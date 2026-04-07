import { initWizard, isSetupComplete, showWizard } from "./wizard.js";

const DEFAULT_STATE = {
  layout: "glasscard",
  theme: "obsidian",
  source: "spotify",
  songifyPort: 4002,
  clientId: "",
  showProgress: true,
  showTimeLeft: false,
  showNextTrack: false,
  /** Spotify queue label: "always" = every poll; "perSong" = hold last title until track changes */
  nextTrackMode: "always",
  showBpm: false,
  showAlbum: false,
  showPlayState: false,
  /** “Nothing playing” / Last.fm idle text (off by default) */
  showIdleMessage: false,
  transparent: false,
  moodSync: true,
  stackDir: "row",
  artPosition: "left",
  maxCardWidth: 900,
  twitchChannel: "",
  twitchToken: "",
  lastfmUsername: "",
  lastfmApiKey: "",
  queueSource: "queue",
  queueMaxItems: 5,
  queueShowPosition: true,
  queueShowArt: true,
  queueShowTitle: true,
  queueShowArtist: true,
  queueShowDuration: true,
  queueShowRequester: true,
  queueShowAvatar: true,
  queueShowLiked: true,
  queueHighlightRequests: false,
  queueTransparent: false,
  queueAnimateIn: "slide",
  queueFontSize: 13,
  queueItemRadius: 10,
  queueItemPadding: 10,
  queueItemOpacity: 80,
  queueArtSize: 40,
  queueGap: 6,
  queueDemoPreview: false,
  queueLayout: "glasscard",
  queueArtPosition: "left",
  queueShowAlbum: false,
  queueShowTimeLeft: false,
  queueShowNextTrack: false,
  queueShowPlayState: false,
  queueShowProgress: false,
  queueBlur: 24,
  queueMaxWidth: 480,
  queueCustomColors: false,
  queueColorAccent: "#ffffff",
  queueColorTitle: "#ffffff",
  queueColorMuted: "rgba(255,255,255,0.45)",
  queueColorCard: "rgba(10,10,10,0.85)",
  canvasEnabled: false,
  commands: {
    sr: {
      enabled: true,
      minRole: "everyone",
      sessionLimit: 0,
      roleLimits: {
        everyone: 3,
        subscriber: 5,
        vip: 10,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 30,
    },
    skip: {
      enabled: true,
      minRole: "moderator",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 0,
    },
    prev: {
      enabled: true,
      minRole: "moderator",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 0,
    },
    queue: {
      enabled: true,
      minRole: "everyone",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 10,
    },
    vol: {
      enabled: false,
      minRole: "moderator",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 5,
    },
  },
  animBgEnabled: false,
  animBgStyle: "aurora",
  animBgSpeed: 12,
  animBgColorMode: "mood",
  animBgColor1: "rgba(145,70,255,0.6)",
  animBgColor2: "rgba(30,30,80,0.8)",
  artBackdropEnabled: false,
  artBackdropBlur: 48,
};

/** Seeds custom editor from sidebar state (custom layout). */
export function readAnimBgForEditor() {
  return {
    animBgEnabled: Boolean(state.animBgEnabled),
    animBgColorMode: state.animBgColorMode || "mood",
    animBgColor1: state.animBgColor1,
    animBgColor2: state.animBgColor2,
    animBgStyle: state.animBgStyle || "aurora",
    animBgSpeed: Number(state.animBgSpeed) || 12,
  };
}

/** Songify-only controls mirrored in the custom editor Art tab. */
export function readSongifyArtFlags() {
  return {
    source: state.source,
    canvasEnabled: Boolean(state.canvasEnabled),
  };
}

export function readArtBackdropForEditor() {
  return {
    artBackdropEnabled: Boolean(state.artBackdropEnabled),
    artBackdropBlur: Number(state.artBackdropBlur) || 48,
  };
}

const LAYOUT_LABELS = {
  glasscard: "Glass",
  pill: "Pill",
  island: "Island",
  strip: "Strip",
  albumfocus: "Album",
  sidebar: "Side",
  custom: "Custom",
};

const LAYOUT_HINTS_SHORT = {
  glasscard: "Art, title, and progress",
  pill: "Compact corner chip",
  island: "Larger square widget",
  strip: "Thin bottom bar",
  albumfocus: "Art-first layout",
  sidebar: "Fixed column",
  custom: "Full custom editor",
};

const CFG_TIP_SHOW_MS = 550;

const LAYOUT_TOOLTIPS = {
  glasscard: "Album art with title, artist, and optional progress and extras.",
  pill: "Compact pill for corners and minimal footprint.",
  island: "Square card with emphasis on album art.",
  strip: "Very thin horizontal bar.",
  albumfocus: "Large art-first layout for music-focused scenes.",
  sidebar: "Vertical strip for side-mounted scenes.",
  custom: "Full visual editor for colors, sizing, and advanced layout.",
};

const THEME_TOOLTIPS = {
  obsidian: "Neutral light-on-dark base.",
  midnight: "Cool blue highlights.",
  aurora: "Purple and magenta accents.",
  forest: "Green accent palette.",
  amber: "Warm orange highlights.",
  glass: "Soft translucent look.",
};

const SOURCE_TOOLTIPS = {
  spotify: "Spotify login and Web API for live playback and rich metadata.",
  lastfm: "Uses your Last.fm recent tracks API.",
  songify: "Reads playback from Songify over localhost WebSocket.",
};

const TOGGLE_KEY_TIPS = {
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

const ANIM_BG_STYLE_TIPS = {
  aurora: "Organic blobs that drift and blend.",
  flow: "Gradient slowly moves across the background.",
  pulse: "Colors expand and contract from the center.",
  breathe: "Gentle fade between tones.",
};

const LAYOUT_OPTIONS = {
  glasscard: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  pill: { showProgress: false, showBpm: false, transparent: true, moodSync: true },
  island: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  strip: { showProgress: false, showBpm: false, transparent: true, moodSync: false },
  albumfocus: { showProgress: false, showBpm: true, transparent: true, moodSync: true },
  sidebar: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  custom: { showProgress: true, showBpm: true, transparent: true, moodSync: true },
};

const LAYOUT_CONTENT = {
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

/** Turn off overlay toggles the current layout does not support (sidebar UI hides them but URL/state could still be on). */
function applyLayoutOverlayConstraints(layout) {
  if (layout === "custom") return;
  const lc = LAYOUT_CONTENT[layout];
  if (!lc) return;
  if (lc.showProgress === false) state.showProgress = false;
  if (lc.showTimeLeft === false) state.showTimeLeft = false;
  if (lc.showNextTrack === false) state.showNextTrack = false;
  if (lc.showBpm === false) state.showBpm = false;
  if (lc.showAlbum === false) state.showAlbum = false;
  if (lc.showPlayState === false) state.showPlayState = false;
}

const DEFAULT_OPEN = new Set(["source", "layout"]);
let openSections = new Set(DEFAULT_OPEN);

const TWITCH_COMMAND_ORDER = ["sr", "skip", "prev", "queue", "vol"];
let expandedCommands = new Set();
let twitchCmdSliderDebounceTimer = null;
let queueConfigOpen = false;
let queueConfigSidebarTab = "look";
let queueRangeDebounceTimer = null;
let queueColorDebounceTimer = null;

function exitQueueDesignerMode() {
  if (!queueConfigOpen && !document.body.classList.contains("cfg-queue-mode")) {
    return;
  }
  queueConfigOpen = false;
  queueConfigSidebarTab = "look";
  document.body.classList.remove("cfg-queue-mode");
  restoreConfiguratorPreviewShell();
}

let state = {
  ...DEFAULT_STATE,
  commands: JSON.parse(JSON.stringify(DEFAULT_STATE.commands)),
};
let inputDebounceTimer = null;
let previousLayout = "glasscard";
let animBgSpeedDebounceTimer = null;
let artBackdropBlurDebounceTimer = null;
let cfgTipEl = null;
let cfgTipShowTimer = null;
let cfgTipHideTimer = null;
let cfgSidebarScrollBound = false;
let cfgTipEscapeBound = false;
let cfgToastTimer = null;
const CUSTOM_PRESETS_KEY = "nowify_custom_presets";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
const OWNER_KEY_STORAGE = "nowify_owner_key";

function mergeCommandsIntoDefaults(saved) {
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE.commands));
  for (const name of Object.keys(base)) {
    const sc = saved[name];
    if (sc && typeof sc === "object") {
      base[name] = {
        ...base[name],
        ...sc,
        roleLimits: { ...base[name].roleLimits, ...(sc.roleLimits || {}) },
      };
    }
  }
  return base;
}

function loadPlatformState() {
  const savedTwitch = localStorage.getItem("nowify_twitch");
  if (savedTwitch) {
    try {
      const tw = JSON.parse(savedTwitch || "{}");
      state.twitchChannel = tw.channel || "";
      state.twitchToken = tw.token || "";
    } catch (_e) {}
  }

  try {
    const saved = JSON.parse(localStorage.getItem("nowify_commands") || "null");
    if (saved && typeof saved === "object") {
      state.commands = mergeCommandsIntoDefaults(saved);
    }
  } catch (_e) {}

  state.clientId = localStorage.getItem("nowify_client_id") || "";

  const savedLastfm = localStorage.getItem("nowify_lastfm");
  if (savedLastfm) {
    try {
      const parsed = JSON.parse(savedLastfm);
      state.lastfmUsername = parsed.username || "";
      state.lastfmApiKey = parsed.apiKey || "";
    } catch (_error) {}
  }

  const savedSongify = localStorage.getItem("nowify_songify");
  if (savedSongify) {
    try {
      const parsed = JSON.parse(savedSongify);
      state.songifyPort = Number(parsed.port) || 4002;
    } catch (_error) {}
  }

  try {
    const qSaved = JSON.parse(localStorage.getItem("nowify_queue") || "null");
    if (qSaved && typeof qSaved === "object") {
      Object.keys(qSaved).forEach((k) => {
        if (k.startsWith("queue") && qSaved[k] !== undefined) {
          state[k] = qSaved[k];
        }
      });
    }
  } catch (_e) {}
}

function savePlatformState(newState) {
  if (newState.twitchChannel !== undefined || newState.twitchToken !== undefined) {
    localStorage.setItem(
      "nowify_twitch",
      JSON.stringify({
        channel: state.twitchChannel,
        token: state.twitchToken,
      })
    );
  }

  if (newState.lastfmUsername !== undefined || newState.lastfmApiKey !== undefined) {
    localStorage.setItem(
      "nowify_lastfm",
      JSON.stringify({
        username: state.lastfmUsername,
        apiKey: state.lastfmApiKey,
      })
    );
  }

  if (newState.songifyPort !== undefined) {
    localStorage.setItem(
      "nowify_songify",
      JSON.stringify({
        port: state.songifyPort,
      })
    );
  }

  try {
    localStorage.setItem("nowify_commands", JSON.stringify(state.commands));
  } catch (_e) {}

  try {
    const qSnap = {};
    Object.keys(state).forEach((k) => {
      if (k.startsWith("queue")) {
        qSnap[k] = state[k];
      }
    });
    localStorage.setItem("nowify_queue", JSON.stringify(qSnap));
  } catch (_e) {}
}

/** Builds the full overlay URL from the current configurator state. */
export function buildOverlayUrl(currentState) {
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();

  Object.entries(currentState).forEach(([key, value]) => {
    if (key === "commands") {
      return;
    }
    if (key.startsWith("queue")) {
      return;
    }
    if (value !== null && typeof value === "object") {
      return;
    }
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
      return;
    }
    params.set(key, String(value));
  });

  return `${base}?${params.toString()}`;
}

function buildQueueSearchParams(inputState, forConfiguratorPreview) {
  const params = new URLSearchParams({
    songifyPort: String(inputState.songifyPort || 4002),
    theme: inputState.theme || "obsidian",
    layout:
      inputState.queueLayout === "sidebar"
        ? "glasscard"
        : inputState.queueLayout || "glasscard",
    artPosition: inputState.queueArtPosition || "left",
    maxItems: String(inputState.queueMaxItems || 5),
    queueSource: inputState.queueSource || "queue",
    showPosition: inputState.queueShowPosition ? "1" : "0",
    showArt: inputState.queueShowArt ? "1" : "0",
    showTitle: inputState.queueShowTitle ? "1" : "0",
    showArtist: inputState.queueShowArtist ? "1" : "0",
    showAlbum: inputState.queueShowAlbum ? "1" : "0",
    showDuration: inputState.queueShowDuration ? "1" : "0",
    showRequester: inputState.queueShowRequester ? "1" : "0",
    showRequesterAvatar: inputState.queueShowAvatar ? "1" : "0",
    showLiked: inputState.queueShowLiked ? "1" : "0",
    highlightRequests: inputState.queueHighlightRequests ? "1" : "0",
    showTimeLeft: inputState.queueShowTimeLeft ? "1" : "0",
    showNextTrack: inputState.queueShowNextTrack ? "1" : "0",
    showPlayState: inputState.queueShowPlayState ? "1" : "0",
    showProgress: inputState.queueShowProgress ? "1" : "0",
    transparent: inputState.queueTransparent ? "1" : "0",
    animateIn: inputState.queueAnimateIn || "slide",
    fontSize: String(inputState.queueFontSize || 13),
    itemRadius: String(inputState.queueItemRadius || 10),
    itemPadding: String(inputState.queueItemPadding || 10),
    itemOpacity: String(inputState.queueItemOpacity || 80),
    artSize: String(inputState.queueArtSize || 40),
    gap: String(inputState.queueGap || 6),
    blurStrength: String(inputState.queueBlur ?? 24),
    maxWidth: String(inputState.queueMaxWidth ?? 480),
  });
  if (forConfiguratorPreview && inputState.queueDemoPreview) {
    params.set("demo", "1");
  }
  if (inputState.queueCustomColors) {
    params.set("customColors", "1");
    if (inputState.queueColorAccent) params.set("colorAccent", inputState.queueColorAccent);
    if (inputState.queueColorTitle) params.set("colorTitle", inputState.queueColorTitle);
    if (inputState.queueColorMuted) params.set("colorMuted", inputState.queueColorMuted);
    if (inputState.queueColorCard) params.set("colorCard", inputState.queueColorCard);
  }
  return params;
}

/** Queue overlay URL (preview uses demo when queueDemoPreview is on). */
export function buildQueueUrl(inputState) {
  const base =
    window.location.origin + window.location.pathname.replace("config.html", "") + "queue.html";
  return `${base}?${buildQueueSearchParams(inputState, true).toString()}`;
}

function queuePreviewIframeSrc(inputState) {
  const url = buildQueueUrl(inputState);
  const u = new URL(url);
  u.searchParams.set("nwPv", String(Date.now()));
  return u.toString();
}

function buildQueueFinalUrl(inputState) {
  const base =
    window.location.origin + window.location.pathname.replace("config.html", "") + "queue.html";
  return `${base}?${buildQueueSearchParams(inputState, false).toString()}`;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((x) => clampByte(x).toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseColorToHexForPicker(css) {
  const s = String(css || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  const hex3 = s.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const h = hex3[1];
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  const rgb = s.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)/i
  );
  if (rgb) return rgbToHex(rgb[1], rgb[2], rgb[3]);
  return "#ffffff";
}

function extractAlphaFromCss(css) {
  const s = String(css || "");
  const m = s.match(/rgba\s*\([\d\s,]+,\s*([\d.]+)\s*\)/i);
  if (m) {
    const a = parseFloat(m[1]);
    return Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1;
  }
  return 1;
}

function hexToRgba(hex, a) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.min(1, Math.max(0, Number(a) || 1));
  return `rgba(${r},${g},${b},${alpha})`;
}

function wheelHexToQueueColorValue(key, hex) {
  if (key === "queueColorMuted" || key === "queueColorCard") {
    const alpha =
      extractAlphaFromCss(state[key]) || (key === "queueColorMuted" ? 0.45 : 0.85);
    return hexToRgba(hex, alpha);
  }
  return hex;
}

function restoreConfiguratorPreviewShell() {
  const preview = document.getElementById("cfg-preview");
  if (!preview) return;
  preview.innerHTML = `
    <div id="cfg-preview-frame-wrap">
      <iframe id="cfg-iframe" frameborder="0"></iframe>
    </div>
    <div id="cfg-preview-bar">
      <span id="cfg-url-display"></span>
    </div>
  `;
  const url = buildOverlayUrl(state);
  const iframe = document.getElementById("cfg-iframe");
  if (iframe) iframe.src = url;
  const urlDisplay = document.getElementById("cfg-url-display");
  if (urlDisplay) urlDisplay.textContent = url;
}

function refreshQueueConfiguratorPreview() {
  const qi = document.getElementById("cfg-queue-iframe");
  if (qi) qi.src = queuePreviewIframeSrc(state);
  const qd = document.getElementById("cfg-queue-url-display");
  if (qd) qd.textContent = buildQueueFinalUrl(state);
}

function attachQueueSidebarListeners(sidebar) {
  sidebar.querySelectorAll("[data-set-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-set-key");
      const v = btn.getAttribute("data-set-value");
      update({ [k]: v });
      refreshQueueConfiguratorPreview();
    });
  });

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () => {
      const k = input.getAttribute("data-toggle-key");
      update({ [k]: input.checked });
      refreshQueueConfiguratorPreview();
    });
  });

  sidebar.querySelectorAll("[data-range-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.getAttribute("data-range-key");
      const val = Number(input.value);
      const label = document.getElementById(`val-${key}`);
      const units = {
        queueFontSize: "px",
        queueItemRadius: "px",
        queueItemPadding: "px",
        queueItemOpacity: "%",
        queueArtSize: "px",
        queueGap: "px",
        queueMaxItems: "",
        queueBlur: "",
        queueMaxWidth: "px",
      };
      if (label) label.textContent = val + (units[key] || "");
      window.clearTimeout(queueRangeDebounceTimer);
      queueRangeDebounceTimer = window.setTimeout(() => {
        update({ [key]: val });
        refreshQueueConfiguratorPreview();
      }, 300);
    });
  });

  sidebar.querySelectorAll("[data-select-key]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const k = sel.getAttribute("data-select-key");
      update({ [k]: sel.value });
      refreshQueueConfiguratorPreview();
    });
  });

  sidebar.querySelectorAll("[data-queue-color]").forEach((inp) => {
    inp.addEventListener("input", () => {
      window.clearTimeout(queueColorDebounceTimer);
      queueColorDebounceTimer = window.setTimeout(() => {
        const k = inp.getAttribute("data-queue-color");
        if (!k) return;
        update({ [k]: inp.value.trim() });
        const wheel = sidebar.querySelector(`[data-queue-color-wheel="${k}"]`);
        if (wheel) {
          wheel.value = parseColorToHexForPicker(inp.value.trim());
        }
        refreshQueueConfiguratorPreview();
      }, 400);
    });
  });

  sidebar.querySelectorAll("[data-queue-color-wheel]").forEach((picker) => {
    picker.addEventListener("input", () => {
      const k = picker.getAttribute("data-queue-color-wheel");
      if (!k) return;
      const next = wheelHexToQueueColorValue(k, picker.value);
      update({ [k]: next });
      const textInp = sidebar.querySelector(`[data-queue-color="${k}"]`);
      if (textInp) textInp.value = next;
      refreshQueueConfiguratorPreview();
    });
  });

  sidebar.querySelectorAll("[data-queue-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-queue-tab");
      queueConfigSidebarTab =
        id === "queue" || id === "style" || id === "colors" || id === "obs" ? id : "look";
      renderQueueSidebar();
    });
  });
}

function renderQueueSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
  sidebar.classList.add("cfg-queue-sidebar-mode");

  if (state.queueLayout === "sidebar") {
    state.queueLayout = "glasscard";
    refreshQueueConfiguratorPreview();
  }

  const themeOptions = ["obsidian", "midnight", "aurora", "forest", "amber", "glass"];
  const queueLayoutOptions = ["glasscard", "pill", "island", "strip", "albumfocus"];
  const tab = queueConfigSidebarTab;

  function sliderRow(label, key, min, max, step, value, suffix) {
    return `
    <div class="cfg-queue-slider-block">
      <div class="cfg-slider-row cfg-slider-row-tight">
        <span class="cfg-slider-label">${label}</span>
        <span class="cfg-slider-val" id="val-${key}">${value}${suffix}</span>
      </div>
      <input type="range" class="cfg-queue-range" data-range-key="${key}"
        min="${min}" max="${max}" step="${step}" value="${value}" />
    </div>`;
  }

  function toggleRow(label, key, description = "") {
    return `
      <label class="cfg-toggle-row cfg-toggle-row-compact">
        <span class="cfg-toggle-label-wrap">
          <span class="cfg-toggle-label">${label}</span>
          ${description ? `<span class="cfg-toggle-desc">${description}</span>` : ""}
        </span>
        <span class="cfg-toggle">
          <input type="checkbox" data-toggle-key="${key}" ${state[key] ? "checked" : ""} />
          <span class="cfg-toggle-track"></span>
          <span class="cfg-toggle-thumb"></span>
        </span>
      </label>
    `;
  }

  function toggleSimple(label, key) {
    return toggleRow(label, key, "");
  }

  function queueTabBtnClass(id) {
    return tab === id
      ? "cfg-btn cfg-sm-btn cfg-queue-tab cfg-active"
      : "cfg-btn cfg-sm-btn cfg-queue-tab";
  }

  const panelLook = `
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Queue data</div>
    ${toggleSimple("Demo sample list", "queueDemoPreview")}
    <div class="cfg-btn-group cfg-btn-group-wrap cfg-queue-source-btns">
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueSource === "queue" ? "cfg-active" : ""}" data-set-key="queueSource" data-set-value="queue">All</button>
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueSource === "requestqueue" ? "cfg-active" : ""}" data-set-key="queueSource" data-set-value="requestqueue">Requests</button>
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueSource === "both" ? "cfg-active" : ""}" data-set-key="queueSource" data-set-value="both">Both</button>
    </div>
  </div>
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Theme</div>
    <div class="cfg-theme-grid cfg-queue-theme-grid">
      ${themeOptions
        .map(
          (opt) => `
        <button type="button" class="cfg-theme-btn ${state.theme === opt ? "cfg-active" : ""}" data-set-key="theme" data-set-value="${opt}">
          <div class="cfg-theme-dot cfg-theme-dot-${opt}"></div><span>${themeLabel(opt)}</span>
        </button>`
        )
        .join("")}
    </div>
  </div>
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Layout</div>
    <div class="cfg-layout-grid cfg-queue-layout-grid">
      ${queueLayoutOptions
        .map(
          (opt) => `
        <button type="button" class="cfg-layout-btn ${state.queueLayout === opt ? "cfg-active" : ""}" data-set-key="queueLayout" data-set-value="${opt}">
          <div class="cfg-layout-icon cfg-layout-icon-${opt}"></div><span>${LAYOUT_LABELS[opt] || opt}</span>
        </button>`
        )
        .join("")}
    </div>
    <div class="cfg-cmd-field-label" style="margin-top:10px">Art position</div>
    <div class="cfg-btn-group">
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueArtPosition === "left" ? "cfg-active" : ""}" data-set-key="queueArtPosition" data-set-value="left">Left</button>
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueArtPosition === "right" ? "cfg-active" : ""}" data-set-key="queueArtPosition" data-set-value="right">Right</button>
    </div>
  </div>`;

  const panelQueue = `
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Now playing context</div>
    ${toggleSimple("Time to next track", "queueShowTimeLeft")}
    ${toggleSimple("Current track progress", "queueShowProgress")}
    ${toggleSimple("Up next title", "queueShowNextTrack")}
    ${toggleSimple("Play state dot", "queueShowPlayState")}
  </div>
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">List length</div>
    ${sliderRow("Max items", "queueMaxItems", 1, 25, 1, state.queueMaxItems, "")}
  </div>
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Track row</div>
    ${toggleRow("Position number", "queueShowPosition", "")}
    ${toggleRow("Album art", "queueShowArt", "")}
    ${toggleRow("Track title", "queueShowTitle", "")}
    ${toggleRow("Artist", "queueShowArtist", "")}
    ${toggleRow("Album name", "queueShowAlbum", "")}
    ${toggleRow("Duration", "queueShowDuration", "")}
    ${toggleRow("Requester", "queueShowRequester", "")}
    ${toggleRow("Requester avatar", "queueShowAvatar", "")}
    ${toggleRow("Liked indicator", "queueShowLiked", "")}
    ${toggleRow(
      "Highlight user requests",
      "queueHighlightRequests",
      "Accent on Songify user requests"
    )}
    ${toggleRow("Transparent background", "queueTransparent", "")}
  </div>`;

  const panelStyle = `
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Sizing and motion</div>
    ${sliderRow("Font size", "queueFontSize", 10, 20, 1, state.queueFontSize, "px")}
    ${sliderRow("Corner radius", "queueItemRadius", 0, 24, 1, state.queueItemRadius, "px")}
    ${sliderRow("Padding", "queueItemPadding", 4, 24, 1, state.queueItemPadding, "px")}
    ${sliderRow("Opacity", "queueItemOpacity", 0, 100, 5, state.queueItemOpacity, "%")}
    ${sliderRow("Art size", "queueArtSize", 24, 80, 4, state.queueArtSize, "px")}
    ${sliderRow("Item gap", "queueGap", 2, 20, 1, state.queueGap, "px")}
    ${sliderRow("Blur", "queueBlur", 8, 40, 1, state.queueBlur, "")}
    ${sliderRow("Max width", "queueMaxWidth", 280, 720, 10, state.queueMaxWidth, "px")}
    <div class="cfg-queue-select-field">
      <span class="cfg-queue-select-label">Animate in</span>
      <select data-select-key="queueAnimateIn" class="cfg-input cfg-select-block">
        ${[
          ["slide", "Slide up"],
          ["fade", "Fade"],
          ["pop", "Pop"],
          ["none", "None"],
        ]
          .map(
            ([v, l]) => `
          <option value="${v}" ${state.queueAnimateIn === v ? "selected" : ""}>${l}</option>`
          )
          .join("")}
      </select>
    </div>
  </div>`;

  const panelColors = `
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">Custom colors</div>
    ${toggleSimple("Override theme colors", "queueCustomColors")}
    ${
      state.queueCustomColors
        ? `
    <div class="cfg-queue-color-grid">
      <div class="cfg-queue-color-field">
        <div class="cfg-cmd-field-label">Accent</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorAccent" value="${parseColorToHexForPicker(state.queueColorAccent)}" title="Accent" aria-label="Accent color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorAccent" value="${escCfg(state.queueColorAccent)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="cfg-queue-color-field">
        <div class="cfg-cmd-field-label">Title</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorTitle" value="${parseColorToHexForPicker(state.queueColorTitle)}" title="Title" aria-label="Title text color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorTitle" value="${escCfg(state.queueColorTitle)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="cfg-queue-color-field">
        <div class="cfg-cmd-field-label">Muted text</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorMuted" value="${parseColorToHexForPicker(state.queueColorMuted)}" title="Muted" aria-label="Muted text color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorMuted" value="${escCfg(state.queueColorMuted)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="cfg-queue-color-field">
        <div class="cfg-cmd-field-label">Row background</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorCard" value="${parseColorToHexForPicker(state.queueColorCard)}" title="Row background" aria-label="Row background color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorCard" value="${escCfg(state.queueColorCard)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <p class="cfg-queue-color-hint">Muted and row colors keep alpha from the text field; edit CSS to change opacity.</p>
    </div>`
        : ""
    }
  </div>`;

  const panelObs = `
  <div class="cfg-queue-panel-block">
    <div class="cfg-cmd-field-label">OBS</div>
    <div class="cfg-songify-preview-note cfg-queue-obs-note">
      Add a <strong>Browser Source</strong>, paste the queue URL, about <strong>400 × 600</strong> px.
    </div>
  </div>`;

  let panelBody = "";
  if (tab === "look") panelBody = panelLook;
  else if (tab === "queue") panelBody = panelQueue;
  else if (tab === "style") panelBody = panelStyle;
  else if (tab === "colors") panelBody = panelColors;
  else if (tab === "obs") panelBody = panelObs;
  else panelBody = panelLook;

  sidebar.innerHTML = `
  <div class="cfg-queue-tabstrip cfg-btn-group cfg-btn-group-wrap" role="tablist">
    <button type="button" class="${queueTabBtnClass("look")}" data-queue-tab="look" role="tab" aria-selected="${tab === "look" ? "true" : "false"}">Look</button>
    <button type="button" class="${queueTabBtnClass("queue")}" data-queue-tab="queue" role="tab" aria-selected="${tab === "queue" ? "true" : "false"}">Queue</button>
    <button type="button" class="${queueTabBtnClass("style")}" data-queue-tab="style" role="tab" aria-selected="${tab === "style" ? "true" : "false"}">Sizing</button>
    <button type="button" class="${queueTabBtnClass("colors")}" data-queue-tab="colors" role="tab" aria-selected="${tab === "colors" ? "true" : "false"}">Colors</button>
    <button type="button" class="${queueTabBtnClass("obs")}" data-queue-tab="obs" role="tab" aria-selected="${tab === "obs" ? "true" : "false"}">OBS</button>
  </div>
  <div class="cfg-queue-tab-panel">
    ${panelBody}
  </div>
  `;

  attachQueueSidebarListeners(sidebar);
  attachCfgTooltips(sidebar);
}

function renderQueueConfig() {
  queueConfigOpen = true;
  const customContainer = document.getElementById("cfg-custom-editor");
  if (customContainer) customContainer.style.display = "none";
  const sidebarEl = document.getElementById("cfg-sidebar");
  if (sidebarEl) sidebarEl.style.display = "";

  const preview = document.getElementById("cfg-preview");
  if (!preview) return;

  document.body.classList.add("cfg-queue-mode");

  preview.innerHTML = `
      <div id="cfg-preview-bg"></div>
      <div class="cfg-queue-preview-header">
        <div class="cfg-queue-preview-heading">
          <div class="cfg-queue-preview-title">Queue overlay</div>
          <div class="cfg-queue-preview-sub">
            Separate browser source for upcoming tracks (Songify)
          </div>
        </div>
        <button class="cfg-btn cfg-sm-btn cfg-btn-secondary" id="btn-close-queue-config" type="button">
          Back to overlay
        </button>
      </div>
      <div id="cfg-queue-preview-wrap">
        <iframe id="cfg-queue-iframe" frameborder="0" title="Queue overlay preview"></iframe>
      </div>
      <div id="cfg-preview-bar">
        <div class="cfg-url-row">
          <span class="cfg-url-row-label">Queue URL</span>
          <span class="cfg-url-mono" id="cfg-queue-url-display"></span>
          <button class="cfg-btn cfg-sm-btn cfg-btn-primary" id="btn-copy-queue" type="button">
            Copy URL
          </button>
        </div>
      </div>
    `;

  const queueIf = document.getElementById("cfg-queue-iframe");
  if (queueIf) queueIf.src = queuePreviewIframeSrc(state);
  const qd = document.getElementById("cfg-queue-url-display");
  if (qd) qd.textContent = buildQueueFinalUrl(state);

  renderQueueSidebar();

  document.getElementById("btn-close-queue-config")?.addEventListener("click", () => {
    exitQueueDesignerMode();
    update({});
  });

  document.getElementById("btn-copy-queue")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(buildQueueFinalUrl(state));
      const btn = document.getElementById("btn-copy-queue");
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 1200);
    } catch (_e) {}
  });
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
}

function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

function escAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function ensureCfgTipElement() {
  if (cfgTipEl && document.body.contains(cfgTipEl)) {
    return cfgTipEl;
  }
  cfgTipEl = document.createElement("div");
  cfgTipEl.id = "cfg-tip-floater";
  cfgTipEl.className = "cfg-tip-floater";
  cfgTipEl.setAttribute("role", "tooltip");
  document.body.appendChild(cfgTipEl);
  if (!cfgTipEscapeBound) {
    cfgTipEscapeBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideCfgTip();
      }
    });
  }
  return cfgTipEl;
}

function hideCfgTip() {
  window.clearTimeout(cfgTipShowTimer);
  cfgTipShowTimer = null;
  if (cfgTipEl) {
    cfgTipEl.classList.remove("cfg-tip-visible");
    cfgTipEl.textContent = "";
    cfgTipEl.style.left = "";
    cfgTipEl.style.top = "";
  }
}

function positionCfgTip(anchor, tip) {
  tip.classList.add("cfg-tip-visible");
  window.requestAnimationFrame(() => {
    const tr = tip.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const pad = 8;
    let top = ar.bottom + pad;
    let left = ar.left + ar.width / 2 - tr.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
    if (top + tr.height > window.innerHeight - pad) {
      top = ar.top - tr.height - pad;
    }
    top = Math.max(pad, top);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  });
}

function scheduleShowCfgTip(anchor, text) {
  window.clearTimeout(cfgTipHideTimer);
  cfgTipHideTimer = null;
  window.clearTimeout(cfgTipShowTimer);
  const tip = ensureCfgTipElement();
  cfgTipShowTimer = window.setTimeout(() => {
    cfgTipShowTimer = null;
    tip.textContent = text;
    positionCfgTip(anchor, tip);
  }, CFG_TIP_SHOW_MS);
}

function bindCfgSidebarScrollOnce() {
  const sb = document.getElementById("cfg-sidebar");
  if (!sb || cfgSidebarScrollBound) {
    return;
  }
  cfgSidebarScrollBound = true;
  sb.addEventListener("scroll", hideCfgTip);
}

function attachCfgTooltips(container) {
  if (!container) {
    return;
  }
  ensureCfgTipElement();
  bindCfgSidebarScrollOnce();
  container.querySelectorAll("[data-cfg-tip]").forEach((el) => {
    const raw = el.getAttribute("data-cfg-tip");
    if (!raw) {
      return;
    }
    const onEnter = () => scheduleShowCfgTip(el, raw);
    const onLeave = () => {
      window.clearTimeout(cfgTipShowTimer);
      cfgTipShowTimer = null;
      cfgTipHideTimer = window.setTimeout(hideCfgTip, 80);
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
  });
}

function renderSection(id, label, content) {
  const open = openSections.has(id);
  return `<div class="cfg-section-block${open ? " cfg-section-open" : ""}" data-section-id="${id}">
    <button type="button" class="cfg-section-header" data-toggle-section="${id}">
      <span class="cfg-section-header-label">${label}</span>
      <span class="cfg-section-header-chevron" aria-hidden="true">›</span>
    </button>
    <div class="cfg-section-body">
      ${content}
    </div>
  </div>`;
}

function compactToggle(label, key, visible = true, desc = "", tooltip = "") {
  if (!visible) return "";
  const descHtml = desc
    ? `<span class="cfg-toggle-desc">${desc}</span>`
    : "";
  const tipAttr = tooltip ? ` data-cfg-tip="${escAttr(tooltip)}"` : "";
  return `<label class="cfg-toggle-row cfg-toggle-row-compact"${tipAttr}>
    <span class="cfg-toggle-label-wrap">
      <span class="cfg-toggle-label">${label}</span>
      ${descHtml}
    </span>
    <span class="cfg-toggle">
      <input type="checkbox" data-toggle-key="${key}" ${state[key] ? "checked" : ""} />
      <span class="cfg-toggle-track"></span>
      <span class="cfg-toggle-thumb"></span>
    </span>
  </label>`;
}

function themeLabel(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function renderSongifyStatus() {
  return `<div class="cfg-songify-status" id="cfg-songify-status">Not connected</div>`;
}

function renderSourceContent() {
  const pills = `<div class="cfg-source-pills">
    <button class="cfg-source-pill ${state.source === "spotify" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="spotify" type="button" data-cfg-tip="${escAttr(SOURCE_TOOLTIPS.spotify)}">Spotify</button>
    <button class="cfg-source-pill ${state.source === "lastfm" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="lastfm" type="button" data-cfg-tip="${escAttr(SOURCE_TOOLTIPS.lastfm)}">Last.fm</button>
    <button class="cfg-source-pill ${state.source === "songify" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="songify" type="button" data-cfg-tip="${escAttr(SOURCE_TOOLTIPS.songify)}">Songify</button>
  </div>`;

  if (state.source === "spotify") {
    return `${pills}
      <input id="ctrl-clientId" class="cfg-input" placeholder="Client ID" value="${escCfg(state.clientId)}" data-cfg-tip="${escAttr("From the Spotify Developer Dashboard. Used for the overlay login flow.")}" />
      <div class="cfg-copy-box" id="cfg-redirect-uri" data-cfg-tip="${escAttr("Add this redirect URI to your Spotify app settings.")}">${getRedirectUri()}</div>`;
  }

  if (state.source === "lastfm") {
    const disconnect =
      state.lastfmUsername || state.lastfmApiKey
        ? `<div class="cfg-disconnect-row"><button class="cfg-disconnect-btn" id="btn-lastfm-disconnect" type="button" data-cfg-tip="${escAttr("Clear saved Last.fm credentials.")}">Disconnect</button></div>`
        : "";
    return `${pills}
      ${disconnect}
      <input id="ctrl-lastfmUsername" class="cfg-input cfg-input-sm" type="text" placeholder="Username" value="${escCfg(state.lastfmUsername)}" data-cfg-tip="${escAttr("Your public Last.fm profile name.")}" />
      <input id="ctrl-lastfmApiKey" class="cfg-input cfg-input-sm" type="text" placeholder="API key" value="${escCfg(state.lastfmApiKey)}" data-cfg-tip="${escAttr("Create an API account on Last.fm to get a key.")}" />`;
  }

  const portNum = Number(state.songifyPort);
  const portOk = Number.isInteger(portNum) && portNum >= 1024 && portNum <= 65535;
  const queueCard = portOk
    ? `<div class="cfg-queue-entry-card" data-cfg-tip="${escAttr("Opens a dedicated layout editor and preview for queue.html — use as a second OBS browser source.")}">
    <div class="cfg-queue-entry-top">
      <div>
        <div class="cfg-queue-entry-head">
          <span class="cfg-cmd-section-label cfg-queue-entry-label">Queue overlay</span>
          <span class="cfg-beta-chip">Songify</span>
        </div>
        <p class="cfg-queue-entry-desc">Show upcoming tracks in a separate browser source powered by Songify.</p>
      </div>
      <button type="button" class="cfg-btn cfg-sm-btn cfg-btn-primary" id="btn-open-queue-config">Configure</button>
    </div>
  </div>`
    : "";
  return `${pills}
    ${renderSongifyStatus()}
    <div class="cfg-row" data-cfg-tip="${escAttr("WebSocket port from Songify → Settings → Web Server (default 4002).")}">
      <span class="cfg-row-label">Port</span>
      <input type="number" id="ctrl-songifyPort" class="cfg-input-inline" value="${escCfg(String(state.songifyPort))}" min="1024" max="65535" />
    </div>
    ${queueCard}`;
}

function renderLayoutContent(layoutOptions) {
  const grid = layoutOptions
    .map((opt) =>
      opt === "custom"
        ? `<button class="cfg-layout-btn cfg-layout-btn-custom ${state.layout === "custom" ? "cfg-active" : ""}" data-set-key="layout" data-set-value="custom" type="button" data-cfg-tip="${escAttr(LAYOUT_TOOLTIPS.custom)}">
            <div class="cfg-layout-icon cfg-layout-icon-custom"></div><span>${LAYOUT_LABELS.custom}</span>
          </button>`
        : `<button class="cfg-layout-btn ${state.layout === opt ? "cfg-active" : ""}" data-set-key="layout" data-set-value="${opt}" type="button" data-cfg-tip="${escAttr(LAYOUT_TOOLTIPS[opt] || "")}">
            <div class="cfg-layout-icon cfg-layout-icon-${opt}"></div><span>${LAYOUT_LABELS[opt] || opt}</span>
          </button>`
    )
    .join("");
  const hint = LAYOUT_HINTS_SHORT[state.layout] || "";
  return `<div class="cfg-layout-grid">${grid}</div>
    <div class="cfg-layout-hint cfg-layout-hint-short">${hint}</div>`;
}

function renderThemeContent(themeOptions) {
  const grid = themeOptions
    .map(
      (opt) =>
        `<button class="cfg-theme-btn ${state.theme === opt ? "cfg-active" : ""}" data-set-key="theme" data-set-value="${opt}" type="button" data-cfg-tip="${escAttr(THEME_TOOLTIPS[opt] || "")}">
          <div class="cfg-theme-dot cfg-theme-dot-${opt}"></div><span>${themeLabel(opt)}</span>
        </button>`
    )
    .join("");
  return `<div class="cfg-theme-grid">${grid}</div>`;
}

function renderContentContent() {
  const lc = LAYOUT_CONTENT[state.layout];
  const isCustom = state.layout === "custom";
  const rows = [];

  if (lc?.showProgress !== false) {
    rows.push(compactToggle("Progress bar", "showProgress", true, "", TOGGLE_KEY_TIPS.showProgress));
  }
  if (lc?.showTimeLeft) {
    rows.push(compactToggle("Time remaining", "showTimeLeft", true, "", TOGGLE_KEY_TIPS.showTimeLeft));
  }
  if (lc?.showNextTrack) {
    rows.push(compactToggle("Next track", "showNextTrack", true, "", TOGGLE_KEY_TIPS.showNextTrack));
  }
  const showNextTrackModeRow =
    state.source === "spotify" && (isCustom || (lc?.showNextTrack && state.showNextTrack));
  if (showNextTrackModeRow) {
    const m = state.nextTrackMode === "perSong" ? "perSong" : "always";
    rows.push(`<div class="cfg-sub-label" data-cfg-tip="${escAttr(TOGGLE_KEY_TIPS.nextTrackMode)}">Next track updates</div>
      <p class="cfg-hint" style="margin:-4px 0 8px;line-height:1.45">Always refresh: fetches the Spotify queue every poll (can flicker if the API is empty). Per song: shows the next title for about 10 seconds after each new track, then hides until the next song.</p>
      <div class="cfg-btn-group" style="margin-bottom:8px">
        <button type="button" class="cfg-btn cfg-sm-btn ${m === "always" ? "cfg-active" : ""}" data-set-key="nextTrackMode" data-set-value="always" data-cfg-tip="${escAttr("Re-fetch the queue on every poll. Next line stays in sync with Spotify.")}">Always refresh</button>
        <button type="button" class="cfg-btn cfg-sm-btn ${m === "perSong" ? "cfg-active" : ""}" data-set-key="nextTrackMode" data-set-value="perSong" data-cfg-tip="${escAttr("After each new track, show the next title for ~10 seconds only.")}">Per song (~10s)</button>
      </div>`);
  }
  if (state.source !== "lastfm" && state.source !== "songify" && lc?.showBpm) {
    rows.push(compactToggle("BPM", "showBpm", true, "", TOGGLE_KEY_TIPS.showBpm));
  }
  if (lc?.showAlbum) {
    rows.push(compactToggle("Album name", "showAlbum", true, "", TOGGLE_KEY_TIPS.showAlbum));
  }
  if (lc?.showPlayState) {
    rows.push(compactToggle("Play state", "showPlayState", true, "", TOGGLE_KEY_TIPS.showPlayState));
  }
  rows.push(compactToggle("Idle message", "showIdleMessage", true, "", TOGGLE_KEY_TIPS.showIdleMessage));

  const showBlock = rows.join("");
  const stackOk = isCustom;
  const artOk = isCustom;
  let layoutBlock = "";
  if (stackOk || artOk) {
    let inner = "";
    if (stackOk) {
      inner += `<div class="cfg-btn-group">
        <button class="cfg-btn cfg-sm-btn ${state.stackDir === "row" ? "cfg-active" : ""}" data-set-key="stackDir" data-set-value="row" type="button" data-cfg-tip="${escAttr("Art and text side by side.")}">Horizontal</button>
        <button class="cfg-btn cfg-sm-btn ${state.stackDir === "column" ? "cfg-active" : ""}" data-set-key="stackDir" data-set-value="column" type="button" data-cfg-tip="${escAttr("Art above or below the text stack.")}">Vertical</button>
      </div>`;
    }
    if (artOk) {
      inner += `<div class="cfg-btn-group">
        <button class="cfg-btn cfg-sm-btn ${state.artPosition === "left" ? "cfg-active" : ""}" data-set-key="artPosition" data-set-value="left" type="button" data-cfg-tip="${escAttr("Cover art on the leading side.")}">Left</button>
        <button class="cfg-btn cfg-sm-btn ${state.artPosition === "right" ? "cfg-active" : ""}" data-set-key="artPosition" data-set-value="right" type="button" data-cfg-tip="${escAttr("Cover art on the opposite side.")}">Right</button>
      </div>`;
    }
    layoutBlock = `<div class="cfg-section-sep"></div>${inner}`;
  }

  return showBlock + layoutBlock;
}

function renderVisualsContent() {
  const parts = [];
  if (state.source === "spotify") {
    parts.push(compactToggle("Mood sync", "moodSync", true, "", TOGGLE_KEY_TIPS.moodSync));
  }

  if (state.layout !== "custom" && state.source !== "songify") {
    parts.push(compactToggle("Animated background", "animBgEnabled", true, "", TOGGLE_KEY_TIPS.animBgEnabled));
    if (state.animBgEnabled) {
      const styles = ["aurora", "flow", "pulse", "breathe"]
        .map(
          (v) =>
            `<button class="cfg-btn cfg-sm-btn ${state.animBgStyle === v ? "cfg-active" : ""}" data-set-key="animBgStyle" data-set-value="${v}" type="button" data-cfg-tip="${escAttr(ANIM_BG_STYLE_TIPS[v] || "")}">${themeLabel(v)}</button>`
        )
        .join("");
      parts.push(`<div class="cfg-visual-sub">
        <div class="cfg-btn-group cfg-btn-group-wrap">${styles}</div>
        <div class="cfg-slider-row cfg-slider-row-tight" data-cfg-tip="${escAttr("Animation loop length. Lower is faster.")}">
          <span class="cfg-slider-label" id="ctrl-anim-bg-speed-label">Speed (${state.animBgSpeed}s)</span>
          <input id="ctrl-anim-bg-speed" type="range" min="3" max="30" step="1" value="${state.animBgSpeed}" />
        </div>
      </div>`);
    }
  }

  if (state.source === "songify") {
    parts.push(compactToggle("Canvas video", "canvasEnabled", true, "", TOGGLE_KEY_TIPS.canvasEnabled));
  }

  if (state.layout !== "custom") {
    parts.push(
      compactToggle("Album art backdrop", "artBackdropEnabled", true, "", TOGGLE_KEY_TIPS.artBackdropEnabled)
    );
    if (state.artBackdropEnabled) {
      parts.push(`<div class="cfg-visual-sub" data-cfg-tip="${escAttr("Blur radius for the cover behind the card. Works with transparent or frosted backgrounds.")}">
        <div class="cfg-slider-row cfg-slider-row-tight">
          <span class="cfg-slider-label" id="ctrl-art-backdrop-blur-label">Backdrop blur (${state.artBackdropBlur}px)</span>
          <input id="ctrl-art-backdrop-blur" type="range" min="0" max="120" step="2" value="${state.artBackdropBlur}" />
        </div>
      </div>`);
    }
  }

  parts.push(
    compactToggle(
      "Transparent background",
      "transparent",
      LAYOUT_OPTIONS[state.layout]?.transparent ?? true,
      "",
      TOGGLE_KEY_TIPS.transparent
    )
  );

  return parts.join("");
}

function renderStyleContent() {
  return `<button type="button" class="cfg-btn cfg-sm-btn cfg-btn-secondary cfg-open-custom-editor" id="btn-open-custom-editor" data-cfg-tip="${escAttr("Switch to custom layout with the full visual editor.")}">Open custom editor</button>`;
}

function getRoleLabel(role) {
  const labels = {
    everyone: "Everyone",
    subscriber: "Subs+",
    vip: "VIPs+",
    moderator: "Mods+",
    broadcaster: "Me only",
  };
  return labels[role] || role;
}

function renderMiniToggle(id, checked) {
  return `<label class="cfg-mini-toggle" onclick="event.stopPropagation()">
    <input type="checkbox"
           data-cmd-enabled="${escCfg(id)}"
           ${checked ? "checked" : ""} />
    <span class="cfg-mini-track"></span>
    <span class="cfg-mini-thumb"></span>
  </label>`;
}

function cmdSliderRow(cmd, key, min, max, step, value, unit, note) {
  const noteHtml =
    note && value === 0 ? `<span class="cfg-val-note">${escCfg(note)}</span>` : "";
  return `<div class="cfg-slider-row cfg-cmd-slider-row">
    <div class="cfg-slider-right">
      <input type="range"
             min="${min}" max="${max}" step="${step}"
             value="${value}"
             data-cmd-slider="${escAttr(cmd)}"
             data-cmd-key="${escAttr(key)}" />
      <span class="cfg-slider-val"
            id="val-cmd-${cmd}-${key}">
        ${escCfg(String(value))}${escCfg(unit)}${noteHtml}
      </span>
    </div>
  </div>`;
}

function renderCommandRow(cmd) {
  const cfg = state.commands[cmd];
  const minRole = cfg.minRole || "everyone";
  const roleLimitRoles = [
    ["everyone", "Everyone"],
    ["subscriber", "Subs"],
    ["vip", "VIPs"],
    ["moderator", "Mods"],
  ];
  const roleLimitRows =
    cmd === "sr"
      ? `
        <div class="cfg-cmd-field-label">
          Requests per viewer
        </div>
        ${roleLimitRoles
          .map(([role, label]) => {
            const lim = cfg.roleLimits[role] ?? 0;
            const limDisplay =
              lim === 0
                ? `0<span class="cfg-val-note">∞</span>`
                : String(lim);
            return `
          <div class="cfg-cmd-role-limit-row">
            <span class="cfg-cmd-role-label">${label}</span>
            <div class="cfg-slider-right">
              <input type="range"
                     min="0" max="20" step="1"
                     value="${lim}"
                     data-cmd-role-limit="${escAttr(cmd)}"
                     data-role="${escAttr(role)}" />
              <span class="cfg-slider-val"
                    id="val-cmd-${cmd}-${role}">
                ${limDisplay}
              </span>
            </div>
          </div>`;
          })
          .join("")}
      `
      : "";
  const expanded = expandedCommands.has(cmd);
  return `<div class="cfg-cmd-block${expanded ? " cfg-cmd-expanded" : ""}"
       data-cmd="${escAttr(cmd)}">

    <div class="cfg-cmd-header"
         data-toggle-cmd="${escAttr(cmd)}">
      <div class="cfg-cmd-header-left">
        <span class="cfg-cmd-name">!${escAttr(cmd)}</span>
        <span class="cfg-cmd-role-badge cfg-role-${escAttr(minRole)}">
          ${escCfg(getRoleLabel(minRole))}
        </span>
      </div>
      <div class="cfg-cmd-header-right">
        ${renderMiniToggle(`cmd_${cmd}_enabled`, cfg.enabled)}
        <span class="cfg-cmd-chevron">›</span>
      </div>
    </div>

    <div class="cfg-cmd-body">

      <div class="cfg-cmd-field-label">Who can use it</div>
      <div class="cfg-btn-group cfg-btn-group-wrap">
        ${[
          ["everyone", "Everyone"],
          ["subscriber", "Subs"],
          ["vip", "VIPs"],
          ["moderator", "Mods"],
          ["broadcaster", "Me only"],
        ]
          .map(
            ([v, l]) => `
          <button type="button" class="cfg-btn cfg-sm-btn
                  ${minRole === v ? "cfg-active" : ""}"
                  data-cmd-set="${escAttr(cmd)}"
                  data-cmd-key="minRole"
                  data-cmd-value="${escAttr(v)}">
            ${l}
          </button>
        `
          )
          .join("")}
      </div>

      <div class="cfg-cmd-field-label">
        Cooldown per viewer
      </div>
      ${cmdSliderRow(cmd, "cooldown", 0, 300, 5, cfg.cooldown, "s", "none")}

      <div class="cfg-cmd-field-label">
        Session limit
      </div>
      ${cmdSliderRow(cmd, "sessionLimit", 0, 100, 1, cfg.sessionLimit, "", "unlimited")}

      ${roleLimitRows}

    </div>
  </div>`;
}

function renderTwitchContent() {
  const badge =
    state.twitchChannel && state.twitchToken
      ? `<span class="cfg-badge-green">Configured</span>`
      : "";
  const cmdBlocks = TWITCH_COMMAND_ORDER.map((cmd) => renderCommandRow(cmd)).join("");
  return `<input id="ctrl-twitchChannel" class="cfg-input" type="text" placeholder="Channel" value="${escCfg(state.twitchChannel || "")}" data-cfg-tip="${escAttr("Your Twitch channel login (no #).")}" />
    <input id="ctrl-twitchToken" class="cfg-input cfg-input-sm" type="password" placeholder="OAuth token" value="${escCfg(state.twitchToken || "")}" data-cfg-tip="${escAttr("OAuth token with chat scopes for viewer commands.")}" />
    <a href="https://twitchapps.com/tmi/" target="_blank" rel="noopener noreferrer" class="cfg-link-small" data-cfg-tip="${escAttr("Opens TwitchApps to generate a chat token.")}">Get token →</a>
    <div class="cfg-cmd-section-head">
      <span class="cfg-cmd-section-label cfg-cmd-section-label-text" data-cfg-tip="${escAttr("Commands viewers can type in chat when Twitch is connected.")}">Commands</span>
      <span class="cfg-beta-chip" data-cfg-tip="${escAttr("Chat commands are still being tested; behavior may change or be incomplete.")}">Beta</span>
    </div>
    <p class="cfg-cmd-beta-note" data-cfg-tip="${escAttr("Live testing in progress — permissions, limits, and cooldowns may not cover every case yet.")}">Live testing in progress — some options may not work completely yet.</p>
    ${cmdBlocks}
    ${badge}`;
}

function attachSidebarListeners(sidebar) {
  if (!sidebar) {
    return;
  }

  sidebar.querySelectorAll("[data-toggle-cmd]").forEach((el) => {
    el.addEventListener("click", () => {
      const cmd = el.dataset.toggleCmd;
      if (!cmd) {
        return;
      }
      if (expandedCommands.has(cmd)) {
        expandedCommands.delete(cmd);
      } else {
        expandedCommands.add(cmd);
      }
      const block = el.closest(".cfg-cmd-block");
      block?.classList.toggle("cfg-cmd-expanded", expandedCommands.has(cmd));
    });
  });

  sidebar.querySelectorAll("[data-cmd-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmdSet;
      const key = btn.dataset.cmdKey;
      const val = btn.dataset.cmdValue;
      if (!cmd || !key || val === undefined || !state.commands[cmd]) {
        return;
      }
      state.commands[cmd][key] = val;
      savePlatformState({});
      sidebar.querySelectorAll(`[data-cmd-set="${cmd}"][data-cmd-key="${key}"]`).forEach((b) => {
        b.classList.toggle("cfg-active", b.dataset.cmdValue === val);
      });
      const badge = sidebar.querySelector(`[data-cmd="${cmd}"] .cfg-cmd-role-badge`);
      if (badge) {
        badge.textContent = getRoleLabel(val);
        badge.className = `cfg-cmd-role-badge cfg-role-${val}`;
      }
    });
  });

  sidebar.querySelectorAll("[data-cmd-enabled]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.cmdEnabled;
      if (!id) {
        return;
      }
      const cmd = id.replace(/^cmd_/, "").replace(/_enabled$/, "");
      if (state.commands[cmd]) {
        state.commands[cmd].enabled = input.checked;
        savePlatformState({});
      }
    });
  });

  sidebar.querySelectorAll("[data-cmd-slider]").forEach((input) => {
    input.addEventListener("input", () => {
      const cmd = input.dataset.cmdSlider;
      const key = input.dataset.cmdKey;
      if (!cmd || !key || !state.commands[cmd]) {
        return;
      }
      const val = Number(input.value);
      const label = document.getElementById(`val-cmd-${cmd}-${key}`);
      if (label) {
        const unit = key === "cooldown" ? "s" : "";
        let note = "";
        if (key === "cooldown" && val === 0) {
          note = ' <span class="cfg-val-note">none</span>';
        } else if (key === "sessionLimit" && val === 0) {
          note = ' <span class="cfg-val-note">unlimited</span>';
        }
        label.innerHTML = `${val}${unit}${note}`;
      }
      window.clearTimeout(twitchCmdSliderDebounceTimer);
      twitchCmdSliderDebounceTimer = window.setTimeout(() => {
        state.commands[cmd][key] = val;
        savePlatformState({});
      }, 300);
    });
  });

  sidebar.querySelectorAll("[data-cmd-role-limit]").forEach((input) => {
    input.addEventListener("input", () => {
      const cmd = input.dataset.cmdRoleLimit;
      const role = input.dataset.role;
      if (!cmd || !role || !state.commands[cmd]) {
        return;
      }
      const val = Number(input.value);
      const label = document.getElementById(`val-cmd-${cmd}-${role}`);
      if (label) {
        label.innerHTML =
          val === 0 ? `0 <span class="cfg-val-note">∞</span>` : String(val);
      }
      window.clearTimeout(twitchCmdSliderDebounceTimer);
      twitchCmdSliderDebounceTimer = window.setTimeout(() => {
        state.commands[cmd].roleLimits[role] = val;
        savePlatformState({});
      }, 300);
    });
  });
}

/** Renders all sidebar controls and re-attaches listeners. */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
  if (queueConfigOpen) {
    renderQueueSidebar();
    return;
  }
  sidebar.classList.remove("cfg-queue-sidebar-mode");
  const scrollTop = sidebar.scrollTop;
  const layoutOptions = ["glasscard", "pill", "island", "strip", "albumfocus", "sidebar", "custom"];
  const themeOptions = ["obsidian", "midnight", "aurora", "forest", "amber", "glass"];

  const twitchBlock =
    state.source !== "songify"
      ? renderSection("twitch", "Twitch", renderTwitchContent())
      : "";

  sidebar.innerHTML = `
    ${renderSection("source", "Source", renderSourceContent())}
    ${renderSection("layout", "Layout", renderLayoutContent(layoutOptions))}
    ${renderSection("theme", "Theme", renderThemeContent(themeOptions))}
    ${renderSection("content", "Content", renderContentContent())}
    ${renderSection("visuals", "Visuals", renderVisualsContent())}
    ${renderSection("style", "Style", renderStyleContent())}
    ${twitchBlock}
  `;

  sidebar.querySelectorAll("[data-toggle-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleSection;
      if (!id) return;
      if (openSections.has(id)) {
        openSections.delete(id);
      } else {
        openSections.add(id);
      }
      const block = btn.closest(".cfg-section-block");
      if (block) {
        block.classList.toggle("cfg-section-open", openSections.has(id));
      }
    });
  });

  sidebar.querySelectorAll("[data-set-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-set-key");
      const value = button.getAttribute("data-set-value");
      update({ [key]: value });
    });
  });

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.getAttribute("data-toggle-key");
      update({ [key]: input.checked });
    });
  });

  const lastfmDisconnect = document.getElementById("btn-lastfm-disconnect");
  if (lastfmDisconnect) {
    lastfmDisconnect.addEventListener("click", () => {
      localStorage.removeItem("nowify_lastfm");
      update({ lastfmUsername: "", lastfmApiKey: "" });
    });
  }

  const bindDebouncedInput = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", () => {
      window.clearTimeout(inputDebounceTimer);
      inputDebounceTimer = window.setTimeout(() => {
        update({ [key]: input.value.trim() });
      }, 600);
    });
  };

  const inputMap = {
    "ctrl-clientId": "clientId",
    "ctrl-lastfmUsername": "lastfmUsername",
    "ctrl-lastfmApiKey": "lastfmApiKey",
    "ctrl-twitchChannel": "twitchChannel",
    "ctrl-twitchToken": "twitchToken",
  };
  Object.entries(inputMap).forEach(([id, key]) => {
    bindDebouncedInput(id, key);
  });

  const songifyPortInput = document.getElementById("ctrl-songifyPort");
  if (songifyPortInput) {
    songifyPortInput.addEventListener("change", () => {
      const val = Number(songifyPortInput.value);
      if (Number.isInteger(val) && val >= 1024 && val <= 65535) {
        update({ songifyPort: val });
      }
    });
  }

  const btnOpenQueue = document.getElementById("btn-open-queue-config");
  if (btnOpenQueue) {
    btnOpenQueue.addEventListener("click", () => {
      renderQueueConfig();
    });
  }

  const openCustomEditor = document.getElementById("btn-open-custom-editor");
  if (openCustomEditor) {
    openCustomEditor.addEventListener("click", () => update({ layout: "custom" }));
  }

  const animSpeedInput = document.getElementById("ctrl-anim-bg-speed");
  if (animSpeedInput) {
    animSpeedInput.addEventListener("input", () => {
      const val = Number(animSpeedInput.value);
      const label = document.getElementById("ctrl-anim-bg-speed-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Speed (${val}s)`;
      }
      window.clearTimeout(animBgSpeedDebounceTimer);
      animBgSpeedDebounceTimer = window.setTimeout(() => {
        if (Number.isFinite(val)) {
          update({ animBgSpeed: val });
        }
      }, 250);
    });
  }

  const artBackdropBlurInput = document.getElementById("ctrl-art-backdrop-blur");
  if (artBackdropBlurInput) {
    artBackdropBlurInput.addEventListener("input", () => {
      const val = Number(artBackdropBlurInput.value);
      const label = document.getElementById("ctrl-art-backdrop-blur-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Backdrop blur (${val}px)`;
      }
      window.clearTimeout(artBackdropBlurDebounceTimer);
      artBackdropBlurDebounceTimer = window.setTimeout(() => {
        if (Number.isFinite(val)) {
          update({ artBackdropBlur: val });
        }
      }, 250);
    });
  }

  if (state.source === "songify") {
    const statusEl = document.getElementById("cfg-songify-status");
    if (statusEl) {
      statusEl.textContent = "Checking...";
      statusEl.classList.remove("cfg-status-connected", "cfg-status-error");
      try {
        const testWs = new WebSocket(`ws://localhost:${state.songifyPort}/ws/data`);
        let settled = false;
        const finalize = (ok) => {
          if (settled) return;
          settled = true;
          if (ok) {
            statusEl.textContent = "Connected";
            statusEl.classList.add("cfg-status-connected");
            statusEl.classList.remove("cfg-status-error");
          } else {
            statusEl.textContent = "Not connected";
            statusEl.classList.remove("cfg-status-connected");
            statusEl.classList.add("cfg-status-error");
          }
          try {
            testWs.close();
          } catch (_error) {}
        };
        testWs.addEventListener("open", () => finalize(true));
        testWs.addEventListener("error", () => finalize(false));
        testWs.addEventListener("close", () => {
          if (!settled) finalize(false);
        });
        window.setTimeout(() => finalize(false), 2000);
      } catch (_error) {
        statusEl.textContent = "Error";
        statusEl.classList.remove("cfg-status-connected");
        statusEl.classList.add("cfg-status-error");
      }
    }
  }
  attachSidebarListeners(sidebar);
  attachCfgTooltips(sidebar);
  sidebar.scrollTop = scrollTop;
}

function checkCustomMode() {
  const isCustom = state.layout === "custom";
  const body = document.getElementById("cfg-body");
  const normalSidebar = document.getElementById("cfg-sidebar");
  if (!body || !normalSidebar) return;
  let customContainer = document.getElementById("cfg-custom-editor");

  if (isCustom) {
    normalSidebar.style.display = "none";
    if (!customContainer) {
      customContainer = document.createElement("div");
      customContainer.id = "cfg-custom-editor";
      body.insertBefore(customContainer, body.firstChild);
    }
    customContainer.style.display = "flex";
    customContainer.style.flex = "0 0 320px";
    customContainer.style.width = "320px";
    import("./custom-editor.js").then(({ initCustomEditor }) => {
      initCustomEditor(customContainer, previousLayout, (customState) => {
        updateCustomPreview(customState);
      });
    });
    renderHeaderDynamic();
  } else {
    normalSidebar.style.display = "";
    if (customContainer) {
      customContainer.style.display = "none";
      customContainer.style.flex = "";
      customContainer.style.width = "";
    }
    previousLayout = state.layout;
    renderHeaderDynamic();
  }
}

function getCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function getOrCreateOwnerKey() {
  const existing = localStorage.getItem(OWNER_KEY_STORAGE);
  if (existing) return existing;
  const generated = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
  localStorage.setItem(OWNER_KEY_STORAGE, generated);
  return generated;
}

async function publishCustomPresetWithPrompt() {
  const presetName = window.prompt("Name for public preset:");
  if (!presetName || !presetName.trim()) return;
  const authorName = window.prompt("Author name (optional):") || "anonymous";
  const name = presetName.trim();
  const ownerKey = getOrCreateOwnerKey();

  const { loadCustomState } = await import("./custom-editor.js");
  const customState = loadCustomState();
  if (!customState) return;

  const res = await fetch(`${WORKER_BASE_URL}/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      author: authorName.trim() || "anonymous",
      customState,
      ownerKey,
    }),
  });

  if (!res.ok) {
    console.warn("Nowify: Failed to publish custom preset", res.status);
    return;
  }
}

function openSetupWizard() {
  showWizard((chosenSource) => {
    state.source = chosenSource;
    const savedLastfm = localStorage.getItem("nowify_lastfm");
    const savedSongify = localStorage.getItem("nowify_songify");
    if (savedLastfm) {
      try {
        const parsed = JSON.parse(savedLastfm);
        state.lastfmUsername = parsed.username || "";
        state.lastfmApiKey = parsed.apiKey || "";
      } catch (_error) {}
    } else {
      state.lastfmUsername = "";
      state.lastfmApiKey = "";
    }
    if (savedSongify) {
      try {
        const parsed = JSON.parse(savedSongify);
        state.songifyPort = Number(parsed.port) || 4002;
      } catch (_error) {
        state.songifyPort = 4002;
      }
    } else {
      state.songifyPort = 4002;
    }
    update({ source: chosenSource });
  });
}

/** Setup, Presets, and custom-layout actions (kept out of static HTML for ordering). */
function renderHeaderDynamic() {
  const wrap = document.getElementById("cfg-header-dynamic");
  if (!wrap) return;
  wrap.replaceChildren();
  const isCustom = state.layout === "custom";

  function addButton(id, label, className, handler) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener("click", handler);
    wrap.appendChild(btn);
  }

  if (isCustom) {
    addButton("btn-exit-custom", "Exit custom", "cfg-nav-btn", () => {
      update({ layout: previousLayout || "glasscard" });
    });
    addButton("btn-publish-custom-preset", "Publish preset", "cfg-nav-btn", () => {
      publishCustomPresetWithPrompt();
    });
  }

  addButton("btn-setup", "Setup", "cfg-nav-btn", () => openSetupWizard());
  addButton("btn-presets", "Presets", "cfg-nav-btn", () => openPresetsModal());
}

let obsGuideEscCleanup = null;

function closeObsGuideModal() {
  if (obsGuideEscCleanup) {
    obsGuideEscCleanup();
    obsGuideEscCleanup = null;
  }
  document.getElementById("cfg-obs-modal")?.remove();
}

function openObsGuideModal() {
  closeObsGuideModal();
  const shell = document.getElementById("cfg-shell");
  if (!shell) return;
  const url =
    document.getElementById("cfg-url-display")?.textContent?.trim() || buildOverlayUrl(state);
  const modal = document.createElement("div");
  modal.id = "cfg-obs-modal";
  modal.className = "cfg-obs-modal";
  modal.innerHTML = `
    <div class="cfg-obs-dialog" role="dialog" aria-labelledby="cfg-obs-title">
      <div class="cfg-obs-header">
        <h2 class="cfg-obs-title" id="cfg-obs-title">Add to OBS Studio</h2>
        <button type="button" class="cfg-btn cfg-btn-ghost" id="cfg-obs-close">Close</button>
      </div>
      <p class="cfg-obs-lead">
        Use a <strong>Browser</strong> source so the overlay can update in real time. Paste the same URL you use in the preview below.
      </p>
      <div class="cfg-obs-url-block">
        <label class="cfg-obs-label" for="cfg-obs-url-field">Overlay URL</label>
        <div class="cfg-obs-url-row">
          <input id="cfg-obs-url-field" class="cfg-obs-url-input" type="text" readonly spellcheck="false" />
          <button type="button" class="cfg-btn cfg-btn-primary" id="cfg-obs-copy-url">Copy</button>
        </div>
      </div>
      <div class="cfg-obs-section">
        <h3 class="cfg-obs-h3">Steps</h3>
        <ol class="cfg-obs-steps">
          <li>In OBS, add a source → <strong>Browser</strong>.</li>
          <li>Name it (e.g. &quot;Nowify&quot;), then paste the URL above into <strong>URL</strong>.</li>
          <li>Set <strong>Width</strong> and <strong>Height</strong> to fit your scene (see sizing tips below).</li>
          <li>Click <strong>OK</strong>, then drag and crop the source in your scene as needed.</li>
        </ol>
      </div>
      <div class="cfg-obs-section">
        <h3 class="cfg-obs-h3">Sizing (starting points)</h3>
        <ul class="cfg-obs-bullets">
          <li><strong>Glass card / island</strong> — about <strong>520 × 200</strong> px; increase height if you show album, BPM, or extra rows.</li>
          <li><strong>Strip</strong> — wide and short, e.g. <strong>720 × 80</strong> px.</li>
          <li><strong>Album focus</strong> — fixed width (~168px content + padding); about <strong>210 × 280</strong> px in OBS.</li>
          <li>If the overlay looks clipped, raise width/height in OBS or reduce <strong>Max card width</strong> in the sidebar so it fits.</li>
        </ul>
      </div>
      <div class="cfg-obs-section">
        <h3 class="cfg-obs-h3">OBS browser settings</h3>
        <ul class="cfg-obs-bullets">
          <li><strong>FPS</strong> — 30 is enough for most streams; use 60 only if motion looks choppy.</li>
          <li><strong>Shutdown source when not visible</strong> — optional; saves CPU when the scene is off.</li>
          <li><strong>Refresh browser when scene becomes active</strong> — useful if the overlay ever freezes after tab sleep.</li>
          <li>Leave <strong>Custom CSS</strong> empty unless you intentionally override styles.</li>
        </ul>
      </div>
      <div class="cfg-obs-section">
        <h3 class="cfg-obs-h3">Transparent background</h3>
        <p class="cfg-obs-p">
          Turn on <strong>Transparent background</strong> in Nowify (Options), then in the OBS Browser source enable transparent output if your OBS version shows that option. For a solid backdrop, keep transparency off in Nowify and size the browser box to match the card.
        </p>
      </div>
      <div class="cfg-obs-section cfg-obs-note">
        <p class="cfg-obs-p">
          <strong>Local files:</strong> If your URL is <code>file://</code> or localhost, OBS must reach that path or server from the same machine. Spotify auth and some features work best when the configurator is opened over <code>http://localhost</code> (or your deployed site), not raw file paths.
        </p>
      </div>
    </div>
  `;
  shell.appendChild(modal);
  const urlField = document.getElementById("cfg-obs-url-field");
  if (urlField) urlField.value = url;
  const onEsc = (e) => {
    if (e.key === "Escape") closeObsGuideModal();
  };
  document.addEventListener("keydown", onEsc);
  obsGuideEscCleanup = () => document.removeEventListener("keydown", onEsc);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeObsGuideModal();
  });
  document.getElementById("cfg-obs-close")?.addEventListener("click", closeObsGuideModal);
  document.getElementById("cfg-obs-copy-url")?.addEventListener("click", async () => {
    const field = document.getElementById("cfg-obs-url-field");
    const t = field?.value || url;
    try {
      await navigator.clipboard.writeText(t);
      const btn = document.getElementById("cfg-obs-copy-url");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Copied!";
        window.setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
      }
    } catch (_e) {
      field?.select();
    }
  });
}

function closePresetsModal() {
  const modal = document.getElementById("cfg-presets-modal");
  if (modal) modal.remove();
}

function applyCustomState(customState) {
  if (!customState) return;
  localStorage.setItem("nowify_custom_layout", JSON.stringify(customState));
  update({ layout: "custom" });
}

function deleteLocalPresetByName(name) {
  if (!name) return;
  const kept = getCustomPresets().filter((p) => p?.name !== name);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(kept));
}

function renderLocalPresetList() {
  const listEl = document.getElementById("cfg-presets-local");
  if (!listEl) return;
  const localPresets = getCustomPresets().slice().reverse();
  if (!localPresets.length) {
    listEl.innerHTML = '<div class="cfg-presets-empty">No saved presets yet.</div>';
    return;
  }
  listEl.innerHTML = localPresets
    .map(
      (p) => `<div class="cfg-presets-row">
        <button class="cfg-presets-item" data-local-apply="${escCfg(p.name)}">
          <span>${p.name || "Untitled"}</span>
        </button>
        <button class="cfg-presets-delete" data-local-delete="${escCfg(p.name)}">Delete</button>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-local-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-local-apply");
      const target = localPresets.find((p) => p?.name === name);
      if (!target?.customState) return;
      applyCustomState(target.customState);
      closePresetsModal();
    });
  });
  listEl.querySelectorAll("[data-local-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-local-delete");
      deleteLocalPresetByName(name);
      renderLocalPresetList();
    });
  });
}

async function renderPublicPresetList() {
  const listEl = document.getElementById("cfg-presets-public");
  if (!listEl) return;
  listEl.innerHTML = '<div class="cfg-presets-empty">Loading presets...</div>';
  try {
    const ownerKey = getOrCreateOwnerKey();
    const res = await fetch(`${WORKER_BASE_URL}/presets`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const presets = (data?.presets || []).filter((p) => p?.customState);
    if (!presets.length) {
      listEl.innerHTML = '<div class="cfg-presets-empty">No public presets yet.</div>';
      return;
    }
    listEl.innerHTML = presets
      .slice(0, 32)
      .map(
        (p) => `<div class="cfg-presets-row">
          <button class="cfg-presets-item" data-public-idx="${p.id}">
            <span>${p.name || "Untitled"} - by ${p.author || "anonymous"}</span>
          </button>
          ${
            p.ownerKey === ownerKey
              ? `<button class="cfg-presets-delete" data-public-delete="${p.id}">Delete</button>`
              : ""
          }
        </div>`
      )
      .join("");

    listEl.querySelectorAll("[data-public-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-public-idx");
        const selected = presets.find((p) => p.id === id);
        if (!selected?.customState) return;
        applyCustomState(selected.customState);
        closePresetsModal();
      });
    });
    listEl.querySelectorAll("[data-public-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-public-delete");
        const ownerKey = getOrCreateOwnerKey();
        const res = await fetch(`${WORKER_BASE_URL}/presets/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerKey }),
        });
        if (!res.ok) return;
        await renderPublicPresetList();
      });
    });
  } catch (_error) {
    listEl.innerHTML = '<div class="cfg-presets-empty">Could not load public presets.</div>';
  }
}

async function openPresetsModal() {
  closePresetsModal();
  const shell = document.getElementById("cfg-shell");
  if (!shell) return;
  const modal = document.createElement("div");
  modal.id = "cfg-presets-modal";
  modal.className = "cfg-presets-modal";
  modal.innerHTML = `
    <div class="cfg-presets-dialog">
      <div class="cfg-presets-header">
        <div class="cfg-presets-title">Presets</div>
        <button class="cfg-btn" id="cfg-presets-close">Close</button>
      </div>
      <div class="cfg-presets-section-label">Saved presets</div>
      <div class="cfg-presets-list" id="cfg-presets-local"></div>
      <div class="cfg-presets-section-label">Public presets</div>
      <div class="cfg-presets-list" id="cfg-presets-public"></div>
    </div>
  `;
  shell.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closePresetsModal();
  });
  const closeBtn = document.getElementById("cfg-presets-close");
  if (closeBtn) closeBtn.addEventListener("click", () => closePresetsModal());
  renderLocalPresetList();
  await renderPublicPresetList();
}

function updateCustomPreview(customState) {
  state.animBgColor1 = customState.animBgColor1;
  state.animBgColor2 = customState.animBgColor2;
  state.animBgEnabled = customState.animBgEnabled;
  state.animBgStyle = customState.animBgStyle;
  state.animBgSpeed = customState.animBgSpeed;
  state.animBgColorMode = customState.animBgColorMode;
  state.canvasEnabled = customState.canvasEnabled;
  state.artBackdropEnabled = customState.artBackdropEnabled;
  state.artBackdropBlur = customState.artBackdropBlur;
  import("./custom-editor.js").then(({ buildCustomUrl }) => {
    const url = buildCustomUrl(state, customState);
    const iframe = document.getElementById("cfg-iframe");
    const urlDisplay = document.getElementById("cfg-url-display");
    if (iframe) iframe.src = url;
    if (urlDisplay) urlDisplay.textContent = url;
  });
}

function showCfgToast(message) {
  const shell = document.getElementById("cfg-shell");
  if (!shell) {
    return;
  }
  let el = document.getElementById("cfg-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "cfg-toast";
    el.className = "cfg-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    shell.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("cfg-toast-visible");
  window.clearTimeout(cfgToastTimer);
  cfgToastTimer = window.setTimeout(() => {
    el.classList.remove("cfg-toast-visible");
  }, 3200);
}

/** Merges state updates and refreshes preview URL and sidebar UI. */
function update(newState) {
  const prevLayout = state.layout;
  const prevTheme = state.theme;
  const moodWasOnForTheme = state.source === "spotify" && state.moodSync;

  Object.assign(state, newState);

  if (newState.nextTrackMode !== undefined) {
    state.nextTrackMode = newState.nextTrackMode === "perSong" ? "perSong" : "always";
  }

  if (newState.layout === "custom") {
    exitQueueDesignerMode();
  }

  if (newState.source !== undefined && newState.source !== "songify") {
    exitQueueDesignerMode();
  }

  if (newState.source !== undefined) {
    localStorage.setItem("nowify_source", state.source);
  }

  if (newState.clientId !== undefined) {
    localStorage.setItem("nowify_client_id", state.clientId);
  }

  if (newState.source === "spotify") {
    state.clientId = localStorage.getItem("nowify_client_id") || "";
  }

  if (state.source === "lastfm") {
    state.clientId = "";
    state.showBpm = false;
    state.moodSync = false;
  }
  if (state.source === "songify") {
    state.clientId = "";
    state.showBpm = false;
    state.moodSync = false;
    if (state.layout !== "custom") {
      state.animBgEnabled = false;
    }
  }
  if (newState.layout) {
    const relevant = LAYOUT_OPTIONS[newState.layout] || {};
    if (!relevant.showProgress) state.showProgress = false;
    if (!relevant.showBpm) state.showBpm = false;
    if (!relevant.moodSync) state.moodSync = false;
    if (newState.layout !== "custom") {
      state.animBgColorMode = "mood";
    }
  }
  applyLayoutOverlayConstraints(state.layout);
  if (state.source === "lastfm") {
    state.showBpm = false;
    state.moodSync = false;
  }
  if (state.source === "songify") {
    state.showBpm = false;
    state.moodSync = false;
  }

  // Animated background (non-custom) uses mood-derived colors; turn mood sync on with Spotify.
  const animBgJustEnabled = newState.animBgEnabled === true;
  const leftCustomLayout =
    typeof newState.layout === "string" &&
    newState.layout !== "custom" &&
    prevLayout === "custom";
  if (
    state.source === "spotify" &&
    state.layout !== "custom" &&
    state.animBgEnabled &&
    (animBgJustEnabled || leftCustomLayout)
  ) {
    state.moodSync = true;
  }

  if (
    newState.theme !== undefined &&
    newState.theme !== prevTheme &&
    moodWasOnForTheme
  ) {
    state.moodSync = false;
    showCfgToast("Mood sync turned off so your theme can apply.");
  }

  savePlatformState(newState);
  const url = buildOverlayUrl(state);
  const iframe = document.getElementById("cfg-iframe");
  const urlDisplay = document.getElementById("cfg-url-display");
  if (queueConfigOpen) {
    refreshQueueConfiguratorPreview();
  } else {
    if (iframe) iframe.src = url;
    if (urlDisplay) urlDisplay.textContent = url;
  }
  renderHeaderDynamic();
  renderSidebar();
  checkCustomMode();
}

/** Initializes configurator controls, preview syncing, and header actions. */
export function initConfig() {
  function finishInit() {
    loadPlatformState();

    if (state.animBgStyle === "conic") {
      state.animBgStyle = "aurora";
    }

    const savedSource = localStorage.getItem("nowify_source");
    if (savedSource === "spotify" || savedSource === "lastfm" || savedSource === "songify") {
      state.source = savedSource;
    } else {
      const hasLastfm = Boolean(state.lastfmUsername && state.lastfmApiKey);
      state.source = hasLastfm && !state.clientId ? "lastfm" : "spotify";
    }

    if (state.source === "lastfm") {
      state.clientId = "";
      state.showBpm = false;
      state.moodSync = false;
    }
    if (state.source === "songify") {
      state.clientId = "";
      state.showBpm = false;
      state.moodSync = false;
    }

    renderSidebar();
    renderHeaderDynamic();
    checkCustomMode();
    update({});

    const copyButton = document.getElementById("btn-copy");
    const openButton = document.getElementById("btn-open");
    const resetButton = document.getElementById("btn-reset");
    document.getElementById("btn-obs-guide")?.addEventListener("click", openObsGuideModal);

    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const queueDisp = document.getElementById("cfg-queue-url-display")?.textContent?.trim();
        const overlayDisp = document.getElementById("cfg-url-display")?.textContent?.trim();
        const activeUrl =
          queueDisp ||
          overlayDisp ||
          (queueConfigOpen ? buildQueueFinalUrl(state) : buildOverlayUrl(state));
        await navigator.clipboard.writeText(activeUrl);
        const previousText = copyButton.textContent;
        copyButton.textContent = "Copied!";
        window.setTimeout(() => {
          copyButton.textContent = previousText;
        }, 1000);
      });
    }

    if (openButton) {
      openButton.addEventListener("click", () => {
        const queueDisp = document.getElementById("cfg-queue-url-display")?.textContent?.trim();
        const overlayDisp = document.getElementById("cfg-url-display")?.textContent?.trim();
        const activeUrl =
          queueDisp ||
          overlayDisp ||
          (queueConfigOpen ? buildQueueFinalUrl(state) : buildOverlayUrl(state));
        window.open(activeUrl, "_blank");
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        exitQueueDesignerMode();
        state = {
          ...DEFAULT_STATE,
          commands: JSON.parse(JSON.stringify(DEFAULT_STATE.commands)),
        };
        update({});
      });
    }
  }

  if (!isSetupComplete()) {
    initWizard((chosenSource) => {
      state.source = chosenSource;
      const savedLastfm = localStorage.getItem("nowify_lastfm");
      const savedSongify = localStorage.getItem("nowify_songify");
      if (savedLastfm) {
        try {
          const parsed = JSON.parse(savedLastfm);
          state.lastfmUsername = parsed.username || "";
          state.lastfmApiKey = parsed.apiKey || "";
        } catch (_error) {}
      }
      if (savedSongify) {
        try {
          const parsed = JSON.parse(savedSongify);
          state.songifyPort = Number(parsed.port) || 4002;
        } catch (_error) {}
      }

      finishInit();
      update({ source: chosenSource });
    });
    return;
  }

  finishInit();
}

export function getConfiguratorNextTrackMode() {
  return state.nextTrackMode === "perSong" ? "perSong" : "always";
}

export function applyConfiguratorPatch(partial) {
  update(partial);
}
