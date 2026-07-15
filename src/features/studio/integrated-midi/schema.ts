import { z } from "zod";

export const createIntegratedMidiDraftSchema = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    parentStemVersionId: z.uuid().nullable(),
  })
  .strict();

export const finalizeIntegratedMidiDraftSchema = z
  .object({
    projectId: z.uuid(),
    draftId: z.uuid(),
    requestId: z.uuid(),
    expectedDraftLockVersion: z.number().int().positive(),
    expectedContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
    workspaceId: z.uuid(),
    expectedWorkspaceLockVersion: z.number().int().positive(),
    operation: z.enum(["add", "replace"]),
    trackId: z.uuid(),
    clipId: z.uuid(),
    startTick: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .refine(
    ({ operation, startTick }) =>
      operation === "add" ? startTick !== null : startTick === null,
    { message: "Only a new clip requires an arrangement start." },
  );
