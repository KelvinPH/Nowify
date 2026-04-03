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

/** Renders all sidebar controls and re-attaches listeners. */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
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

    ${toggleRow(
      "Idle message",
      "showIdleMessage",
      "When no track: show “Nothing playing” (Spotify) or Last.fm equivalent. Setup errors always show."
    )}

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
    addButton("btn-exit-custom", "Exit custom", "cfg-btn cfg-btn-ghost", () => {
      update({ layout: previousLayout || "glasscard" });
    });
    addButton("btn-publish-custom-preset", "Publish preset", "cfg-btn cfg-btn-ghost", () => {
      publishCustomPresetWithPrompt();
    });
  }

  addButton("btn-setup", "Setup", "cfg-btn cfg-btn-ghost", () => openSetupWizard());
  addButton("btn-presets", "Presets", "cfg-btn cfg-btn-ghost", () => openPresetsModal());
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
          <li><strong>Album focus</strong> — about <strong>220 × 280</strong> px.</li>
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
