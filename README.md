# Docker Music Player / Docker 音乐播放器

An Apple Music inspired web music player with a Liquid Glass interface, LUFS loudness leveling, browser EQ, drag-and-drop import, and Docker deployment.

这是一个基于 Docker 的网页音乐播放器，整体界面参考 Apple Music，采用 Liquid Glass 视觉风格，支持 LUFS 响度平衡、浏览器端 EQ、拖拽导入和一键部署。

## Features / 特色

- `LUFS Auto Leveling / LUFS 自动平衡`
  Analyze imported tracks with `ffmpeg loudnorm`, read integrated loudness, and compensate playback toward a target LUFS value.
  使用 `ffmpeg loudnorm` 分析导入音频的综合响度，在播放时自动朝目标 LUFS 做增益补偿。

- `One-click Loudness Control / 一键响度控制`
  Adjust the target LUFS from the playback menu and apply a consistent playback experience across your library.
  通过播放菜单直接调整目标 LUFS，让整套音乐库获得更统一的听感。

- `Built-in EQ / 内置均衡器`
  Tune playback in real time with a browser-side equalizer, without rewriting the original audio files.
  在浏览器中实时调节均衡器，不会改写原始音频文件。

- `Liquid Glass UI / 液态玻璃界面`
  Full-screen layout, left navigation, right-side content pages, and a custom bottom playback bar.
  全屏自适应布局、左侧导航、右侧内容页，以及自定义底部播放条。

- `Language Switch / 语言切换`
  Built-in `EN / 中文` toggle for the main UI.
  内置 `EN / 中文` 一键切换。

## Supported Formats / 支持格式
.mp3, .m4a, .aac

## Stack / 技术栈

- `Node.js`
- `Express`
- `multer`
- `ffmpeg`
- `Web Audio API`
- `Docker Compose`

## Quick Start / 快速启动

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

然后打开 `http://localhost:3000`。

## Docker CLI Deployment / Docker 命令行部署

### 1. Clone / 拉取项目

```bash
git clone https://github.com/reallapt/docker_music.git
cd docker_music
```

### 2. Build and Start / 构建并启动

```bash
docker compose build --no-cache
docker compose up -d
```

### 3. View Logs / 查看日志

```bash
docker compose logs -f
```

### 4. Stop Service / 停止服务

```bash
docker compose down
```

### 5. Restart After Update / 更新后重启

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

## Server Example / 服务器部署示例

If you deploy to `/opt/music-player` on a Linux server:

如果你要部署到 Linux 服务器的 `/opt/music-player`：

```bash
sudo mkdir -p /opt/music-player
sudo chown -R $USER:$USER /opt/music-player
cd /opt/music-player
git clone https://github.com/reallapt/docker_music.git .
docker compose build --no-cache
docker compose up -d
```

## Project Note / 项目说明

This version of the project, including the UI, upload workflow, playback logic, LUFS leveling, equalizer integration, and Docker setup, was written and assembled by OpenAI Codex for the repository owner.

这个版本的项目，包括界面、上传流程、播放逻辑、LUFS 平衡、均衡器集成和 Docker 部署结构，均由 OpenAI Codex 为仓库所有者编写与整合完成。
