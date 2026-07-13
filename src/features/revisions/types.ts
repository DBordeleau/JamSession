export type PublishAssetOption = {
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  durationMs: number;
  sampleRateHz: number;
  channels: number;
  creditName: string;
};
export type InstrumentOption = { id: string; name: string };
export type RevisionPlaybackTrack = {
  trackId: string;
  assetId: string;
  displayName: string;
  verifiedDurationMs: number;
  instrumentName: string | null;
  creditName: string;
};
export type RevisionTrack = {
  id: string;
  assetId: string;
  instrumentName: string | null;
  name: string;
  durationMs: number;
  sortOrder: number;
  creditName: string;
};
export type RevisionSummary = {
  id: string;
  revisionNumber: number;
  message: string | null;
  durationMs: number;
  createdAt: string;
  authorName: string;
  tracks: RevisionTrack[];
};
