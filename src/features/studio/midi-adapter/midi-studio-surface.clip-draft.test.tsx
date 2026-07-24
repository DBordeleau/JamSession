import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegratedMidiComposer } from "../integrated-midi/integrated-midi-composer.client";
import {
  V3_IDS,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
  V3_PATTERN_VERSION_2,
} from "../manifest/v3.fixtures";
import { freezeStudioPatternAction } from "../integrated-midi/actions";
import {
  publishMidiWorkspaceV3Action,
  saveMidiWorkspaceV3Action,
} from "@/features/workspaces/actions";
import { MidiStudioSurface } from "./midi-studio-surface.client";

const composer = vi.hoisted(() => ({
  props: null as Parameters<typeof IntegratedMidiComposer>[0] | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../integrated-midi/integrated-midi-composer.client", () => ({
  IntegratedMidiComposer: (
    props: Parameters<typeof IntegratedMidiComposer>[0],
  ) => {
    composer.props = props;
    return <div>Integrated draft test double</div>;
  },
}));

vi.mock("../integrated-midi/actions", () => ({
  freezeStudioPatternAction: vi.fn(),
}));

vi.mock("@/features/workspaces/actions", () => ({
  saveMidiWorkspaceV3Action: vi.fn(),
  publishMidiWorkspaceV3Action: vi.fn(),
}));

vi.mock("../clip-collection/studio-clip-drawer.client", () => ({
  StudioClipDrawer: () => null,
}));

vi.mock("./browser-midi-runtime.client", () => ({
  BrowserMidiRuntime: class {
    prepare = vi.fn().mockResolvedValue(undefined);
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    dispose = vi.fn();
    getTransportSnapshot = vi.fn().mockReturnValue({
      positionSeconds: 0,
      state: "paused",
    });
  },
}));

const surfaceProps = {
  mode: "workspace" as const,
  viewerId: V3_IDS.creator,
  projectId: V3_IDS.project,
  projectTitle: "Device draft session",
  workspaceId: V3_IDS.workspace,
  baseRevisionId: null,
  currentRevisionId: null,
  currentRevisionNumber: null,
  lockVersion: 7,
  manifestSha256: "a".repeat(64),
  updatedAt: "2026-07-24T12:00:00.000Z",
  staleDraft: null,
  initialEditorClipId: V3_IDS.clipA,
  manifest: { ...V3_MANIFEST_BEFORE, workspaceId: V3_IDS.workspace },
  durationMs: 4_000,
  tracks: V3_MANIFEST_BEFORE.tracks.map((track) => ({
    trackId: track.trackId,
    instrumentName: track.presetId,
    creditName: "Loop Maker",
  })),
  patternVersions: [
    {
      ...V3_PATTERN_VERSION_1,
      name: "Warm keys",
      presetId: "warm-keys",
      presetVersion: 1 as const,
    },
  ],
};

beforeEach(() => {
  composer.props = null;
  vi.clearAllMocks();
  vi.mocked(saveMidiWorkspaceV3Action).mockResolvedValue({
    ok: true,
    lockVersion: 8,
    manifestSha256: "8".repeat(64),
    updatedAt: "2026-07-24T12:01:00.000Z",
  });
  vi.mocked(publishMidiWorkspaceV3Action).mockResolvedValue({
    ok: false,
    code: "unavailable",
  });
  vi.mocked(freezeStudioPatternAction).mockResolvedValue({
    ok: true,
    version: V3_PATTERN_VERSION_2,
  });
});

afterEach(cleanup);

describe("MidiStudioSurface deliberate pattern versions", () => {
  it("reuses identical MIDI while applying track name and preset changes", async () => {
    render(<MidiStudioSurface {...surfaceProps} />);
    await screen.findByText("Integrated draft test double");

    const result = await composer.props!.onFinalize(
      {
        draftId: crypto.randomUUID(),
        expectedLockVersion: 2,
        expectedContentSha256: V3_PATTERN_VERSION_1.contentSha256,
        patternRequestId: null,
        versionRequestId: null,
        appliedTrackId: V3_IDS.trackA,
        appliedClipId: V3_IDS.clipA,
        content: {
          name: "Renamed lead",
          presetId: "warm-keys",
          presetVersion: 1,
          ppq: 480,
          durationTicks: V3_PATTERN_VERSION_1.durationTicks,
          notes: V3_PATTERN_VERSION_1.notes,
        },
      },
      composer.props!.target,
    );

    expect(result).toEqual({
      ok: true,
      message:
        "The exact pattern version was reused and the track settings were applied.",
    });
    expect(freezeStudioPatternAction).not.toHaveBeenCalled();
    expect(saveMidiWorkspaceV3Action).toHaveBeenCalledOnce();
    expect(saveMidiWorkspaceV3Action).toHaveBeenCalledWith(
      expect.objectContaining({
        manifest: expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({
              trackId: V3_IDS.trackA,
              name: "Renamed lead",
              presetId: "warm-keys",
              clips: [
                expect.objectContaining({
                  midiPatternVersionId: V3_IDS.patternVersion1,
                }),
              ],
            }),
          ]),
        }),
      }),
    );
  });

  it("freezes changed MIDI exactly once with the supplied stable intent", async () => {
    render(<MidiStudioSurface {...surfaceProps} />);
    await screen.findByText("Integrated draft test double");
    const patternRequestId = crypto.randomUUID();
    const versionRequestId = crypto.randomUUID();

    const result = await composer.props!.onFinalize(
      {
        draftId: crypto.randomUUID(),
        expectedLockVersion: 2,
        expectedContentSha256: "9".repeat(64),
        patternRequestId,
        versionRequestId,
        appliedTrackId: V3_IDS.trackA,
        appliedClipId: V3_IDS.clipA,
        content: {
          name: "Changed lead",
          presetId: "soft-lead",
          presetVersion: 1,
          ppq: 480,
          durationTicks: V3_PATTERN_VERSION_2.durationTicks,
          notes: V3_PATTERN_VERSION_2.notes,
        },
      },
      composer.props!.target,
    );

    expect(result.ok).toBe(true);
    expect(freezeStudioPatternAction).toHaveBeenCalledOnce();
    expect(freezeStudioPatternAction).toHaveBeenCalledWith(
      expect.objectContaining({ patternRequestId, versionRequestId }),
    );
    expect(saveMidiWorkspaceV3Action).toHaveBeenCalledOnce();
  });

  it("keeps the editor open when canonical workspace save fails", async () => {
    vi.mocked(saveMidiWorkspaceV3Action).mockResolvedValueOnce({
      ok: false,
      code: "unavailable",
    });
    render(<MidiStudioSurface {...surfaceProps} />);
    await screen.findByText("Integrated draft test double");

    const result = await composer.props!.onFinalize(
      {
        draftId: crypto.randomUUID(),
        expectedLockVersion: 2,
        expectedContentSha256: "9".repeat(64),
        patternRequestId: crypto.randomUUID(),
        versionRequestId: crypto.randomUUID(),
        appliedTrackId: V3_IDS.trackA,
        appliedClipId: V3_IDS.clipA,
        content: {
          name: "Changed lead",
          presetId: "soft-lead",
          presetVersion: 1,
          ppq: 480,
          durationTicks: V3_PATTERN_VERSION_2.durationTicks,
          notes: V3_PATTERN_VERSION_2.notes,
        },
      },
      composer.props!.target,
    );

    expect(result).toMatchObject({ ok: false });
    expect(
      screen.getByText("Integrated draft test double"),
    ).toBeInTheDocument();
    expect(freezeStudioPatternAction).toHaveBeenCalledOnce();
  });
});
