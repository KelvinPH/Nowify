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
  transparent: false,
  moodSync: true,
  stackDir: "row",
  artPosition: "left",
  maxCardWidth: 900,
  twitchChannel: "",
  twitchToken: "",
  lastfmUsername: "",
  lastfmApiKey: "",
  // Queue overlay
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
  /** Accent styling for viewer-requested tracks (Songify); off by default */
  queueHighlightRequests: false,
  queueTransparent: false,
  queueAnimateIn: "slide",
  queueFontSize: 13,
  queueItemRadius: 10,
  queueItemPadding: 10,
  queueItemOpacity: 80,
  queueArtSize: 40,
  queueGap: 6,
  /** Configurator only: show sample queue in preview iframe */
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

let state = { ...DEFAULT_STATE };
let inputDebounceTimer = null;
let queueRangeDebounceTimer = null;
let queueColorDebounceTimer = null;
let queueConfigOpen = false;
/** Active tab in queue configurator sidebar: look | queue | style | colors | obs */
let queueConfigSidebarTab = "look";
let previousLayout = "glasscard";
let sourceSettingsOpen = false;
let twitchSectionOpen = false;
const CUSTOM_PRESETS_KEY = "nowify_custom_presets";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
const OWNER_KEY_STORAGE = "nowify_owner_key";

function renderTwitchSection() {
  const toggleLabel = twitchSectionOpen ? "Hide" : "Show";
  return `
  <div class="cfg-section">
    <div class="cfg-section-header">
      <div class="cfg-section-label">Twitch chat commands</div>
      <button class="cfg-disconnect-btn" id="btn-twitch-toggle" type="button">${toggleLabel}</button>
    </div>

    ${
      !twitchSectionOpen
        ? `<div class="cfg-field-desc">
      Optional. Viewer commands are hidden by default. Click Show to configure.
    </div>`
        : `
    <div class="cfg-twitch-explainer">
      Optional. Connect Twitch so viewers can use
      <strong>!sr</strong>, <strong>!skip</strong>,
      <strong>!prev</strong> and <strong>!queue</strong>
      in chat to control your music.
      Your overlay works without this.
    </div>

    <div class="cfg-field-group">
      <div class="cfg-field-label">Channel name</div>
      <div class="cfg-field-desc">
        Your Twitch channel name (without the # symbol).
      </div>
      <input id="ctrl-twitchChannel"
             class="cfg-input"
             type="text"
             placeholder="your_twitch_channel"
             value="${escCfg(state.twitchChannel || "")}" />
    </div>

    <div class="cfg-field-group">
      <div class="cfg-field-label">
        OAuth token
        <span class="cfg-field-optional">optional</span>
      </div>
      <div class="cfg-field-desc">
        Required for chat commands to work. Generate a token
        with the correct scopes using the button below.
        Never share this token with anyone.
      </div>
      <input id="ctrl-twitchToken"
             class="cfg-input"
             type="password"
             placeholder="oauth:your_token_here"
             value="${escCfg(state.twitchToken || "")}" />
      <div class="cfg-twitch-token-actions">
        <a href="https://twitchtokengenerator.com/"
           target="_blank"
           class="cfg-btn cfg-sm-btn cfg-btn-external">
          Generate token ->
        </a>
        <div class="cfg-twitch-scopes">
          Needs scopes:
          <code>chat:read</code>
          <code>chat:edit</code>
        </div>
      </div>
    </div>

    ${
      state.twitchChannel && state.twitchToken
        ? '<div class="cfg-connected-badge">Twitch configured</div>'
        : state.twitchChannel
          ? '<div class="cfg-field-desc" style="color:rgba(255,159,10,0.8)">Token missing - commands will not work</div>'
          : ""
    }

    <div class="cfg-twitch-commands-list">
      <div class="cfg-commands-label">Available commands</div>
      <div class="cfg-command-row">
        <code>!sr [song]</code>
        <span>Add a song to the queue</span>
      </div>
      <div class="cfg-command-row">
        <code>!skip</code>
        <span>Skip to next track</span>
      </div>
      <div class="cfg-command-row">
        <code>!prev</code>
        <span>Go to previous track</span>
      </div>
      <div class="cfg-command-row">
        <code>!queue</code>
        <span>Show upcoming tracks in chat</span>
      </div>
    </div>
    `
    }
  </div>
  `;
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
    if (key.startsWith("queue")) {
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

/** Queue overlay URL for the configurator preview (demo=1 only when queueDemoPreview is on). */
export function buildQueueUrl(inputState) {
  const base =
    window.location.origin + window.location.pathname.replace("config.html", "") + "queue.html";
  return `${base}?${buildQueueSearchParams(inputState, true).toString()}`;
}

/** Assign the queue preview iframe only. Appends a nonce so the document always reloads (avoids stale maxItems when increasing the slider). */
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

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
}

function getLayoutHint(layout) {
  const hints = {
    glasscard: "Album art with title and artist, plus progress. Great for most streams.",
    pill: "Compact pill layout. Great for corners and gameplay streams.",
    island: "Square widget with larger album art. Great for music focused scenes.",
    strip: "Thin 40px bar with a minimal footprint.",
    albumfocus: "Centered art first layout for music focused scenes.",
    sidebar: "Vertical 72px column that sits neatly on the side.",
    custom: "Full visual editor with color tools and advanced controls.",
  };
  return hints[layout] || "";
}

function getLayoutFeatureBadges(layout) {
  const opts = LAYOUT_OPTIONS[layout] || {};
  const badges = [];
  if (opts.showProgress) badges.push("progress bar");
  if (opts.showBpm) badges.push("BPM display");
  if (opts.moodSync) badges.push("mood sync");
  if (opts.transparent) badges.push("transparent mode");
  if (!badges.length) return "";
  return `<div class="cfg-feature-badges">
    ${badges.map((b) => `<span class="cfg-feature-badge">${b}</span>`).join("")}
  </div>`;
}

function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((x) => clampByte(x).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Hex for native color picker (opens system color wheel where supported). */
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

function attachQueueSidebarListeners(sidebar) {
  sidebar.querySelectorAll("[data-set-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-set-key");
      const v = btn.getAttribute("data-set-value");
      update({ [k]: v });
      const qi = document.getElementById("cfg-queue-iframe");
      if (qi) qi.src = queuePreviewIframeSrc(state);
      const qd = document.getElementById("cfg-queue-url-display");
      if (qd) qd.textContent = buildQueueFinalUrl(state);
    });
  });

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () => {
      const k = input.getAttribute("data-toggle-key");
      update({ [k]: input.checked });
      const qi = document.getElementById("cfg-queue-iframe");
      if (qi) qi.src = queuePreviewIframeSrc(state);
      const qd = document.getElementById("cfg-queue-url-display");
      if (qd) qd.textContent = buildQueueFinalUrl(state);
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
        const qi = document.getElementById("cfg-queue-iframe");
        if (qi) qi.src = queuePreviewIframeSrc(state);
        const qd = document.getElementById("cfg-queue-url-display");
        if (qd) qd.textContent = buildQueueFinalUrl(state);
      }, 300);
    });
  });

  sidebar.querySelectorAll("[data-select-key]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const k = sel.getAttribute("data-select-key");
      update({ [k]: sel.value });
      const qi = document.getElementById("cfg-queue-iframe");
      if (qi) qi.src = queuePreviewIframeSrc(state);
      const qd = document.getElementById("cfg-queue-url-display");
      if (qd) qd.textContent = buildQueueFinalUrl(state);
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
        const qi = document.getElementById("cfg-queue-iframe");
        if (qi) qi.src = queuePreviewIframeSrc(state);
        const qd = document.getElementById("cfg-queue-url-display");
        if (qd) qd.textContent = buildQueueFinalUrl(state);
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
      const qi = document.getElementById("cfg-queue-iframe");
      if (qi) qi.src = queuePreviewIframeSrc(state);
      const qd = document.getElementById("cfg-queue-url-display");
      if (qd) qd.textContent = buildQueueFinalUrl(state);
    });
  });

  sidebar.querySelectorAll("[data-queue-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-queue-tab");
      queueConfigSidebarTab = id === "queue" || id === "style" || id === "colors" || id === "obs" ? id : "look";
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
    const qi = document.getElementById("cfg-queue-iframe");
    if (qi) qi.src = queuePreviewIframeSrc(state);
    const qd = document.getElementById("cfg-queue-url-display");
    if (qd) qd.textContent = buildQueueFinalUrl(state);
  }

  const themeOptions = ["obsidian", "midnight", "aurora", "forest", "amber", "glass"];
  const queueLayoutOptions = ["glasscard", "pill", "island", "strip", "albumfocus"];
  const tab = queueConfigSidebarTab;

  function sliderRow(label, key, min, max, step, value, suffix) {
    return `
    <div class="cfg-queue-slider-block">
      <div class="cfg-slider-row">
        <span class="cfg-slider-label">${label}</span>
        <span class="cfg-slider-val" id="val-${key}">${value}${suffix}</span>
      </div>
      <input type="range" class="cfg-queue-range" data-range-key="${key}"
        min="${min}" max="${max}" step="${step}" value="${value}" />
    </div>`;
  }

  function toggleRow(label, key, description = "") {
    return `
      <label class="cfg-toggle-row">
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

  function queueTabClass(id) {
    return tab === id ? "cfg-queue-tab cfg-queue-tab-active" : "cfg-queue-tab";
  }

  const panelLook = `
  <div class="cfg-section">
    <div class="cfg-section-label">Queue overlay</div>
    ${toggleSimple("Demo toggle", "queueDemoPreview")}
    <div class="cfg-source-pills cfg-queue-source-pills">
      <button type="button" class="cfg-source-pill ${state.queueSource === "queue" ? "cfg-pill-active" : ""}" data-set-key="queueSource" data-set-value="queue">All</button>
      <button type="button" class="cfg-source-pill ${state.queueSource === "requestqueue" ? "cfg-pill-active" : ""}" data-set-key="queueSource" data-set-value="requestqueue">Requests</button>
      <button type="button" class="cfg-source-pill ${state.queueSource === "both" ? "cfg-pill-active" : ""}" data-set-key="queueSource" data-set-value="both">Both</button>
    </div>
  </div>
  <div class="cfg-divider"></div>
  <div class="cfg-section">
    <div class="cfg-section-label">Theme</div>
    <div class="cfg-theme-grid">
      ${themeOptions
        .map(
          (opt) => `
        <button type="button" class="cfg-theme-btn ${state.theme === opt ? "cfg-active" : ""}" data-set-key="theme" data-set-value="${opt}">
          <div class="cfg-theme-dot cfg-theme-dot-${opt}"></div><span>${opt}</span>
        </button>`
        )
        .join("")}
    </div>
  </div>
  <div class="cfg-divider"></div>
  <div class="cfg-section">
    <div class="cfg-section-label">Layout</div>
    <div class="cfg-layout-grid cfg-queue-layout-grid">
      ${queueLayoutOptions
        .map(
          (opt) => `
        <button type="button" class="cfg-layout-btn ${state.queueLayout === opt ? "cfg-active" : ""}" data-set-key="queueLayout" data-set-value="${opt}">
          <div class="cfg-layout-icon cfg-layout-icon-${opt}"></div><span>${opt}</span>
        </button>`
        )
        .join("")}
    </div>
    <div class="cfg-section-label" style="margin-top:14px">Art position</div>
    <div class="cfg-btn-group">
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueArtPosition === "left" ? "cfg-active" : ""}" data-set-key="queueArtPosition" data-set-value="left">Left</button>
      <button type="button" class="cfg-btn cfg-sm-btn ${state.queueArtPosition === "right" ? "cfg-active" : ""}" data-set-key="queueArtPosition" data-set-value="right">Right</button>
    </div>
  </div>`;

  const panelQueue = `
  <div class="cfg-section">
    <div class="cfg-section-label">Now playing context</div>
    ${toggleSimple("Time to next track", "queueShowTimeLeft")}
    ${toggleSimple("Current track progress", "queueShowProgress")}
    ${toggleSimple("Up next title", "queueShowNextTrack")}
    ${toggleSimple("Play state dot", "queueShowPlayState")}
  </div>
  <div class="cfg-divider"></div>
  <div class="cfg-section">
    <div class="cfg-section-label">List length</div>
    ${sliderRow("Max items", "queueMaxItems", 1, 10, 1, state.queueMaxItems, "")}
  </div>
  <div class="cfg-divider"></div>
  <div class="cfg-section">
    <div class="cfg-section-label">Track row</div>
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
      "Accent on tracks requested via Songify (not regular queue adds)"
    )}
    ${toggleRow("Transparent background", "queueTransparent", "")}
  </div>`;

  const panelStyle = `
  <div class="cfg-section">
    <div class="cfg-section-label">Sizing & motion</div>
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
      <select data-select-key="queueAnimateIn" class="cfg-select cfg-select-block">
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
  <div class="cfg-section">
    <div class="cfg-section-label">Custom colors</div>
    ${toggleSimple("Override theme colors", "queueCustomColors")}
    ${
      state.queueCustomColors
        ? `
    <div class="cfg-queue-color-grid">
      <div class="cfg-field-group cfg-queue-color-field">
        <div class="cfg-field-label">Accent</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorAccent" value="${parseColorToHexForPicker(state.queueColorAccent)}" title="Accent" aria-label="Accent color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorAccent" value="${escCfg(state.queueColorAccent)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="cfg-field-group cfg-queue-color-field">
        <div class="cfg-field-label">Title</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorTitle" value="${parseColorToHexForPicker(state.queueColorTitle)}" title="Title" aria-label="Title text color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorTitle" value="${escCfg(state.queueColorTitle)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="cfg-field-group cfg-queue-color-field">
        <div class="cfg-field-label">Muted text</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorMuted" value="${parseColorToHexForPicker(state.queueColorMuted)}" title="Muted" aria-label="Muted text color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorMuted" value="${escCfg(state.queueColorMuted)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="cfg-field-group cfg-queue-color-field">
        <div class="cfg-field-label">Row background</div>
        <div class="cfg-queue-color-row">
          <input type="color" class="cfg-queue-color-wheel" data-queue-color-wheel="queueColorCard" value="${parseColorToHexForPicker(state.queueColorCard)}" title="Row background" aria-label="Row background color" />
          <input class="cfg-input cfg-input-sm cfg-queue-color-text" type="text" data-queue-color="queueColorCard" value="${escCfg(state.queueColorCard)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <p class="cfg-queue-color-hint">The square opens your system color picker (color wheel on macOS). Muted and row colors keep their opacity; edit the CSS text to change alpha.</p>
    </div>`
        : ""
    }
  </div>`;

  const panelObs = `
  <div class="cfg-section">
    <div class="cfg-section-label">OBS</div>
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
  <div class="cfg-queue-tabs" role="tablist">
    <button type="button" class="${queueTabClass("look")}" data-queue-tab="look" role="tab" aria-selected="${tab === "look" ? "true" : "false"}">Look</button>
    <button type="button" class="${queueTabClass("queue")}" data-queue-tab="queue" role="tab" aria-selected="${tab === "queue" ? "true" : "false"}">Queue</button>
    <button type="button" class="${queueTabClass("style")}" data-queue-tab="style" role="tab" aria-selected="${tab === "style" ? "true" : "false"}">Sizing</button>
    <button type="button" class="${queueTabClass("colors")}" data-queue-tab="colors" role="tab" aria-selected="${tab === "colors" ? "true" : "false"}">Colors</button>
    <button type="button" class="${queueTabClass("obs")}" data-queue-tab="obs" role="tab" aria-selected="${tab === "obs" ? "true" : "false"}">OBS</button>
  </div>
  <div class="cfg-queue-tab-panel">
    ${panelBody}
  </div>
  `;

  attachQueueSidebarListeners(sidebar);
}

function renderQueueConfig() {
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
            Separate browser source for your upcoming tracks
          </div>
        </div>
        <button class="cfg-btn cfg-sm-btn" id="btn-close-queue-config" type="button">
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
    queueConfigOpen = false;
    queueConfigSidebarTab = "look";
    document.body.classList.remove("cfg-queue-mode");
    restoreConfiguratorPreviewShell();
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

  const toggleRow = (label, key, description = "", visible = true) => {
    if (!visible) return "";
    return `
      <label class="cfg-toggle-row">
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
  };

  sidebar.innerHTML = `
  <div class="cfg-source-bar">
    <div class="cfg-source-bar-header">
      <span class="cfg-source-label">Music source</span>
      <span class="cfg-beta-chip">Songify BETA</span>
    </div>
    <div class="cfg-source-bar-controls">
      <div class="cfg-source-pills">
        <button class="cfg-source-pill ${state.source === "spotify" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="spotify" type="button">
          Spotify
        </button>
        <button class="cfg-source-pill ${state.source === "lastfm" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="lastfm" type="button">
          Last.fm
        </button>
        <button class="cfg-source-pill ${state.source === "songify" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="songify" type="button">
          Songify (BETA)
        </button>
      </div>
      <button id="btn-source-settings" class="cfg-gear-btn" type="button" title="Settings">
        &#9881;
      </button>
    </div>
  </div>

  ${sourceSettingsOpen ? `
    <div class="cfg-section" style="padding-top:14px;">
      ${state.source === "spotify" ? `
        <div class="cfg-section-label">Spotify API key</div>
        <input
          id="ctrl-clientId"
          class="cfg-input"
          placeholder="Paste your Spotify Client ID"
          value="${escCfg(state.clientId)}"
        />
        <div class="cfg-hint">
          Uses your Client ID for the overlay. The redirect URI is:
          <div class="cfg-copy-box" id="cfg-redirect-uri">${getRedirectUri()}</div>
        </div>
      ` : state.source === "lastfm" ? `
        <div class="cfg-section-header" style="margin-bottom:8px;">
          <div class="cfg-section-label">Last.fm API keys</div>
          ${
            state.lastfmUsername || state.lastfmApiKey
              ? `<button class="cfg-disconnect-btn" id="btn-lastfm-disconnect" type="button">Disconnect</button>`
              : ""
          }
        </div>
        <div class="cfg-source-info" style="margin-bottom:10px;">
          Used to fetch your now playing track from Last.fm recent tracks.
        </div>
        <input
          id="ctrl-lastfmUsername"
          class="cfg-input cfg-input-sm"
          type="text"
          placeholder="Last.fm username"
          value="${escCfg(state.lastfmUsername)}"
        />
        <input
          id="ctrl-lastfmApiKey"
          class="cfg-input cfg-input-sm"
          type="text"
          placeholder="API key"
          value="${escCfg(state.lastfmApiKey)}"
        />
        ${
          state.lastfmUsername && state.lastfmApiKey
            ? `<div class="cfg-source-active-badge">Last.fm active. Now playing enabled.</div>`
            : ""
        }
      ` : `
        <div class="cfg-section-label">Songify connection</div>
        <div class="cfg-songify-status" id="cfg-songify-status">Not connected</div>
        <div class="cfg-slider-row">
          <span class="cfg-slider-label">Port</span>
          <input
            id="ctrl-songify-port"
            class="cfg-input cfg-input-sm"
            type="number"
            style="max-width: 100px"
            min="1024"
            max="65535"
            value="${escCfg(state.songifyPort)}"
          />
        </div>
        <div class="cfg-source-info" style="margin-bottom:0;">
          Nowify uses <code>ws://localhost:PORT/ws/data</code> for track updates and
          <code>ws://localhost:PORT/</code> for chat commands. Enable the web server in
          File → Settings → Web Server.
          Default port is 4002.
        </div>
        <div class="cfg-songify-preview-note ${
          typeof window !== "undefined" && window.location.protocol === "https:"
            ? "cfg-songify-preview-note-warn"
            : ""
        }">
          <strong>Live preview</strong> uses
          <code>ws://localhost:${escCfg(String(state.songifyPort))}/ws/data</code>
          (and <code>GET http://127.0.0.1:${escCfg(String(state.songifyPort))}/</code>)
          from this browser. Songify must run on the <strong>same PC</strong>, and this
          page must be served over <strong>HTTP</strong> (for example
          <code>http://localhost/…/config.html</code>). HTTPS pages may block those
          local connections depending on the browser.
          ${
            typeof window !== "undefined" && window.location.protocol === "https:"
              ? "<br /><br />You are on HTTPS, so the built-in preview will not receive Songify here. Run Nowify from a local HTTP server or paste the copied overlay URL into OBS Browser Source on the Songify PC."
              : ""
          }
        </div>
        <div class="cfg-songify-beta-note">
          Songify integration is in beta. Some players or Songify versions may report
          slightly different metadata fields.
        </div>
      `}
    </div>
  ` : ""}

  ${
    state.source === "songify" &&
    Number(state.songifyPort) >= 1024 &&
    Number(state.songifyPort) <= 65535
      ? `
    <div class="cfg-queue-banner" id="cfg-queue-banner">
      <div class="cfg-queue-banner-left">
        <div class="cfg-queue-banner-icon">≡</div>
        <div>
          <div class="cfg-queue-banner-title">
            Queue overlay available
          </div>
          <div class="cfg-queue-banner-desc">
            Show your upcoming tracks as a separate OBS source.
          </div>
        </div>
      </div>
      <button class="cfg-btn cfg-sm-btn cfg-btn-primary"
              id="btn-open-queue-config"
              type="button">
        Configure
      </button>
    </div>
  `
      : ""
  }

  ${
    state.source !== "songify"
      ? `<div class="cfg-divider"></div>${renderTwitchSection()}`
      : ""
  }

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Layout</div>
    <div class="cfg-layout-grid">
      ${layoutOptions
        .map((opt) =>
          opt === "custom"
            ? `<button class="cfg-layout-btn cfg-layout-btn-custom ${state.layout === "custom" ? "cfg-active" : ""}" data-set-key="layout" data-set-value="custom">
                <div class="cfg-layout-icon cfg-layout-icon-custom"></div><span>Custom</span>
              </button>`
            : `<button class="cfg-layout-btn ${state.layout === opt ? "cfg-active" : ""}" data-set-key="layout" data-set-value="${opt}">
                <div class="cfg-layout-icon cfg-layout-icon-${opt}"></div><span>${opt}</span>
              </button>`
        )
        .join("")}
    </div>
    <div class="cfg-layout-hint">${getLayoutHint(state.layout)}</div>
    <div class="cfg-layout-features">${getLayoutFeatureBadges(state.layout)}</div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Theme</div>
    <div class="cfg-theme-grid">
      ${themeOptions
        .map(
          (opt) => `<button class="cfg-theme-btn ${state.theme === opt ? "cfg-active" : ""}" data-set-key="theme" data-set-value="${opt}">
          <div class="cfg-theme-dot cfg-theme-dot-${opt}"></div><span>${opt}</span></button>`
        )
        .join("")}
    </div>
    ${state.moodSync ? `<div class="cfg-mood-warning">Mood sync is on. Theme background is based on song energy.
      Turn off mood sync to see your selected theme colour.</div>` : ""}
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Options</div>
    ${toggleRow("Transparent background", "transparent", "Removes background for gameplay scenes", LAYOUT_OPTIONS[state.layout]?.transparent ?? true)}
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Now playing</div>

    ${LAYOUT_CONTENT[state.layout]?.showProgress !== false
      ? toggleRow("Progress bar", "showProgress", "Track position indicator")
      : ""}

    ${LAYOUT_CONTENT[state.layout]?.showTimeLeft
      ? toggleRow("Time remaining", "showTimeLeft", "Shows time left instead of elapsed")
      : ""}

    ${LAYOUT_CONTENT[state.layout]?.showNextTrack
      ? toggleRow("Next track", "showNextTrack", "Requires queue permission — see setup")
      : ""}

    ${state.source !== "lastfm" && state.source !== "songify" && LAYOUT_CONTENT[state.layout]?.showBpm
      ? toggleRow("BPM badge", "showBpm", "Tempo from Spotify audio features")
      : ""}

    ${LAYOUT_CONTENT[state.layout]?.showAlbum
      ? toggleRow("Album name", "showAlbum", "")
      : ""}

    ${LAYOUT_CONTENT[state.layout]?.showPlayState
      ? toggleRow("Play state dot", "showPlayState", "Pulsing dot when track is playing")
      : ""}

    ${state.layout === "custom" && LAYOUT_CONTENT[state.layout]?.stackDir
      ? `<div class="cfg-section-label" style="margin-top:8px">Layout direction</div>
         <div class="cfg-btn-group">
           <button class="cfg-btn cfg-sm-btn ${state.stackDir === "row" ? "cfg-active" : ""}" data-set-key="stackDir" data-set-value="row">Horizontal</button>
           <button class="cfg-btn cfg-sm-btn ${state.stackDir === "column" ? "cfg-active" : ""}" data-set-key="stackDir" data-set-value="column">Vertical</button>
         </div>`
      : ""}

    ${state.layout === "custom" && LAYOUT_CONTENT[state.layout]?.artPosition
      ? `<div class="cfg-section-label" style="margin-top:8px">Art position</div>
         <div class="cfg-btn-group">
           <button class="cfg-btn cfg-sm-btn ${state.artPosition === "left" ? "cfg-active" : ""}" data-set-key="artPosition" data-set-value="left">Left</button>
           <button class="cfg-btn cfg-sm-btn ${state.artPosition === "right" ? "cfg-active" : ""}" data-set-key="artPosition" data-set-value="right">Right</button>
         </div>`
      : ""}
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Mood sync</div>
    ${toggleRow("Mood sync", "moodSync", "Background shifts with song energy — works on all layouts", state.source === "spotify")}
    ${
      state.source === "lastfm"
        ? `<div class="cfg-lastfm-notice">
      Using Last.fm — BPM display and mood sync are not available.
      Switch to Spotify for full features.
    </div>`
        : state.source === "songify"
          ? `<div class="cfg-lastfm-notice">
      Using Songify — BPM display and mood sync are not available.
      Nowify reads track data directly from Songify's web server.
    </div>`
        : ""
    }
  </div>

  <div class="cfg-divider"></div>
`;

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

  const settingsBtn = document.getElementById("btn-source-settings");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      sourceSettingsOpen = !sourceSettingsOpen;
      renderSidebar();
    });
  }

  const btnOpenQueueCfg = document.getElementById("btn-open-queue-config");
  if (btnOpenQueueCfg) {
    btnOpenQueueCfg.addEventListener("click", () => {
      queueConfigOpen = true;
      renderQueueConfig();
    });
  }

  const lastfmDisconnect = document.getElementById("btn-lastfm-disconnect");
  if (lastfmDisconnect) {
    lastfmDisconnect.addEventListener("click", () => {
      localStorage.removeItem("nowify_lastfm");
      update({ lastfmUsername: "", lastfmApiKey: "" });
    });
  }
  const twitchToggleBtn = document.getElementById("btn-twitch-toggle");
  if (twitchToggleBtn) {
    twitchToggleBtn.addEventListener("click", () => {
      twitchSectionOpen = !twitchSectionOpen;
      renderSidebar();
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

  const songifyPortInput = sidebar.querySelector("#ctrl-songify-port");
  if (songifyPortInput) {
    songifyPortInput.addEventListener("change", () => {
      const val = Number(songifyPortInput.value);
      if (Number.isInteger(val) && val >= 1024 && val <= 65535) {
        update({ songifyPort: val });
      }
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
  sidebar.scrollTop = scrollTop;
}

function checkCustomMode() {
  if (queueConfigOpen) {
    const normalSidebar = document.getElementById("cfg-sidebar");
    const customContainer = document.getElementById("cfg-custom-editor");
    if (normalSidebar) normalSidebar.style.display = "";
    if (customContainer) customContainer.style.display = "none";
    return;
  }
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
    ensureCustomHeaderButtons(true);
  } else {
    normalSidebar.style.display = "";
    if (customContainer) {
      customContainer.style.display = "none";
      customContainer.style.flex = "";
      customContainer.style.width = "";
    }
    previousLayout = state.layout;
    ensureCustomHeaderButtons(false);
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

function ensureCustomHeaderButtons(isCustom) {
  const actions = document.querySelector(".cfg-header-actions");
  if (!actions) return;
  let exitBtn = document.getElementById("btn-exit-custom");
  let publishBtn = document.getElementById("btn-publish-custom-preset");

  if (isCustom) {
    if (!publishBtn) {
      publishBtn = document.createElement("button");
      publishBtn.id = "btn-publish-custom-preset";
      publishBtn.className = "cfg-btn";
      publishBtn.textContent = "Publish preset";
      publishBtn.addEventListener("click", () => {
        publishCustomPresetWithPrompt();
      });
      actions.prepend(publishBtn);
    }
    if (!exitBtn) {
      exitBtn = document.createElement("button");
      exitBtn.id = "btn-exit-custom";
      exitBtn.className = "cfg-btn";
      exitBtn.textContent = "Exit custom";
      exitBtn.addEventListener("click", () => {
        update({ layout: previousLayout || "glasscard" });
      });
      actions.prepend(exitBtn);
    }
  } else {
    if (publishBtn) publishBtn.remove();
    if (exitBtn) exitBtn.remove();
  }
}

function ensurePresetHeaderButton() {
  const actions = document.querySelector(".cfg-header-actions");
  if (!actions) return;
  let presetsBtn = document.getElementById("btn-presets");
  if (presetsBtn) return;
  presetsBtn = document.createElement("button");
  presetsBtn.id = "btn-presets";
  presetsBtn.className = "cfg-btn";
  presetsBtn.textContent = "Presets";
  presetsBtn.addEventListener("click", () => openPresetsModal());
  actions.prepend(presetsBtn);
}

function ensureSetupHeaderButton() {
  const actions = document.querySelector(".cfg-header-actions");
  if (!actions) return;
  let setupBtn = document.getElementById("btn-setup");
  if (setupBtn) return;

  setupBtn = document.createElement("button");
  setupBtn.id = "btn-setup";
  setupBtn.className = "cfg-btn";
  setupBtn.textContent = "Setup";
  setupBtn.addEventListener("click", () => {
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
  });
  actions.prepend(setupBtn);
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
  import("./custom-editor.js").then(({ buildCustomUrl }) => {
    const url = buildCustomUrl(state, customState);
    const iframe = document.getElementById("cfg-iframe");
    const urlDisplay = document.getElementById("cfg-url-display");
    if (iframe) iframe.src = url;
    if (urlDisplay) urlDisplay.textContent = url;
  });
}

/** Merges state updates and refreshes preview URL and sidebar UI. */
function update(newState) {
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
  }
  if (state.source === "lastfm") {
    state.showBpm = false;
    state.moodSync = false;
  }
  if (state.source === "songify") {
    state.showBpm = false;
    state.moodSync = false;
  }
  savePlatformState(newState);
  ensurePresetHeaderButton();

  if (queueConfigOpen) {
    const qi = document.getElementById("cfg-queue-iframe");
    if (qi) qi.src = queuePreviewIframeSrc(state);
    const qd = document.getElementById("cfg-queue-url-display");
    if (qd) qd.textContent = buildQueueFinalUrl(state);
    renderQueueSidebar();
    const normalSidebar = document.getElementById("cfg-sidebar");
    if (normalSidebar) normalSidebar.style.display = "";
    const customContainer = document.getElementById("cfg-custom-editor");
    if (customContainer) customContainer.style.display = "none";
    return;
  }

  const url = buildOverlayUrl(state);
  const iframe = document.getElementById("cfg-iframe");
  const urlDisplay = document.getElementById("cfg-url-display");
  if (iframe) iframe.src = url;
  if (urlDisplay) urlDisplay.textContent = url;
  renderSidebar();
  checkCustomMode();
}

/** Initializes configurator controls, preview syncing, and header actions. */
export function initConfig() {
  function finishInit() {
    loadPlatformState();

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
    ensurePresetHeaderButton();
    ensureSetupHeaderButton();
    checkCustomMode();
    update({});

    const copyButton = document.getElementById("btn-copy");
    const openButton = document.getElementById("btn-open");
    const resetButton = document.getElementById("btn-reset");

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
