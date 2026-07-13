import { describe, expect, it, vi } from "vitest";
import { loadSources } from "./source-loader.client";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];
const signed = (suffix = "initial") =>
  ids.map((assetId) => ({
    assetId,
    signedUrl: `https://example.test/${suffix}/${assetId}`,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  }));

describe("loadSources", () => {
  it("limits source work to three and reports atomic progress", async () => {
    let active = 0;
    let maximum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active -= 1;
        return new Response(new Uint8Array([1]));
      }),
    );
    const progress = vi.fn();
    const result = await loadSources({
      assetIds: ids,
      sources: signed(),
      refresh: async () => signed("refresh"),
      decode: async () => ({}) as AudioBuffer,
      signal: new AbortController().signal,
      onProgress: progress,
    });
    expect(maximum).toBeLessThanOrEqual(3);
    expect(result.size).toBe(4);
    expect(progress).toHaveBeenLastCalledWith(4, 4);
    vi.unstubAllGlobals();
  });

  it("deduplicates one refresh for concurrent authorization failures", async () => {
    const refresh = vi.fn(async () => signed("refresh"));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string | URL | Request) =>
          new Response(new Uint8Array([1]), {
            status: String(url).includes("initial") ? 403 : 200,
          }),
      ),
    );
    await loadSources({
      assetIds: ids,
      sources: signed(),
      refresh,
      decode: async () => ({}) as AudioBuffer,
      signal: new AbortController().signal,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
