import type { MidiLibraryReuseMode } from "./types";

export const MIDI_LIBRARY_RIGHTS_LABELS: Record<MidiLibraryReuseMode, string> =
  {
    commercial_reuse: "Commercial reuse permitted — CC BY 4.0",
    reference_only: "Reference only — reuse not granted",
  };
export function formatInstrumentFamily(value: string) {
  const labels: Record<string, string> = {
    "drums-percussion": "Drums & percussion",
    basses: "Basses",
    keys: "Keys",
    leads: "Leads",
    "pads-strings": "Pads & strings",
    "plucks-bells-textures": "Plucks, bells & textures",
  };
  return labels[value] ?? value;
}
export function formatPitch(pitch: number | null) {
  if (pitch === null) return "—";
  const names = [
    "C",
    "C♯",
    "D",
    "E♭",
    "E",
    "F",
    "F♯",
    "G",
    "A♭",
    "A",
    "B♭",
    "B",
  ];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}
