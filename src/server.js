const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const multer = require("multer");

const app = express();
const port = process.env.PORT || 3000;

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const ARTWORK_DIR = path.join(DATA_DIR, "artwork");
const EXPORTS_DIR = path.join(DATA_DIR, "exports");
const DB_PATH = path.join(DATA_DIR, "tracks.json");
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".m4a", ".aac"]);
const DEFAULT_TARGET_LUFS = Number(process.env.DEFAULT_TARGET_LUFS || -14);
const AVAILABLE_CPU_COUNT = getAvailableCpuCount();
const INITIAL_PROCESSING_CONCURRENCY = getConfiguredConcurrency(process.env.PROCESSING_CONCURRENCY, AVAILABLE_CPU_COUNT);
const INITIAL_CONVERSION_CONCURRENCY = getConfiguredConcurrency(process.env.CONVERSION_CONCURRENCY, AVAILABLE_CPU_COUNT);
const TRACK_METADATA_VERSION = 5;

let dbTaskChain = Promise.resolve();
const processingQueue = [];
const queuedTrackIds = new Set();
let activeProcessingWorkers = 0;
let processingConcurrency = INITIAL_PROCESSING_CONCURRENCY;
let conversionConcurrency = INITIAL_CONVERSION_CONCURRENCY;

function getAvailableCpuCount() {
  const availableParallelism =
    typeof os.availableParallelism === "function" ? os.availableParallelism() : Array.isArray(os.cpus()) ? os.cpus().length : 1;

  return Math.max(1, Number(availableParallelism) || 1);
}

function getConfiguredConcurrency(value, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "auto" || normalized === "all" || normalized === "max") {
    return Math.max(1, fallback);
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : Math.max(1, fallback);
}

function normalizeProcessingCores(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.max(1, Math.min(AVAILABLE_CPU_COUNT, Math.floor(parsed)));
}

function applyRuntimeProcessingCores(value) {
  const normalized = normalizeProcessingCores(value) ?? INITIAL_PROCESSING_CONCURRENCY;
  processingConcurrency = normalized;
  conversionConcurrency = normalized;
  return normalized;
}

async function ensureDataFiles() {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  await fsp.mkdir(ARTWORK_DIR, { recursive: true });
  await fsp.mkdir(EXPORTS_DIR, { recursive: true });

  try {
    await fsp.access(DB_PATH, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(
      DB_PATH,
      JSON.stringify(
        {
          settings: {
            targetLufs: DEFAULT_TARGET_LUFS,
            processingCores: processingConcurrency
          },
          tracks: [],
          playlists: []
        },
        null,
        2
      )
    );
  }
}

function normalizeDbShape(db) {
  const nextDb = db && typeof db === "object" ? db : {};

  if (!Array.isArray(nextDb.tracks)) {
    nextDb.tracks = [];
  }

  if (!Array.isArray(nextDb.playlists)) {
    nextDb.playlists = [];
  }

  const targetLufs = Number.isFinite(Number(nextDb.settings?.targetLufs)) ? Number(nextDb.settings.targetLufs) : DEFAULT_TARGET_LUFS;
  const processingCores = normalizeProcessingCores(nextDb.settings?.processingCores) ?? processingConcurrency;

  nextDb.settings = {
    targetLufs,
    processingCores
  };

  return nextDb;
}

async function readDbRaw() {
  const content = await fsp.readFile(DB_PATH, "utf8");
  return normalizeDbShape(JSON.parse(content));
}

async function readDb() {
  await dbTaskChain.catch(() => {});
  return readDbRaw();
}

async function writeDbRaw(data) {
  await fsp.writeFile(DB_PATH, JSON.stringify(normalizeDbShape(data), null, 2));
}

function queueDbTask(task) {
  const result = dbTaskChain.then(task, task);
  dbTaskChain = result.catch(() => {});
  return result;
}

async function removeFileIfExists(filePath) {
  if (!filePath) {
    return;
  }

  await fsp.rm(filePath, {
    force: true
  }).catch(() => {});
}

function removeTrackFromProcessingQueue(trackId) {
  queuedTrackIds.delete(trackId);

  for (let index = processingQueue.length - 1; index >= 0; index -= 1) {
    if (processingQueue[index] === trackId) {
      processingQueue.splice(index, 1);
    }
  }
}

function getArtworkFilenameForTrack(track) {
  if (track?.coverUrl && String(track.coverUrl).startsWith("/artwork/")) {
    return decodeURIComponent(path.basename(track.coverUrl));
  }

  return track?.id ? `${track.id}.jpg` : "";
}

function normalizeAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") {
    return null;
  }

  const normalized = {
    inputI: Number(analysis.inputI),
    inputTp: Number(analysis.inputTp),
    inputLra: Number(analysis.inputLra),
    inputThresh: Number(analysis.inputThresh),
    targetOffset: Number(analysis.targetOffset)
  };

  return Object.values(normalized).some((value) => Number.isFinite(value)) ? normalized : null;
}

function sanitizeBaseName(filename) {
  return (
    path
      .basename(String(filename || "track"), path.extname(String(filename || "")))
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "track"
  );
}

function normalizeTrackRecord(track) {
  const duration = Number(track?.duration);
  const coverUrl = typeof track?.coverUrl === "string" && track.coverUrl.trim() ? track.coverUrl : null;
  const lyrics = typeof track?.lyrics === "string" ? track.lyrics : "";
  const title = String(track?.title || "").trim() || sanitizeBaseName(track?.originalName || track?.filename || "track");
  const artist = String(track?.artist || "").trim() || "Unknown Artist";
  const extension = String(track?.extension || path.extname(track?.originalName || "")).toLowerCase();

  return {
    ...track,
    id: String(track?.id || crypto.randomUUID()),
    title,
    artist,
    lyrics,
    coverUrl,
    originalName: String(track?.originalName || track?.filename || title),
    filename: String(track?.filename || ""),
    extension,
    url:
      typeof track?.url === "string" && track.url
        ? track.url
        : track?.filename
          ? `/media/${encodeURIComponent(track.filename)}`
          : "",
    duration: Number.isFinite(duration) ? duration : null,
    analysis: normalizeAnalysis(track?.analysis),
    processing: Boolean(track?.processing),
    metadataVersion: Number(track?.metadataVersion) || 0,
    metadataReady:
      typeof track?.metadataReady === "boolean"
        ? track.metadataReady
        : track?.artist !== undefined && track?.lyrics !== undefined && track?.coverUrl !== undefined,
    analysisReady:
      typeof track?.analysisReady === "boolean"
        ? track.analysisReady
        : track?.duration !== undefined && track?.analysis !== undefined,
    processingError: track?.processingError ? String(track.processingError) : null,
    processedAt: typeof track?.processedAt === "string" ? track.processedAt : null
  };
}

function needsTrackProcessing(track) {
  return track.processing || !track.metadataReady || !track.analysisReady || track.metadataVersion < TRACK_METADATA_VERSION;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}\n${stderr}`));
    });
  });
}

function parseLoudnorm(stderr) {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const payload = JSON.parse(stderr.slice(start, end + 1));
    return {
      inputI: Number(payload.input_i),
      inputTp: Number(payload.input_tp),
      inputLra: Number(payload.input_lra),
      inputThresh: Number(payload.input_thresh),
      targetOffset: Number(payload.target_offset)
    };
  } catch {
    return null;
  }
}

async function getDuration(filePath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);

  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) ? duration : null;
}

async function getTrackMetadata(filePath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format_tags:stream=index,codec_type,disposition:stream_tags",
    "-of",
    "json",
    filePath
  ]);

  return JSON.parse(stdout || "{}");
}

function findTagValue(tags, candidates) {
  if (!tags || typeof tags !== "object") {
    return "";
  }

  const normalized = Object.entries(tags).reduce((accumulator, [key, value]) => {
    accumulator[key.toLowerCase()] = value;
    return accumulator;
  }, {});

  for (const candidate of candidates) {
    const value = normalized[candidate.toLowerCase()];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function stripLyricsDecorators(value) {
  const timestampPattern = /\[(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/;
  const metadataTagPattern = /^\[(ar|ti|al|by|offset|re|ve|kana|length):.*\]$/i;

  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return true;
      }

      if (timestampPattern.test(line)) {
        return true;
      }

      return !metadataTagPattern.test(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLyricsDescriptor(value) {
  return /(lyrics|lyric|lrc|karaoke|\u6b4c\u8bcd)/.test(String(value || "").toLowerCase());
}

function decodeSyncSafeInteger(buffer, offset = 0) {
  return (
    ((buffer[offset] || 0) << 21) |
    ((buffer[offset + 1] || 0) << 14) |
    ((buffer[offset + 2] || 0) << 7) |
    (buffer[offset + 3] || 0)
  );
}

function removeUnsynchronization(buffer) {
  const bytes = [];

  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0xff && buffer[index + 1] === 0x00) {
      bytes.push(0xff);
      index += 1;
      continue;
    }

    bytes.push(buffer[index]);
  }

  return Buffer.from(bytes);
}

function decodeUtf16Be(buffer) {
  const swapped = Buffer.from(buffer);

  for (let index = 0; index + 1 < swapped.length; index += 2) {
    const current = swapped[index];
    swapped[index] = swapped[index + 1];
    swapped[index + 1] = current;
  }

  return swapped.toString("utf16le");
}

function decodeId3Text(buffer, encoding) {
  if (!buffer.length) {
    return "";
  }

  if (encoding === 0) {
    return buffer.toString("latin1");
  }

  if (encoding === 3) {
    return buffer.toString("utf8");
  }

  if (encoding === 2) {
    return decodeUtf16Be(buffer);
  }

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }

  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return decodeUtf16Be(buffer.subarray(2));
  }

  return buffer.toString("utf16le");
}

function readId3EncodedString(buffer, encoding, start = 0) {
  const usesDoubleTerminator = encoding === 1 || encoding === 2;
  let end = start;

  if (usesDoubleTerminator) {
    while (end + 1 < buffer.length) {
      if (buffer[end] === 0x00 && buffer[end + 1] === 0x00) {
        break;
      }
      end += 1;
    }

    return {
      value: decodeId3Text(buffer.subarray(start, end), encoding).trim(),
      nextOffset: Math.min(buffer.length, end + 2)
    };
  }

  while (end < buffer.length && buffer[end] !== 0x00) {
    end += 1;
  }

  return {
    value: decodeId3Text(buffer.subarray(start, end), encoding).trim(),
    nextOffset: Math.min(buffer.length, end + 1)
  };
}

function parseUsltFrame(frameBuffer) {
  if (!frameBuffer.length) {
    return "";
  }

  const encoding = frameBuffer[0];
  const descriptor = readId3EncodedString(frameBuffer, encoding, 4);
  return decodeId3Text(frameBuffer.subarray(descriptor.nextOffset), encoding).trim();
}

function parseTxxxFrame(frameBuffer) {
  if (!frameBuffer.length) {
    return "";
  }

  const encoding = frameBuffer[0];
  const descriptor = readId3EncodedString(frameBuffer, encoding, 1);
  const descriptorText = descriptor.value.toLowerCase();
  const value = decodeId3Text(frameBuffer.subarray(descriptor.nextOffset), encoding).trim();
  if (isLyricsDescriptor(descriptorText)) {
    return value;
  }

  return /(lyrics|lyric|lrc|karaoke|姝岃瘝)/.test(descriptorText) ? value : "";
}

function parseCommFrame(frameBuffer) {
  if (frameBuffer.length < 4) {
    return "";
  }

  const encoding = frameBuffer[0];
  const descriptor = readId3EncodedString(frameBuffer, encoding, 4);
  const descriptorText = descriptor.value.toLowerCase();
  const comment = decodeId3Text(frameBuffer.subarray(descriptor.nextOffset), encoding).trim();
  if (isLyricsDescriptor(descriptorText)) {
    return comment;
  }

  return /(lyrics|lyric|lrc|karaoke|姝岃瘝)/.test(descriptorText) ? comment : "";
}

async function extractMp3Lyrics(filePath) {
  const handle = await fsp.open(filePath, "r");

  try {
    const header = Buffer.alloc(10);
    await handle.read(header, 0, 10, 0);

    if (header.toString("latin1", 0, 3) !== "ID3") {
      return "";
    }

    const version = header[3];
    const flags = header[5];
    const tagSize = decodeSyncSafeInteger(header, 6);

    if (!tagSize || tagSize < 10) {
      return "";
    }

    let tagBuffer = Buffer.alloc(tagSize);
    await handle.read(tagBuffer, 0, tagSize, 10);

    if (flags & 0x80) {
      tagBuffer = removeUnsynchronization(tagBuffer);
    }

    let offset = 0;

    if (flags & 0x40) {
      if (version === 3 && tagBuffer.length >= 4) {
        offset = Math.min(tagBuffer.readUInt32BE(0), tagBuffer.length);
      } else if (version === 4 && tagBuffer.length >= 4) {
        offset = Math.min(decodeSyncSafeInteger(tagBuffer, 0), tagBuffer.length);
      }
    }

    while (offset + 10 <= tagBuffer.length) {
      const frameId = tagBuffer.toString("latin1", offset, offset + 4).replace(/\u0000/g, "");

      if (!/^[A-Z0-9]{4}$/.test(frameId)) {
        break;
      }

      const frameSize = version === 4 ? decodeSyncSafeInteger(tagBuffer, offset + 4) : tagBuffer.readUInt32BE(offset + 4);

      if (!frameSize) {
        break;
      }

      const frameStart = offset + 10;
      const frameEnd = Math.min(frameStart + frameSize, tagBuffer.length);
      const frameBuffer = tagBuffer.subarray(frameStart, frameEnd);
      let parsedLyrics = "";

      if (frameId === "USLT") {
        parsedLyrics = parseUsltFrame(frameBuffer);
      } else if (frameId === "TXXX") {
        parsedLyrics = parseTxxxFrame(frameBuffer);
      }

      if (parsedLyrics.trim()) {
        return parsedLyrics.trim();
      }

      offset = frameEnd;
    }

    return "";
  } finally {
    await handle.close();
  }
}

async function extractSidecarLyrics(filePath) {
  const basePath = filePath.slice(0, -path.extname(filePath).length);

  for (const extension of [".lrc", ".txt"]) {
    try {
      const content = await fsp.readFile(`${basePath}${extension}`, "utf8");
      if (content.trim()) {
        return content.trim();
      }
    } catch {
      // Ignore missing sidecar files.
    }
  }

  return "";
}

async function extractFallbackLyrics(filePath) {
  if (path.extname(filePath).toLowerCase() === ".mp3") {
    const embeddedLyrics = await extractMp3Lyrics(filePath).catch(() => "");
    if (embeddedLyrics) {
      return embeddedLyrics;
    }
  }

  return extractSidecarLyrics(filePath);
}

async function extractArtwork(filePath, trackId) {
  const artworkFilename = `${trackId}.jpg`;
  const artworkPath = path.join(ARTWORK_DIR, artworkFilename);

  try {
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      filePath,
      "-an",
      "-vf",
      "scale=600:-1",
      "-frames:v",
      "1",
      artworkPath
    ]);

    const stat = await fsp.stat(artworkPath);
    if (stat.size > 0) {
      return `/artwork/${encodeURIComponent(artworkFilename)}`;
    }
  } catch {
    return null;
  }

  return null;
}

async function buildTrackMetadata(filePath, originalName, trackId) {
  const fallbackTitle = sanitizeBaseName(originalName);
  const metadata = await getTrackMetadata(filePath).catch(() => null);
  const formatTags = metadata?.format?.tags || {};
  const streamTags = Array.isArray(metadata?.streams)
    ? metadata.streams.flatMap((stream) => (stream?.tags ? [stream.tags] : []))
    : [];

  const tagPool = [formatTags, ...streamTags];
  const readFirst = (candidates) => {
    for (const tags of tagPool) {
      const value = findTagValue(tags, candidates);
      if (value) {
        return value;
      }
    }
    return "";
  };

  const title = readFirst(["title"]) || fallbackTitle;
  const artist = readFirst(["artist", "album_artist", "albumartist", "composer"]) || "Unknown Artist";
  const taggedLyrics = readFirst([
      "lyrics",
      "lyrics-eng",
      "unsyncedlyrics",
      "unsynchronized lyrics",
      "lyric",
      "uslt",
      "sylt",
      "\u00a9lyr",
      "\u00a9lyrics",
      "©lyr",
      "wm/lyrics"
    ]);
  const lyrics = stripLyricsDecorators(taggedLyrics || (await extractFallbackLyrics(filePath)));
  const coverUrl = await extractArtwork(filePath, trackId);

  return {
    title,
    artist,
    lyrics,
    coverUrl
  };
}

async function analyzeTrack(filePath) {
  const duration = await getDuration(filePath).catch(() => null);

  const { stderr } = await runCommand("ffmpeg", [
    "-hide_banner",
    "-i",
    filePath,
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-"
  ]);

  return {
    duration,
    analysis: parseLoudnorm(stderr)
  };
}

function normalizeTargetLufs(value) {
  const targetLufs = Number(value);
  return Number.isFinite(targetLufs) && targetLufs <= -6 && targetLufs >= -30 ? targetLufs : null;
}

function normalizeEqBandsInput(eqBands) {
  if (!Array.isArray(eqBands)) {
    return [];
  }

  return eqBands
    .map((band) => ({
      type: String(band?.type || "peaking").toLowerCase(),
      frequency: Number(band?.frequency),
      gain: Number(band?.gain),
      q: Number(band?.q)
    }))
    .filter((band) => Number.isFinite(band.frequency) && Number.isFinite(band.gain))
    .slice(0, 16);
}

function buildEqFilters(eqBands) {
  return eqBands.flatMap((band) => {
    if (Math.abs(band.gain) < 0.05) {
      return [];
    }

    if (band.type === "lowshelf") {
      return [`bass=g=${band.gain.toFixed(2)}:f=${Math.max(20, band.frequency).toFixed(0)}`];
    }

    if (band.type === "highshelf") {
      return [`treble=g=${band.gain.toFixed(2)}:f=${Math.max(1000, band.frequency).toFixed(0)}`];
    }

    const safeQ = Number.isFinite(band.q) ? Math.max(0.1, Math.min(10, band.q)) : 1;
    return [
      `equalizer=f=${Math.max(20, band.frequency).toFixed(2)}:width_type=q:width=${safeQ.toFixed(2)}:g=${band.gain.toFixed(2)}`
    ];
  });
}

function buildLoudnormFilter(targetLufs, analysis = null) {
  const params = [`I=${targetLufs}`, "TP=-1.5", "LRA=11"];

  if (
    analysis &&
    Number.isFinite(analysis.inputI) &&
    Number.isFinite(analysis.inputTp) &&
    Number.isFinite(analysis.inputLra) &&
    Number.isFinite(analysis.inputThresh) &&
    Number.isFinite(analysis.targetOffset)
  ) {
    params.push(
      `measured_I=${analysis.inputI}`,
      `measured_TP=${analysis.inputTp}`,
      `measured_LRA=${analysis.inputLra}`,
      `measured_thresh=${analysis.inputThresh}`,
      `offset=${analysis.targetOffset}`,
      "linear=true"
    );
  }

  return `loudnorm=${params.join(":")}`;
}

function buildConversionFilters({ targetLufs, applyEq, eqBands, analysis }) {
  const filters = [];

  if (applyEq) {
    filters.push(...buildEqFilters(eqBands));
  }

  filters.push(buildLoudnormFilter(targetLufs, applyEq ? null : analysis));
  return filters.join(",");
}

function getOutputExtension(extension) {
  const normalized = String(extension || "").toLowerCase();
  return SUPPORTED_EXTENSIONS.has(normalized) ? normalized : ".m4a";
}

function getTranscodeArgs(extension) {
  switch (extension) {
    case ".mp3":
      return ["-c:a", "libmp3lame", "-b:a", "320k", "-id3v2_version", "3"];
    case ".aac":
      return ["-c:a", "aac", "-b:a", "256k"];
    case ".m4a":
    default:
      return ["-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart"];
  }
}

function buildExportFilename(track, targetLufs, extension) {
  const baseName = sanitizeBaseName(track.title || track.originalName || track.filename || "track");
  const targetLabel = String(targetLufs).replace(/[^0-9-]+/g, "_");
  return `${baseName}-balanced-${targetLabel}LUFS-${crypto.randomUUID().slice(0, 8)}${extension}`;
}

async function replaceFileAtomic(tempPath, targetPath) {
  try {
    await fsp.rename(tempPath, targetPath);
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EEXIST"].includes(error?.code)) {
      await fsp.rm(targetPath, { force: true });
      await fsp.rename(tempPath, targetPath);
      return;
    }

    throw error;
  }
}

async function convertTrackFile({ sourcePath, outputPath, extension, targetLufs, applyEq, eqBands, analysis }) {
  const filters = buildConversionFilters({
    targetLufs,
    applyEq,
    eqBands,
    analysis
  });
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", sourcePath, "-map", "0:a:0", "-map_metadata", "0"];

  if (extension !== ".aac") {
    args.push("-map", "0:v?");
  }

  args.push("-af", filters, ...getTranscodeArgs(extension));

  if (extension !== ".aac") {
    args.push("-c:v", "copy");
  }

  args.push(outputPath);
  await runCommand("ffmpeg", args);
}

async function mapWithConcurrency(items, limit, iteratee) {
  if (!items.length) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function enqueueTrackProcessing(trackId) {
  if (!trackId || queuedTrackIds.has(trackId)) {
    return;
  }

  queuedTrackIds.add(trackId);
  processingQueue.push(trackId);
  void runTrackProcessingQueue();
}

async function runTrackProcessingQueue() {
  while (activeProcessingWorkers < processingConcurrency && processingQueue.length) {
    activeProcessingWorkers += 1;

    void (async () => {
      try {
        while (processingQueue.length) {
          const trackId = processingQueue.shift();

          try {
            await processTrackRecord(trackId);
          } catch (error) {
            console.error(`Failed to process track ${trackId}:`, error);
          } finally {
            queuedTrackIds.delete(trackId);
          }
        }
      } finally {
        activeProcessingWorkers = Math.max(0, activeProcessingWorkers - 1);

        if (processingQueue.length) {
          void runTrackProcessingQueue();
        }
      }
    })();
  }
}

async function processTrackRecord(trackId) {
  const dbSnapshot = await readDb();
  const existingTrack = dbSnapshot.tracks.find((track) => track.id === trackId);

  if (!existingTrack) {
    return;
  }

  const track = normalizeTrackRecord(existingTrack);
  if (!track.filename) {
    return;
  }

  const filePath = path.join(UPLOADS_DIR, track.filename);
  const fallbackMetadata = {
    title: sanitizeBaseName(track.originalName || track.filename),
    artist: track.artist || "Unknown Artist",
    lyrics: track.lyrics || "",
    coverUrl: track.coverUrl ?? null
  };

  const [analysisResult, metadataResult] = await Promise.all([
    analyzeTrack(filePath).catch(() => ({
      duration: track.duration ?? null,
      analysis: track.analysis ?? null
    })),
    buildTrackMetadata(filePath, track.originalName || track.filename, track.id).catch(() => fallbackMetadata)
  ]);

  const nextTrack = {
    ...track,
    title: metadataResult.title || track.title || fallbackMetadata.title,
    artist: metadataResult.artist || track.artist || fallbackMetadata.artist,
    lyrics: metadataResult.lyrics || track.lyrics || fallbackMetadata.lyrics,
    coverUrl: metadataResult.coverUrl ?? track.coverUrl ?? fallbackMetadata.coverUrl,
    duration: Number.isFinite(analysisResult.duration) ? analysisResult.duration : track.duration ?? null,
    analysis: analysisResult.analysis ?? track.analysis ?? null,
    processing: false,
    metadataReady: true,
    analysisReady: true,
    metadataVersion: TRACK_METADATA_VERSION,
    processingError: null,
    processedAt: new Date().toISOString()
  };

  await queueDbTask(async () => {
    const db = await readDbRaw();
    const index = db.tracks.findIndex((candidate) => candidate.id === trackId);

    if (index === -1) {
      return;
    }

    const latestTrack = normalizeTrackRecord(db.tracks[index]);
    db.tracks[index] = {
      ...latestTrack,
      ...nextTrack
    };
    await writeDbRaw(db);
  });
}

async function deleteTracksByIds(trackIds) {
  const uniqueTrackIds = [...new Set(trackIds.map((trackId) => String(trackId)).filter(Boolean))];

  if (!uniqueTrackIds.length) {
    const error = new Error("Please choose at least one track.");
    error.statusCode = 400;
    throw error;
  }

  const deletedTracks = await queueDbTask(async () => {
    const db = await readDbRaw();
    const existingTracks = uniqueTrackIds
      .map((trackId) => db.tracks.find((track) => track.id === trackId))
      .filter(Boolean)
      .map(normalizeTrackRecord);

    if (!existingTracks.length) {
      const error = new Error("No valid tracks were selected.");
      error.statusCode = 400;
      throw error;
    }

    const deletedTrackIds = new Set(existingTracks.map((track) => track.id));
    db.tracks = db.tracks.filter((track) => !deletedTrackIds.has(track.id));
    db.playlists = db.playlists.map((playlist) => {
      const nextTrackIds = playlist.trackIds.filter((id) => !deletedTrackIds.has(id));
      return nextTrackIds.length === playlist.trackIds.length
        ? playlist
        : {
            ...playlist,
            trackIds: nextTrackIds,
            updatedAt: new Date().toISOString()
          };
    });
    await writeDbRaw(db);
    return existingTracks;
  });

  deletedTracks.forEach((track) => {
    removeTrackFromProcessingQueue(track.id);
  });

  await Promise.all(
    deletedTracks.flatMap((track) => [
      removeFileIfExists(track.filename ? path.join(UPLOADS_DIR, track.filename) : ""),
      removeFileIfExists(path.join(ARTWORK_DIR, getArtworkFilenameForTrack(track)))
    ])
  );

  return deletedTracks;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeBaseName(file.originalname);
    cb(null, `${safeName}-${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 20,
    fileSize: 60 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error("Only mp3, m4a, and aac files are supported."));
  }
});

app.use(express.json());
app.use("/media", express.static(UPLOADS_DIR));
app.use("/artwork", express.static(ARTWORK_DIR));
app.use("/exports", express.static(EXPORTS_DIR));
app.use(express.static(path.join(ROOT_DIR, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/library", async (_req, res, next) => {
  try {
    const db = await readDb();
    const tracks = db.tracks.map((entry) => {
      const track = normalizeTrackRecord(entry);

      if (needsTrackProcessing(track)) {
        track.processing = true;
        enqueueTrackProcessing(track.id);
      }

      return track;
    });

    res.json({
      ...db,
      settings: {
        ...db.settings,
        availableCpuCount: AVAILABLE_CPU_COUNT
      },
      tracks
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings", async (req, res, next) => {
  try {
    const hasTargetLufs = req.body?.targetLufs !== undefined;
    const targetLufs = hasTargetLufs ? normalizeTargetLufs(req.body?.targetLufs) : null;
    const processingCores = normalizeProcessingCores(req.body?.processingCores);

    if (hasTargetLufs && targetLufs === null) {
      res.status(400).json({ error: "targetLufs must be between -30 and -6." });
      return;
    }

    if (req.body?.processingCores !== undefined && processingCores === null) {
      res.status(400).json({ error: `processingCores must be between 1 and ${AVAILABLE_CPU_COUNT}.` });
      return;
    }

    const settings = await queueDbTask(async () => {
      const db = await readDbRaw();
      if (hasTargetLufs) {
        db.settings.targetLufs = targetLufs;
      }
      db.settings.processingCores = processingCores ?? db.settings.processingCores ?? processingConcurrency;
      await writeDbRaw(db);
      return db.settings;
    });

    applyRuntimeProcessingCores(settings.processingCores);
    void runTrackProcessingQueue();

    res.json({
      ...settings,
      availableCpuCount: AVAILABLE_CPU_COUNT
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/convert", async (req, res, next) => {
  try {
    const mode = req.body?.mode === "overwrite" ? "overwrite" : req.body?.mode === "download" ? "download" : null;
    const targetLufs = normalizeTargetLufs(req.body?.targetLufs);
    const applyEq = Boolean(req.body?.applyEq);
    const eqBands = normalizeEqBandsInput(req.body?.eqBands);
    const trackIds = Array.isArray(req.body?.trackIds) ? [...new Set(req.body.trackIds.map((id) => String(id)))] : [];

    if (!mode) {
      res.status(400).json({ error: "mode must be download or overwrite." });
      return;
    }

    if (targetLufs === null) {
      res.status(400).json({ error: "targetLufs must be between -30 and -6." });
      return;
    }

    if (!trackIds.length) {
      res.status(400).json({ error: "Please choose at least one track." });
      return;
    }

    const db = await readDb();
    const tracks = trackIds
      .map((trackId) => db.tracks.find((track) => track.id === trackId))
      .filter(Boolean)
      .map(normalizeTrackRecord)
      .filter((track) => track.filename);

    if (!tracks.length) {
      res.status(400).json({ error: "No valid tracks were selected." });
      return;
    }

    if (mode === "download") {
      const items = await mapWithConcurrency(tracks, conversionConcurrency, async (track) => {
        const sourcePath = path.join(UPLOADS_DIR, track.filename);
        const extension = getOutputExtension(track.extension);
        const exportFilename = buildExportFilename(track, targetLufs, extension);
        const outputPath = path.join(EXPORTS_DIR, exportFilename);

        await fsp.access(sourcePath, fs.constants.F_OK);
        await convertTrackFile({
          sourcePath,
          outputPath,
          extension,
          targetLufs,
          applyEq,
          eqBands,
          analysis: track.analysis
        });

        return {
          trackId: track.id,
          title: track.title,
          fileName: exportFilename,
          downloadUrl: `/exports/${encodeURIComponent(exportFilename)}`
        };
      });

      res.json({
        ok: true,
        items
      });
      return;
    }

    const overwrittenTrackIds = await mapWithConcurrency(tracks, conversionConcurrency, async (track) => {
      const sourcePath = path.join(UPLOADS_DIR, track.filename);
      const extension = getOutputExtension(track.extension);
      const tempFilename = `${track.id}-${crypto.randomUUID()}${extension}`;
      const tempPath = path.join(UPLOADS_DIR, tempFilename);

      await fsp.access(sourcePath, fs.constants.F_OK);

      try {
        await convertTrackFile({
          sourcePath,
          outputPath: tempPath,
          extension,
          targetLufs,
          applyEq,
          eqBands,
          analysis: track.analysis
        });

        await replaceFileAtomic(tempPath, sourcePath);
        return track.id;
      } finally {
        await fsp.rm(tempPath, { force: true }).catch(() => {});
      }
    });

    const refreshedAt = new Date().toISOString();

    await queueDbTask(async () => {
      const currentDb = await readDbRaw();
      currentDb.tracks = currentDb.tracks.map((entry) => {
        const track = normalizeTrackRecord(entry);

        if (!overwrittenTrackIds.includes(track.id)) {
          return track;
        }

        return {
          ...track,
          duration: null,
          analysis: null,
          processing: true,
          metadataVersion: 0,
          metadataReady: false,
          analysisReady: false,
          processingError: null,
          processedAt: refreshedAt
        };
      });

      await writeDbRaw(currentDb);
    });

    overwrittenTrackIds.forEach((trackId) => {
      enqueueTrackProcessing(trackId);
    });

    res.json({
      ok: true,
      count: overwrittenTrackIds.length
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/playlists", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const trackIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds.map((id) => String(id)) : [];

    if (!name) {
      res.status(400).json({ error: "Playlist name is required." });
      return;
    }

    if (!trackIds.length) {
      res.status(400).json({ error: "Please choose at least one track." });
      return;
    }

    const result = await queueDbTask(async () => {
      const db = await readDbRaw();
      const uniqueTrackIds = [...new Set(trackIds)];
      const validTrackIds = uniqueTrackIds.filter((trackId) => db.tracks.some((track) => track.id === trackId));

      if (!validTrackIds.length) {
        const error = new Error("No valid tracks were selected.");
        error.statusCode = 400;
        throw error;
      }

      const playlist = {
        id: crypto.randomUUID(),
        name,
        trackIds: validTrackIds,
        createdAt: new Date().toISOString()
      };

      db.playlists.unshift(playlist);
      await writeDbRaw(db);

      return {
        playlist,
        playlists: db.playlists
      };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tracks/:trackId", async (req, res, next) => {
  try {
    const trackId = String(req.params.trackId || "").trim();

    if (!trackId) {
      res.status(400).json({ error: "Track id is required." });
      return;
    }

    const deletedTracks = await deleteTracksByIds([trackId]);

    res.json({
      ok: true,
      trackId,
      count: deletedTracks.length
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tracks/delete", async (req, res, next) => {
  try {
    const trackIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds : [];
    const deletedTracks = await deleteTracksByIds(trackIds);

    res.json({
      ok: true,
      count: deletedTracks.length,
      trackIds: deletedTracks.map((track) => track.id)
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/playlists/:playlistId", async (req, res, next) => {
  try {
    const playlistId = String(req.params.playlistId || "").trim();
    const name = String(req.body?.name || "").trim();
    const trackIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds.map((id) => String(id)) : [];

    if (!playlistId) {
      res.status(400).json({ error: "Playlist id is required." });
      return;
    }

    if (!name) {
      res.status(400).json({ error: "Playlist name is required." });
      return;
    }

    if (!trackIds.length) {
      res.status(400).json({ error: "Please choose at least one track." });
      return;
    }

    const result = await queueDbTask(async () => {
      const db = await readDbRaw();
      const playlistIndex = db.playlists.findIndex((playlist) => playlist.id === playlistId);

      if (playlistIndex === -1) {
        const error = new Error("Playlist not found.");
        error.statusCode = 404;
        throw error;
      }

      const uniqueTrackIds = [...new Set(trackIds)];
      const validTrackIds = uniqueTrackIds.filter((trackId) => db.tracks.some((track) => track.id === trackId));

      if (!validTrackIds.length) {
        const error = new Error("No valid tracks were selected.");
        error.statusCode = 400;
        throw error;
      }

      const playlist = {
        ...db.playlists[playlistIndex],
        name,
        trackIds: validTrackIds,
        updatedAt: new Date().toISOString()
      };

      db.playlists[playlistIndex] = playlist;
      await writeDbRaw(db);

      return {
        playlist,
        playlists: db.playlists
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/playlists/:playlistId", async (req, res, next) => {
  try {
    const playlistId = String(req.params.playlistId || "").trim();

    if (!playlistId) {
      res.status(400).json({ error: "Playlist id is required." });
      return;
    }

    const result = await queueDbTask(async () => {
      const db = await readDbRaw();
      const playlistIndex = db.playlists.findIndex((playlist) => playlist.id === playlistId);

      if (playlistIndex === -1) {
        const error = new Error("Playlist not found.");
        error.statusCode = 404;
        throw error;
      }

      const [playlist] = db.playlists.splice(playlistIndex, 1);
      await writeDbRaw(db);

      return {
        playlist,
        playlists: db.playlists
      };
    });

    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/upload", upload.array("tracks", 20), async (req, res, next) => {
  try {
    const files = req.files || [];

    if (!files.length) {
      res.status(400).json({ error: "No files uploaded." });
      return;
    }

    const result = await queueDbTask(async () => {
      const db = await readDbRaw();
      const createdTracks = [];
      const replacedAssets = [];

      for (const file of files) {
        const existingIndex = db.tracks.findIndex(
          (track) => String(track.originalName || "").trim().toLowerCase() === String(file.originalname || "").trim().toLowerCase()
        );

        const existingTrack = existingIndex === -1 ? null : normalizeTrackRecord(db.tracks[existingIndex]);
        const track = normalizeTrackRecord({
          ...(existingTrack || {}),
          id: existingTrack?.id || crypto.randomUUID(),
          title: sanitizeBaseName(file.originalname),
          artist: "Unknown Artist",
          lyrics: "",
          coverUrl: null,
          originalName: file.originalname,
          filename: file.filename,
          mimeType: file.mimetype,
          extension: path.extname(file.originalname).toLowerCase(),
          size: file.size,
          url: `/media/${encodeURIComponent(file.filename)}`,
          uploadedAt: new Date().toISOString(),
          duration: null,
          analysis: null,
          processing: true,
          metadataVersion: 0,
          metadataReady: false,
          analysisReady: false,
          processingError: null,
          processedAt: null
        });

        if (existingTrack) {
          db.tracks[existingIndex] = track;
          replacedAssets.push({
            filename: existingTrack.filename,
            artworkFilename: getArtworkFilenameForTrack(existingTrack),
            trackId: existingTrack.id
          });
        } else {
          db.tracks.unshift(track);
        }

        createdTracks.push(track);
      }

      await writeDbRaw(db);

      return {
        tracks: createdTracks,
        replacedAssets,
        settings: db.settings
      };
    });

    result.tracks.forEach((track) => {
      removeTrackFromProcessingQueue(track.id);
      enqueueTrackProcessing(track.id);
    });

    await Promise.all(
      (result.replacedAssets || []).flatMap((asset) => [
        removeFileIfExists(asset.filename ? path.join(UPLOADS_DIR, asset.filename) : ""),
        removeFileIfExists(path.join(ARTWORK_DIR, asset.artworkFilename))
      ])
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const message = String(error?.message || "Unexpected server error.");
  const status =
    error?.statusCode ||
    (error?.code === "LIMIT_FILE_SIZE" || error?.code === "LIMIT_FILE_COUNT" ? 400 : null) ||
    (message.includes("supported") ? 400 : 500);

  res.status(status).json({
    error: message
  });
});

ensureDataFiles()
  .then(async () => {
    const db = await readDb();
    applyRuntimeProcessingCores(db.settings.processingCores);
    db.tracks.map(normalizeTrackRecord).filter(needsTrackProcessing).forEach((track) => {
      enqueueTrackProcessing(track.id);
    });

    app.listen(port, () => {
      console.log(
        `Music player listening on http://localhost:${port} (processing=${processingConcurrency}, convert=${conversionConcurrency}, visibleCpu=${AVAILABLE_CPU_COUNT})`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to initialize data directory:", error);
    process.exit(1);
  });
