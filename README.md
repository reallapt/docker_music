# Docker Music Player

An Apple Music inspired web music player with a Liquid Glass interface, LUFS loudness leveling, browser EQ, FPS monitoring, drag-and-drop import, playlist management, and Docker deployment.

这是一个基于 Docker 的网页音乐播放器，整体界面参考 Apple Music，采用 Liquid Glass 风格，支持 LUFS 响度校正、浏览器端 EQ、拖拽导入和 Docker 部署。

## Features / 特性

- Liquid Glass UI / 液态玻璃界面
- Large artwork + bottom playback bar / 大封面与底部播放条
- Timed lyrics support / 支持时间轴歌词
- LUFS auto leveling / LUFS 自动响度校正
- Browser EQ / 浏览器端均衡器
- EN / 中文 language switch / 中英文切换

## Supported Formats / 支持格式

- `.mp3`
- `.m4a`
- `.aac`
- `.wav`
- `.flac`
- `.ogg`

## Highlights / 本次更新

- Optional live FPS monitor with local persistence.
- Playlist create, edit, delete, and track removal.
- Duplicate uploads replace the existing track instead of creating duplicates.
- Improved lyrics parsing, metadata refresh, responsive polling, and reduced-motion behavior.

## Docker Hub Image / Docker Hub 镜像

- Repository: `reallapt/docker_music`
- Recommended tag: `v2`

## Quick Start With Tag / 使用 Tag 快速启动

### 1. Pull Image / 拉取镜像

```bash
docker pull reallapt/docker_music:v2
```

### 2. Run Container / 运行容器

```bash
docker run -d \
  --name docker-music-player \
  -p 3002:3000 \
  -e PORT=3000 \
  -e DEFAULT_TARGET_LUFS=-14 \
  -e PROCESSING_CONCURRENCY=all \
  -e CONVERSION_CONCURRENCY=all \
  -v ./data:/app/data \
  reallapt/docker_music:v2
```

Then open `http://localhost:3002`.

然后打开 `http://localhost:3002`。

## Docker Compose With Tag / 使用 Tag 的 Docker Compose

Create a `docker-compose.yml` like this:

按下面内容创建 `docker-compose.yml`：

```yaml
services:
  music-player:
    image: reallapt/docker_music:v2
    container_name: docker-music-player
    ports:
      - "3002:3000"
    environment:
      PORT: 3000
      DEFAULT_TARGET_LUFS: -14
      PROCESSING_CONCURRENCY: all
      CONVERSION_CONCURRENCY: all
    volumes:
      - ./data:/app/data
```

Start it with:

启动命令：

```bash
docker compose up -d
```

## Update To A New Tag / 升级到新 Tag

```bash
docker pull reallapt/docker_music:v2
docker compose down
docker compose up -d
```

If you want the newest build and accept mutable tags, you can also use:

如果你想直接使用最新构建，也可以使用：

```bash
docker pull reallapt/docker_music:latest
```

## Local Source Build / 本地源码构建

```bash
git clone https://github.com/reallapt/docker_music.git
cd docker_music
docker compose up --build -d
```

## Notes / 说明

- Uploaded files are stored in `/app/data`.
- The container listens on port `3000`.
- The example above maps host port `3002` to container port `3000`.

## Project Note / 项目说明

This v2 release includes the FPS switch and monitor, playlist management fixes, duplicate-upload replacement, improved lyric extraction, responsive polling and animation optimizations, playback-history fixes, and settings persistence fixes.
