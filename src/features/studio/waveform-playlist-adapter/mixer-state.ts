export function hasAlignedMixerState(input: {
  trackIds: readonly string[];
  trackStateCount: number;
  persistedTrackIds: readonly string[];
}) {
  if (
    input.trackIds.length === 0 ||
    input.trackStateCount !== input.trackIds.length
  ) {
    return false;
  }
  const persisted = new Set(input.persistedTrackIds);
  return input.trackIds.every((trackId) => persisted.has(trackId));
}
