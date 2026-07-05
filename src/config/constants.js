export const LAYOUT_LABELS = {
  glasscard: "Glass",
  pill: "Pill",
  island: "Island",
  strip: "Strip",
  albumfocus: "Album",
  sidebar: "Side",
  vinyl: "Vinyl",
  terminal: "Terminal",
  cassette: "Cassette",
  gameboy: "Game Boy",
  hud: "HUD",
  stickynote: "Sticky Note",
  spotifycard: "Spotify Card",
  custom: "Custom",
};

export const LAYOUT_HINTS_SHORT = {
  glasscard: "Art, title, and progress",
  pill: "Compact corner chip",
  island: "Larger square widget",
  strip: "Thin bottom bar",
  albumfocus: "Art-first layout",
  sidebar: "Fixed column",
  vinyl: "Turntable player preset",
  terminal: "Retro CLI preset",
  cassette: "Tape deck preset",
  gameboy: "Retro handheld preset",
  hud: "Fighter HUD preset",
  stickynote: "Pinned note preset",
  spotifycard: "Social share card preset",
  custom: "Full custom editor",
};

export const CFG_TIP_SHOW_MS = 550;

export const LAYOUT_TOOLTIPS = {
  glasscard: "Album art with title, artist, and optional progress and extras.",
  pill: "Compact pill for corners and minimal footprint.",
  island: "Square card with emphasis on album art.",
  strip: "Very thin horizontal bar.",
  albumfocus: "Large art-first layout for music-focused scenes.",
  sidebar: "Vertical strip for side-mounted scenes.",
  vinyl: "Turntable scene with spinning disc and tonearm.",
  terminal: "Retro command-line interface with scan lines.",
  cassette: "Compact cassette with animated reels.",
  gameboy: "Game Boy Color style handheld console.",
  hud: "Heads-up display with targeting reticle.",
  stickynote: "Handwritten note with pin.",
  spotifycard: "Spotify social share card style.",
  custom: "Full visual editor for colors, sizing, and advanced layout.",
};

export const THEME_TOOLTIPS = {
  obsidian: "Neutral light-on-dark base.",
  midnight: "Cool blue highlights.",
  aurora: "Purple and magenta accents.",
  forest: "Green accent palette.",
  amber: "Warm orange highlights.",
  glass: "Soft translucent look.",
};

export const SOURCE_TOOLTIPS = {
  spotify: "Spotify login and Web API for live playback and rich metadata.",
  lastfm: "Uses your Last.fm recent tracks API.",
  songify: "Reads playback from Songify over localhost WebSocket.",
};

export const TOGGLE_KEY_TIPS = {
  showProgress: "Track position when the layout supports a progress bar.",
  showTimeLeft: "Show remaining time instead of elapsed.",
  showNextTrack: "Next in queue when Spotify queue data is available.",
  nextTrackMode:
    "Always refresh: update every poll. Per song: show the next title for ~10s after each new track, then hide until the next song.",
  showBpm: "Tempo from Spotify audio features (Spotify source only).",
  showAlbum: "Album name alongside track and artist.",
  showPlayState: "Small indicator when playback is active.",
  showIdleMessage: "Message when nothing is playing or when setup needs attention.",
  moodSync: "Background reacts to track energy using colors from album art.",
  animBgEnabled: "Animated gradient behind the card.",
  artBackdropEnabled: "Blurred cover art fills the area behind the glass card.",
  canvasEnabled: "Uses Spotify Canvas video for art when Songify supplies it.",
  transparent: "Transparent background for layering in OBS or over gameplay.",
};

export const ANIM_BG_STYLE_TIPS = {
  aurora: "Organic blobs that drift and blend.",
  flow: "Gradient slowly moves across the background.",
  pulse: "Colors expand and contract from the center.",
  breathe: "Gentle fade between tones.",
};

export const LAYOUT_OPTIONS = {
  glasscard: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  pill: { showProgress: false, showBpm: false, transparent: true, moodSync: true },
  island: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  strip: { showProgress: false, showBpm: false, transparent: true, moodSync: false },
  albumfocus: { showProgress: false, showBpm: true, transparent: true, moodSync: true },
  sidebar: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  vinyl: { showProgress: true, showBpm: true, transparent: true, moodSync: true },
  terminal: { showProgress: true, showBpm: true, transparent: false, moodSync: false },
  cassette: { showProgress: true, showBpm: false, transparent: false, moodSync: false },
  gameboy: { showProgress: true, showBpm: true, transparent: false, moodSync: false },
  hud: { showProgress: true, showBpm: true, transparent: true, moodSync: false },
  stickynote: { showProgress: true, showBpm: false, transparent: true, moodSync: false },
  spotifycard: { showProgress: true, showBpm: false, transparent: false, moodSync: false },
  custom: { showProgress: true, showBpm: true, transparent: true, moodSync: true },
};

export const LAYOUT_CONTENT = {
  glasscard: {
    showProgress: true, showTimeLeft: true, showNextTrack: true,
    showBpm: true, showAlbum: true, showPlayState: true,
    stackDir: true, artPosition: true,
  },
  pill: {
    showProgress: false, showTimeLeft: false, showNextTrack: false,
    showBpm: false, showAlbum: false, showPlayState: true,
    stackDir: false, artPosition: false,
  },
  island: {
    showProgress: true, showTimeLeft: true, showNextTrack: false,
    showBpm: true, showAlbum: true, showPlayState: true,
    stackDir: false, artPosition: false,
  },
  strip: {
    showProgress: false, showTimeLeft: true, showNextTrack: false,
    showBpm: false, showAlbum: false, showPlayState: false,
    stackDir: false, artPosition: true,
  },
  albumfocus: {
    showProgress: true, showTimeLeft: true, showNextTrack: false,
    showBpm: true, showAlbum: true, showPlayState: true,
    stackDir: false, artPosition: false,
  },
  sidebar: {
    showProgress: true, showTimeLeft: false, showNextTrack: false,
    showBpm: false, showAlbum: false, showPlayState: false,
    stackDir: false, artPosition: false,
  },
};

export const DEFAULT_OPEN = new Set(["source", "layout"]);

export const TWITCH_COMMAND_ORDER = ["sr", "skip", "prev", "queue", "vol"];

export const PREVIEW_DEBOUNCE_MS = 300;
export const CONFIG_DRAFT_KEY = "nowify_config_draft";
export const SONGIFY_STATUS_TTL_MS = 30_000;

export const CUSTOM_PRESETS_KEY = "nowify_custom_presets";
export const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
export const PUBLIC_PRESETS_CACHE_KEY = "nowify_public_presets_v1";
export const PUBLIC_PRESETS_CACHE_MS = 5 * 60 * 1000;

export const OWNER_KEY_STORAGE = "nowify_owner_key";
