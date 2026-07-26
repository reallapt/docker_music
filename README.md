# Docker Music Player

A Docker-based web music player with:

- audio import for `mp3`, `m4a`, and `aac`
- a browser-side 5-band equalizer
- automatic LUFS analysis with `ffmpeg loudnorm`
- one-click playback leveling by adjusting to a target LUFS value

## Run

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000).

## Features

### Audio import

- Upload tracks from the web UI
- Files are stored in `data/uploads`
- The server measures duration with `ffprobe` and loudness with `ffmpeg loudnorm`

### LUFS leveling

- Default target is `-14 LUFS`
- Each imported track stores measured integrated loudness
- Playback gain is adjusted using `target LUFS - measured LUFS`
- The target LUFS slider can be changed in the UI and saved to the backend

### Equalizer

- Implemented with the Web Audio API
- Real-time playback EQ, without rewriting the original file
- Bands: `60Hz`, `170Hz`, `350Hz`, `1kHz`, `3.5kHz`

## Stack

- Backend: `Node.js`, `Express`, `multer`
- Loudness analysis: `ffmpeg` and the `loudnorm` filter
- Frontend playback pipeline: `AudioContext`
- Container runtime: Docker and Docker Compose

## Notes

- The current one-click leveling feature is playback-time gain compensation. It does not permanently rewrite or re-encode tracks.
- Browser autoplay rules may require one manual play interaction before audio can start.
- If `docker compose build` fails with a daemon error, start Docker Desktop or the Docker engine first.
