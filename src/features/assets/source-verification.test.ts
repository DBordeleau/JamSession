import { describe, expect, it } from "vitest";

import {
  detectSourceAudioSignature,
  PermanentVerificationError,
  sha256Hex,
  validateSourceAudioMetadata,
} from "../../../supabase/functions/_shared/source-verification";

describe("trusted source verification policy", () => {
  it.each([
    [new TextEncoder().encode("RIFF0000WAVE"), "audio/wav"],
    [new TextEncoder().encode("fLaC"), "audio/flac"],
    [new TextEncoder().encode("ID3"), "audio/mpeg"],
    [new Uint8Array([0xff, 0xfb]), "audio/mpeg"],
  ] as const)("detects supported byte signatures", (bytes, expected) => {
    expect(detectSourceAudioSignature(bytes)).toBe(expected);
  });

  it("rejects a container that disagrees with the byte signature", () => {
    expect(() =>
      validateSourceAudioMetadata({
        signatureMediaType: "audio/wav",
        container: "FLAC",
        durationSeconds: 1,
        sampleRateHz: 44_100,
        channels: 2,
      }),
    ).toThrowError(new PermanentVerificationError("unsupported_format"));
  });

  it("normalizes trusted metadata", () => {
    expect(
      validateSourceAudioMetadata({
        signatureMediaType: "audio/mpeg",
        container: "MPEG",
        durationSeconds: 1.2344,
        sampleRateHz: 48_000,
        channels: 2,
      }),
    ).toEqual({
      mediaType: "audio/mpeg",
      durationMs: 1234,
      sampleRateHz: 48_000,
      channels: 2,
    });
  });

  it("enforces duration, rate, and channel bounds", () => {
    for (const input of [
      { durationSeconds: 601, sampleRateHz: 44_100, channels: 2 },
      { durationSeconds: 1, sampleRateHz: 4000, channels: 2 },
      { durationSeconds: 1, sampleRateHz: 44_100, channels: 9 },
    ]) {
      expect(() =>
        validateSourceAudioMetadata({
          signatureMediaType: "audio/flac",
          container: "FLAC",
          ...input,
        }),
      ).toThrow(PermanentVerificationError);
    }
  });

  it("computes a complete SHA-256 digest", async () => {
    await expect(
      sha256Hex(new TextEncoder().encode("abc").buffer),
    ).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
