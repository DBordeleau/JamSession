import type { ClipTrack, WaveformDataObject } from "@waveform-playlist/core";
import type { WorkspaceManifestV1, WorkspaceTrackV1 } from "../manifest/schema";
import {
  parseWorkspaceManifestV2,
  type AudioTrackV2,
  type WorkspaceManifestV2,
} from "../manifest/v2";

export const millisecondsToSamples = (
  milliseconds: number,
  sampleRate: number,
) => Math.round((milliseconds / 1000) * sampleRate);
export const samplesToMilliseconds = (samples: number, sampleRate: number) =>
  Math.round((samples / sampleRate) * 1000);
export const decibelsToGain = (decibels: number) => Math.pow(10, decibels / 20);
export const gainToDecibels = (gain: number) => 20 * Math.log10(gain);

export function manifestTrackToClipTrack(
  track: WorkspaceTrackV1,
  audioBuffer?: AudioBuffer,
  waveformData?: WaveformDataObject,
): ClipTrack {
  const sampleRate =
    audioBuffer?.sampleRate ?? waveformData?.sample_rate ?? 48_000;
  const sourceDurationSamples =
    audioBuffer?.length ??
    (waveformData
      ? Math.round(waveformData.duration * waveformData.sample_rate)
      : undefined) ??
    millisecondsToSamples(track.trimStartMs + track.durationMs, sampleRate);
  return {
    id: track.trackId,
    name: track.name,
    muted: track.muted,
    soloed: track.soloed,
    volume: decibelsToGain(track.gainDb),
    pan: track.pan,
    clips: [
      {
        id: `${track.trackId}:${track.assetId}`,
        ...(audioBuffer ? { audioBuffer } : {}),
        ...(!audioBuffer && waveformData ? { waveformData } : {}),
        startSample: millisecondsToSamples(track.positionMs, sampleRate),
        durationSamples: millisecondsToSamples(track.durationMs, sampleRate),
        offsetSamples: millisecondsToSamples(track.trimStartMs, sampleRate),
        sourceDurationSamples,
        sampleRate,
        gain: 1,
        name: track.name,
      },
    ],
  };
}

export function editorTracksToManifest(
  base: WorkspaceManifestV1,
  tracks: readonly ClipTrack[],
): WorkspaceManifestV1 {
  return {
    ...base,
    tracks: tracks.map((track, sortOrder) => {
      const persisted = base.tracks.find(({ trackId }) => trackId === track.id);
      const clip = track.clips[0];
      if (!persisted || !clip)
        throw new Error(`Unknown editor track ${track.id}`);
      return {
        ...persisted,
        name: track.name,
        positionMs: samplesToMilliseconds(clip.startSample, clip.sampleRate),
        trimStartMs: samplesToMilliseconds(clip.offsetSamples, clip.sampleRate),
        durationMs: samplesToMilliseconds(
          clip.durationSamples,
          clip.sampleRate,
        ),
        gainDb: Number(gainToDecibels(track.volume).toFixed(3)),
        pan: track.pan,
        muted: track.muted,
        soloed: track.soloed,
        sortOrder,
      };
    }),
  };
}

export function manifestAudioTrackV2ToClipTrack(
  track: AudioTrackV2,
  audioBuffer?: AudioBuffer,
  waveformData?: WaveformDataObject,
): ClipTrack {
  const sampleRate =
    audioBuffer?.sampleRate ?? waveformData?.sample_rate ?? 48_000;
  const sourceDurationSamples =
    audioBuffer?.length ??
    (waveformData
      ? Math.round(waveformData.duration * waveformData.sample_rate)
      : undefined) ??
    Math.max(
      ...track.clips.map((clip) =>
        millisecondsToSamples(clip.trimStartMs + clip.durationMs, sampleRate),
      ),
    );
  return {
    id: track.trackId,
    name: track.name,
    muted: track.muted,
    soloed: track.soloed,
    volume: decibelsToGain(track.gainDb),
    pan: track.pan,
    clips: track.clips.map((clip) => ({
      id: clip.clipId,
      ...(audioBuffer ? { audioBuffer } : {}),
      ...(!audioBuffer && waveformData ? { waveformData } : {}),
      startSample: millisecondsToSamples(clip.positionMs, sampleRate),
      durationSamples: millisecondsToSamples(clip.durationMs, sampleRate),
      offsetSamples: millisecondsToSamples(clip.trimStartMs, sampleRate),
      sourceDurationSamples,
      sampleRate,
      gain: 1,
      name: track.name,
    })),
  };
}

export function editorAudioTracksToManifestV2(
  base: WorkspaceManifestV2,
  tracks: readonly ClipTrack[],
): WorkspaceManifestV2 {
  const editorById = new Map(tracks.map((track) => [track.id, track]));
  return parseWorkspaceManifestV2({
    ...base,
    tracks: base.tracks.map((persisted) => {
      if (persisted.kind !== "audio") return persisted;
      const editor = editorById.get(persisted.trackId);
      if (!editor) throw new Error(`Missing editor track ${persisted.trackId}`);
      const persistedIds = new Set(persisted.clips.map(({ clipId }) => clipId));
      if (
        editor.clips.length !== persistedIds.size ||
        editor.clips.some((clip) => !persistedIds.has(clip.id))
      )
        throw new Error(
          `Editor clips do not match manifest track ${persisted.trackId}`,
        );
      return {
        ...persisted,
        name: editor.name,
        gainDb: Number(gainToDecibels(editor.volume).toFixed(3)),
        pan: editor.pan,
        muted: editor.muted,
        soloed: editor.soloed,
        clips: editor.clips.map((clip) => ({
          clipId: clip.id,
          positionMs: samplesToMilliseconds(clip.startSample, clip.sampleRate),
          trimStartMs: samplesToMilliseconds(
            clip.offsetSamples,
            clip.sampleRate,
          ),
          durationMs: samplesToMilliseconds(
            clip.durationSamples,
            clip.sampleRate,
          ),
        })),
      };
    }),
  });
}
