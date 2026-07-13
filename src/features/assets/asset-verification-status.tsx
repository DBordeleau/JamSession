"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { retryVerification } from "./actions";
import {
  sourceVerificationFailureMessage,
  type AssetVerificationStatus as VerificationStatus,
} from "./types";

const pollingTerminalStates = new Set(["dead", "ready", "failed"]);
const refreshTerminalStates = new Set(["ready", "failed"]);

function statusMessage(status: VerificationStatus) {
  switch (status.verificationState) {
    case "verifying":
      return "Verifying format and audio details…";
    case "retrying":
      return "Verification was interrupted. Retrying automatically…";
    case "delayed":
      return "Verification is taking longer than usual. You can leave this page; your upload is safe.";
    case "dead":
      return "We couldn’t finish verification. Retry without uploading again.";
    case "ready":
      return `Ready to use. ${status.mediaType} · ${status.byteSize?.toLocaleString()} bytes · ${status.durationMs} ms · ${status.sampleRateHz} Hz · ${status.channels} ch`;
    case "failed":
      return sourceVerificationFailureMessage(status.failureCode);
    default:
      return "Upload complete. Starting audio verification…";
  }
}

export function AssetVerificationStatus({
  assetId,
  initialState = "queued",
}: {
  assetId: string;
  initialState?: VerificationStatus["verificationState"];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>({
    assetStatus: "processing",
    verificationState: initialState,
    attemptCount: 0,
    nextAttemptAt: null,
    failureCode: null,
    mediaType: null,
    byteSize: null,
    durationMs: null,
    sampleRateHz: null,
    channels: null,
  });
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const terminalRefresh = useRef(false);

  useEffect(() => {
    if (pollingTerminalStates.has(status.verificationState)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;
      if (document.hidden || !navigator.onLine) {
        return;
      }
      try {
        const response = await fetch(`/api/assets/${assetId}/verification`, {
          cache: "no-store",
        });
        if (response.ok) {
          const next = (await response.json()) as VerificationStatus;
          setStatus(next);
          if (
            refreshTerminalStates.has(next.verificationState) &&
            !terminalRefresh.current
          ) {
            terminalRefresh.current = true;
            router.refresh();
            return;
          }
        }
      } catch {
        // A later bounded poll or page reload recovers transient status failures.
      }
      if (Date.now() - startedAt >= 120_000) return;
      const delays = [1_500, 2_000, 3_000];
      const base = delays[polls] ?? 5_000;
      polls += 1;
      timer = setTimeout(poll, Math.min(base + Math.random() * 500, 5_000));
    };

    const resume = () => {
      if (!document.hidden && navigator.onLine) void poll();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [assetId, router, status.verificationState]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    const result = await retryVerification(assetId);
    setRetrying(false);
    if (result.error) {
      setRetryError(
        "Could not restart verification. Please try again shortly.",
      );
      return;
    }
    terminalRefresh.current = false;
    setStatus((current) => ({
      ...current,
      verificationState: result.kickDelayed ? "delayed" : "queued",
      attemptCount: 0,
    }));
  }

  return (
    <div className="mt-1 text-sm text-zinc-400">
      <p
        aria-live="polite"
        role={status.verificationState === "failed" ? "alert" : undefined}
      >
        {statusMessage(status)}
      </p>
      {status.verificationState === "dead" && (
        <button
          className="mt-2 rounded-lg border border-white/20 px-3 py-2 text-white disabled:opacity-50"
          type="button"
          disabled={retrying}
          onClick={() => void retry()}
        >
          {retrying ? "Restarting…" : "Retry verification"}
        </button>
      )}
      {retryError && <p className="mt-2 text-red-300">{retryError}</p>}
    </div>
  );
}
