import { afterEach, describe, expect, it, vi } from "vitest";
import {
  markStudioPerformance,
  studioPerformanceMarks,
} from "./performance-marks.client";

describe("studio performance marks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("records bounded development-only detail without source identities", () => {
    vi.stubEnv("NODE_ENV", "development");
    const mark = vi.spyOn(performance, "mark").mockImplementation(
      () =>
        ({
          name: studioPerformanceMarks.sourceFetchStart,
          entryType: "mark",
          startTime: 0,
          duration: 0,
          detail: null,
          toJSON: () => ({}),
        }) as PerformanceMark,
    );

    markStudioPerformance(studioPerformanceMarks.sourceFetchStart, {
      sourceIndex: 2,
    });

    expect(mark).toHaveBeenCalledWith(studioPerformanceMarks.sourceFetchStart, {
      detail: { sourceIndex: 2 },
    });
  });

  it("does not record marks in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const mark = vi.spyOn(performance, "mark");

    markStudioPerformance(studioPerformanceMarks.playbackReady);

    expect(mark).not.toHaveBeenCalled();
  });
});
