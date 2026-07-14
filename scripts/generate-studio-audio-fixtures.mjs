import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const profiles = {
  smoke: {
    output: resolve("public", "fixtures", "audio"),
    stems: 2,
    durationSeconds: 2,
    sampleRate: 44_100,
    bitDepth: 16,
  },
  controlled: {
    output: resolve("local", "opt01-audio-fixtures", "controlled"),
    stems: 3,
    durationSeconds: 180,
    sampleRate: 44_100,
    bitDepth: 24,
  },
  stress: {
    output: resolve("local", "opt01-audio-fixtures", "stress"),
    stems: 12,
    durationSeconds: 180,
    sampleRate: 44_100,
    bitDepth: 24,
  },
  boundary: {
    output: resolve("local", "opt01-audio-fixtures", "boundary"),
    stems: 1,
    durationSeconds: 590,
    sampleRate: 32_000,
    bitDepth: 16,
  },
};

function parseArguments(argv) {
  const profileName = argv[argv.indexOf("--profile") + 1] ?? "smoke";
  if (!(profileName in profiles))
    throw new Error(`Unknown fixture profile: ${profileName}`);
  const outputIndex = argv.indexOf("--output");
  return {
    profileName,
    ...profiles[profileName],
    output:
      outputIndex >= 0
        ? resolve(argv[outputIndex + 1])
        : profiles[profileName].output,
  };
}

function deterministicSample(time, stemIndex, sampleIndex, profileName) {
  if (profileName === "smoke") {
    if (stemIndex === 0)
      return (
        0.28 *
        Math.sin(2 * Math.PI * 220 * time) *
        (0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * time))
      );
    return (
      0.22 * Math.sin(2 * Math.PI * 440 * time) * Math.exp(-2.2 * (time % 0.5))
    );
  }
  const base = 110 + stemIndex * 37;
  const transient = Math.exp(-3.1 * (time % (0.32 + stemIndex * 0.015)));
  let noise = (sampleIndex + 1) * (stemIndex + 11);
  noise ^= noise << 13;
  noise ^= noise >>> 17;
  noise ^= noise << 5;
  const normalizedNoise = ((noise >>> 0) / 0xffff_ffff) * 2 - 1;
  return (
    0.24 * Math.sin(2 * Math.PI * base * time) +
    0.11 * Math.sin(2 * Math.PI * base * 1.503 * time) +
    0.07 * transient * Math.sin(2 * Math.PI * base * 3 * time) +
    0.025 * normalizedNoise
  );
}

function writePcmSample(output, offset, value, bitDepth) {
  const bounded = Math.max(-1, Math.min(1, value));
  if (bitDepth === 16) {
    output.writeInt16LE(Math.round(bounded * 32_767), offset);
    return;
  }
  const integer = Math.round(bounded * 8_388_607);
  output[offset] = integer & 0xff;
  output[offset + 1] = (integer >> 8) & 0xff;
  output[offset + 2] = (integer >> 16) & 0xff;
}

export function makeDeterministicWav({
  durationSeconds,
  sampleRate,
  bitDepth,
  stemIndex,
  profileName,
}) {
  const sampleCount = sampleRate * durationSeconds;
  const bytesPerSample = bitDepth / 8;
  const dataSize = sampleCount * bytesPerSample;
  const output = Buffer.allocUnsafe(44 + dataSize);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * bytesPerSample, 28);
  output.writeUInt16LE(bytesPerSample, 32);
  output.writeUInt16LE(bitDepth, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    writePcmSample(
      output,
      44 + index * bytesPerSample,
      deterministicSample(index / sampleRate, stemIndex, index, profileName),
      bitDepth,
    );
  }
  return output;
}

export function generateFixtureProfile(options) {
  mkdirSync(options.output, { recursive: true });
  const files = [];
  for (let stemIndex = 0; stemIndex < options.stems; stemIndex += 1) {
    const name =
      options.profileName === "smoke"
        ? `stem-${String.fromCharCode(97 + stemIndex)}.wav`
        : `stem-${String(stemIndex + 1).padStart(2, "0")}.wav`;
    const target = resolve(options.output, name);
    const wav = makeDeterministicWav({ ...options, stemIndex });
    writeFileSync(target, wav);
    files.push({
      name,
      target,
      bytes: wav.byteLength,
      sha256: createHash("sha256").update(wav).digest("hex"),
    });
  }
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  const files = generateFixtureProfile(options);
  process.stdout.write(
    `${JSON.stringify({ profile: options.profileName, ...options, files }, null, 2)}\n`,
  );
}
