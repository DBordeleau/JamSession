"use client";

import type { SignedAudioSource } from "../source-contract";
import { StudioAdapterError } from "../studio-adapter.types";
import {
  markStudioPerformance,
  studioPerformanceMarks,
} from "./performance-marks.client";

export async function loadSources(input: {
  assetIds: readonly string[];
  sources: readonly SignedAudioSource[];
  refresh: () => Promise<readonly SignedAudioSource[]>;
  decode: (bytes: ArrayBuffer, assetId: string) => Promise<AudioBuffer>;
  signal: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
  concurrency?: number;
}): Promise<Map<string, AudioBuffer>> {
  let sources = new Map(
    input.sources.map((source) => [source.assetId, source]),
  );
  let refreshPromise: Promise<void> | null = null;
  let refreshed = false;
  let cursor = 0;
  let loaded = 0;
  const output = new Map<string, AudioBuffer>();

  const refreshOnce = async () => {
    if (refreshed)
      throw new StudioAdapterError(
        "expired_source",
        "Audio access expired. Retry the studio.",
      );
    refreshPromise ??= input.refresh().then((next) => {
      sources = new Map(next.map((source) => [source.assetId, source]));
      refreshed = true;
    });
    await refreshPromise;
  };
  const fetchOne = async (assetId: string, sourceIndex: number) => {
    let source = sources.get(assetId);
    if (!source)
      throw new StudioAdapterError(
        "missing_source",
        "Revision audio is unavailable.",
      );
    if (Date.parse(source.expiresAt) - Date.now() <= 60_000) {
      await refreshOnce();
      source = sources.get(assetId);
    }
    if (!source)
      throw new StudioAdapterError(
        "missing_source",
        "Revision audio is unavailable.",
      );
    let response: Response;
    try {
      markStudioPerformance(studioPerformanceMarks.sourceFetchStart, {
        sourceIndex,
      });
      response = await fetch(source.signedUrl, {
        signal: input.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (input.signal.aborted)
        throw new StudioAdapterError(
          "cancelled",
          "Studio loading was cancelled.",
        );
      throw new StudioAdapterError(
        "fetch_failed",
        "A source could not be downloaded. Check your connection and retry.",
        { cause: error },
      );
    }
    if (response.status === 401 || response.status === 403) {
      if (sources.get(assetId)?.signedUrl === source.signedUrl)
        await refreshOnce();
      const retry = sources.get(assetId);
      if (!retry)
        throw new StudioAdapterError(
          "missing_source",
          "Revision audio is unavailable.",
        );
      response = await fetch(retry.signedUrl, {
        signal: input.signal,
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403)
        throw new StudioAdapterError(
          "expired_source",
          "Audio access expired. Retry the studio.",
        );
    }
    if (response.status === 404)
      throw new StudioAdapterError(
        "missing_source",
        "Revision audio is unavailable.",
      );
    if (!response.ok)
      throw new StudioAdapterError(
        "fetch_failed",
        "A source could not be downloaded. Retry the studio.",
      );
    try {
      const bytes = await response.arrayBuffer();
      markStudioPerformance(studioPerformanceMarks.sourceFetchEnd, {
        sourceIndex,
      });
      markStudioPerformance(studioPerformanceMarks.sourceDecodeStart, {
        sourceIndex,
      });
      output.set(assetId, await input.decode(bytes, assetId));
      markStudioPerformance(studioPerformanceMarks.sourceDecodeEnd, {
        sourceIndex,
      });
    } catch (error) {
      throw new StudioAdapterError(
        "decode_failed",
        "A track uses audio this browser could not decode.",
        { cause: error },
      );
    }
    loaded += 1;
    input.onProgress?.(loaded, input.assetIds.length);
  };
  const worker = async () => {
    while (true) {
      const index = cursor++;
      const assetId = input.assetIds[index];
      if (!assetId) return;
      await fetchOne(assetId, index);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(input.concurrency ?? 3, input.assetIds.length) },
      worker,
    ),
  );
  return output;
}
