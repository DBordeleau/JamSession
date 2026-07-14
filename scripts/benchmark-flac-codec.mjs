import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { basename, dirname, resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { generateFixtureProfile } from "./generate-studio-audio-fixtures.mjs";

const codecVersion = "1.50.8";
const browserName = argument("--browser", "chromium");
const fixtureProfile = argument("--fixture", "controlled");
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);
const output = resolve(
  argument(
    "--output",
    `local/opt01-results/codec-${browserName}-${new Date().toISOString().replaceAll(":", "-")}.json`,
  ),
);
const dependencyRoot = resolve("local", "opt01-codec-spike", "node_modules");
const mediabunny = resolve(
  dependencyRoot,
  "mediabunny",
  "dist",
  "bundles",
  "mediabunny.mjs",
);
const flacEncoder = resolve(
  dependencyRoot,
  "@mediabunny",
  "flac-encoder",
  "dist",
  "bundles",
  "mediabunny-flac-encoder.mjs",
);
if (!existsSync(mediabunny) || !existsSync(flacEncoder))
  throw new Error(
    `Install the disposable spike first: npm install --prefix local/opt01-codec-spike --no-package-lock --ignore-scripts --no-save mediabunny@${codecVersion} @mediabunny/flac-encoder@${codecVersion}`,
  );

const fixtureDirectory = resolve(
  "local",
  "opt01-audio-fixtures",
  fixtureProfile,
);
const fixture = resolve(fixtureDirectory, "stem-01.wav");
if (!existsSync(fixture)) {
  const fixtureOptions =
    fixtureProfile === "boundary"
      ? { stems: 1, durationSeconds: 590, sampleRate: 32_000, bitDepth: 16 }
      : { stems: 3, durationSeconds: 180, sampleRate: 44_100, bitDepth: 24 };
  generateFixtureProfile({
    profileName: fixtureProfile,
    output: fixtureDirectory,
    ...fixtureOptions,
  });
}

const server = createServer((request, response) => {
  if (request.url === "/") {
    response
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(
        "<!doctype html><meta charset=utf-8><title>OPT-01 codec spike</title>",
      );
    return;
  }
  if (request.url === "/fixture.wav")
    return serveFile(response, fixture, "audio/wav");
  if (request.url === "/deps/mediabunny.mjs")
    return serveFile(response, mediabunny, "text/javascript");
  if (request.url === "/deps/flac.mjs") {
    const source = readFileSync(flacEncoder, "utf8").replaceAll(
      'from "mediabunny"',
      'from "/deps/mediabunny.mjs"',
    );
    response.writeHead(200, { "Content-Type": "text/javascript" }).end(source);
    return;
  }
  if (request.url === "/codec-worker.mjs") {
    response
      .writeHead(200, { "Content-Type": "text/javascript" })
      .end(codecWorkerSource());
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Codec server did not bind.");

let browser;
try {
  browser = await browserType.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const result = await page.evaluate(async () => {
    const wav = await (await fetch("/fixture.wav")).arrayBuffer();
    const inputBytes = wav.byteLength;
    const OriginalAudioContext =
      window.AudioContext || window.webkitAudioContext;
    const originalContext = new OriginalAudioContext();
    const original = await originalContext.decodeAudioData(wav.slice(0));
    await originalContext.close();
    const beforeHeap =
      "memory" in performance ? performance.memory.usedJSHeapSize : null;
    const worker = new Worker("/codec-worker.mjs", { type: "module" });
    const messages = [];
    const encoded = await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        messages.push(data);
        if (data.type === "done") resolve(data);
        if (data.type === "error") reject(new Error(data.message));
      };
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage({ type: "start", bytes: wav }, [wav]);
    });
    worker.terminate();
    const flac = encoded.bytes;
    const signature = String.fromCharCode(...new Uint8Array(flac, 0, 4));
    const decodedContext = new OriginalAudioContext({
      sampleRate: original.sampleRate,
    });
    const decoded = await decodedContext.decodeAudioData(flac.slice(0));
    await decodedContext.close();
    let maxSampleDelta = 0;
    const originalSamples = original.getChannelData(0);
    const decodedSamples = decoded.getChannelData(0);
    for (
      let index = 0;
      index < Math.min(10_000, originalSamples.length);
      index += 1
    ) {
      maxSampleDelta = Math.max(
        maxSampleDelta,
        Math.abs(originalSamples[index] - decodedSamples[index]),
      );
    }

    const cancelWav = await (await fetch("/fixture.wav")).arrayBuffer();
    const cancelWorker = new Worker("/codec-worker.mjs", { type: "module" });
    const cancellation = await new Promise((resolve, reject) => {
      let requested = false;
      const timeout = setTimeout(
        () => reject(new Error("Cancellation timed out.")),
        30_000,
      );
      cancelWorker.onmessage = ({ data }) => {
        if (data.type === "progress" && !requested) {
          requested = true;
          cancelWorker.postMessage({ type: "cancel" });
        }
        if (data.type === "cancelled" || data.type === "done") {
          clearTimeout(timeout);
          resolve({ outcome: data.type, requested });
        }
        if (data.type === "error") reject(new Error(data.message));
      };
      cancelWorker.postMessage({ type: "start", bytes: cancelWav }, [
        cancelWav,
      ]);
    });
    cancelWorker.terminate();
    const afterHeap =
      "memory" in performance ? performance.memory.usedJSHeapSize : null;
    return {
      workerSupported:
        typeof Worker === "function" && typeof WebAssembly === "object",
      inputBytes,
      outputBytes: flac.byteLength,
      outputRatio: flac.byteLength / inputBytes,
      signature,
      conversionMilliseconds: encoded.conversionMilliseconds,
      peakGenerationMilliseconds: encoded.peakGenerationMilliseconds,
      peakCount: encoded.peakCount,
      workerHeapBytes: encoded.workerHeapBytes,
      mainHeapDeltaBytes:
        beforeHeap === null || afterHeap === null
          ? null
          : afterHeap - beforeHeap,
      progressEvents: messages.filter((message) => message.type === "progress")
        .length,
      cancellation,
      roundTrip: {
        durationDeltaSeconds: Math.abs(decoded.duration - original.duration),
        channels: decoded.numberOfChannels,
        playbackContextSampleRate: decoded.sampleRate,
        encodedDurationSeconds: encoded.metadata.durationSeconds,
        encodedChannels: encoded.metadata.channels,
        encodedSampleRate: encoded.metadata.sampleRate,
        maxFirstTenThousandSampleDelta: maxSampleDelta,
      },
    };
  });
  const evidence = {
    recordedAt: new Date().toISOString(),
    browser: browserName,
    platform: process.platform,
    candidate: {
      packages: {
        mediabunny: codecVersion,
        "@mediabunny/flac-encoder": codecVersion,
      },
      license: "MPL-2.0",
      rawBundleBytes: statSync(mediabunny).size + statSync(flacEncoder).size,
      gzipBundleBytes:
        gzipSync(readFileSync(mediabunny)).byteLength +
        gzipSync(readFileSync(flacEncoder)).byteLength,
    },
    fixture: {
      profile: fixtureProfile,
      name: basename(fixture),
      bytes: statSync(fixture).size,
    },
    result,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output, evidence }, null, 2)}\n`);
} finally {
  await browser?.close();
  server.close();
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function serveFile(response, file, contentType) {
  response.writeHead(200, {
    "Content-Length": statSync(file).size,
    "Content-Type": contentType,
  });
  createReadStream(file).pipe(response);
}

function codecWorkerSource() {
  return String.raw`
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  FlacOutputFormat,
  Input,
  Output,
} from "/deps/mediabunny.mjs";
import { registerFlacEncoder } from "/deps/flac.mjs";

registerFlacEncoder();
let activeConversion = null;

self.onmessage = async ({ data }) => {
  if (data.type === "cancel") {
    await activeConversion?.cancel();
    return;
  }
  if (data.type !== "start") return;
  try {
    const peakStart = performance.now();
    const peaks = generatePeaks(data.bytes, 2048);
    const peakGenerationMilliseconds = performance.now() - peakStart;
    const input = new Input({
      source: new BlobSource(new Blob([data.bytes], { type: "audio/wav" })),
      formats: ALL_FORMATS,
    });
    const target = new BufferTarget();
    const output = new Output({ format: new FlacOutputFormat(), target });
    const conversion = await Conversion.init({ input, output });
    activeConversion = conversion;
    conversion.onProgress = (progress) => self.postMessage({ type: "progress", progress });
    const startedAt = performance.now();
    await conversion.execute();
    const conversionMilliseconds = performance.now() - startedAt;
    activeConversion = null;
    const bytes = target.buffer;
    const verificationInput = new Input({
      source: new BlobSource(new Blob([bytes], { type: "audio/flac" })),
      formats: ALL_FORMATS,
    });
    const verificationTrack = await verificationInput.getPrimaryAudioTrack();
    if (!verificationTrack) throw new Error("Encoded FLAC has no audio track.");
    const metadata = {
      durationSeconds: await verificationInput.computeDuration(),
      channels: await verificationTrack.getNumberOfChannels(),
      sampleRate: await verificationTrack.getSampleRate(),
    };
    self.postMessage(
      {
        type: "done",
        bytes,
        metadata,
        conversionMilliseconds,
        peakGenerationMilliseconds,
        peakCount: peaks.length,
        workerHeapBytes: "memory" in performance ? performance.memory.usedJSHeapSize : null,
      },
      [bytes],
    );
  } catch (error) {
    activeConversion = null;
    if (error instanceof ConversionCanceledError) {
      self.postMessage({ type: "cancelled" });
      return;
    }
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};

function generatePeaks(bytes, bins) {
  const view = new DataView(bytes);
  const bits = view.getUint16(34, true);
  const bytesPerSample = bits / 8;
  const sampleCount = view.getUint32(40, true) / bytesPerSample;
  const samplesPerBin = Math.ceil(sampleCount / bins);
  const peaks = new Float32Array(bins * 2);
  for (let bin = 0; bin < bins; bin += 1) {
    let minimum = 1;
    let maximum = -1;
    const end = Math.min(sampleCount, (bin + 1) * samplesPerBin);
    for (let index = bin * samplesPerBin; index < end; index += 1) {
      const offset = 44 + index * bytesPerSample;
      let sample;
      if (bits === 16) sample = view.getInt16(offset, true) / 32768;
      else {
        let integer = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
        if (integer & 0x800000) integer |= 0xff000000;
        sample = integer / 8388608;
      }
      minimum = Math.min(minimum, sample);
      maximum = Math.max(maximum, sample);
    }
    peaks[bin * 2] = minimum;
    peaks[bin * 2 + 1] = maximum;
  }
  return peaks;
}
`;
}
