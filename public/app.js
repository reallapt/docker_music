const state = {
  tracks: [],
  currentTrackId: null,
  settings: {
    targetLufs: -14
  },
  autoLevelEnabled: true,
  isUploading: false,
  audioContext: null,
  sourceNode: null,
  inputGainNode: null,
  compressorNode: null,
  eqNodes: [],
  language: localStorage.getItem("music-player-language") || "en"
};

const translations = {
  en: {
    pageTitle: "Liquid Glass Music Player",
    brandEyebrow: "Liquid Glass Audio",
    navLibrary: "Library",
    navCustomize: "Customize",
    importEyebrow: "Import",
    dropzoneBadge: "Import",
    dropzoneTitle: "Drop tracks into your library",
    dropzoneMeta: "MP3, M4A, AAC",
    uploadButtonIdle: "Import and Analyze",
    uploadButtonBusy: "Importing...",
    subnavPlayback: "Playback",
    subnavEqualizer: "Equalizer",
    libraryTitle: "Choose music from a full-screen listening layout",
    libraryHero:
      "The app now behaves like a mainstream music player: navigation on the left, full-size listening pages on the right.",
    pillAdaptive: "Adaptive layout",
    pillCustom: "Custom player",
    pillApple: "Apple Music inspired",
    nowPlayingEyebrow: "Now Playing",
    mainPlaybackSurface: "Main playback surface",
    statsTracks: "Tracks",
    statsTracksMeta: "Total imported songs in your local library.",
    statsAnalyzed: "Analyzed",
    statsAnalyzedMeta: "Tracks with integrated loudness data available.",
    statsAverageLufs: "Average LUFS",
    statsAverageLufsMeta: "Quick snapshot of your imported library loudness.",
    statsAutoLevel: "Auto level",
    statsAutoLevelMeta: "Playback compensation follows your current LUFS target.",
    musicEyebrow: "Music",
    libraryMenuTitle: "Library Menu",
    libraryMenuMeta: "Choose a song from the right-side content page just like a modern streaming app.",
    customizeTitle: "Tune playback behavior and EQ from one menu section",
    customizeHero:
      "Playback and equalizer settings now live under Customize instead of taking over the main player page.",
    playbackTitle: "Main listening controls",
    playbackMeta: "Adjust LUFS target and overall leveling behavior here.",
    targetLufs: "Target LUFS",
    oneClickLeveling: "One-click leveling",
    enablePlaybackComp: "Enable playback compensation",
    usesMeasuredLoudness: "Uses measured loudness per track.",
    savedTarget: "Saved target",
    saveTargetButton: "Save Target LUFS",
    smartNote: "Smart note",
    eqTitle: "Glass EQ deck",
    eqMeta: "Adjust tone in real time without rewriting the source audio.",
    resetEqButton: "Reset Equalizer",
    volume: "Volume",
    none: "None",
    enabled: "Enabled",
    disabled: "Disabled",
    noTrackSelected: "No track selected",
    noTrackMeta: "Import tracks and choose one from the library menu.",
    bottomNoTrackMeta: "Choose a track from the library to start.",
    unknownDuration: "Unknown duration",
    lufsUnavailable: "LUFS analysis unavailable",
    suggestedCompensation: "Suggested compensation {value} dB",
    noTracksYet: "No tracks yet",
    uploadSongsPrompt: "Upload a few songs and the server will analyze their loudness automatically.",
    noAnalysis: "No analysis",
    playing: "Playing",
    play: "Play",
    pause: "Pause",
    measuredLoudnessMeta: "Measured loudness {lufs} LUFS, target {target} LUFS",
    noLoudnessMeta: "This track does not have loudness analysis data.",
    lowerTargetHint: "Lower targets preserve more headroom and feel gentler across the library.",
    higherTargetHint: "This target is louder and will ask for more gain reduction on already hot masters.",
    defaultTargetHint: "Most streaming playback targets sit close to -14 LUFS.",
    chooseAudioFiles: "Please choose at least one audio file.",
    uploadingStatus: "Uploading and analyzing loudness. This may take a moment.",
    uploadFailed: "Upload failed. Please try again.",
    importedStatus: "Imported {count} track(s) and finished loudness analysis.",
    saveFailed: "Save failed.",
    saveSuccess: "Target LUFS saved as {value}.",
    libraryLoadFailed: "Failed to load the library. Please refresh and try again.",
    filesReady: "{count} file(s) ready to import"
  },
  zh: {
    pageTitle: "液态玻璃音乐播放器",
    brandEyebrow: "液态玻璃音频",
    navLibrary: "音乐库",
    navCustomize: "自定义",
    importEyebrow: "导入",
    dropzoneBadge: "导入",
    dropzoneTitle: "把音乐拖进你的音乐库",
    dropzoneMeta: "支持 MP3、M4A、AAC",
    uploadButtonIdle: "导入并分析",
    uploadButtonBusy: "导入中...",
    subnavPlayback: "播放",
    subnavEqualizer: "均衡器",
    libraryTitle: "在全屏沉浸式布局中选择音乐",
    libraryHero: "现在的界面更像主流音乐软件：左边是导航菜单，右边是全尺寸内容页面。",
    pillAdaptive: "自适应布局",
    pillCustom: "自定义播放器",
    pillApple: "Apple Music 风格",
    nowPlayingEyebrow: "正在播放",
    mainPlaybackSurface: "主播放区域",
    statsTracks: "歌曲数",
    statsTracksMeta: "本地音乐库中已导入的歌曲总数。",
    statsAnalyzed: "已分析",
    statsAnalyzedMeta: "已经拿到响度数据的歌曲数量。",
    statsAverageLufs: "平均 LUFS",
    statsAverageLufsMeta: "快速查看当前音乐库的平均响度。",
    statsAutoLevel: "自动平衡",
    statsAutoLevelMeta: "播放补偿会跟随你当前设定的 LUFS 目标。",
    musicEyebrow: "音乐",
    libraryMenuTitle: "音乐菜单",
    libraryMenuMeta: "像现代流媒体播放器一样，在右侧内容区选择要播放的歌曲。",
    customizeTitle: "在同一菜单中统一调整播放与 EQ",
    customizeHero: "播放设置和均衡器都收纳到了自定义菜单里，不再占用主播放器页面。",
    playbackTitle: "播放控制",
    playbackMeta: "在这里调整目标 LUFS 和整体自动平衡行为。",
    targetLufs: "目标 LUFS",
    oneClickLeveling: "一键平衡",
    enablePlaybackComp: "启用播放补偿",
    usesMeasuredLoudness: "基于每首歌测得的响度进行补偿。",
    savedTarget: "已保存目标",
    saveTargetButton: "保存目标 LUFS",
    smartNote: "智能提示",
    eqTitle: "玻璃感 EQ 面板",
    eqMeta: "实时调节音色，不会改写原始音频文件。",
    resetEqButton: "重置均衡器",
    volume: "音量",
    none: "无",
    enabled: "已开启",
    disabled: "已关闭",
    noTrackSelected: "还没有选择歌曲",
    noTrackMeta: "先导入音乐，然后从音乐库菜单里选择一首歌。",
    bottomNoTrackMeta: "从音乐库里选择一首歌开始播放。",
    unknownDuration: "未知时长",
    lufsUnavailable: "暂无 LUFS 分析数据",
    suggestedCompensation: "建议补偿 {value} dB",
    noTracksYet: "还没有歌曲",
    uploadSongsPrompt: "上传几首歌后，服务器会自动分析它们的响度。",
    noAnalysis: "未分析",
    playing: "播放中",
    play: "播放",
    pause: "暂停",
    measuredLoudnessMeta: "测得响度 {lufs} LUFS，当前目标 {target} LUFS",
    noLoudnessMeta: "这首歌暂时没有响度分析数据。",
    lowerTargetHint: "更低的目标值会保留更多动态余量，整体听感更柔和。",
    higherTargetHint: "这个目标更响，会对已经很热的母带施加更多增益衰减。",
    defaultTargetHint: "大多数流媒体平台的播放目标都接近 -14 LUFS。",
    chooseAudioFiles: "请至少选择一个音频文件。",
    uploadingStatus: "正在上传并分析响度，请稍等片刻。",
    uploadFailed: "上传失败，请重试。",
    importedStatus: "已导入 {count} 首歌曲，并完成响度分析。",
    saveFailed: "保存失败。",
    saveSuccess: "目标 LUFS 已保存为 {value}。",
    libraryLoadFailed: "音乐库加载失败，请刷新页面后重试。",
    filesReady: "已有 {count} 个文件待导入"
  }
};

const eqBands = [
  { key: "sub", label: "60Hz", type: "lowshelf", frequency: 60, gain: 0 },
  { key: "low", label: "170Hz", type: "peaking", frequency: 170, q: 1, gain: 0 },
  { key: "mid", label: "350Hz", type: "peaking", frequency: 350, q: 1, gain: 0 },
  { key: "presence", label: "1kHz", type: "peaking", frequency: 1000, q: 1.1, gain: 0 },
  { key: "air", label: "3.5kHz", type: "highshelf", frequency: 3500, gain: 0 }
];

const uploadForm = document.querySelector("#uploadForm");
const fileInput = document.querySelector("#trackFiles");
const uploadStatus = document.querySelector("#uploadStatus");
const uploadButton = document.querySelector("#uploadButton");
const libraryEl = document.querySelector("#library");
const navItems = document.querySelectorAll("[data-view]");
const contentPanels = document.querySelectorAll(".content-panel");
const customizeMenu = document.querySelector("#customizeMenu");
const customizeItems = document.querySelectorAll("[data-customize-view]");
const customizePanels = document.querySelectorAll(".customize-panel");
const audioPlayer = document.querySelector("#audioPlayer");
const targetLufsSlider = document.querySelector("#targetLufs");
const targetLufsReadout = document.querySelector("#targetLufsReadout");
const targetLufsValue = document.querySelector("#targetLufsValue");
const autoLevelToggle = document.querySelector("#autoLevelToggle");
const autoLevelState = document.querySelector("#autoLevelState");
const saveLufsButton = document.querySelector("#saveLufsButton");
const nowPlayingTitle = document.querySelector("#nowPlayingTitle");
const nowPlayingMeta = document.querySelector("#nowPlayingMeta");
const bottomNowPlayingTitle = document.querySelector("#bottomNowPlayingTitle");
const bottomNowPlayingMeta = document.querySelector("#bottomNowPlayingMeta");
const dropzone = document.querySelector("#dropzone");
const dropzoneTitle = document.querySelector("#dropzoneTitle");
const dropzoneMeta = document.querySelector("#dropzoneMeta");
const eqControls = document.querySelector("#eqControls");
const resetEqButton = document.querySelector("#resetEqButton");
const trackCount = document.querySelector("#trackCount");
const analyzedCount = document.querySelector("#analyzedCount");
const currentTrackDisplay = document.querySelector("#currentTrackDisplay");
const averageLufs = document.querySelector("#averageLufs");
const levelingHint = document.querySelector("#levelingHint");
const playPauseButton = document.querySelector("#playPauseButton");
const prevTrackButton = document.querySelector("#prevTrackButton");
const nextTrackButton = document.querySelector("#nextTrackButton");
const seekBar = document.querySelector("#seekBar");
const currentTimeLabel = document.querySelector("#currentTimeLabel");
const durationLabel = document.querySelector("#durationLabel");
const volumeSlider = document.querySelector("#volumeSlider");
const recordDisc = document.querySelector("#recordDisc");
const langEnButton = document.querySelector("#langEnButton");
const langZhButton = document.querySelector("#langZhButton");

let currentView = "library";
let currentCustomizeView = "playback";

function t(key, vars = {}) {
  const dictionary = translations[state.language] || translations.en;
  const template = dictionary[key] || translations.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, token) => String(vars[token] ?? ""));
}

function applyTranslations() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  uploadButton.textContent = state.isUploading ? t("uploadButtonBusy") : t("uploadButtonIdle");
  saveLufsButton.textContent = t("saveTargetButton");
  resetEqButton.textContent = t("resetEqButton");
  langEnButton.classList.toggle("active", state.language === "en");
  langZhButton.classList.toggle("active", state.language === "zh");
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return t("unknownDuration");
  }

  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function setUploadState(isUploading, message = "") {
  state.isUploading = isUploading;
  uploadButton.disabled = isUploading;
  uploadButton.textContent = isUploading ? t("uploadButtonBusy") : t("uploadButtonIdle");
  if (message) {
    uploadStatus.textContent = message;
  }
}

function formatGainComp(track) {
  const integrated = track.analysis?.inputI;
  if (!Number.isFinite(integrated)) {
    return t("lufsUnavailable");
  }

  const delta = state.settings.targetLufs - integrated;
  const formatted = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  return t("suggestedCompensation", { value: formatted });
}

function gainToLinear(db) {
  return Math.pow(10, db / 20);
}

function getCurrentTrack() {
  return state.tracks.find((track) => track.id === state.currentTrackId) || null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderNavigation() {
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === currentView);
  });

  contentPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${currentView}View`);
  });

  customizeMenu.style.display = currentView === "customize" ? "grid" : "none";

  customizeItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.customizeView === currentCustomizeView);
  });

  customizePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${currentCustomizeView}Panel`);
  });
}

function renderLibrary() {
  if (!state.tracks.length) {
    libraryEl.innerHTML = `
      <div class="track-card">
        <div class="track-main">
          <strong>${escapeHtml(t("noTracksYet"))}</strong>
          <span class="track-meta">${escapeHtml(t("uploadSongsPrompt"))}</span>
        </div>
      </div>
    `;
    return;
  }

  libraryEl.innerHTML = state.tracks
    .map((track) => {
      const isActive = track.id === state.currentTrackId;
      const integrated = track.analysis?.inputI;
      const pillClass = Number.isFinite(integrated) ? "good" : "warn";
      const lufsText = Number.isFinite(integrated) ? `${integrated.toFixed(1)} LUFS` : t("noAnalysis");

      return `
        <article class="track-card ${isActive ? "active" : ""}">
          <div class="track-main">
            <div class="track-title-row">
              <strong>${escapeHtml(track.title)}</strong>
              <span class="pill ${pillClass}">${escapeHtml(lufsText)}</span>
            </div>
            <span class="track-meta">${escapeHtml(track.originalName)} | ${escapeHtml(formatDuration(track.duration))}</span>
            <span class="track-analysis">${escapeHtml(formatGainComp(track))}</span>
          </div>
          <button class="track-play" data-track-id="${track.id}">${isActive ? t("playing") : t("play")}</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-track-id]").forEach((button) => {
    button.addEventListener("click", () => {
      currentView = "library";
      renderNavigation();
      playTrack(button.dataset.trackId);
    });
  });
}

function renderOverview() {
  const analyzedTracks = state.tracks.filter((track) => Number.isFinite(track.analysis?.inputI));
  const average =
    analyzedTracks.reduce((sum, track) => sum + track.analysis.inputI, 0) / (analyzedTracks.length || 1);
  const currentTrack = getCurrentTrack();

  trackCount.textContent = String(state.tracks.length);
  analyzedCount.textContent = String(analyzedTracks.length);
  currentTrackDisplay.textContent = currentTrack ? currentTrack.title : t("none");
  averageLufs.textContent = analyzedTracks.length ? `${average.toFixed(1)} LUFS` : "--";
}

function renderNowPlaying(track = null) {
  if (!track) {
    nowPlayingTitle.textContent = t("noTrackSelected");
    nowPlayingMeta.textContent = t("noTrackMeta");
    bottomNowPlayingTitle.textContent = t("noTrackSelected");
    bottomNowPlayingMeta.textContent = t("bottomNoTrackMeta");
    playPauseButton.textContent = t("play");
    currentTimeLabel.textContent = "0:00";
    durationLabel.textContent = "0:00";
    seekBar.value = "0";
    return;
  }

  const meta = Number.isFinite(track.analysis?.inputI)
    ? t("measuredLoudnessMeta", { lufs: track.analysis.inputI.toFixed(1), target: state.settings.targetLufs })
    : t("noLoudnessMeta");

  nowPlayingTitle.textContent = track.title;
  nowPlayingMeta.textContent = meta;
  bottomNowPlayingTitle.textContent = track.title;
  bottomNowPlayingMeta.textContent = meta;
}

function renderPlayState() {
  const hasTrack = Boolean(getCurrentTrack());
  playPauseButton.textContent = audioPlayer.paused || !hasTrack ? t("play") : t("pause");
  recordDisc.style.animationPlayState = audioPlayer.paused ? "paused" : "running";
}

function updateTimeline() {
  const currentTime = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  currentTimeLabel.textContent = formatDuration(currentTime);
  durationLabel.textContent = duration > 0 ? formatDuration(duration) : "0:00";

  if (duration > 0) {
    seekBar.value = String(Math.round((currentTime / duration) * 1000));
  } else {
    seekBar.value = "0";
  }
}

function getTrackIndex(trackId) {
  return state.tracks.findIndex((track) => track.id === trackId);
}

async function playAdjacentTrack(direction) {
  if (!state.tracks.length) {
    return;
  }

  const currentIndex = getTrackIndex(state.currentTrackId);
  const safeIndex = currentIndex === -1 ? 0 : (currentIndex + direction + state.tracks.length) % state.tracks.length;
  await playTrack(state.tracks[safeIndex].id);
}

function renderTargetLufs() {
  const value = `${state.settings.targetLufs} LUFS`;
  targetLufsSlider.value = String(state.settings.targetLufs);
  targetLufsReadout.textContent = value;
  targetLufsValue.textContent = value;

  if (state.settings.targetLufs < -14) {
    levelingHint.textContent = t("lowerTargetHint");
  } else if (state.settings.targetLufs > -14) {
    levelingHint.textContent = t("higherTargetHint");
  } else {
    levelingHint.textContent = t("defaultTargetHint");
  }
}

function renderAutoLevelState() {
  autoLevelToggle.checked = state.autoLevelEnabled;
  autoLevelState.textContent = state.autoLevelEnabled ? t("enabled") : t("disabled");
}

async function ensureAudioGraph() {
  if (state.audioContext) {
    if (state.audioContext.state === "suspended") {
      await state.audioContext.resume();
    }
    return;
  }

  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextRef();
  const source = context.createMediaElementSource(audioPlayer);
  const inputGain = context.createGain();
  const compressor = context.createDynamicsCompressor();

  compressor.threshold.value = -18;
  compressor.knee.value = 14;
  compressor.ratio.value = 2.2;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.24;

  const eqNodes = eqBands.map((band) => {
    const node = context.createBiquadFilter();
    node.type = band.type;
    node.frequency.value = band.frequency;
    node.gain.value = band.gain;
    if (band.q) {
      node.Q.value = band.q;
    }
    return node;
  });

  source.connect(inputGain);
  let chainHead = inputGain;
  eqNodes.forEach((node) => {
    chainHead.connect(node);
    chainHead = node;
  });
  chainHead.connect(compressor);
  compressor.connect(context.destination);

  state.audioContext = context;
  state.sourceNode = source;
  state.inputGainNode = inputGain;
  state.compressorNode = compressor;
  state.eqNodes = eqNodes;
}

function applyTrackLeveling() {
  if (!state.inputGainNode) {
    return;
  }

  const currentTrack = getCurrentTrack();
  const integrated = currentTrack?.analysis?.inputI;

  if (!state.autoLevelEnabled || !Number.isFinite(integrated)) {
    state.inputGainNode.gain.value = 1;
    return;
  }

  const delta = state.settings.targetLufs - integrated;
  state.inputGainNode.gain.value = gainToLinear(delta);
}

async function playTrack(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track) {
    return;
  }

  await ensureAudioGraph();
  state.currentTrackId = track.id;
  audioPlayer.src = track.url;
  renderNowPlaying(track);
  applyTrackLeveling();
  renderLibrary();
  renderOverview();
  await audioPlayer.play();
  renderPlayState();
}

function buildEqControls() {
  eqControls.innerHTML = eqBands
    .map(
      (band, index) => `
        <label class="eq-band">
          <strong>${band.label}</strong>
          <input type="range" min="-12" max="12" step="0.5" value="${band.gain}" data-eq-index="${index}" />
          <span id="eq-value-${index}">${band.gain} dB</span>
        </label>
      `
    )
    .join("");

  document.querySelectorAll("[data-eq-index]").forEach((input) => {
    input.addEventListener("input", async (event) => {
      const index = Number(event.currentTarget.dataset.eqIndex);
      const value = Number(event.currentTarget.value);
      eqBands[index].gain = value;
      document.querySelector(`#eq-value-${index}`).textContent = `${value} dB`;
      await ensureAudioGraph();
      state.eqNodes[index].gain.value = value;
    });
  });
}

function setLanguage(language) {
  state.language = language === "zh" ? "zh" : "en";
  localStorage.setItem("music-player-language", state.language);
  applyTranslations();
  renderTargetLufs();
  renderAutoLevelState();
  renderLibrary();
  renderOverview();
  renderNowPlaying(getCurrentTrack());
  renderPlayState();
  updateDropzoneText();
}

async function fetchLibrary() {
  const response = await fetch("/api/library");
  const payload = await response.json();
  state.tracks = payload.tracks || [];
  state.settings = payload.settings || state.settings;
  renderTargetLufs();
  renderLibrary();
  renderOverview();
  renderNowPlaying(getCurrentTrack());
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!fileInput.files.length) {
    uploadStatus.textContent = t("chooseAudioFiles");
    return;
  }

  const formData = new FormData();
  Array.from(fileInput.files).forEach((file) => {
    formData.append("tracks", file);
  });

  try {
    setUploadState(true, t("uploadingStatus"));

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setUploadState(false, payload.error || t("uploadFailed"));
      return;
    }

    state.tracks = [...payload.tracks, ...state.tracks];
    state.settings = payload.settings || state.settings;
    renderTargetLufs();
    renderLibrary();
    renderOverview();
    uploadStatus.textContent = t("importedStatus", { count: payload.tracks.length });
    uploadForm.reset();
    updateDropzoneText();
    currentView = "library";
    renderNavigation();

    if (payload.tracks.length) {
      await playTrack(payload.tracks[0].id);
    } else {
      renderNowPlaying(getCurrentTrack());
    }
  } catch (_error) {
    setUploadState(false, t("uploadFailed"));
    return;
  }

  setUploadState(false);
});

targetLufsSlider.addEventListener("input", () => {
  state.settings.targetLufs = Number(targetLufsSlider.value);
  renderTargetLufs();
  renderLibrary();
  renderOverview();
  renderNowPlaying(getCurrentTrack());
  applyTrackLeveling();
});

autoLevelToggle.addEventListener("change", () => {
  state.autoLevelEnabled = autoLevelToggle.checked;
  renderAutoLevelState();
  applyTrackLeveling();
});

saveLufsButton.addEventListener("click", async () => {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      targetLufs: state.settings.targetLufs
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    uploadStatus.textContent = payload.error || t("saveFailed");
    return;
  }

  state.settings.targetLufs = payload.targetLufs;
  renderTargetLufs();
  renderLibrary();
  renderOverview();
  renderNowPlaying(getCurrentTrack());
  applyTrackLeveling();
  uploadStatus.textContent = t("saveSuccess", { value: payload.targetLufs });
});

resetEqButton.addEventListener("click", async () => {
  eqBands.forEach((band) => {
    band.gain = 0;
  });
  buildEqControls();
  await ensureAudioGraph();
  state.eqNodes.forEach((node) => {
    node.gain.value = 0;
  });
});

playPauseButton.addEventListener("click", async () => {
  if (!getCurrentTrack() && state.tracks.length) {
    await playTrack(state.tracks[0].id);
    return;
  }

  if (!audioPlayer.src) {
    return;
  }

  if (audioPlayer.paused) {
    await ensureAudioGraph();
    await audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
});

prevTrackButton.addEventListener("click", async () => {
  await playAdjacentTrack(-1);
});

nextTrackButton.addEventListener("click", async () => {
  await playAdjacentTrack(1);
});

seekBar.addEventListener("input", () => {
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  if (duration <= 0) {
    return;
  }
  audioPlayer.currentTime = (Number(seekBar.value) / 1000) * duration;
  updateTimeline();
});

volumeSlider.addEventListener("input", () => {
  audioPlayer.volume = Number(volumeSlider.value) / 100;
});

audioPlayer.addEventListener("play", async () => {
  await ensureAudioGraph();
  applyTrackLeveling();
  renderPlayState();
});

audioPlayer.addEventListener("pause", () => {
  renderPlayState();
});

audioPlayer.addEventListener("loadedmetadata", () => {
  updateTimeline();
});

audioPlayer.addEventListener("timeupdate", () => {
  updateTimeline();
});

audioPlayer.addEventListener("ended", () => {
  playAdjacentTrack(1);
});

fileInput.addEventListener("change", () => {
  updateDropzoneText();
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    currentView = item.dataset.view;
    renderNavigation();
  });
});

customizeItems.forEach((item) => {
  item.addEventListener("click", () => {
    currentCustomizeView = item.dataset.customizeView;
    renderNavigation();
  });
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) {
    return;
  }

  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;
  updateDropzoneText();
});

langEnButton.addEventListener("click", () => {
  setLanguage("en");
});

langZhButton.addEventListener("click", () => {
  setLanguage("zh");
});

function updateDropzoneText() {
  const count = fileInput.files?.length || 0;
  if (!count) {
    dropzoneTitle.textContent = t("dropzoneTitle");
    dropzoneMeta.textContent = t("dropzoneMeta");
    return;
  }

  dropzoneTitle.textContent = t("filesReady", { count });
  dropzoneMeta.textContent = Array.from(fileInput.files)
    .slice(0, 2)
    .map((file) => file.name)
    .join(" | ");
}

applyTranslations();
buildEqControls();
renderAutoLevelState();
renderOverview();
renderNowPlaying();
renderPlayState();
updateTimeline();
updateDropzoneText();
renderNavigation();
fetchLibrary().catch(() => {
  uploadStatus.textContent = t("libraryLoadFailed");
});
