import { describe, expect, it } from "vitest";
import { decodeNavigationCursor, encodeNavigationCursor } from "./cursor";

describe("navigation cursor", () => {
  it("round trips a bound keyset cursor", () => {
    const cursor = {
      v: 1 as const,
      kind: "projects" as const,
      subject: "e0000000-0000-4000-8000-000000000001",
      filter: "owned:all",
      timestamp: "2026-07-13T22:00:00.000Z",
      id: "e1000000-0000-4000-8000-000000000001",
    };
    expect(decodeNavigationCursor(encodeNavigationCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects malformed and oversized input", () => {
    expect(decodeNavigationCursor("not-json")).toBeNull();
    expect(decodeNavigationCursor("a".repeat(513))).toBeNull();
  });
});
