import { describe, expect, it } from "vitest";
import {
  SOURCE_ADMISSION_UNAVAILABLE_MESSAGE,
  sourceReservationErrorMessage,
} from "./source-admission";

describe("source admission copy", () => {
  it("maps the bounded database denial without pricing or entitlement language", () => {
    const message = sourceReservationErrorMessage("audio_uploads_unavailable");
    expect(message).toBe(SOURCE_ADMISSION_UNAVAILABLE_MESSAGE);
    expect(message).not.toMatch(/price|plan|premium|upgrade/i);
  });

  it("preserves existing actionable reservation errors", () => {
    expect(sourceReservationErrorMessage("asset_user_quota_exceeded")).toBe(
      "asset_user_quota_exceeded",
    );
    expect(sourceReservationErrorMessage(undefined)).toBe(
      "Could not reserve storage.",
    );
  });
});
