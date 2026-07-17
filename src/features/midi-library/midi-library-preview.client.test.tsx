import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MidiLibraryPreview } from "./midi-library-preview.client";

const pause = vi.fn();
vi.mock("@/features/public-midi/preview-runtime.client", () => ({
  PublicMidiPreviewRuntime: class {
    prepare = vi.fn().mockResolvedValue(undefined);
    play = vi.fn().mockResolvedValue(undefined);
    pause = pause;
    dispose = vi.fn();
  },
}));
const props = {
  patternVersionId: "10000000-0000-4000-8000-000000000001",
  presetId: "warm-keys",
  presetVersion: 1,
  durationTicks: 960,
  notes: [
    {
      noteId: "10000000-0000-4000-8000-000000000002",
      startTick: 0,
      durationTicks: 480,
      pitch: 60,
      velocity: 100,
    },
  ],
};
describe("library preview", () => {
  beforeEach(() => {
    pause.mockClear();
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: class {},
    });
  });
  afterEach(cleanup);
  it("keeps card playback mutually exclusive", async () => {
    render(
      <>
        <MidiLibraryPreview
          {...props}
          listingId="10000000-0000-4000-8000-000000000003"
          title="First"
        />
        <MidiLibraryPreview
          {...props}
          listingId="10000000-0000-4000-8000-000000000004"
          title="Second"
        />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play First" }));
    await screen.findByRole("button", { name: "Pause First" });
    fireEvent.click(screen.getByRole("button", { name: "Play Second" }));
    await screen.findByRole("button", { name: "Pause Second" });
    expect(pause).toHaveBeenCalled();
  });
  it("disables playback when Web Audio is unavailable", async () => {
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: undefined,
    });
    render(
      <MidiLibraryPreview
        {...props}
        listingId="10000000-0000-4000-8000-000000000003"
        title="First"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play First" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Play First" })).toBeDisabled(),
    );
  });
});
