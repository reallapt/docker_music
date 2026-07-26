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
  eqNodes: []
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

let currentView = "library";
let currentCustomizeView = "playback";

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return "Unknown duration";
  }

  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function setUploadState(isUploading, message = "") {
  state.isUploading = isUploading;
  uploadButton.disabled = isUploading;
  uploadButton.textContent = isUploading ? "Importing..." : "Import and Analyze";
  if (message) {
    uploadStatus.textContent = message;
  }
}

function formatGainComp(track) {
  const integrated = track.analysis?.inputI;
  if (!Number.isFinite(integrated)) {
    return "LUFS analysis unavailable";
  }

  const delta = state.settings.targetLufs - integrated;
  const prefix = delta > 0 ? "+" : "";
  return `Suggested compensation ${prefix}${delta.toFixed(1)} dB`;
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
    libraryEl.innerHTML =
      '<div class="track-card"><div class="track-main"><strong>No tracks yet</strong><span class="track-meta">Upload a few songs and the server will analyze their loudness automatically.</span></div></div>';
    return;
  }

  libraryEl.innerHTML = state.tracks
    .map((track) => {
      const isActive = track.id === state.currentTrackId;
      const integrated = track.analysis?.inputI;
      const pillClass = Number.isFinite(integrated) ? "good" : "warn";
      const lufsText = Number.isFinite(integrated)
        ? `${integrated.toFixed(1)} LUFS`
        : "No analysis";

      return `
        <article class="track-card ${isActive ? "active" : ""}">
          <div class="track-main">
            <div class="track-title-row">
              <strong>${escapeHtml(track.title)}</strong>
              <span class="pill ${pillClass}">${lufsText}</span>
            </div>
            <span class="track-meta">${escapeHtml(track.originalName)} | ${formatDuration(track.duration)}</span>
            <span class="track-analysis">${formatGainComp(track)}</span>
          </div>
          <button class="track-play" data-track-id="${track.id}">${isActive ? "Playing" : "Play"}</button>
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
  currentTrackDisplay.textContent = currentTrack ? currentTrack.title : "None";
  averageLufs.textContent = analyzedTracks.length ? `${average.toFixed(1)} LUFS` : "--";
}

function renderNowPlaying(track = null) {
  if (!track) {
    nowPlayingTitle.textContent = "No track selected";
    nowPlayingMeta.textContent = "Import tracks and choose one from the library menu.";
    bottomNowPlayingTitle.textContent = "No track selected";
    bottomNowPlayingMeta.textContent = "Choose a track from the library to start.";
    playPauseButton.textContent = "Play";
    currentTimeLabel.textContent = "0:00";
    durationLabel.textContent = "0:00";
    seekBar.value = "0";
    return;
  }

  const meta = Number.isFinite(track.analysis?.inputI)
    ? `Measured loudness ${track.analysis.inputI.toFixed(1)} LUFS, target ${state.settings.targetLufs} LUFS`
    : "This track does not have loudness analysis data.";

  nowPlayingTitle.textContent = track.title;
  nowPlayingMeta.textContent = meta;
  bottomNowPlayingTitle.textContent = track.title;
  bottomNowPlayingMeta.textContent = meta;
}

function renderPlayState() {
  const hasTrack = Boolean(getCurrentTrack());
  playPauseButton.textContent = audioPlayer.paused || !hasTrack ? "Play" : "Pause";
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
  levelingHint.textContent =
    state.settings.targetLufs <= -16
      ? "Lower targets preserve more headroom and feel gentler across the library."
      : "This target is louder and will ask for more gain reduction on already hot masters.";
}

function renderAutoLevelState() {
  autoLevelToggle.checked = state.autoLevelEnabled;
  autoLevelState.textContent = state.autoLevelEnabled ? "Enabled" : "Disabled";
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
    uploadStatus.textContent = "Please choose at least one audio file.";
    return;
  }

  const formData = new FormData();
  Array.from(fileInput.files).forEach((file) => {
    formData.append("tracks", file);
  });

  try {
    setUploadState(true, "Uploading and analyzing loudness. This may take a moment.");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setUploadState(false, payload.error || "Upload failed.");
      return;
    }

    state.tracks = [...payload.tracks, ...state.tracks];
    state.settings = payload.settings || state.settings;
    renderTargetLufs();
    renderLibrary();
    renderOverview();
    uploadStatus.textContent = `Imported ${payload.tracks.length} track(s) and finished loudness analysis.`;
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
    setUploadState(false, "Upload failed. Please try again.");
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
    uploadStatus.textContent = payload.error || "Save failed.";
    return;
  }

  state.settings.targetLufs = payload.targetLufs;
  renderTargetLufs();
  renderLibrary();
  renderOverview();
  renderNowPlaying(getCurrentTrack());
  applyTrackLeveling();
  uploadStatus.textContent = `Target LUFS saved as ${payload.targetLufs}.`;
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

function updateDropzoneText() {
  const count = fileInput.files?.length || 0;
  if (!count) {
    dropzoneTitle.textContent = "Drop tracks into your library";
    dropzoneMeta.textContent = "MP3, M4A, AAC";
    return;
  }

  dropzoneTitle.textContent = `${count} file(s) ready to import`;
  dropzoneMeta.textContent = Array.from(fileInput.files)
    .slice(0, 2)
    .map((file) => file.name)
    .join(" | ");
}

buildEqControls();
renderAutoLevelState();
renderOverview();
renderNowPlaying();
renderPlayState();
updateTimeline();
updateDropzoneText();
renderNavigation();
fetchLibrary().catch(() => {
  uploadStatus.textContent = "Failed to load the library. Please refresh and try again.";
});
