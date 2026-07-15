"use server";

import { revalidatePath } from "next/cache";
import { createImportedMidiStemSchema } from "@/features/midi/stems/schema";
import {
  createImportedMidiStemDraft,
  createMidiStemDraft,
  getMidiStemDraft,
  getMidiStemVersion,
} from "@/server/repositories/midi-stems";
import { finalizeStudioMidiDraft } from "@/server/repositories/workspaces";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import {
  createIntegratedMidiDraftSchema,
  finalizeIntegratedMidiDraftSchema,
} from "./schema";

export async function createIntegratedMidiDraftAction(input: unknown) {
  const parsed = createIntegratedMidiDraftSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await createMidiStemDraft({
    requestId: parsed.data.requestId,
    name: parsed.data.name,
    entryMode: parsed.data.parentStemVersionId ? "derive" : "blank",
    parentStemVersionId: parsed.data.parentStemVersionId,
  });
  const created = data?.[0];
  if (error || !created)
    return {
      ok: false as const,
      code:
        error?.message === "midi_stem_parent_not_found"
          ? ("parent_unavailable" as const)
          : error?.message === "midi_stem_limit_reached"
            ? ("limit" as const)
            : ("unavailable" as const),
    };
  const draft = await getMidiStemDraft(created.stem_id);
  return draft
    ? { ok: true as const, draft }
    : { ok: false as const, code: "unavailable" as const };
}

export async function createIntegratedImportedMidiDraftAction(input: unknown) {
  const parsed = createImportedMidiStemSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await createImportedMidiStemDraft(parsed.data);
  const created = data?.[0];
  if (error || !created)
    return { ok: false as const, code: "unavailable" as const };
  const draft = await getMidiStemDraft(created.stem_id);
  return draft
    ? { ok: true as const, draft }
    : { ok: false as const, code: "unavailable" as const };
}

export async function finalizeIntegratedMidiDraftAction(input: unknown) {
  const parsed = finalizeIntegratedMidiDraftSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await finalizeStudioMidiDraft(parsed.data);
  const applied = data?.[0];
  if (error || !applied)
    return {
      ok: false as const,
      code:
        error?.message === "workspace_save_conflict"
          ? ("workspace_conflict" as const)
          : error?.message === "midi_stem_publish_conflict"
            ? ("draft_conflict" as const)
            : error?.message === "studio_midi_target_not_found"
              ? ("target_missing" as const)
              : error?.code === "PT404"
                ? ("not_found" as const)
                : ("unavailable" as const),
    };
  const version = await getMidiStemVersion(applied.stem_version_id);
  if (!version) return { ok: false as const, code: "unavailable" as const };
  revalidatePath(`/studio/${parsed.data.projectId}`);
  revalidatePath("/stems");
  return {
    ok: true as const,
    version,
    manifest: parseWorkspaceManifestV2(applied.workspace_manifest),
    workspaceLockVersion: applied.workspace_lock_version,
    manifestSha256: applied.workspace_manifest_sha256,
    workspaceUpdatedAt: applied.workspace_updated_at,
  };
}
