import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { generateFixtureProfile } from "./generate-studio-audio-fixtures.mjs";

const profileName = argument("--profile", "controlled");
const repetitions = Number(argument("--repetitions", "5"));
const phase = argument("--phase", "both");
const output = resolve(
  argument(
    "--output",
    `local/opt01-results/delivery-${profileName}-${new Date().toISOString().replaceAll(":", "-")}.json`,
  ),
);
const profileDefinitions = {
  controlled: {
    stems: 3,
    durationSeconds: 180,
    sampleRate: 44_100,
    bitDepth: 24,
  },
  stress: { stems: 12, durationSeconds: 180, sampleRate: 44_100, bitDepth: 24 },
  boundary: {
    stems: 1,
    durationSeconds: 590,
    sampleRate: 32_000,
    bitDepth: 16,
  },
};
const profile = profileDefinitions[profileName];
if (!profile) throw new Error(`Unsupported benchmark profile: ${profileName}`);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10)
  throw new Error("Repetitions must be an integer from 1 to 10.");
if (!["both", "cold", "warm"].includes(phase))
  throw new Error("Phase must be both, cold, or warm.");

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const fixtureDirectory = resolve("local", "opt01-audio-fixtures", profileName);
const expected = Array.from({ length: profile.stems }, (_, index) =>
  resolve(fixtureDirectory, `stem-${String(index + 1).padStart(2, "0")}.wav`),
);
if (expected.some((file) => !existsSync(file))) {
  generateFixtureProfile({ profileName, output: fixtureDirectory, ...profile });
}

const server = createServer((request, response) => {
  const match = /^\/audio\/(stem-\d{2}\.wav)$/.exec(request.url ?? "");
  if (!match) {
    response.writeHead(404).end();
    return;
  }
  const file = resolve(fixtureDirectory, match[1]);
  if (!expected.includes(file)) {
    response.writeHead(404).end();
    return;
  }
  const size = statSync(file).size;
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "private, max-age=3600",
    "Content-Length": size,
    "Content-Type": "audio/wav",
  });
  createReadStream(file).pipe(response);
});
await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Benchmark server did not bind.");
const urls = expected.map(
  (file) => `http://127.0.0.1:${address.port}/audio/${basename(file)}`,
);

const browser = await chromium.launch();
const results = { cold: [], warm: [] };
try {
  if (phase !== "warm") {
    for (let index = 0; index < repetitions; index += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Network.enable");
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 50,
        downloadThroughput: 2_500_000,
        uploadThroughput: 625_000,
        connectionType: "cellular4g",
      });
      results.cold.push(await runCurrentLoader(page, urls));
      await context.close();
    }
  }

  if (phase !== "cold") {
    const context = await browser.newContext();
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: false });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 50,
      downloadThroughput: 2_500_000,
      uploadThroughput: 625_000,
      connectionType: "cellular4g",
    });
    for (let index = 0; index < repetitions; index += 1) {
      results.warm.push(await runCurrentLoader(page, urls));
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const evidence = {
  recordedAt: new Date().toISOString(),
  environment: {
    browser: "Playwright Chromium",
    downstreamBitsPerSecond: 20_000_000,
    upstreamBitsPerSecond: 5_000_000,
    latencyMilliseconds: 50,
    fetchCacheMode: "no-store",
  },
  profile: {
    name: profileName,
    ...profile,
    files: expected.map((file) => ({
      name: basename(file),
      bytes: statSync(file).size,
    })),
  },
  repetitions,
  phase,
  results,
  summary: {
    cold: results.cold.length > 0 ? summarize(results.cold) : null,
    warm: results.warm.length > 0 ? summarize(results.warm) : null,
  },
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ output, summary: evidence.summary }, null, 2)}\n`,
);

async function runCurrentLoader(page, sourceUrls) {
  return page.evaluate(async (inputUrls) => {
    const startedAt = performance.now();
    const longTasks = [];
    const observer =
      typeof PerformanceObserver !== "undefined"
        ? new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              longTasks.push(entry.duration);
          })
        : null;
    try {
      observer?.observe({ type: "longtask", buffered: true });
    } catch {
      // Long-task entries are optional capability evidence.
    }
    const context = new AudioContext();
    let cursor = 0;
    const sources = [];
    const worker = async () => {
      while (true) {
        const sourceIndex = cursor++;
        const url = inputUrls[sourceIndex];
        if (!url) return;
        const fetchStart = performance.now();
        const response = await fetch(url, { cache: "no-store" });
        const bytes = await response.arrayBuffer();
        const fetchEnd = performance.now();
        const decodeStart = performance.now();
        const buffer = await context.decodeAudioData(bytes);
        const decodeEnd = performance.now();
        sources.push({
          sourceIndex,
          bytes: bytes.byteLength,
          fetchMilliseconds: fetchEnd - fetchStart,
          decodeMilliseconds: decodeEnd - decodeStart,
          readyMilliseconds: decodeEnd - startedAt,
          channels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate,
          durationSeconds: buffer.duration,
        });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(3, inputUrls.length) }, () => worker()),
    );
    const readyAt = performance.now();
    await context.close();
    observer?.disconnect();
    return {
      // The current production surface gates all three states on the complete
      // fetch/decode group, so these values intentionally match at baseline.
      shellReadyMilliseconds: readyAt - startedAt,
      peaksReadyMilliseconds: readyAt - startedAt,
      playbackReadyMilliseconds: readyAt - startedAt,
      slowestLongTaskMilliseconds: Math.max(0, ...longTasks),
      usedJsHeapBytes:
        "memory" in performance ? performance.memory.usedJSHeapSize : null,
      sources: sources.sort(
        (left, right) => left.sourceIndex - right.sourceIndex,
      ),
    };
  }, sourceUrls);
}

function summarize(runs) {
  const playback = runs
    .map((run) => run.playbackReadyMilliseconds)
    .sort((left, right) => left - right);
  const median = playback[Math.floor(playback.length / 2)];
  return {
    medianPlaybackReadyMilliseconds: Math.round(median),
    slowestPlaybackReadyMilliseconds: Math.round(playback.at(-1)),
    medianShellReadyMilliseconds: Math.round(median),
    transferredBytesPerRun: expected.reduce(
      (sum, file) => sum + statSync(file).size,
      0,
    ),
    slowestLongTaskMilliseconds: Math.round(
      Math.max(...runs.map((run) => run.slowestLongTaskMilliseconds)),
    ),
  };
}
