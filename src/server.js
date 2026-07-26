const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const multer = require("multer");

const app = express();
const port = process.env.PORT || 3000;

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "tracks.json");
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".m4a", ".aac"]);
const DEFAULT_TARGET_LUFS = Number(process.env.DEFAULT_TARGET_LUFS || -14);

async function ensureDataFiles() {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });

  try {
    await fsp.access(DB_PATH, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(
      DB_PATH,
      JSON.stringify(
        {
          settings: {
            targetLufs: DEFAULT_TARGET_LUFS
          },
          tracks: []
        },
        null,
        2
      )
    );
  }
}

async function readDb() {
  const content = await fsp.readFile(DB_PATH, "utf8");
  return JSON.parse(content);
}

async function writeDb(data) {
  await fsp.writeFile(DB_PATH, JSON.stringify(data, null, 2));
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

  const loudness = parseLoudnorm(stderr);

  return {
    duration,
    analysis: loudness
  };
}

function sanitizeBaseName(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "track";
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
app.use(express.static(path.join(ROOT_DIR, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/library", async (_req, res, next) => {
  try {
    const db = await readDb();
    res.json(db);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings", async (req, res, next) => {
  try {
    const targetLufs = Number(req.body?.targetLufs);

    if (!Number.isFinite(targetLufs) || targetLufs > -6 || targetLufs < -30) {
      res.status(400).json({ error: "targetLufs must be between -30 and -6." });
      return;
    }

    const db = await readDb();
    db.settings.targetLufs = targetLufs;
    await writeDb(db);
    res.json(db.settings);
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

    const db = await readDb();
    const createdTracks = [];

    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file.filename);
      const { duration, analysis } = await analyzeTrack(filePath).catch(() => ({
        duration: null,
        analysis: null
      }));

      const track = {
        id: crypto.randomUUID(),
        title: sanitizeBaseName(file.originalname),
        originalName: file.originalname,
        filename: file.filename,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname).toLowerCase(),
        size: file.size,
        url: `/media/${encodeURIComponent(file.filename)}`,
        uploadedAt: new Date().toISOString(),
        duration,
        analysis
      };

      db.tracks.unshift(track);
      createdTracks.push(track);
    }

    await writeDb(db);
    res.status(201).json({ tracks: createdTracks, settings: db.settings });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.message.includes("supported") ? 400 : 500;
  res.status(status).json({
    error: error.message || "Unexpected server error."
  });
});

ensureDataFiles()
  .then(() => {
    app.listen(port, () => {
      console.log(`Music player listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize data directory:", error);
    process.exit(1);
  });
