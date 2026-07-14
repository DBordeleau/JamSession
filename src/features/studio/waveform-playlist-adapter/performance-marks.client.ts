"use client";

export const studioPerformanceMarks = {
  routeStart: "jam-session:studio:route-start",
  adapterMounted: "jam-session:studio:adapter-mounted",
  shellReady: "jam-session:studio:shell-ready",
  sourceFetchStart: "jam-session:studio:source-fetch-start",
  sourceFetchEnd: "jam-session:studio:source-fetch-end",
  sourceDecodeStart: "jam-session:studio:source-decode-start",
  sourceDecodeEnd: "jam-session:studio:source-decode-end",
  peaksReady: "jam-session:studio:peaks-ready",
  playbackReady: "jam-session:studio:playback-ready",
} as const;

type StudioPerformanceMark =
  (typeof studioPerformanceMarks)[keyof typeof studioPerformanceMarks];

export function markStudioPerformance(
  name: StudioPerformanceMark,
  detail?: Readonly<Record<string, number | string>>,
) {
  if (
    process.env.NODE_ENV !== "development" ||
    typeof performance === "undefined" ||
    typeof performance.mark !== "function"
  )
    return;

  performance.mark(name, detail ? { detail } : undefined);
}
