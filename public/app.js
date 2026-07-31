const MAX_PARALLEL_UPLOADS = 4;

const state = {
  tracks: [],
  playlists: [],
  librarySelectedTrackIds: [],
  librarySelectionMode: false,
  selectedTrackIds: [],
  converterSelectedTrackIds: [],
  currentTrackId: null,
  playbackHistory: [],
  playbackHistoryIndex: -1,
  activePlaylistId: null,
  editingPlaylistId: null,
  playlistBuilderOpen: false,
  playbackMode: localStorage.getItem("music-player-playback-mode") || "sequence",
  theme: localStorage.getItem("music-player-theme") || "system",
  showFps: localStorage.getItem("music-player-show-fps") === "true",
  settings: {
    targetLufs: -14,
    availableCpuCount: 1
  },
  draftSettings: {
    targetLufs: null
  },
  autoLevelEnabled: localStorage.getItem("music-player-auto-level") !== "false",
  isUploading: false,
  isConverting: false,
  isPollingLibrary: false,
  libraryPollHandle: null,
  audioContext: null,
  inputGainNode: null,
  eqNodes: [],
  language: localStorage.getItem("music-player-language") || "zh",
  conversionItems: [],
  activeLyricKey: "",
  activeLyricIndex: -1,
  librarySnapshot: null
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const isPowerSaverDevice =
  window.matchMedia("(pointer: coarse)").matches ||
  window.matchMedia("(max-width: 1100px)").matches ||
  prefersReducedMotion.matches ||
  Boolean(navigator.connection?.saveData);
const libraryPollInterval = isPowerSaverDevice ? 5000 : 2200;
let pointerFrameHandle = 0;
let timelineUpdateHandle = 0;

const translations = {
  en: {
    pageTitle: "Liquid Glass Music Player",
    langEn: "EN",
    langZh: "中文",
    brandEyebrow: "Liquid Glass Audio",
    themeEyebrow: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    themeFollowMeta: "System follows your OS automatically. Light and dark can be forced here when needed.",
    navLibrary: "Library",
    navPlaylists: "Playlists",
    navCustomize: "Customize",
    importEyebrow: "Import",
    dropzoneBadge: "Import",
    dropzoneTitle: "Drop tracks into your library",
    dropzoneMeta: "MP3, M4A, AAC",
    libraryStats: "Library Stats",
    statsTracks: "Tracks",
    statsTracksMeta: "Total imported songs in your local library.",
    statsPlaylists: "Playlists",
    statsPlaylistsMeta: "Playlists created from your library selections.",
    statsAnalyzed: "Analyzed",
    statsAnalyzedMeta: "Tracks with integrated loudness data available.",
    statsAutoLevel: "Auto level",
    statsAutoLevelMeta: "Playback compensation follows your current LUFS target.",
    enabled: "Enabled",
    disabled: "Disabled",
    musicEyebrow: "Music",
    libraryMenuTitle: "Library",
    libraryMenuMeta: "Tap any song row to play.",
    listColumnTrack: "Track",
    listColumnArtist: "Artist",
    listColumnDuration: "Duration",
    listColumnActions: "Actions",
    listColumnSelect: "Select",
    subnavPlayback: "Playback",
    subnavEqualizer: "Equalizer",
    subnavConverter: "Converter",
    playlistsTitle: "Create and manage playlists",
    playlistsMeta: "Choose songs here for your playlist builder.",
    playlistAddButton: "Add Playlist",
    playlistHideBuilder: "Hide Add Panel",
    playlistBuilderTitle: "Add songs to a new playlist",
    playlistBuilderMeta: "Open this panel only when you want to build a playlist.",
    playlistEditTitle: "Edit playlist",
    playlistEditMeta: "Add or remove songs, then save your changes.",
    playlistName: "Playlist Name",
    playlistNamePlaceholder: "My playlist",
    createPlaylist: "Create Playlist",
    updatePlaylist: "Save Changes",
    editPlaylist: "Edit",
    playPlaylist: "Play Playlist",
    deletePlaylist: "Delete Playlist",
    deletePlaylistConfirm: "Delete playlist {name}?",
    playlistDeleteFailed: "Playlist deletion failed.",
    playlistDeleted: "Playlist deleted.",
    playlistSelectAll: "Select All",
    playlistClearSelection: "Clear",
    removeTrack: "Remove",
    librarySelectMode: "Select",
    librarySelectDone: "Done",
    deleteSelectedTracks: "Delete Selected",
    selectedCount: "{count} selected",
    selectedTracksTitle: "Selected tracks",
    selectedTracksMeta: "These songs will be saved into the next playlist you create.",
    playlistSourceTitle: "Choose tracks from library",
    playlistSourceMeta: "Tap the checkbox or anywhere on a row to add songs.",
    existingPlaylists: "Your playlists",
    existingPlaylistsMeta: "Playlist cards show the name and track count. Tap one to open it.",
    playlistTrackCount: "{count} tracks",
    backToPlaylists: "Close",
    emptySelectedTracks: "No tracks selected yet.",
    emptyPlaylists: "No playlists yet.",
    emptyPlaylistTracks: "This playlist does not contain any songs yet.",
    customizeTitle: "Tune playback behavior and EQ from one menu section",
    showFps: "Show FPS",
    showFpsDescription: "Display live frame rate",
    showFpsMeta: "Shows a small FPS readout in the top-right corner.",
    fpsLabel: "FPS",
    playbackTitle: "Main listening controls",
    playbackMeta: "Adjust LUFS target and overall leveling behavior here.",
    targetLufs: "Target LUFS",
    savePlaybackSettingsButton: "Save Playback Settings",
    oneClickLeveling: "One-click leveling",
    enablePlaybackComp: "Enable playback compensation",
    usesMeasuredLoudness: "Uses measured loudness per track.",
    savedTarget: "Saved target",
    saveTargetButton: "Save Target LUFS",
    smartNote: "Smart note",
    currentCompensation: "Current Compensation",
    eqTitle: "Glass EQ deck",
    eqMeta: "Adjust tone in real time without rewriting the source audio.",
    resetEqButton: "Reset Equalizer",
    converterTitle: "LUFS Converter",
    converterMeta: "Select tracks here, bake in leveling, then download or overwrite them.",
    converterSelected: "Selected Tracks",
    converterSelectionMetaEmpty: "Pick songs below for conversion.",
    converterSelectionMetaReady: "These tracks will use the current LUFS target and optional EQ curve.",
    converterPickerTitle: "Choose tracks for conversion",
    converterPickerMeta: "Select only the songs you want the LUFS converter to process.",
    converterTarget: "Current Target",
    converterTargetMeta: "The converter uses the same LUFS target you set in Playback.",
    converterEq: "Bake EQ",
    converterEqStrong: "Apply the current EQ curve",
    converterEqMeta: "The exported file will use the current EQ and LUFS target together.",
    downloadConverted: "Download Balanced Files",
    overwriteConverted: "Overwrite Originals",
    conversionReadyCount: "{count} selected",
    conversionNoSelection: "Select at least one song in the converter before converting.",
    conversionPreparingDownload: "Rendering balanced files for download...",
    conversionPreparingOverwrite: "Overwriting the selected originals...",
    conversionDownloadSuccess: "Balanced files are ready. If automatic downloads were blocked, use the links below.",
    conversionOverwriteSuccess: "The selected files were overwritten and re-indexed successfully.",
    conversionFailed: "Conversion failed.",
    lowerTargetHint: "Lower targets keep more headroom and feel gentler across the whole library.",
    higherTargetHint: "Higher targets sound louder and will reduce already hot masters more aggressively.",
    defaultTargetHint: "Most streaming playback targets sit close to -14 LUFS.",
    nowPlayingEyebrow: "Now Playing",
    noTrackSelected: "No track selected",
    bottomNoTrackMeta: "Choose a track from the library to start.",
    liveLyrics: "Lyrics",
    noLyrics: "No lyrics were found in this file.",
    lyricsAwaiting: "Lyrics are still being read from this file.",
    volume: "Volume",
    play: "Play",
    pause: "Pause",
    deleteTrack: "Delete",
    deleteTrackConfirm: "Delete {title} from the library? This also removes it from playlists.",
    deleteTrackFailed: "Track deletion failed.",
    trackDeleted: "{title} was deleted.",
    deleteTracksConfirm: "Delete {count} selected track(s) from the library? This also removes them from playlists.",
    deleteTracksFailed: "Selected track deletion failed.",
    tracksDeleted: "{count} track(s) were deleted.",
    allTracksDeleted: "All audio files were deleted.",
    unknownArtist: "Unknown Artist",
    unknownDuration: "Unknown duration",
    noTracksYet: "No tracks yet",
    none: "None",
    uploadSongsPrompt: "Upload a few songs and the server will process metadata, artwork, lyrics, and LUFS automatically.",
    processingBadge: "Processing",
    processingTrackMeta: "Reading metadata, artwork, lyrics, and LUFS in the background.",
    processingShort: "Working",
    chooseAudioFiles: "Please choose at least one audio file.",
    uploadingStatus: "Uploading {current}/{total} files...",
    uploadFailed: "Upload failed. Please try again.",
    importedQueuedStatus: "{count} track(s) imported. Metadata and LUFS analysis are continuing in the background.",
    importedPartialStatus: "{success} track(s) imported, {failed} failed. Metadata and LUFS analysis are continuing in the background.",
    saveFailed: "Save failed.",
    saveSuccess: "Target LUFS saved as {value}.",
    playbackSettingsSaved: "Playback settings saved: {lufs} LUFS, {used}/{total} cores.",
    libraryLoadFailed: "Failed to load the library. Please refresh and try again.",
    playlistNameRequired: "Please enter a playlist name.",
    playlistSelectionRequired: "Please select at least one track first.",
    playlistCreateFailed: "Playlist creation failed.",
    playlistCreated: "Playlist created successfully.",
    playlistUpdateFailed: "Playlist update failed.",
    playlistUpdated: "Playlist updated successfully.",
    noCompensation: "0.0 dB",
    playbackBlocked: "Playback was blocked by the browser. Tap play again.",
    fileCountReady: "{count} file(s) ready to import",
    modeSequence: "Sequence",
    modeShuffle: "Shuffle",
    modeRepeatOne: "Repeat One",
    playbackModeButtonLabel: "Playback mode: {mode}",
    downloadLinkLabel: "Download",
    previousTrack: "Previous track",
    nextTrack: "Next track"
  },
  zh: {
    showFps: "\u663e\u793a\u5e27\u7387",
    showFpsDescription: "\u663e\u793a\u5f53\u524d\u5e27\u7387",
    showFpsMeta: "\u53f3\u4e0a\u89d2\u663e\u793a\u5b9e\u65f6 FPS\u3002",
    fpsLabel: "FPS",
    pageTitle: "Liquid Glass 音乐播放器",
    langEn: "EN",
    langZh: "中文",
    brandEyebrow: "Liquid Glass Audio",
    themeEyebrow: "主题",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    themeFollowMeta: "默认会跟随系统，也可以在这里手动固定浅色或深色。",
    navLibrary: "音乐库",
    navPlaylists: "播放列表",
    navCustomize: "自定义",
    importEyebrow: "导入",
    dropzoneBadge: "导入",
    dropzoneTitle: "把音乐拖进你的音乐库",
    dropzoneMeta: "支持 MP3、M4A、AAC",
    libraryStats: "音乐库数据",
    statsTracks: "歌曲数",
    statsTracksMeta: "当前本地音乐库里已导入的歌曲总数。",
    statsPlaylists: "播放列表",
    statsPlaylistsMeta: "根据音乐库歌曲创建的播放列表数量。",
    statsAnalyzed: "已分析",
    statsAnalyzedMeta: "已经拿到响度分析结果的歌曲数量。",
    statsAutoLevel: "自动平衡",
    statsAutoLevelMeta: "播放补偿会跟随你当前设置的 LUFS 目标。",
    enabled: "已开启",
    disabled: "已关闭",
    musicEyebrow: "音乐",
    libraryMenuTitle: "音乐库",
    libraryMenuMeta: "点击任意歌曲整行即可播放。",
    listColumnTrack: "歌曲",
    listColumnArtist: "作者",
    listColumnDuration: "时长",
    listColumnSelect: "选择",
    subnavPlayback: "播放",
    subnavEqualizer: "均衡器",
    subnavConverter: "转换器",
    playlistsTitle: "创建和管理播放列表",
    playlistsMeta: "在这里挑选歌曲并整理你的播放列表。",
    playlistAddButton: "添加播放列表",
    playlistHideBuilder: "收起添加面板",
    playlistBuilderTitle: "向新播放列表添加歌曲",
    playlistBuilderMeta: "只有在需要创建播放列表时才展开这个面板。",
    playlistEditTitle: "编辑播放列表",
    playlistEditMeta: "增减歌曲后保存修改。",
    playlistName: "播放列表名称",
    playlistNamePlaceholder: "我的播放列表",
    createPlaylist: "创建播放列表",
    updatePlaylist: "保存修改",
    editPlaylist: "编辑",
    deletePlaylist: "删除播放列表",
    deletePlaylistConfirm: "确定删除播放列表“{name}”吗？",
    playlistDeleteFailed: "删除播放列表失败。",
    playlistDeleted: "播放列表已删除。",
    playlistSelectAll: "全选",
    playlistClearSelection: "清空",
    removeTrack: "移除",
    librarySelectMode: "选择",
    librarySelectDone: "完成",
    deleteSelectedTracks: "删除所选歌曲",
    selectedCount: "已选择 {count} 首",
    selectedTracksTitle: "已选歌曲",
    selectedTracksMeta: "这些歌曲会保存到你下一次创建的播放列表里。",
    playlistSourceTitle: "从音乐库选择歌曲",
    playlistSourceMeta: "点复选框，或者直接点整行，把歌曲加入播放列表。",
    existingPlaylists: "你的播放列表",
    existingPlaylistsMeta: "这里只显示名字和歌曲数量，点进去再看全部歌曲。",
    playlistTrackCount: "{count} 首歌曲",
    backToPlaylists: "收起",
    emptySelectedTracks: "还没有选择歌曲。",
    emptyPlaylists: "还没有播放列表。",
    emptyPlaylistTracks: "这个播放列表里还没有歌曲。",
    customizeTitle: "自定义",
    playbackTitle: "播放控制",
    playbackMeta: "在这里调整目标 LUFS 和自动平衡行为。",
    targetLufs: "目标 LUFS",
    cpuCores: "CPU 核心",
    cpuCoresMeta: "选择后台分析和批量转换可使用的 CPU 核心数量。",
    cpuCoresReadout: "{used} / {total} 核",
    savePlaybackSettingsButton: "保存播放设置",
    oneClickLeveling: "一键平衡",
    enablePlaybackComp: "启用播放补偿",
    usesMeasuredLoudness: "按照每首歌测得的响度自动补偿。",
    savedTarget: "已保存目标",
    saveTargetButton: "保存目标 LUFS",
    smartNote: "智能提示",
    currentCompensation: "当前补偿",
    eqTitle: "玻璃质感 EQ 面板",
    eqMeta: "实时调整音色，不会改写原始音频文件。",
    resetEqButton: "重置均衡器",
    converterTitle: "LUFS 转换器",
    converterMeta: "在这里选择要转换的歌曲，把当前响度目标和可选 EQ 烘焙进文件后再下载或覆盖。",
    converterSelected: "已选歌曲",
    converterSelectionMetaEmpty: "在下面选择要转换的歌曲。",
    converterSelectionMetaReady: "这些歌曲会使用当前 LUFS 目标，以及可选的 EQ 曲线一起处理。",
    converterPickerTitle: "选择要转换的歌曲",
    converterPickerMeta: "只选择你想让 LUFS 转换器处理的歌曲。",
    converterTarget: "当前目标",
    converterTargetMeta: "转换器会使用 Playback 里同一个 LUFS 目标值。",
    converterEq: "烘焙 EQ",
    converterEqStrong: "应用当前 EQ 曲线",
    converterEqMeta: "导出的音频会把现在的 EQ 和 LUFS 目标一起写进文件。",
    downloadConverted: "下载平衡后的文件",
    overwriteConverted: "覆盖原文件",
    conversionReadyCount: "已选 {count} 首",
    conversionNoSelection: "请先在转换器里至少选择一首歌，再来转换。",
    conversionPreparingDownload: "正在生成可下载的平衡文件...",
    conversionPreparingOverwrite: "正在覆盖你选中的原文件...",
    conversionDownloadSuccess: "平衡后的文件已经准备好。如果浏览器拦截了自动下载，可以直接点下面的链接。",
    conversionOverwriteSuccess: "选中的文件已经覆盖完成，并重新写回音乐库。",
    conversionFailed: "转换失败。",
    lowerTargetHint: "更低的目标会保留更多动态余量，整库听感会更柔和。",
    higherTargetHint: "更高的目标会更响，也会对本来就偏热的母带施加更多衰减。",
    defaultTargetHint: "大多数流媒体平台的播放目标都接近 -14 LUFS。",
    nowPlayingEyebrow: "正在播放",
    noTrackSelected: "还没有选择歌曲",
    bottomNoTrackMeta: "从音乐库里点一首歌开始播放。",
    liveLyrics: "歌词",
    noLyrics: "这首歌里没有读到歌词。",
    lyricsAwaiting: "正在从这首歌里读取歌词。",
    volume: "音量",
    play: "播放",
    pause: "暂停",
    unknownArtist: "未知作者",
    unknownDuration: "未知时长",
    noTracksYet: "还没有歌曲",
    none: "无",
    uploadSongsPrompt: "先上传几首歌，服务器会自动处理元数据、封面、歌词和 LUFS。",
    processingBadge: "处理中",
    processingTrackMeta: "正在后台读取元数据、封面、歌词和 LUFS。",
    processingShort: "处理中",
    chooseAudioFiles: "请至少选择一个音频文件。",
    uploadingStatus: "正在上传第 {current}/{total} 个文件...",
    uploadFailed: "上传失败，请重试。",
    importedQueuedStatus: "已导入 {count} 首歌曲，元数据和 LUFS 正在后台继续处理。",
    importedPartialStatus: "成功导入 {success} 首，失败 {failed} 首，元数据和 LUFS 正在后台继续处理。",
    saveFailed: "保存失败。",
    saveSuccess: "目标 LUFS 已保存为 {value}。",
    playbackSettingsSaved: "播放设置已保存：{lufs} LUFS，CPU {used}/{total} 核。",
    libraryLoadFailed: "音乐库加载失败，请刷新后重试。",
    playlistNameRequired: "请先填写播放列表名称。",
    playlistSelectionRequired: "请先至少选择一首歌曲。",
    playlistCreateFailed: "创建播放列表失败。",
    playlistCreated: "播放列表创建成功。",
    playlistUpdateFailed: "保存播放列表失败。",
    playlistUpdated: "播放列表已更新。",
    noCompensation: "0.0 dB",
    playbackBlocked: "浏览器阻止了自动播放，请再点一次播放。",
    fileCountReady: "已有 {count} 个文件待导入",
    modeSequence: "顺序播放",
    modeShuffle: "随机播放",
    modeRepeatOne: "单曲循环",
    playbackModeButtonLabel: "播放模式：{mode}",
    downloadLinkLabel: "下载",
    previousTrack: "上一首",
    nextTrack: "下一首"
  }
};

const playbackModeIcons = {
  sequence: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h13"></path>
      <path d="m13 4 4 3-4 3"></path>
      <path d="M20 17H7"></path>
      <path d="m11 14-4 3 4 3"></path>
    </svg>
  `,
  shuffle: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 3h5v5"></path>
      <path d="m21 3-8 8"></path>
      <path d="M4 20l6-6"></path>
      <path d="M4 4l6 6"></path>
      <path d="m21 16-5 5"></path>
      <path d="M16 21h5v-5"></path>
    </svg>
  `,
  "repeat-one": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 1l4 4-4 4"></path>
      <path d="M3 11V7a2 2 0 0 1 2-2h16"></path>
      <path d="m7 23-4-4 4-4"></path>
      <path d="M21 13v4a2 2 0 0 1-2 2H3"></path>
      <path d="M12 9v7"></path>
      <path d="m10.5 10.5 1.5-1.5 1.5 1.5"></path>
    </svg>
  `
};

const transportIcons = {
  play: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5z" fill="currentColor" stroke="none"></path>
    </svg>
  `,
  pause: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="6" width="3.5" height="12" rx="1.5" fill="currentColor" stroke="none"></rect>
      <rect x="13.5" y="6" width="3.5" height="12" rx="1.5" fill="currentColor" stroke="none"></rect>
    </svg>
  `,
  previous: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 6v12"></path>
      <path d="m15 18-8-6 8-6z" fill="currentColor" stroke="none"></path>
    </svg>
  `,
  next: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6v12"></path>
      <path d="m9 6 8 6-8 6z" fill="currentColor" stroke="none"></path>
    </svg>
  `
};

const eqBands = [
  { label: "60Hz", type: "lowshelf", frequency: 60, gain: 0 },
  { label: "170Hz", type: "peaking", frequency: 170, q: 1, gain: 0 },
  { label: "350Hz", type: "peaking", frequency: 350, q: 1, gain: 0 },
  { label: "1kHz", type: "peaking", frequency: 1000, q: 1.1, gain: 0 },
  { label: "3.5kHz", type: "highshelf", frequency: 3500, gain: 0 }
];

const uploadForm = document.querySelector("#uploadForm");
const fileInput = document.querySelector("#trackFiles");
const uploadStatus = document.querySelector("#uploadStatus");
const uploadProgressWrap = document.querySelector("#uploadProgressWrap");
const uploadProgressFill = document.querySelector("#uploadProgressFill");
const uploadProgressLabel = document.querySelector("#uploadProgressLabel");
const toggleLibrarySelectionButton = document.querySelector("#toggleLibrarySelectionButton");
const librarySelectionSummary = document.querySelector("#librarySelectionSummary");
const deleteSelectedTracksButton = document.querySelector("#deleteSelectedTracksButton");
const libraryListHead = document.querySelector("#libraryListHead");
const libraryEl = document.querySelector("#library");
const playlistsEl = document.querySelector("#playlists");
const selectedTracksList = document.querySelector("#selectedTracksList");
const playlistTrackPicker = document.querySelector("#playlistTrackPicker");
const converterTrackPicker = document.querySelector("#converterTrackPicker");
const playlistDetailPanel = document.querySelector("#playlistDetailPanel");
const playlistDetailTitle = document.querySelector("#playlistDetailTitle");
const playlistDetailMeta = document.querySelector("#playlistDetailMeta");
const playlistDetailTracks = document.querySelector("#playlistDetailTracks");
const playlistDetailListHead = document.querySelector("#playlistDetailListHead");
const playPlaylistButton = document.querySelector("#playPlaylistButton");
const editPlaylistButton = document.querySelector("#editPlaylistButton");
const deletePlaylistButton = document.querySelector("#deletePlaylistButton");
const closePlaylistDetailButton = document.querySelector("#closePlaylistDetailButton");
const togglePlaylistBuilderButton = document.querySelector("#togglePlaylistBuilderButton");
const playlistBuilderPanel = document.querySelector("#playlistBuilderPanel");
const playlistBuilderTitleText = document.querySelector("#playlistBuilderTitleText");
const playlistBuilderMetaText = document.querySelector("#playlistBuilderMetaText");
const navItems = document.querySelectorAll("[data-view]");
const contentPanels = document.querySelectorAll(".content-panel");
const customizeItems = document.querySelectorAll("[data-customize-view]");
const customizePanels = document.querySelectorAll(".customize-panel");
const audioPlayer = document.querySelector("#audioPlayer");
const targetLufsSlider = document.querySelector("#targetLufs");
const targetLufsReadout = document.querySelector("#targetLufsReadout");
const targetLufsValue = document.querySelector("#targetLufsValue");
const cpuCoresSlider = document.querySelector("#cpuCoresSlider") || { addEventListener() {} };
const cpuCoresReadout = document.querySelector("#cpuCoresReadout") || { textContent: "" };
const settingsSavedValue = document.querySelector("#settingsSavedValue") || { textContent: "" };
const currentCompensationValue = document.querySelector("#currentCompensationValue");
const autoLevelToggle = document.querySelector("#autoLevelToggle");
const autoLevelState = document.querySelector("#autoLevelState");
const saveLufsButton = document.querySelector("#saveLufsButton");
const dropzone = document.querySelector("#dropzone");
const dropzoneTitle = document.querySelector("#dropzoneTitle");
const dropzoneMeta = document.querySelector("#dropzoneMeta");
const eqControls = document.querySelector("#eqControls");
const resetEqButton = document.querySelector("#resetEqButton");
const trackCount = document.querySelector("#trackCount");
const playlistCount = document.querySelector("#playlistCount");
const analyzedCount = document.querySelector("#analyzedCount");
const levelingHint = document.querySelector("#levelingHint");
const playPauseButton = document.querySelector("#playPauseButton");
const prevTrackButton = document.querySelector("#prevTrackButton");
const nextTrackButton = document.querySelector("#nextTrackButton");
const playbackModeButton = document.querySelector("#playbackModeButton");
const seekBar = document.querySelector("#seekBar");
const currentTimeLabel = document.querySelector("#currentTimeLabel");
const durationLabel = document.querySelector("#durationLabel");
const volumeSlider = document.querySelector("#volumeSlider");
const langEnButton = document.querySelector("#langEnButton");
const langZhButton = document.querySelector("#langZhButton");
const themeSystemButton = document.querySelector("#themeSystemButton");
const themeLightButton = document.querySelector("#themeLightButton");
const themeDarkButton = document.querySelector("#themeDarkButton");
const showFpsToggle = document.querySelector("#showFpsToggle");
const fpsMonitor = document.querySelector("#fpsMonitor");
const fpsValue = document.querySelector("#fpsValue");
const playlistNameInput = document.querySelector("#playlistNameInput");
const createPlaylistButton = document.querySelector("#createPlaylistButton");
const playlistSelectionSummary = document.querySelector("#playlistSelectionSummary");
const playlistSelectAllButton = document.querySelector("#playlistSelectAllButton");
const playlistClearSelectionButton = document.querySelector("#playlistClearSelectionButton");
const bottomArtworkImage = document.querySelector("#bottomArtworkImage");
const bottomArtworkFallback = document.querySelector("#bottomArtworkFallback");
const bottomNowPlayingTitle = document.querySelector("#bottomNowPlayingTitle");
const bottomNowPlayingArtist = document.querySelector("#bottomNowPlayingArtist");
const bottomNowPlayingMeta = document.querySelector("#bottomNowPlayingMeta") || {
  hidden: true,
  textContent: ""
};
const bottomPlayerShell = document.querySelector(".bottom-player");
const liveLyricsBody = document.querySelector("#liveLyricsBody");
const converterSelectionCount = document.querySelector("#converterSelectionCount");
const converterSelectionMeta = document.querySelector("#converterSelectionMeta");
const converterTargetValue = document.querySelector("#converterTargetValue");
const converterSelectAllButton = document.querySelector("#converterSelectAllButton");
const converterClearSelectionButton = document.querySelector("#converterClearSelectionButton");
const applyEqToExportToggle = document.querySelector("#applyEqToExportToggle");
const downloadConvertedButton = document.querySelector("#downloadConvertedButton");
const overwriteConvertedButton = document.querySelector("#overwriteConvertedButton");
const conversionStatus = document.querySelector("#conversionStatus");
const conversionDownloads = document.querySelector("#conversionDownloads");

let currentView = "library";
let currentCustomizeView = "playback";
let fpsFrameHandle = 0;
let fpsWindowStart = 0;
let fpsFrameCount = 0;

function t(key, vars = {}) {
  const dictionary = translations[state.language] || translations.en;
  const template = dictionary[key] || translations.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, token) => String(vars[token] ?? ""));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^./\\]+$/, "") || "track";
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

function formatTrackType(track) {
  return String(track.extension || "")
    .replace(".", "")
    .toUpperCase();
}

function parseTimestampedLyrics(lyrics) {
  if (!lyrics) {
    return [];
  }

  const lines = [];

  String(lyrics)
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const timestampPattern = /\[(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;
      const text = rawLine.replace(timestampPattern, "").trim();
      const matches = [...rawLine.matchAll(timestampPattern)];

      matches.forEach((match) => {
        const minutes = Number(match[1] || 0);
        const seconds = Number(match[2] || 0);
        const fractionRaw = match[3] || "0";
        const fraction =
          fractionRaw.length === 3 ? Number(fractionRaw) / 1000 : fractionRaw.length === 2 ? Number(fractionRaw) / 100 : Number(fractionRaw) / 10;
        const time = minutes * 60 + seconds + fraction;

        if (Number.isFinite(time)) {
          lines.push({
            time,
            text: text || "...",
            cue: match[0]
          });
        }
      });
    });

  return lines.sort((left, right) => left.time - right.time);
}

function normalizeTrack(track, previousTrack = null) {
  const duration = Number(track.duration);
  const lyrics = typeof track.lyrics === "string" ? track.lyrics.trim() : "";
  const parsedLyrics = previousTrack && previousTrack.lyrics === lyrics ? previousTrack.parsedLyrics : parseTimestampedLyrics(lyrics);
  return {
    ...track,
    title: String(track.title || "").trim() || stripExtension(track.originalName || track.filename || "track"),
    artist: String(track.artist || "").trim(),
    lyrics,
    parsedLyrics,
    coverUrl: typeof track.coverUrl === "string" && track.coverUrl.trim() ? track.coverUrl : "",
    duration: Number.isFinite(duration) ? duration : null,
    processing: Boolean(track.processing),
    url: String(track.url || ""),
    originalName: String(track.originalName || track.filename || ""),
    extension: String(track.extension || ""),
    uploadedAt: typeof track.uploadedAt === "string" ? track.uploadedAt : "",
    processedAt: typeof track.processedAt === "string" ? track.processedAt : ""
  };
}

function buildTrackStreamUrl(track) {
  const revision = track.processedAt || track.uploadedAt || track.filename || Date.now();
  return `${track.url}?v=${encodeURIComponent(revision)}`;
}

function getCurrentTrack() {
  return state.tracks.find((track) => track.id === state.currentTrackId) || null;
}

function getTrackById(trackId) {
  return state.tracks.find((track) => track.id === trackId) || null;
}

function getTrackArtist(track) {
  return track?.artist || t("unknownArtist");
}

function getPlaylistById(playlistId) {
  return state.playlists.find((playlist) => playlist.id === playlistId) || null;
}

function getActivePlaylist() {
  return getPlaylistById(state.activePlaylistId);
}

function isTrackSelected(trackId) {
  return state.selectedTrackIds.includes(trackId);
}

function isConverterTrackSelected(trackId) {
  return state.converterSelectedTrackIds.includes(trackId);
}

function isLibraryTrackSelected(trackId) {
  return state.librarySelectedTrackIds.includes(trackId);
}

function getLibraryTrackIds() {
  return state.tracks.map((track) => track.id);
}

function normalizeSelectedTrackIds(trackIds) {
  const validTrackIds = new Set(getLibraryTrackIds());
  return [...new Set(trackIds.map((trackId) => String(trackId)))].filter((trackId) => validTrackIds.has(trackId));
}

function hasAllTracksSelected(trackIds) {
  const libraryTrackIds = getLibraryTrackIds();
  return Boolean(libraryTrackIds.length) && libraryTrackIds.every((trackId) => trackIds.includes(trackId));
}

function updateLibrarySelectionSummary() {
  if (!librarySelectionSummary || !deleteSelectedTracksButton || !toggleLibrarySelectionButton || !libraryListHead) {
    return;
  }

  toggleLibrarySelectionButton.textContent = state.librarySelectionMode ? t("librarySelectDone") : t("librarySelectMode");
  librarySelectionSummary.hidden = !state.librarySelectionMode;
  librarySelectionSummary.textContent = t("selectedCount", {
    count: state.librarySelectedTrackIds.length
  });
  libraryListHead.classList.toggle("library-head-select", state.librarySelectionMode);
  libraryListHead.classList.toggle("library-head", !state.librarySelectionMode);
  deleteSelectedTracksButton.textContent = t("deleteSelectedTracks");
  deleteSelectedTracksButton.hidden = !state.librarySelectionMode || !state.librarySelectedTrackIds.length;
  deleteSelectedTracksButton.disabled = !state.librarySelectedTrackIds.length;
}

function getPlaybackModeLabel(mode = state.playbackMode) {
  if (mode === "shuffle") {
    return t("modeShuffle");
  }

  if (mode === "repeat-one") {
    return t("modeRepeatOne");
  }

  return t("modeSequence");
}

function setUploadProgress(percent) {
  uploadProgressWrap.hidden = false;
  uploadProgressFill.style.width = `${percent}%`;
  uploadProgressLabel.textContent = `${Math.round(percent)}%`;
}

function resetUploadProgress() {
  uploadProgressWrap.hidden = true;
  uploadProgressFill.style.width = "0%";
  uploadProgressLabel.textContent = "0%";
}

function coverMarkup(track, className = "track-art") {
  if (track?.coverUrl) {
    return `<img class="${className}" src="${track.coverUrl}" alt="${escapeHtml(track.title || "artwork")}" />`;
  }

  return `<div class="${className}-placeholder">MP3</div>`;
}

function libraryNeedsPolling() {
  return state.tracks.some((track) => track.processing);
}

function syncLibraryPolling() {
  if (libraryNeedsPolling() && !document.hidden) {
    if (!state.libraryPollHandle) {
      state.libraryPollHandle = window.setInterval(async () => {
        if (state.isPollingLibrary || state.isUploading || state.isConverting) {
          return;
        }

        state.isPollingLibrary = true;

        try {
          await fetchLibrary({ preserveStatus: true });
        } catch {
          // Keep the current UI state and try again later.
        } finally {
          state.isPollingLibrary = false;
        }
      }, libraryPollInterval);
    }

    return;
  }

  if (state.libraryPollHandle) {
    window.clearInterval(state.libraryPollHandle);
    state.libraryPollHandle = null;
  }
}

function renderNavigation() {
  document.body.dataset.view = currentView;
  document.body.dataset.customizeView = currentCustomizeView;

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === currentView);
  });

  contentPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${currentView}View`);
  });

  customizeItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.customizeView === currentCustomizeView);
  });

  customizePanels.forEach((panel) => {
    panel.classList.add("active");
    panel.classList.toggle("is-current", panel.id === `${currentCustomizeView}Panel`);
  });
}

function renderThemeButtons() {
  themeSystemButton.classList.toggle("active", state.theme === "system");
  themeLightButton.classList.toggle("active", state.theme === "light");
  themeDarkButton.classList.toggle("active", state.theme === "dark");
}

function stopFpsMonitor() {
  if (fpsFrameHandle) {
    window.cancelAnimationFrame(fpsFrameHandle);
  }

  fpsFrameHandle = 0;
  fpsWindowStart = 0;
  fpsFrameCount = 0;
  fpsValue.textContent = "--";
}

function sampleFps(timestamp) {
  if (!state.showFps || document.hidden) {
    stopFpsMonitor();
    return;
  }

  if (!fpsWindowStart) {
    fpsWindowStart = timestamp;
  }

  fpsFrameCount += 1;
  const elapsed = timestamp - fpsWindowStart;

  if (elapsed >= 500) {
    fpsValue.textContent = String(Math.round((fpsFrameCount * 1000) / elapsed));
    fpsWindowStart = timestamp;
    fpsFrameCount = 0;
  }

  fpsFrameHandle = window.requestAnimationFrame(sampleFps);
}

function syncFpsMonitor() {
  if (!state.showFps || document.hidden) {
    stopFpsMonitor();
    return;
  }

  if (!fpsFrameHandle) {
    fpsWindowStart = 0;
    fpsFrameCount = 0;
    fpsFrameHandle = window.requestAnimationFrame(sampleFps);
  }
}

function renderFpsState() {
  if (!showFpsToggle || !fpsMonitor || !fpsValue) {
    return;
  }

  showFpsToggle.checked = state.showFps;
  fpsMonitor.hidden = !state.showFps;
  syncFpsMonitor();
}

function applyTheme() {
  if (state.theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = state.theme;
  }

  renderThemeButtons();
}

function setTheme(theme) {
  state.theme = ["system", "light", "dark"].includes(theme) ? theme : "system";
  localStorage.setItem("music-player-theme", state.theme);
  applyTheme();
}

function updateSelectionSummary() {
  playlistSelectionSummary.textContent = t("selectedCount", {
    count: state.selectedTrackIds.length
  });
  playlistSelectAllButton.disabled = !state.tracks.length || hasAllTracksSelected(state.selectedTrackIds);
  playlistClearSelectionButton.disabled = !state.selectedTrackIds.length;
}

function setPlaylistSelection(trackIds) {
  state.selectedTrackIds = normalizeSelectedTrackIds(trackIds);
  updateSelectionSummary();
  renderSelectedTracks();
  renderPlaylistTrackPicker();
}

function setLibrarySelection(trackIds) {
  state.librarySelectedTrackIds = normalizeSelectedTrackIds(trackIds);
  updateLibrarySelectionSummary();
  renderLibrary();
}

async function deleteSelectedTracks() {
  if (!state.librarySelectedTrackIds.length) {
    return;
  }

  const confirmed = window.confirm(
    t("deleteTracksConfirm", {
      count: state.librarySelectedTrackIds.length
    })
  );

  if (!confirmed) {
    return;
  }

  const response = await fetch("/api/tracks/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      trackIds: state.librarySelectedTrackIds
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    uploadStatus.textContent = payload.error || t("deleteTracksFailed");
    return;
  }

  state.librarySelectedTrackIds = [];
  await fetchLibrary({ preserveStatus: true });
  uploadStatus.textContent = t("tracksDeleted", {
    count: payload.count || 0
  });
}

function setConverterSelection(trackIds) {
  state.converterSelectedTrackIds = normalizeSelectedTrackIds(trackIds);
  renderConverterTrackPicker();
  renderConverterSummary();
}

function resetPlaylistBuilderState({ keepOpen = false } = {}) {
  state.editingPlaylistId = null;
  state.selectedTrackIds = [];
  state.playlistBuilderOpen = keepOpen;
  playlistNameInput.value = "";
}

function recordPlaybackHistory(trackId) {
  if (state.playbackHistory[state.playbackHistoryIndex] === trackId) {
    return;
  }

  if (state.playbackHistoryIndex < state.playbackHistory.length - 1) {
    state.playbackHistory = state.playbackHistory.slice(0, state.playbackHistoryIndex + 1);
  }

  state.playbackHistory.push(trackId);

  if (state.playbackHistory.length > 100) {
    state.playbackHistory.shift();
  }

  state.playbackHistoryIndex = state.playbackHistory.length - 1;
}

function startPlaylistEdit(playlistId) {
  const playlist = getPlaylistById(playlistId);

  if (!playlist) {
    return;
  }

  state.editingPlaylistId = playlist.id;
  state.playlistBuilderOpen = true;
  playlistNameInput.value = playlist.name;
  setPlaylistSelection(playlist.trackIds);
  renderPlaylistBuilder();
  renderPlaylistDetail();
  window.requestAnimationFrame(() => {
    playlistBuilderPanel?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

function renderOverview() {
  const analyzedTracks = state.tracks.filter((track) => Number.isFinite(track.analysis?.inputI));
  trackCount.textContent = String(state.tracks.length);
  playlistCount.textContent = String(state.playlists.length);
  analyzedCount.textContent = String(analyzedTracks.length);
}

function getBottomTrackMeta(track) {
  if (track.processing) {
    return t("processingTrackMeta");
  }

  const parts = [];

  if (track.artist) {
    parts.push(track.artist);
  }

  if (Number.isFinite(track.duration)) {
    parts.push(formatDuration(track.duration));
  }

  const fileType = formatTrackType(track);
  if (fileType) {
    parts.push(fileType);
  }

  return parts.join(" / ") || t("bottomNoTrackMeta");
}

function getLyricsText(track) {
  if (!track) {
    return t("noLyrics");
  }

  if (track.lyrics) {
    return track.lyrics;
  }

  return track.processing ? t("lyricsAwaiting") : t("noLyrics");
}

function getActiveLyricIndex(track, currentTime) {
  const lyricLines = Array.isArray(track?.parsedLyrics) ? track.parsedLyrics : [];

  if (!lyricLines.length) {
    return -1;
  }

  const targetTime = currentTime + 0.05;
  let low = 0;
  let high = lyricLines.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (targetTime >= lyricLines[middle].time) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeIndex;
}

function formatLyricsMarkup(text) {
  return escapeHtml(text).replace(/\n/g, "<br />");
}

function getVisibleLyricWindow(lyricLines, activeIndex) {
  const totalLines = Array.isArray(lyricLines) ? lyricLines.length : 0;
  if (!totalLines) {
    return { start: 0, end: -1 };
  }

  if (totalLines <= 2) {
    return { start: 0, end: totalLines - 1 };
  }

  if (activeIndex < 0) {
    return { start: 0, end: 1 };
  }

  return {
    start: activeIndex,
    end: Math.min(totalLines - 1, activeIndex + 1)
  };
}

function getLibrarySnapshot(tracks, playlists, settings) {
  return JSON.stringify({
    tracks: tracks.map((track) => [
      track.id,
      track.title,
      track.artist,
      track.lyrics,
      track.coverUrl,
      track.duration,
      track.processing,
      track.url,
      track.filename,
      track.originalName,
      track.extension,
      track.uploadedAt,
      track.processedAt,
      track.analysis?.inputI ?? null
    ]),
    playlists,
    settings
  });
}

function bindTimedLyricClicks(track) {
  if (!liveLyricsBody) {
    return;
  }

  liveLyricsBody.querySelectorAll("[data-lyric-time]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetTime = Number(button.dataset.lyricTime);
      if (!Number.isFinite(targetTime)) {
        return;
      }

      if (getCurrentTrack()?.id !== track.id) {
        return;
      }

      audioPlayer.currentTime = targetTime;
      updateTimeline();
    });
  });
}

function renderLiveLyrics(track = getCurrentTrack(), { force = false } = {}) {
  if (!liveLyricsBody) {
    return;
  }

  if (!track) {
    state.activeLyricKey = "";
    state.activeLyricIndex = -1;
    liveLyricsBody.innerHTML = `<div class="live-lyrics-static">${formatLyricsMarkup(t("noLyrics"))}</div>`;
    return;
  }

  const lyricLines = Array.isArray(track.parsedLyrics) ? track.parsedLyrics : [];

  if (!track.lyrics) {
    const emptyKey = `${track.id}:empty`;
    if (!force && state.activeLyricKey === emptyKey) {
      return;
    }
    state.activeLyricKey = emptyKey;
    state.activeLyricIndex = -1;
    const emptyText = track.processing ? t("lyricsAwaiting") : t("noLyrics");
    liveLyricsBody.innerHTML = `<div class="live-lyrics-static">${formatLyricsMarkup(emptyText)}</div>`;
    return;
  }

  if (!lyricLines.length) {
    const staticKey = `${track.id}:static`;
    if (!force && state.activeLyricKey === staticKey) {
      return;
    }
    state.activeLyricKey = staticKey;
    state.activeLyricIndex = -1;
    liveLyricsBody.innerHTML = `<div class="live-lyrics-static">${formatLyricsMarkup(track.lyrics)}</div>`;
    return;
  }

  const activeIndex = getActiveLyricIndex(track, Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0);
  const nextKey = `${track.id}:${activeIndex}`;

  if (!force && state.activeLyricKey === nextKey) {
    return;
  }

  state.activeLyricKey = nextKey;
  state.activeLyricIndex = activeIndex;
  const { start, end } = getVisibleLyricWindow(lyricLines, activeIndex);

  liveLyricsBody.innerHTML = `
    <div class="live-lyrics-list">
      ${lyricLines
        .map((line, index) => {
          if (index < start || index > end) {
            return "";
          }

          const activeClass = index === activeIndex ? " is-active lyric-fade-enter" : "";
          const nextClass = index === activeIndex + 1 ? " is-next" : "";
          return `
            <button
              class="live-lyric-line${activeClass}${nextClass}"
              type="button"
              data-lyric-time="${line.time}"
              data-lyric-index="${index}"
            >
              <span class="live-lyric-text">${escapeHtml(line.text)}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  bindTimedLyricClicks(track);
}

function triggerBottomPlayerSlide() {
  if (!bottomPlayerShell || prefersReducedMotion.matches) {
    return;
  }

  bottomPlayerShell.classList.remove("is-track-changing");
  void bottomPlayerShell.offsetWidth;
  bottomPlayerShell.classList.add("is-track-changing");
  window.clearTimeout(triggerBottomPlayerSlide.timeoutId);
  triggerBottomPlayerSlide.timeoutId = window.setTimeout(() => {
    bottomPlayerShell?.classList.remove("is-track-changing");
  }, 480);
}

function renderBottomPlayer(track = null) {
  triggerBottomPlayerSlide();

  if (!track) {
    bottomNowPlayingTitle.textContent = t("noTrackSelected");
    bottomNowPlayingArtist.textContent = t("unknownArtist");
    bottomNowPlayingMeta.hidden = true;
    renderLiveLyrics(null, { force: true });
    bottomArtworkImage.hidden = true;
    bottomArtworkFallback.hidden = false;
    return;
  }

  bottomNowPlayingTitle.textContent = track.title;
  bottomNowPlayingArtist.textContent = getTrackArtist(track);
  bottomNowPlayingMeta.hidden = true;
  renderLiveLyrics(track, { force: true });

  if (track.coverUrl) {
    bottomArtworkImage.src = track.coverUrl;
    bottomArtworkImage.alt = track.title || "Artwork";
    bottomArtworkImage.hidden = false;
    bottomArtworkFallback.hidden = true;
  } else {
    bottomArtworkImage.hidden = true;
    bottomArtworkFallback.hidden = false;
  }
}

function renderCurrentCompensation() {
  const integrated = getCurrentTrack()?.analysis?.inputI;

  if (!state.autoLevelEnabled || !Number.isFinite(integrated)) {
    currentCompensationValue.textContent = t("noCompensation");
    return;
  }

  const delta = getEffectiveTargetLufs() - integrated;
  const prefix = delta > 0 ? "+" : "";
  currentCompensationValue.textContent = `${prefix}${delta.toFixed(1)} dB`;
}

function buildTrackMetaMarkup(track) {
  return `
    <div class="track-meta-row">
      <span class="track-meta">${escapeHtml(track.originalName || track.title)}</span>
      ${track.processing ? `<span class="track-status-pill">${escapeHtml(t("processingBadge"))}</span>` : ""}
    </div>
  `;
}

function buildTrackRow(
  track,
  {
    active = false,
    dataAttr = "data-row-track-id",
    showSelect = false,
    selectAttr = "data-track-select-id",
    selected = false,
    showPlayAction = false,
    showDeleteAction = false,
    playAttr = "data-track-play-id",
    deleteAttr = "data-track-delete-id"
  } = {}
) {
  const durationLabel = track.processing && !Number.isFinite(track.duration) ? t("processingShort") : formatDuration(track.duration);
  const actions = [];

  if (showPlayAction) {
    actions.push(
      `<button class="track-action-button track-action-button-primary" type="button" ${playAttr}="${track.id}">${escapeHtml(t("play"))}</button>`
    );
  }

  if (showDeleteAction) {
    actions.push(`<button class="track-action-button" type="button" ${deleteAttr}="${track.id}">${escapeHtml(t("deleteTrack"))}</button>`);
  }

  const selectMarkup = showSelect
    ? `
      <div class="track-select">
        <input class="playlist-checkbox" type="checkbox" ${selectAttr}="${track.id}" ${selected ? "checked" : ""} />
      </div>
    `
    : "";
  const rowClasses = [
    "track-row",
    "track-row-library",
    "glass-inline-card",
    active ? "active" : "",
    showSelect && actions.length ? "track-row-with-select-actions" : showSelect ? "track-row-with-select" : "",
    actions.length && !showSelect ? "track-row-with-actions" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${rowClasses}" ${dataAttr}="${track.id}">
      ${selectMarkup}
      <div class="track-main">
        ${coverMarkup(track)}
        <div class="track-text">
          <strong class="track-title">${escapeHtml(track.title)}</strong>
          ${buildTrackMetaMarkup(track)}
        </div>
      </div>
      <span class="track-artist">${escapeHtml(getTrackArtist(track))}</span>
      <span class="track-duration">${escapeHtml(durationLabel)}</span>
      ${actions.length ? `<div class="track-actions">${actions.join("")}</div>` : ""}
    </article>
  `;
}

function renderLibrary() {
  if (!state.tracks.length) {
    libraryEl.innerHTML = `
      <article class="track-row track-row-library glass-inline-card empty-state-card">
        <div class="track-main">
          <div class="track-art-placeholder">MP3</div>
          <div class="track-text">
            <strong class="track-title">${escapeHtml(t("noTracksYet"))}</strong>
            <span class="track-meta">${escapeHtml(t("uploadSongsPrompt"))}</span>
          </div>
        </div>
        <span class="track-artist">${escapeHtml(t("none"))}</span>
        <span class="track-duration">${escapeHtml(t("none"))}</span>
      </article>
    `;
    return;
  }

  libraryEl.innerHTML = state.tracks
    .map(
      (track) =>
        buildTrackRow(track, {
          active: track.id === state.currentTrackId,
          showSelect: state.librarySelectionMode,
          selectAttr: "data-library-select-track-id",
          selected: isLibraryTrackSelected(track.id)
        })
    )
    .join("");

  document.querySelectorAll("[data-library-select-track-id]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    checkbox.addEventListener("change", (event) => {
      const trackId = event.currentTarget.dataset.librarySelectTrackId;
      const nextTrackIds = event.currentTarget.checked
        ? [...state.librarySelectedTrackIds, trackId]
        : state.librarySelectedTrackIds.filter((id) => id !== trackId);
      state.librarySelectedTrackIds = normalizeSelectedTrackIds(nextTrackIds);
      updateLibrarySelectionSummary();
    });
  });

  document.querySelectorAll("[data-row-track-id]").forEach((row) => {
    row.addEventListener("click", async () => {
      if (state.librarySelectionMode) {
        const checkbox = row.querySelector("[data-library-select-track-id]");

        if (!checkbox) {
          return;
        }

        checkbox.checked = !checkbox.checked;
        const nextTrackIds = checkbox.checked
          ? [...state.librarySelectedTrackIds, row.dataset.rowTrackId]
          : state.librarySelectedTrackIds.filter((id) => id !== row.dataset.rowTrackId);
        state.librarySelectedTrackIds = normalizeSelectedTrackIds(nextTrackIds);
        updateLibrarySelectionSummary();
        return;
      }

      state.activePlaylistId = null;
      await playTrack(row.dataset.rowTrackId);
    });
  });
}

function renderSelectedTracks() {
  if (!state.selectedTrackIds.length) {
    selectedTracksList.innerHTML = `<div class="selected-track-empty">${escapeHtml(t("emptySelectedTracks"))}</div>`;
    return;
  }

  selectedTracksList.innerHTML = state.selectedTrackIds
    .map((trackId) => getTrackById(trackId))
    .filter(Boolean)
    .map(
      (track) => `
        <article class="selected-track-chip">
          ${coverMarkup(track, "selected-track-art")}
          <div class="selected-track-copy">
            <strong>${escapeHtml(track.title)}</strong>
            <small>${escapeHtml(getTrackArtist(track))}</small>
          </div>
          <button class="selected-track-remove" type="button" data-remove-selected-track-id="${track.id}" aria-label="${escapeHtml(t("removeTrack"))}">
            ${escapeHtml(t("removeTrack"))}
          </button>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-remove-selected-track-id]").forEach((button) => {
    button.textContent = t("removeTrack");
    const selectedTrack = getTrackById(button.dataset.removeSelectedTrackId);
    button.setAttribute("aria-label", `${t("removeTrack")} ${(selectedTrack?.title || t("noTracksYet")).trim()}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTrackSelection(button.dataset.removeSelectedTrackId, false);
    });
  });
}

function renderPlaylistBuilder() {
  if (!playlistBuilderPanel || !togglePlaylistBuilderButton) {
    return;
  }

  playlistBuilderPanel.hidden = !state.playlistBuilderOpen;
  const isEditing = Boolean(state.editingPlaylistId);
  togglePlaylistBuilderButton.textContent = state.playlistBuilderOpen
    ? isEditing
      ? t("backToPlaylists")
      : t("playlistHideBuilder")
    : t("playlistAddButton");
  playlistBuilderTitleText.textContent = isEditing ? t("playlistEditTitle") : t("playlistBuilderTitle");
  playlistBuilderMetaText.textContent = isEditing ? t("playlistEditMeta") : t("playlistBuilderMeta");
  createPlaylistButton.textContent = isEditing ? t("updatePlaylist") : t("createPlaylist");
}

function buildPlaylistCoverMarkup(playlist) {
  const coverTracks = playlist.trackIds.map((trackId) => getTrackById(trackId)).filter(Boolean).slice(0, 4);
  const fallbackLabel = escapeHtml(String(playlist.name || "♪").trim().slice(0, 1) || "♪");

  return `
    <div class="playlist-cover-collage" aria-hidden="true">
      ${Array.from({ length: 4 }, (_item, index) => {
        const track = coverTracks[index];
        if (track?.coverUrl) {
          return `<img class="playlist-cover-tile" src="${track.coverUrl}" alt="${escapeHtml(track.title || playlist.name)}" />`;
        }

        return `<div class="playlist-cover-tile playlist-cover-fallback">${fallbackLabel}</div>`;
      }).join("")}
    </div>
  `;
}

function toggleTrackSelection(trackId, shouldSelect) {
  if (shouldSelect) {
    setPlaylistSelection([...state.selectedTrackIds, trackId]);
  } else {
    setPlaylistSelection(state.selectedTrackIds.filter((id) => id !== trackId));
  }

  renderPlaylistDetail();
}

function toggleConverterTrackSelection(trackId, shouldSelect) {
  if (shouldSelect) {
    setConverterSelection([...state.converterSelectedTrackIds, trackId]);
  } else {
    setConverterSelection(state.converterSelectedTrackIds.filter((id) => id !== trackId));
  }
}

function renderPlaylistTrackPicker() {
  if (!state.tracks.length) {
    playlistTrackPicker.innerHTML = `
      <article class="track-row picker-row glass-inline-card empty-state-card">
        <div class="track-select"></div>
        <div class="track-main">
          <div class="track-art-placeholder">MP3</div>
          <div class="track-text">
            <strong class="track-title">${escapeHtml(t("noTracksYet"))}</strong>
            <span class="track-meta">${escapeHtml(t("uploadSongsPrompt"))}</span>
          </div>
        </div>
        <span class="track-artist">${escapeHtml(t("none"))}</span>
        <span class="track-duration">${escapeHtml(t("none"))}</span>
      </article>
    `;
    return;
  }

  playlistTrackPicker.innerHTML = state.tracks
    .map((track) => {
      const durationLabel = track.processing && !Number.isFinite(track.duration) ? t("processingShort") : formatDuration(track.duration);

      return `
        <article class="track-row picker-row glass-inline-card" data-picker-track-id="${track.id}">
          <div class="track-select">
            <input class="playlist-checkbox" type="checkbox" data-select-track-id="${track.id}" ${isTrackSelected(track.id) ? "checked" : ""} />
          </div>
          <div class="track-main">
            ${coverMarkup(track)}
            <div class="track-text">
              <strong class="track-title">${escapeHtml(track.title)}</strong>
              ${buildTrackMetaMarkup(track)}
            </div>
          </div>
          <span class="track-artist">${escapeHtml(getTrackArtist(track))}</span>
          <span class="track-duration">${escapeHtml(durationLabel)}</span>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-select-track-id]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    checkbox.addEventListener("change", (event) => {
      toggleTrackSelection(event.currentTarget.dataset.selectTrackId, event.currentTarget.checked);
    });
  });

  document.querySelectorAll("[data-picker-track-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const checkbox = row.querySelector("[data-select-track-id]");
      checkbox.checked = !checkbox.checked;
      toggleTrackSelection(row.dataset.pickerTrackId, checkbox.checked);
    });
  });
}

function renderConverterTrackPicker() {
  if (!converterTrackPicker) {
    return;
  }

  if (!state.tracks.length) {
    converterTrackPicker.innerHTML = `
      <article class="track-row picker-row glass-inline-card empty-state-card">
        <div class="track-select"></div>
        <div class="track-main">
          <div class="track-art-placeholder">MP3</div>
          <div class="track-text">
            <strong class="track-title">${escapeHtml(t("noTracksYet"))}</strong>
            <span class="track-meta">${escapeHtml(t("uploadSongsPrompt"))}</span>
          </div>
        </div>
        <span class="track-artist">${escapeHtml(t("none"))}</span>
        <span class="track-duration">${escapeHtml(t("none"))}</span>
      </article>
    `;
    return;
  }

  converterTrackPicker.innerHTML = state.tracks
    .map((track) => {
      const durationLabel = track.processing && !Number.isFinite(track.duration) ? t("processingShort") : formatDuration(track.duration);

      return `
        <article class="track-row picker-row glass-inline-card" data-converter-track-id="${track.id}">
          <div class="track-select">
            <input class="playlist-checkbox" type="checkbox" data-converter-select-track-id="${track.id}" ${isConverterTrackSelected(track.id) ? "checked" : ""} />
          </div>
          <div class="track-main">
            ${coverMarkup(track)}
            <div class="track-text">
              <strong class="track-title">${escapeHtml(track.title)}</strong>
              ${buildTrackMetaMarkup(track)}
            </div>
          </div>
          <span class="track-artist">${escapeHtml(getTrackArtist(track))}</span>
          <span class="track-duration">${escapeHtml(durationLabel)}</span>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-converter-select-track-id]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    checkbox.addEventListener("change", (event) => {
      toggleConverterTrackSelection(event.currentTarget.dataset.converterSelectTrackId, event.currentTarget.checked);
    });
  });

  document.querySelectorAll("[data-converter-track-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const checkbox = row.querySelector("[data-converter-select-track-id]");
      checkbox.checked = !checkbox.checked;
      toggleConverterTrackSelection(row.dataset.converterTrackId, checkbox.checked);
    });
  });
}

function renderPlaylistDetail() {
  const activePlaylist = getActivePlaylist();

  if (!activePlaylist) {
    playlistDetailPanel.hidden = true;
    playlistDetailTitle.textContent = "";
    playlistDetailMeta.textContent = "";
    playlistDetailTracks.innerHTML = "";
    playlistDetailListHead.className = "library-list-head library-head library-head-actions mini-label";
    playPlaylistButton.disabled = true;
    editPlaylistButton.disabled = true;
    deletePlaylistButton.disabled = true;
    editPlaylistButton.classList.remove("danger-button");
    editPlaylistButton.classList.add("secondary-button");
    editPlaylistButton.textContent = t("editPlaylist");
    return;
  }

  const tracks = activePlaylist.trackIds.map((trackId) => getTrackById(trackId)).filter(Boolean);
  playlistDetailPanel.hidden = false;
  playlistDetailTitle.textContent = activePlaylist.name;
  playlistDetailMeta.textContent = t("playlistTrackCount", { count: tracks.length });
  playlistDetailListHead.className = "library-list-head library-head library-head-actions mini-label";
  playPlaylistButton.disabled = !tracks.length;
  editPlaylistButton.disabled = false;
  deletePlaylistButton.disabled = false;
  editPlaylistButton.classList.remove("danger-button", "secondary-button");
  editPlaylistButton.classList.add("secondary-button");
  editPlaylistButton.textContent = t("editPlaylist");

  if (!tracks.length) {
    playlistDetailTracks.innerHTML = `<div class="selected-track-empty">${escapeHtml(t("emptyPlaylistTracks"))}</div>`;
    return;
  }

  playlistDetailTracks.innerHTML = tracks
    .map(
      (track) =>
        buildTrackRow(track, {
          active: track.id === state.currentTrackId,
          dataAttr: "data-playlist-track-id",
          showPlayAction: true,
          playAttr: "data-playlist-play-track-id"
        })
    )
    .join("");

  document.querySelectorAll("[data-playlist-play-track-id]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await playTrack(button.dataset.playlistPlayTrackId);
    });
  });

  document.querySelectorAll("[data-playlist-track-id]").forEach((row) => {
    row.addEventListener("click", async () => {
      await playTrack(row.dataset.playlistTrackId);
    });
  });
}

function renderPlaylists() {
  if (!state.playlists.length) {
    playlistsEl.innerHTML = `<div class="selected-track-empty">${escapeHtml(t("emptyPlaylists"))}</div>`;
    renderPlaylistDetail();
    return;
  }

  playlistsEl.innerHTML = state.playlists
    .map((playlist) => {
      const activeClass = playlist.id === state.activePlaylistId ? "active" : "";

      return `
        <button class="playlist-card glass-inline-card ${activeClass}" type="button" data-open-playlist-id="${playlist.id}">
          <div class="playlist-card-head">
            ${buildPlaylistCoverMarkup(playlist)}
            <div class="playlist-copy">
              <strong>${escapeHtml(playlist.name)}</strong>
              <small>${escapeHtml(t("playlistTrackCount", { count: playlist.trackIds.length }))}</small>
            </div>
          </div>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-open-playlist-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePlaylistId = button.dataset.openPlaylistId;
      if (state.playlistBuilderOpen || state.editingPlaylistId) {
        resetPlaylistBuilderState({ keepOpen: false });
      }
      renderPlaylists();
      window.requestAnimationFrame(() => {
        playlistDetailPanel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  });

  renderPlaylistDetail();
}

function renderTargetLufs() {
  const effectiveTargetLufs = Number.isFinite(Number(state.draftSettings.targetLufs))
    ? Number(state.draftSettings.targetLufs)
    : Number(state.settings.targetLufs);
  const safeTargetLufs = Number.isFinite(effectiveTargetLufs) ? effectiveTargetLufs : -14;
  const value = `${safeTargetLufs} LUFS`;
  const savedTargetValue = `${Number.isFinite(Number(state.settings.targetLufs)) ? Number(state.settings.targetLufs) : safeTargetLufs} LUFS`;
  targetLufsSlider.value = String(safeTargetLufs);
  targetLufsReadout.textContent = value;
  targetLufsValue.textContent = savedTargetValue;
  converterTargetValue.textContent = value;

  if (safeTargetLufs < -14) {
    levelingHint.textContent = t("lowerTargetHint");
  } else if (safeTargetLufs > -14) {
    levelingHint.textContent = t("higherTargetHint");
  } else {
    levelingHint.textContent = t("defaultTargetHint");
  }
}

function renderProcessingCores() {
  return;
}

function renderAutoLevelState() {
  autoLevelToggle.checked = state.autoLevelEnabled;
  autoLevelState.textContent = state.autoLevelEnabled ? t("enabled") : t("disabled");
}

function renderPlaybackModeButton() {
  playbackModeButton.innerHTML = playbackModeIcons[state.playbackMode] || playbackModeIcons.sequence;
  const label = t("playbackModeButtonLabel", {
    mode: getPlaybackModeLabel()
  });
  playbackModeButton.title = label;
  playbackModeButton.setAttribute("aria-label", label);
}

function renderPlayState() {
  const hasTrack = Boolean(getCurrentTrack());
  const isPaused = audioPlayer.paused || !hasTrack;
  const playLabel = isPaused ? t("play") : t("pause");

  playPauseButton.innerHTML = isPaused ? transportIcons.play : transportIcons.pause;
  playPauseButton.title = playLabel;
  playPauseButton.setAttribute("aria-label", playLabel);

  prevTrackButton.innerHTML = transportIcons.previous;
  prevTrackButton.title = t("previousTrack");
  prevTrackButton.setAttribute("aria-label", t("previousTrack"));

  nextTrackButton.innerHTML = transportIcons.next;
  nextTrackButton.title = t("nextTrack");
  nextTrackButton.setAttribute("aria-label", t("nextTrack"));
}

function updateTimeline() {
  const currentTime = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  currentTimeLabel.textContent = formatDuration(currentTime);
  durationLabel.textContent = duration > 0 ? formatDuration(duration) : "0:00";
  seekBar.value = duration > 0 ? String(Math.round((currentTime / duration) * 1000)) : "0";
  renderLiveLyrics();
}

function scheduleTimelineUpdate() {
  if (!isPowerSaverDevice) {
    updateTimeline();
    return;
  }

  if (timelineUpdateHandle) {
    return;
  }

  timelineUpdateHandle = window.setTimeout(() => {
    timelineUpdateHandle = 0;
    updateTimeline();
  }, 250);
}

function renderConverterDownloads(items = state.conversionItems) {
  if (!items.length) {
    conversionDownloads.innerHTML = "";
    return;
  }

  conversionDownloads.innerHTML = items
    .map(
      (item) => `
        <div class="download-link glass-inline-card">
          <span>${escapeHtml(item.title || item.fileName)}</span>
          <a href="${item.downloadUrl}" download="${escapeHtml(item.fileName)}">${escapeHtml(t("downloadLinkLabel"))}</a>
        </div>
      `
    )
    .join("");
}

function renderConverterSummary() {
  converterSelectionCount.textContent = t("conversionReadyCount", {
    count: state.converterSelectedTrackIds.length
  });
  converterSelectionMeta.textContent = state.converterSelectedTrackIds.length ? t("converterSelectionMetaReady") : t("converterSelectionMetaEmpty");
  converterSelectAllButton.disabled = !state.tracks.length || hasAllTracksSelected(state.converterSelectedTrackIds);
  converterClearSelectionButton.disabled = !state.converterSelectedTrackIds.length;
}

function getEffectiveTargetLufs() {
  const draftTargetLufs = Number(state.draftSettings.targetLufs);
  const savedTargetLufs = Number(state.settings.targetLufs);
  return Number.isFinite(draftTargetLufs) ? draftTargetLufs : Number.isFinite(savedTargetLufs) ? savedTargetLufs : -14;
}

async function savePlaybackSettings() {
  const nextTargetLufs = getEffectiveTargetLufs();
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      targetLufs: nextTargetLufs
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    uploadStatus.textContent = payload.error || t("saveFailed");
    return false;
  }

  state.settings = {
    ...state.settings,
    ...payload
  };
  state.draftSettings.targetLufs = null;
  renderTargetLufs();
  renderProcessingCores();
  renderCurrentCompensation();
  applyTrackLeveling();
  uploadStatus.textContent = t("saveSuccess", {
    value: nextTargetLufs
  });
  return true;
}

function applyTranslations() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  playlistNameInput.placeholder = t("playlistNamePlaceholder");
  langEnButton.classList.toggle("active", state.language === "en");
  langZhButton.classList.toggle("active", state.language === "zh");
  renderThemeButtons();
  renderFpsState();
  renderProcessingCores();
  renderPlaybackModeButton();
  renderPlayState();
  renderConverterSummary();
  renderConverterTrackPicker();
  renderConverterDownloads();
  renderPlaylistBuilder();
  updateLibrarySelectionSummary();
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
  state.inputGainNode = inputGain;
  state.eqNodes = eqNodes;
}

function gainToLinear(db) {
  return Math.pow(10, db / 20);
}

function applyTrackLeveling() {
  if (!state.inputGainNode) {
    return;
  }

  const integrated = getCurrentTrack()?.analysis?.inputI;

  if (!state.autoLevelEnabled || !Number.isFinite(integrated)) {
    state.inputGainNode.gain.value = 1;
    return;
  }

  state.inputGainNode.gain.value = gainToLinear(getEffectiveTargetLufs() - integrated);
}

async function playTrack(trackId, { recordHistory = true } = {}) {
  const track = getTrackById(trackId);

  if (!track || !track.url) {
    return;
  }

  await ensureAudioGraph();
  state.currentTrackId = track.id;
  if (recordHistory) {
    recordPlaybackHistory(track.id);
  }
  audioPlayer.src = buildTrackStreamUrl(track);
  renderBottomPlayer(track);
  applyTrackLeveling();
  renderCurrentCompensation();
  renderLibrary();
  renderPlaylists();

  try {
    await audioPlayer.play();
  } catch (error) {
    uploadStatus.textContent = error?.message || t("playbackBlocked");
  }

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
  state.language = language === "en" ? "en" : "zh";
  localStorage.setItem("music-player-language", state.language);
  rerenderAll();
}

function cyclePlaybackMode() {
  const order = ["sequence", "shuffle", "repeat-one"];
  const currentIndex = order.indexOf(state.playbackMode);
  const nextMode = order[(currentIndex + 1) % order.length];
  state.playbackMode = nextMode;
  localStorage.setItem("music-player-playback-mode", nextMode);
  renderPlaybackModeButton();
}

function rerenderAll() {
  applyTranslations();
  applyTheme();
  renderTargetLufs();
  renderProcessingCores();
  renderAutoLevelState();
  renderOverview();
  renderLibrary();
  renderSelectedTracks();
  renderPlaylistTrackPicker();
  renderConverterTrackPicker();
  renderPlaylists();
  renderPlaylistBuilder();
  renderBottomPlayer(getCurrentTrack());
  renderCurrentCompensation();
  renderPlayState();
  updateLibrarySelectionSummary();
  updateSelectionSummary();
  updateDropzoneText();
  renderNavigation();
}

function setPointerGlowPosition(clientX, clientY) {
  const width = Math.max(window.innerWidth || 1, 1);
  const height = Math.max(window.innerHeight || 1, 1);
  document.documentElement.style.setProperty("--pointer-x", `${((clientX / width) * 100).toFixed(2)}%`);
  document.documentElement.style.setProperty("--pointer-y", `${((clientY / height) * 100).toFixed(2)}%`);
}

function schedulePointerGlow(clientX, clientY) {
  if (isPowerSaverDevice || prefersReducedMotion.matches) {
    return;
  }

  if (pointerFrameHandle) {
    window.cancelAnimationFrame(pointerFrameHandle);
  }

  pointerFrameHandle = window.requestAnimationFrame(() => {
    setPointerGlowPosition(clientX, clientY);
    pointerFrameHandle = 0;
  });
}

function initializeSceneMotion() {
  document.body.classList.add("is-ready");
  setPointerGlowPosition(window.innerWidth * 0.72, window.innerHeight * 0.18);

  if (isPowerSaverDevice || prefersReducedMotion.matches) {
    return;
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      schedulePointerGlow(event.clientX, event.clientY);
    },
    { passive: true }
  );

  window.addEventListener("blur", () => {
    setPointerGlowPosition(window.innerWidth * 0.72, window.innerHeight * 0.18);
  });
}

async function fetchLibrary({ preserveStatus = false } = {}) {
  const response = await fetch("/api/library");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || t("libraryLoadFailed"));
  }

  const previousTracksById = new Map(state.tracks.map((track) => [track.id, track]));
  const nextTracks = Array.isArray(payload.tracks)
    ? payload.tracks.map((track) => normalizeTrack(track, previousTracksById.get(track.id)))
    : [];
  const nextPlaylists = Array.isArray(payload.playlists) ? payload.playlists : [];
  const nextSettings = {
    ...state.settings,
    ...(payload.settings || {})
  };
  const nextLibrarySnapshot = getLibrarySnapshot(nextTracks, nextPlaylists, nextSettings);
  const libraryChanged = state.librarySnapshot !== nextLibrarySnapshot;

  state.tracks = nextTracks;
  state.playlists = nextPlaylists;
  state.settings = nextSettings;
  state.librarySelectedTrackIds = state.librarySelectedTrackIds.filter((trackId) => state.tracks.some((track) => track.id === trackId));
  state.selectedTrackIds = state.selectedTrackIds.filter((trackId) => state.tracks.some((track) => track.id === trackId));
  state.converterSelectedTrackIds = state.converterSelectedTrackIds.filter((trackId) => state.tracks.some((track) => track.id === trackId));
  state.playbackHistory = state.playbackHistory.filter((trackId) => state.tracks.some((track) => track.id === trackId));
  state.playbackHistoryIndex = Math.min(state.playbackHistoryIndex, state.playbackHistory.length - 1);

  if (state.activePlaylistId && !getActivePlaylist()) {
    state.activePlaylistId = null;
  }

  if (state.editingPlaylistId && !getPlaylistById(state.editingPlaylistId)) {
    resetPlaylistBuilderState({ keepOpen: false });
  }

  if (state.currentTrackId && !getTrackById(state.currentTrackId)) {
    state.currentTrackId = null;
    state.playbackHistoryIndex = -1;
    state.activeLyricKey = "";
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
  }

  if (libraryChanged) {
    state.librarySnapshot = nextLibrarySnapshot;
    rerenderAll();
  }
  syncLibraryPolling();

  if (!preserveStatus && !state.isUploading && !state.isConverting) {
    uploadStatus.textContent = "";
    conversionStatus.textContent = "";
  }
}

function getPlayableTrackPool() {
  const activePlaylist = getActivePlaylist();

  if (activePlaylist) {
    const playlistTracks = activePlaylist.trackIds.map((trackId) => getTrackById(trackId)).filter((track) => track && track.url);

    if (playlistTracks.length) {
      return playlistTracks;
    }
  }

  return state.tracks.filter((track) => track.url);
}

function pickRandomTrack(pool, excludeTrackId) {
  if (!pool.length) {
    return null;
  }

  if (pool.length === 1) {
    return pool[0];
  }

  const filteredPool = pool.filter((track) => track.id !== excludeTrackId);
  const sourcePool = filteredPool.length ? filteredPool : pool;
  const randomIndex = Math.floor(Math.random() * sourcePool.length);
  return sourcePool[randomIndex];
}

async function playAdjacentTrack(direction, { allowWrap = true } = {}) {
  const pool = getPlayableTrackPool();

  if (!pool.length) {
    return;
  }

  if (direction < 0 && audioPlayer.currentTime > 3) {
    audioPlayer.currentTime = 0;
    updateTimeline();
    return;
  }

  if (direction < 0 && state.playbackHistoryIndex > 0) {
    const previousHistoryTrackId = state.playbackHistory[state.playbackHistoryIndex - 1];
    if (pool.some((track) => track.id === previousHistoryTrackId)) {
      state.playbackHistoryIndex -= 1;
      await playTrack(previousHistoryTrackId, { recordHistory: false });
      return;
    }
  }

  if (state.playbackMode === "shuffle" && direction > 0) {
    const randomTrack = pickRandomTrack(pool, state.currentTrackId);
    if (randomTrack) {
      await playTrack(randomTrack.id);
    }
    return;
  }

  const currentIndex = pool.findIndex((track) => track.id === state.currentTrackId);
  const nextIndex = currentIndex === -1 ? 0 : currentIndex + direction;

  if (nextIndex < 0) {
    await playTrack(pool[0].id);
    return;
  }

  if (nextIndex >= pool.length) {
    if (!allowWrap) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      updateTimeline();
      renderPlayState();
      return;
    }

    await playTrack(pool[0].id);
    return;
  }

  await playTrack(pool[nextIndex].id);
}

async function handleTrackEnded() {
  if (state.playbackMode === "repeat-one" && getCurrentTrack()) {
    audioPlayer.currentTime = 0;

    try {
      await audioPlayer.play();
    } catch (error) {
      uploadStatus.textContent = error?.message || t("playbackBlocked");
    }

    return;
  }

  await playAdjacentTrack(1, { allowWrap: false });
}

function updateDropzoneText() {
  const count = fileInput.files?.length || 0;

  if (!count) {
    dropzoneTitle.textContent = t("dropzoneTitle");
    dropzoneMeta.textContent = t("dropzoneMeta");
    return;
  }

  dropzoneTitle.textContent = t("fileCountReady", { count });
  dropzoneMeta.textContent = Array.from(fileInput.files)
    .slice(0, 2)
    .map((file) => file.name)
    .join(" | ");
}

async function uploadSingleFile(file, index, total, progressMap) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("tracks", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload");
    request.responseType = "json";

    request.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        return;
      }

      progressMap[index] = (progressEvent.loaded / progressEvent.total) * 100;
      const overall = progressMap.reduce((sum, value) => sum + value, 0) / total;
      setUploadProgress(overall);
    });

    request.addEventListener("load", () => {
      const responsePayload = request.response || {};
      if (request.status >= 200 && request.status < 300) {
        progressMap[index] = 100;
        const overall = progressMap.reduce((sum, value) => sum + value, 0) / total;
        setUploadProgress(overall);
        resolve(responsePayload);
        return;
      }

      reject(new Error(responsePayload.error || t("uploadFailed")));
    });

    request.addEventListener("error", () => {
      reject(new Error(t("uploadFailed")));
    });

    request.send(formData);
  });
}

async function uploadSelectedFiles() {
  if (state.isUploading) {
    return;
  }

  const files = Array.from(fileInput.files || []);

  if (!files.length) {
    uploadStatus.textContent = t("chooseAudioFiles");
    return;
  }

  state.isUploading = true;
  state.conversionItems = [];
  renderConverterDownloads();
  const progressMap = files.map(() => 0);
  let uploadedCount = 0;
  let failedCount = 0;
  let nextIndex = 0;

  uploadStatus.textContent = t("uploadingStatus", { current: 0, total: files.length });
  setUploadProgress(0);

  const worker = async () => {
    while (nextIndex < files.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        await uploadSingleFile(files[currentIndex], currentIndex, files.length, progressMap);
        uploadedCount += 1;
      } catch {
        failedCount += 1;
        progressMap[currentIndex] = 100;
        const overall = progressMap.reduce((sum, value) => sum + value, 0) / files.length;
        setUploadProgress(overall);
      }

      const current = Math.min(uploadedCount + failedCount, files.length);
      uploadStatus.textContent = t("uploadingStatus", {
        current,
        total: files.length
      });
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALLEL_UPLOADS, files.length) }, () => worker())
    );

    uploadForm.reset();
    updateDropzoneText();
    await fetchLibrary({ preserveStatus: true });
    currentView = "library";
    renderNavigation();

    if (!uploadedCount) {
      uploadStatus.textContent = t("uploadFailed");
      return;
    }

    if (failedCount) {
      uploadStatus.textContent = t("importedPartialStatus", {
        success: uploadedCount,
        failed: failedCount
      });
    } else {
      uploadStatus.textContent = t("importedQueuedStatus", { count: uploadedCount });
    }
  } finally {
    state.isUploading = false;
    window.setTimeout(() => {
      resetUploadProgress();
    }, 400);
  }
}

async function runConversion(mode) {
  if (state.isConverting) {
    return;
  }

  if (!state.converterSelectedTrackIds.length) {
    conversionStatus.textContent = t("conversionNoSelection");
    return;
  }

  state.isConverting = true;
  state.conversionItems = [];
  renderConverterDownloads();
  conversionStatus.textContent = mode === "overwrite" ? t("conversionPreparingOverwrite") : t("conversionPreparingDownload");

  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        trackIds: state.converterSelectedTrackIds,
        targetLufs: getEffectiveTargetLufs(),
        applyEq: applyEqToExportToggle.checked,
        eqBands
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || t("conversionFailed"));
    }

    if (mode === "download") {
      state.conversionItems = Array.isArray(payload.items) ? payload.items : [];
      renderConverterDownloads();
      conversionStatus.textContent = t("conversionDownloadSuccess");

      state.conversionItems.forEach((item, index) => {
        window.setTimeout(() => {
          const anchor = document.createElement("a");
          anchor.href = item.downloadUrl;
          anchor.download = item.fileName || "";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }, index * 120);
      });
      return;
    }

    await fetchLibrary({ preserveStatus: true });
    conversionStatus.textContent = t("conversionOverwriteSuccess");
  } catch (error) {
    conversionStatus.textContent = error.message || t("conversionFailed");
  } finally {
    state.isConverting = false;
  }
}

targetLufsSlider.addEventListener("input", () => {
  state.draftSettings.targetLufs = Number(targetLufsSlider.value);
  renderTargetLufs();
  renderCurrentCompensation();
  applyTrackLeveling();
});

autoLevelToggle.addEventListener("change", () => {
  state.autoLevelEnabled = autoLevelToggle.checked;
  localStorage.setItem("music-player-auto-level", String(state.autoLevelEnabled));
  renderAutoLevelState();
  applyTrackLeveling();
  renderCurrentCompensation();
});

saveLufsButton.addEventListener("click", async () => {
  await savePlaybackSettings();
});

createPlaylistButton.addEventListener("click", async () => {
  const name = playlistNameInput.value.trim();
  const isEditing = Boolean(state.editingPlaylistId);

  if (!name) {
    uploadStatus.textContent = t("playlistNameRequired");
    return;
  }

  if (!state.selectedTrackIds.length) {
    uploadStatus.textContent = t("playlistSelectionRequired");
    return;
  }

  const response = await fetch(isEditing ? `/api/playlists/${encodeURIComponent(state.editingPlaylistId)}` : "/api/playlists", {
    method: isEditing ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      trackIds: state.selectedTrackIds
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    uploadStatus.textContent = payload.error || (isEditing ? t("playlistUpdateFailed") : t("playlistCreateFailed"));
    return;
  }

  state.playlists = payload.playlists || state.playlists;
  state.activePlaylistId = payload.playlist?.id || state.activePlaylistId;
  resetPlaylistBuilderState({ keepOpen: false });
  rerenderAll();
  uploadStatus.textContent = isEditing ? t("playlistUpdated") : t("playlistCreated");
});

closePlaylistDetailButton.addEventListener("click", () => {
  state.activePlaylistId = null;
  renderPlaylists();
});

playPlaylistButton.addEventListener("click", async () => {
  const activePlaylist = getActivePlaylist();

  if (!activePlaylist) {
    return;
  }

  const firstTrackId = activePlaylist.trackIds.find((trackId) => getTrackById(trackId)?.url);

  if (!firstTrackId) {
    return;
  }

  await playTrack(firstTrackId);
});

deleteSelectedTracksButton.addEventListener("click", async () => {
  await deleteSelectedTracks();
});

deletePlaylistButton.addEventListener("click", async () => {
  const activePlaylist = getActivePlaylist();

  if (!activePlaylist) {
    return;
  }

  const confirmed = window.confirm(t("deletePlaylistConfirm", { name: activePlaylist.name }));
  if (!confirmed) {
    return;
  }

  const response = await fetch(`/api/playlists/${encodeURIComponent(activePlaylist.id)}`, {
    method: "DELETE"
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    uploadStatus.textContent = payload.error || t("playlistDeleteFailed");
    return;
  }

  state.activePlaylistId = null;
  state.playlists = payload.playlists || state.playlists.filter((playlist) => playlist.id !== activePlaylist.id);
  resetPlaylistBuilderState({ keepOpen: false });
  rerenderAll();
  uploadStatus.textContent = t("playlistDeleted");
});

toggleLibrarySelectionButton.addEventListener("click", () => {
  state.librarySelectionMode = !state.librarySelectionMode;

  if (!state.librarySelectionMode) {
    state.librarySelectedTrackIds = [];
  }

  updateLibrarySelectionSummary();
  renderLibrary();
});

editPlaylistButton.addEventListener("click", () => {
  if (!state.activePlaylistId) {
    return;
  }

  if (state.editingPlaylistId !== state.activePlaylistId) {
    startPlaylistEdit(state.activePlaylistId);
    return;
  }

  playlistBuilderPanel?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

togglePlaylistBuilderButton.addEventListener("click", () => {
  if (state.playlistBuilderOpen) {
    resetPlaylistBuilderState({ keepOpen: false });
    rerenderAll();
    return;
  }

  state.playlistBuilderOpen = true;
  renderPlaylistBuilder();
});

playlistSelectAllButton.addEventListener("click", () => {
  setPlaylistSelection(getLibraryTrackIds());
});

playlistClearSelectionButton.addEventListener("click", () => {
  setPlaylistSelection([]);
});

converterSelectAllButton.addEventListener("click", () => {
  setConverterSelection(getLibraryTrackIds());
});

converterClearSelectionButton.addEventListener("click", () => {
  setConverterSelection([]);
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

downloadConvertedButton.addEventListener("click", async () => {
  await runConversion("download");
});

overwriteConvertedButton.addEventListener("click", async () => {
  await runConversion("overwrite");
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

    try {
      await audioPlayer.play();
    } catch (error) {
      uploadStatus.textContent = error?.message || t("playbackBlocked");
    }
  } else {
    audioPlayer.pause();
  }
});

playbackModeButton.addEventListener("click", () => {
  cyclePlaybackMode();
});

prevTrackButton.addEventListener("click", async () => {
  await playAdjacentTrack(-1);
});

nextTrackButton.addEventListener("click", async () => {
  await playAdjacentTrack(1);
});

seekBar.addEventListener("input", () => {
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;

  if (duration > 0) {
    audioPlayer.currentTime = (Number(seekBar.value) / 1000) * duration;
    updateTimeline();
  }
});

volumeSlider.addEventListener("input", () => {
  audioPlayer.volume = Number(volumeSlider.value) / 100;
});

audioPlayer.addEventListener("play", async () => {
  await ensureAudioGraph();
  applyTrackLeveling();
  renderCurrentCompensation();
  renderPlayState();
});

audioPlayer.addEventListener("pause", () => {
  renderPlayState();
});

audioPlayer.addEventListener("loadedmetadata", updateTimeline);
audioPlayer.addEventListener("timeupdate", scheduleTimelineUpdate);
audioPlayer.addEventListener("ended", async () => {
  await handleTrackEnded();
});

document.addEventListener("visibilitychange", () => {
  syncLibraryPolling();
  syncFpsMonitor();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await uploadSelectedFiles();
});

fileInput.addEventListener("change", async () => {
  updateDropzoneText();
  if (fileInput.files.length) {
    await uploadSelectedFiles();
  }
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
    document.querySelector(`#${currentCustomizeView}Panel`)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
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

dropzone.addEventListener("drop", async (event) => {
  const files = Array.from(event.dataTransfer?.files || []);

  if (!files.length) {
    return;
  }

  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;
  updateDropzoneText();
  await uploadSelectedFiles();
});

langEnButton.addEventListener("click", () => {
  setLanguage("en");
});

langZhButton.addEventListener("click", () => {
  setLanguage("zh");
});

themeSystemButton.addEventListener("click", () => {
  setTheme("system");
});

themeLightButton.addEventListener("click", () => {
  setTheme("light");
});

themeDarkButton.addEventListener("click", () => {
  setTheme("dark");
});

showFpsToggle.addEventListener("change", () => {
  state.showFps = showFpsToggle.checked;
  localStorage.setItem("music-player-show-fps", String(state.showFps));
  renderFpsState();
});

applyTheme();
applyTranslations();
initializeSceneMotion();
buildEqControls();
renderAutoLevelState();
renderOverview();
renderLibrary();
renderSelectedTracks();
renderPlaylistTrackPicker();
renderConverterTrackPicker();
renderPlaylists();
renderBottomPlayer();
renderCurrentCompensation();
renderPlayState();
renderPlaybackModeButton();
renderConverterSummary();
renderConverterDownloads();
updateTimeline();
updateSelectionSummary();
updateDropzoneText();
renderNavigation();

fetchLibrary().catch(() => {
  uploadStatus.textContent = t("libraryLoadFailed");
});
