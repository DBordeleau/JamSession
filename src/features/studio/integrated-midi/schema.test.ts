import { describe, expect, it } from "vitest";
import {
  createIntegratedMidiDraftSchema,
  finalizeIntegratedMidiDraftSchema,
} from "./schema";

const uuid = (suffix: number) =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

describe("integrated MIDI Studio command schemas", () => {
  it("accepts blank and exact-version draft requests", () => {
    expect(
      createIntegratedMidiDraftSchema.safeParse({
        requestId: uuid(1),
        name: "Project keys",
        parentStemVersionId: null,
      }).success,
    ).toBe(true);
    expect(
      createIntegratedMidiDraftSchema.safeParse({
        requestId: uuid(2),
        name: "Project keys variation",
        parentStemVersionId: uuid(3),
      }).success,
    ).toBe(true);
  });

  it("binds add starts and replacement targets to distinct operations", () => {
    const base = {
      projectId: uuid(6),
      draftId: uuid(1),
      requestId: uuid(2),
      expectedDraftLockVersion: 2,
      expectedContentSha256: "a".repeat(64),
      workspaceId: uuid(3),
      expectedWorkspaceLockVersion: 4,
      trackId: uuid(4),
      clipId: uuid(5),
    };
    expect(
      finalizeIntegratedMidiDraftSchema.safeParse({
        ...base,
        operation: "add",
        startTick: 480,
      }).success,
    ).toBe(true);
    expect(
      finalizeIntegratedMidiDraftSchema.safeParse({
        ...base,
        operation: "replace",
        startTick: null,
      }).success,
    ).toBe(true);
    expect(
      finalizeIntegratedMidiDraftSchema.safeParse({
        ...base,
        operation: "replace",
        startTick: 480,
      }).success,
    ).toBe(false);
  });
});
