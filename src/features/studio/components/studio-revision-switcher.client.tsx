"use client";

import { useStudioNavigation } from "./studio-shell.client";

export function StudioRevisionSwitcher({
  projectId,
  revisionId,
  revisionNumber,
  selected,
  staleDraft,
}: {
  projectId: string;
  revisionId: string;
  revisionNumber: number;
  selected: "draft" | "revision";
  staleDraft: boolean;
}) {
  const { requestNavigation, switching } = useStudioNavigation();
  const draftUrl = `/studio/${projectId}`;
  const revisionUrl = `${draftUrl}?revision=${revisionId}`;

  function navigate(target: string) {
    if (requestNavigation) requestNavigation(target);
    else window.location.assign(target);
  }

  return (
    <aside
      className={`rounded-card border px-4 py-3 ${staleDraft ? "border-accent bg-surface-raised" : "border-subtle bg-surface"}`}
      aria-label="Studio project source"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {selected === "revision"
              ? `Viewing immutable revision ${revisionNumber}`
              : staleDraft
                ? `Your draft predates revision ${revisionNumber}`
                : `Editing a draft based on revision ${revisionNumber}`}
          </p>
          <p className="text-muted mt-0.5 text-xs">
            {selected === "revision"
              ? "This read-only view includes the accepted arrangement. Your editable draft is preserved."
              : staleDraft
                ? "The latest revision includes accepted changes. Switch views without replacing your private draft."
                : "Switch to the published revision without changing this private draft."}
          </p>
        </div>
        <div
          className="border-strong rounded-control flex border p-1"
          role="group"
          aria-label="Choose Studio source"
        >
          <button
            type="button"
            aria-pressed={selected === "draft"}
            disabled={switching || selected === "draft"}
            onClick={() => navigate(draftUrl)}
            className="aria-pressed:bg-surface-raised rounded-control min-h-9 px-3 text-xs font-semibold disabled:cursor-default disabled:opacity-70"
          >
            Editable draft
          </button>
          <button
            type="button"
            aria-pressed={selected === "revision"}
            disabled={switching || selected === "revision"}
            onClick={() => navigate(revisionUrl)}
            className="aria-pressed:bg-surface-raised rounded-control min-h-9 px-3 text-xs font-semibold disabled:cursor-default disabled:opacity-70"
          >
            Revision {revisionNumber} (latest)
          </button>
        </div>
      </div>
    </aside>
  );
}
