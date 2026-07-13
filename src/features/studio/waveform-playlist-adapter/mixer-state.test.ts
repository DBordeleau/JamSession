import { describe, expect, it } from "vitest";

import { hasAlignedMixerState } from "./mixer-state";

describe("mixer state readiness", () => {
  it("waits while Waveform Playlist initializes track state", () => {
    expect(
      hasAlignedMixerState({
        trackIds: ["track-1"],
        trackStateCount: 0,
        persistedTrackIds: ["track-1"],
      }),
    ).toBe(false);
  });

  it("rejects a track without matching persisted state", () => {
    expect(
      hasAlignedMixerState({
        trackIds: ["track-1"],
        trackStateCount: 1,
        persistedTrackIds: ["different-track"],
      }),
    ).toBe(false);
  });

  it("accepts aligned provider and manifest tracks", () => {
    expect(
      hasAlignedMixerState({
        trackIds: ["track-1", "track-2"],
        trackStateCount: 2,
        persistedTrackIds: ["track-1", "track-2"],
      }),
    ).toBe(true);
  });
});
