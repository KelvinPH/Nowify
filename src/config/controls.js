import { initWizard, isSetupComplete, showWizard } from "./wizard.js";

const DEFAULT_STATE = {
  layout: "glasscard",
  theme: "obsidian",
  source: "spotify",
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
const CUSTOM_PRESETS_KEY = "nowify_custom_presets";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
const OWNER_KEY_STORAGE = "nowify_owner_key";

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
    <span class="cfg-source-label">Music source</span>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="cfg-source-pills">
        <button class="cfg-source-pill ${state.source === "spotify" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="spotify" type="button">
          Spotify
        </button>
        <button class="cfg-source-pill ${state.source === "lastfm" ? "cfg-pill-active" : ""}" data-set-key="source" data-set-value="lastfm" type="button">
          Last.fm
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
      ` : `
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
      `}
    </div>
  ` : ""}

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-header">
      <div class="cfg-section-label">Twitch (optional)</div>
      ${
        state.twitchChannel
          ? `<button class="cfg-disconnect-btn" id="btn-twitch-disconnect" type="button">Disconnect</button>`
          : ""
      }
    </div>
    <input id="ctrl-twitchChannel" class="cfg-input cfg-input-sm" placeholder="Channel name" value="${escCfg(state.twitchChannel)}" />
    <input id="ctrl-twitchToken" class="cfg-input cfg-input-sm" type="password" placeholder="OAuth token from twitchtokengenerator.com" value="${escCfg(state.twitchToken)}" />
    <div class="cfg-hint">Enables !sr, !skip, and !prev in chat</div>
  </div>

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

    ${LAYOUT_CONTENT[state.layout]?.showBpm
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

  const disconnectBtn = document.getElementById("btn-twitch-disconnect");
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", () => {
      localStorage.removeItem("nowify_twitch");
      update({ twitchChannel: "", twitchToken: "" });
    });
  }
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

  bindDebouncedInput("ctrl-clientId", "clientId");
  bindDebouncedInput("ctrl-twitchChannel", "twitchChannel");
  bindDebouncedInput("ctrl-twitchToken", "twitchToken");
  bindDebouncedInput("ctrl-lastfmUsername", "lastfmUsername");
  bindDebouncedInput("ctrl-lastfmApiKey", "lastfmApiKey");
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
  const url = buildOverlayUrl(state);
  const iframe = document.getElementById("cfg-iframe");
  const urlDisplay = document.getElementById("cfg-url-display");
  if (iframe) iframe.src = url;
  if (urlDisplay) urlDisplay.textContent = url;
  ensurePresetHeaderButton();
  renderSidebar();
  checkCustomMode();
}

/** Initializes configurator controls, preview syncing, and header actions. */
export function initConfig() {
  function finishInit() {
    const savedTwitch = localStorage.getItem("nowify_twitch");
    if (savedTwitch) {
      try {
        const parsed = JSON.parse(savedTwitch);
        state.twitchChannel = parsed.channel || "";
        state.twitchToken = parsed.token || "";
      } catch (_error) {}
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

    const savedSource = localStorage.getItem("nowify_source");
    if (savedSource === "spotify" || savedSource === "lastfm") {
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
      if (savedLastfm) {
        try {
          const parsed = JSON.parse(savedLastfm);
          state.lastfmUsername = parsed.username || "";
          state.lastfmApiKey = parsed.apiKey || "";
        } catch (_error) {}
      }

      finishInit();
      update({ source: chosenSource });
    });
    return;
  }

  finishInit();
}
