import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MidiStemDraft } from "./types";
import { MidiStemEditor } from "./stem-editor.client";

const performanceMock = vi.hoisted(() => ({
  status: "idle" as const,
  countIn: true,
  setCountIn: vi.fn(),
  metronome: true,
  setMetronome: vi.fn(),
  octave: 4,
  setOctave: vi.fn(),
  defaultVelocity: 96,
  setDefaultVelocity: vi.fn(),
  playheadTick: 0,
  webMidiStatus: "ready" as const,
  hardwareInputCount: 0,
  activePitches: new Set([60]) as ReadonlySet<number>,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  requestWebMidi: vi.fn(),
  releaseActive: vi.fn(),
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  previewOn: vi.fn(() => true),
  previewOff: vi.fn(),
  previewNote: vi.fn(),
  keyDown: vi.fn(() => false),
  keyUp: vi.fn(() => false),
}));

vi.mock("./use-midi-performance.client", () => ({
  useMidiPerformance: () => performanceMock,
}));

vi.mock("./actions", () => ({
  publishMidiStemVersionAction: vi.fn(),
  saveMidiStemDraftAction: vi.fn(),
}));

const draft: MidiStemDraft = {
  draftId: "00000000-0000-4000-8000-000000000001",
  stemId: "00000000-0000-4000-8000-000000000002",
  ownerId: "00000000-0000-4000-8000-000000000003",
  entryMode: "blank",
  parentStemVersionId: null,
  name: "Piano feel",
  defaultPresetId: "warm-poly",
  defaultPresetVersion: 1,
  ppq: 480,
  durationTicks: 1_920,
  notes: [],
  noteCount: 0,
  contentSha256: "a".repeat(64),
  lockVersion: 1,
  createdAt: "2026-07-15T12:00:00.000Z",
  updatedAt: "2026-07-15T12:00:00.000Z",
};

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({
    left: 0,
    top: 0,
    right: 900,
    bottom: 430,
    width: 900,
    height: 430,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  Object.defineProperties(HTMLCanvasElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
    releasePointerCapture: { configurable: true, value: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  performanceMock.previewOn.mockClear();
  performanceMock.previewOff.mockClear();
});

describe("MIDI editor piano interaction", () => {
  it("exposes active performance keys with aria-pressed", () => {
    render(<MidiStemEditor draft={draft} />);

    expect(
      screen.getByRole("button", { name: "Play C4, MIDI note 60" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Play C♯4, MIDI note 61" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("previews crossed gutter pitches once and releases on pointer up", () => {
    render(<MidiStemEditor draft={draft} />);
    const roll = screen.getByTestId("midi-piano-roll");

    fireEvent.pointerDown(roll, {
      button: 0,
      pointerId: 7,
      clientX: 20,
      clientY: 10,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 7,
      clientX: 20,
      clientY: 32,
    });
    fireEvent.pointerMove(roll, {
      pointerId: 7,
      clientX: 20,
      clientY: 32,
    });
    fireEvent.pointerUp(roll, { pointerId: 7, clientX: 20, clientY: 32 });

    expect(performanceMock.previewOn.mock.calls).toEqual([
      [96, 96, "piano-gutter:7"],
      [95, 96, "piano-gutter:7"],
    ]);
    expect(performanceMock.previewOff).toHaveBeenCalledOnce();
    expect(performanceMock.previewOff).toHaveBeenCalledWith("piano-gutter:7");
  });
});
