# Docker Music Player

A Docker-based web music player with an Apple Music inspired layout, a Liquid Glass visual style, LUFS-based loudness leveling, and a built-in browser equalizer.

## Highlights

- `LUFS auto leveling`
  Upload tracks and automatically analyze integrated loudness with `ffmpeg loudnorm`, then compensate playback gain toward a target LUFS value.

- `Built-in EQ`
  Shape playback in real time with a browser-side equalizer without rewriting the source audio files.

- `Liquid Glass UI`
  A glass-heavy, Apple-inspired visual direction with a left navigation rail, full-screen content area, and custom bottom playback bar.

- `Docker deployment`
  Designed to run through Docker Compose with persistent uploaded media storage.

## Supported Formats

- `mp3`
- `m4a`
- `aac`

## Run

```bash
docker compose up --build
```

Then open `http://localhost:3000` locally, or the mapped server port if deployed remotely.

## Stack

- `Node.js`
- `Express`
- `multer`
- `ffmpeg`
- `Web Audio API`
- `Docker Compose`

## Project Note

This version of the project was written and assembled by OpenAI Codex for the repository owner, including the player UI, upload flow, LUFS leveling logic, equalizer integration, and Docker deployment setup.
