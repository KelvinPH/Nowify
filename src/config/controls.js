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
  canvasEnabled: false,
  animBgEnabled: false,
  animBgStyle: "aurora",
  animBgSpeed: 12,
  animBgColorMode: "mood",
  animBgColor1: "rgba(145,70,255,0.6)",
  animBgColor2: "rgba(30,30,80,0.8)",
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
  showBpm: "Tempo from Spotify audio features (Spotify source only).",
  showAlbum: "Album name alongside track and artist.",
  showPlayState: "Small indicator when playback is active.",
  showIdleMessage: "Message when nothing is playing or when setup needs attention.",
  moodSync: "Background reacts to track energy using colors from album art.",
  animBgEnabled: "Animated gradient behind the card.",
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

let state = { ...DEFAULT_STATE };
let inputDebounceTimer = null;
let previousLayout = "glasscard";
let animBgSpeedDebounceTimer = null;
let cfgTipEl = null;
let cfgTipShowTimer = null;
let cfgTipHideTimer = null;
let cfgSidebarScrollBound = false;
let cfgTipEscapeBound = false;
let cfgToastTimer = null;
const CUSTOM_PRESETS_KEY = "nowify_custom_presets";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
const OWNER_KEY_STORAGE = "nowify_owner_key";

function loadPlatformState() {
  const savedTwitch = localStorage.getItem("nowify_twitch");
  if (savedTwitch) {
    try {
      const tw = JSON.parse(savedTwitch || "{}");
      state.twitchChannel = tw.channel || "";
      state.twitchToken = tw.token || "";
    } catch (_e) {}
  }

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
}

/** Builds the full overlay URL from the current configurator state. */
export function buildOverlayUrl(currentState) {
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();

  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
      return;
    }
    params.set(key, String(value));
  });

  return `${base}?${params.toString()}`;
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

  return `${pills}
    ${renderSongifyStatus()}
    <div class="cfg-row" data-cfg-tip="${escAttr("WebSocket port from Songify → Settings → Web Server (default 4002).")}">
      <span class="cfg-row-label">Port</span>
      <input type="number" id="ctrl-songifyPort" class="cfg-input-inline" value="${escCfg(String(state.songifyPort))}" min="1024" max="65535" />
    </div>`;
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

  if (state.layout !== "custom") {
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

function renderTwitchContent() {
  const badge =
    state.twitchChannel && state.twitchToken
      ? `<span class="cfg-badge-green">Configured</span>`
      : "";
  return `<input id="ctrl-twitchChannel" class="cfg-input" type="text" placeholder="Channel" value="${escCfg(state.twitchChannel || "")}" data-cfg-tip="${escAttr("Your Twitch channel login (no #).")}" />
    <input id="ctrl-twitchToken" class="cfg-input cfg-input-sm" type="password" placeholder="OAuth token" value="${escCfg(state.twitchToken || "")}" data-cfg-tip="${escAttr("OAuth token with chat scopes for viewer commands.")}" />
    <a href="https://twitchapps.com/tmi/" target="_blank" rel="noopener noreferrer" class="cfg-link-small" data-cfg-tip="${escAttr("Opens TwitchApps to generate a chat token.")}">Get token →</a>
    <div class="cfg-cmd-list" data-cfg-tip="${escAttr("Commands viewers can type in chat when Twitch is connected.")}">
      <span class="cfg-cmd">!sr</span> Request
      <span class="cfg-cmd">!skip</span> Skip
      <span class="cfg-cmd">!prev</span> Previous
      <span class="cfg-cmd">!queue</span> Queue
    </div>
    ${badge}`;
}

/** Renders all sidebar controls and re-attaches listeners. */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
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
  if (iframe) iframe.src = url;
  if (urlDisplay) urlDisplay.textContent = url;
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
        const activeUrl =
          document.getElementById("cfg-url-display")?.textContent || buildOverlayUrl(state);
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
        const activeUrl =
          document.getElementById("cfg-url-display")?.textContent || buildOverlayUrl(state);
        window.open(activeUrl, "_blank");
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        state = { ...DEFAULT_STATE };
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
