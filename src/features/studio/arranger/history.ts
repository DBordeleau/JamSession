import type { WorkspaceManifestV2 } from "../manifest/v2";

export const ARRANGEMENT_HISTORY_LIMIT = 50;

export type ArrangementHistory = {
  present: WorkspaceManifestV2;
  past: WorkspaceManifestV2[];
  future: WorkspaceManifestV2[];
  group: string | null;
};

export function createArrangementHistory(
  manifest: WorkspaceManifestV2,
): ArrangementHistory {
  return { present: manifest, past: [], future: [], group: null };
}

export function commitArrangementHistory(
  history: ArrangementHistory,
  next: WorkspaceManifestV2,
  group: string | null = null,
): ArrangementHistory {
  if (next === history.present) return history;
  if (group && group === history.group)
    return { ...history, present: next, future: [] };
  return {
    present: next,
    past: [...history.past, history.present].slice(-ARRANGEMENT_HISTORY_LIMIT),
    future: [],
    group,
  };
}

export function undoArrangement(history: ArrangementHistory) {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future].slice(
      0,
      ARRANGEMENT_HISTORY_LIMIT,
    ),
    group: null,
  };
}

export function redoArrangement(history: ArrangementHistory) {
  const next = history.future[0];
  if (!next) return history;
  return {
    present: next,
    past: [...history.past, history.present].slice(-ARRANGEMENT_HISTORY_LIMIT),
    future: history.future.slice(1),
    group: null,
  };
}
