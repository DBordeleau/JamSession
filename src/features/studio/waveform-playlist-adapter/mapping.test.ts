import { describe, expect, it } from "vitest";
import { STUDIO_FIXTURE_MANIFEST } from "../manifest/fixtures";
import {
  decibelsToGain,
  editorTracksToManifest,
  gainToDecibels,
  manifestTrackToClipTrack,
  manifestAudioTrackV2ToClipTrack,
  editorAudioTracksToManifestV2,
  millisecondsToSamples,
  samplesToMilliseconds,
} from "./mapping";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import { createWaveformData } from "./persisted-peaks.client";
import { WAVEFORM_PEAKS_BIN_COUNT } from "@/features/assets/waveform-peaks/contract";

const buffer = { length: 96_000, sampleRate: 48_000 } as AudioBuffer;

describe("Waveform Playlist mapping", () => {
  it("converts persistence units deterministically", () => {
    expect(millisecondsToSamples(500, 48_000)).toBe(24_000);
    expect(samplesToMilliseconds(24_000, 48_000)).toBe(500);
    expect(gainToDecibels(decibelsToGain(-6))).toBeCloseTo(-6, 10);
  });

  it("preserves stable Jam Session IDs through an editor round trip", () => {
    const editorTracks = STUDIO_FIXTURE_MANIFEST.tracks.map((track) =>
      manifestTrackToClipTrack(track, buffer),
    );
    expect(editorTracks.map(({ id }) => id)).toEqual([
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000012",
    ]);
    expect(
      editorTracksToManifest(STUDIO_FIXTURE_MANIFEST, editorTracks),
    ).toEqual(STUDIO_FIXTURE_MANIFEST);
  });

  it("maps only the promoted editor mutation", () => {
    const editorTracks = STUDIO_FIXTURE_MANIFEST.tracks.map((track) =>
      manifestTrackToClipTrack(track, buffer),
    );
    editorTracks[0].pan = 0.75;
    const exported = editorTracksToManifest(
      STUDIO_FIXTURE_MANIFEST,
      editorTracks,
    );
    expect(exported.tracks[0]).toEqual({
      ...STUDIO_FIXTURE_MANIFEST.tracks[0],
      pan: 0.75,
    });
    expect(exported.tracks[1]).toEqual(STUDIO_FIXTURE_MANIFEST.tracks[1]);
  });

  it("maps persisted peaks into a placeholder clip without audio authority", () => {
    const waveform = createWaveformData({
      sourceAssetId: STUDIO_FIXTURE_MANIFEST.tracks[0]!.assetId,
      formatVersion: 1,
      algorithmVersion: "pcm-minmax-v1",
      channels: 1,
      durationMs: 2_000,
      sampleRateHz: 44_100,
      binCount: WAVEFORM_PEAKS_BIN_COUNT,
      values: new Int16Array(WAVEFORM_PEAKS_BIN_COUNT * 2),
    });
    const track = manifestTrackToClipTrack(
      STUDIO_FIXTURE_MANIFEST.tracks[0]!,
      undefined,
      waveform,
    );
    expect(track.clips[0]?.audioBuffer).toBeUndefined();
    expect(track.clips[0]?.waveformData).toBe(waveform);
    expect(track.clips[0]?.sampleRate).toBe(44_100);
  });

  it("round-trips every manifest-v2 audio clip without dropping secondary clips", () => {
    const manifest = parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "jam-session-composite",
      engineVersion: "jam-session-composite-2_tone-15.1.22",
      projectId: "00000000-0000-4000-8000-000000000001",
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks: 3_840,
      tracks: [
        {
          kind: "audio",
          trackId: "00000000-0000-4000-8000-000000000011",
          assetId: "00000000-0000-4000-8000-000000000021",
          instrumentId: null,
          name: "Split guitar",
          gainDb: -3,
          pan: 0,
          muted: false,
          soloed: false,
          sortOrder: 0,
          clips: [
            {
              clipId: "00000000-0000-4000-8000-000000000031",
              positionMs: 0,
              trimStartMs: 0,
              durationMs: 500,
            },
            {
              clipId: "00000000-0000-4000-8000-000000000032",
              positionMs: 750,
              trimStartMs: 500,
              durationMs: 500,
            },
          ],
        },
      ],
    });
    const audioTrack = manifest.tracks[0]!;
    if (audioTrack.kind !== "audio") throw new Error("Expected audio fixture");
    const editorTrack = manifestAudioTrackV2ToClipTrack(audioTrack, buffer);

    expect(editorTrack.clips.map(({ id }) => id)).toEqual([
      "00000000-0000-4000-8000-000000000031",
      "00000000-0000-4000-8000-000000000032",
    ]);
    expect(editorAudioTracksToManifestV2(manifest, [editorTrack])).toEqual(
      manifest,
    );
    expect(() =>
      editorAudioTracksToManifestV2(manifest, [
        { ...editorTrack, clips: editorTrack.clips.slice(0, 1) },
      ]),
    ).toThrow(/do not match/);
  });
});
