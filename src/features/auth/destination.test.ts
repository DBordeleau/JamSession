import { describe, expect, it } from "vitest";
import { getViewerEntryPath } from "./destination";

describe("getViewerEntryPath", () => {
  it("sends completed active viewers to the dashboard", () => {
    expect(
      getViewerEntryPath({
        status: "active",
        profileCompletedAt: "2026-07-21T20:00:00.000Z",
      }),
    ).toBe("/dashboard");
  });

  it("keeps incomplete active viewers in onboarding", () => {
    expect(
      getViewerEntryPath({ status: "active", profileCompletedAt: null }),
    ).toBe("/onboarding");
  });

  it.each(["suspended", "deleted"] as const)(
    "keeps %s viewers outside the active application",
    (status) => {
      expect(
        getViewerEntryPath({
          status,
          profileCompletedAt: "2026-07-21T20:00:00.000Z",
        }),
      ).toBe("/account-unavailable");
    },
  );
});
