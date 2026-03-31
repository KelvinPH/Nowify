import { PRESETS, applyPreset } from "./presets.js";

const DEFAULT_STATE = {
  layout: "glasscard",
  theme: "obsidian",
  clientId: "",
  showProgress: true,
  showBpm: false,
  transparent: false,
  vinyl: false,
  moodSync: true,
  twitchChannel: "",
  twitchToken: "",
};

let state = { ...DEFAULT_STATE };
let inputDebounceTimer = null;

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
    glasscard: "Album art + title/artist with progress. Works anywhere.",
    pill: "Compact pill shape. Great for corners and gaming streams.",
    island: "Square widget with large art. Best for music streams.",
    strip: "Ultra-thin 40px bar. Minimal footprint for any stream.",
    albumfocus: "Art-first, centered. Best when music is the focus.",
    sidebar: "Vertical 72px column. Hugs the side of your stream.",
  };
  return hints[layout] || "";
}

function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

/** Renders all sidebar controls and re-attaches listeners. */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) {
    return;
  }

  const scrollTop = sidebar.scrollTop;
  const layoutOptions = ["glasscard", "pill", "island", "strip", "albumfocus", "sidebar"];
  const themeOptions = ["obsidian", "midnight", "aurora", "forest", "amber", "glass"];

  const sectionLabel = (text) => `<div class="cfg-section-label">${text}</div>`;
  const toggleRow = (label, key, description = "") => `
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

  sidebar.innerHTML = `
  <div class="cfg-intro">
    <div class="cfg-intro-step">
      <span class="cfg-step-num">1</span>
      <div>
        <div class="cfg-step-title">Create Spotify app</div>
        <div class="cfg-step-body">
          Go to <a href="https://developer.spotify.com/dashboard"
          target="_blank" class="cfg-link">developer.spotify.com</a>,
          create an app, add this as redirect URI:
          <div class="cfg-copy-box" id="cfg-redirect-uri">
            ${getRedirectUri()}
          </div>
        </div>
      </div>
    </div>
    <div class="cfg-intro-step">
      <span class="cfg-step-num">2</span>
      <div>
        <div class="cfg-step-title">Paste your Client ID</div>
        <input id="ctrl-clientId" class="cfg-input"
          placeholder="e.g. fe21f433..." value="${escCfg(state.clientId)}" />
      </div>
    </div>
    <div class="cfg-intro-step">
      <span class="cfg-step-num">3</span>
      <div>
        <div class="cfg-step-title">Design, then Copy URL → OBS</div>
        <div class="cfg-step-body">Browser Source · 900 × 300 px · right-click → Interact to log in</div>
      </div>
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Layout</div>
    <div class="cfg-layout-grid">
      ${layoutOptions.map(opt => `
        <button class="cfg-layout-btn ${state.layout === opt ? "cfg-active" : ""}"
                data-set-key="layout" data-set-value="${opt}">
          <div class="cfg-layout-icon cfg-layout-icon-${opt}"></div>
          <span>${opt}</span>
        </button>
      `).join("")}
    </div>
    <div class="cfg-layout-hint" id="cfg-layout-hint">
      ${getLayoutHint(state.layout)}
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Theme</div>
    <div class="cfg-theme-grid">
      ${themeOptions.map(opt => `
        <button class="cfg-theme-btn ${state.theme === opt ? "cfg-active" : ""}"
                data-set-key="theme" data-set-value="${opt}">
          <div class="cfg-theme-dot cfg-theme-dot-${opt}"></div>
          <span>${opt}</span>
        </button>
      `).join("")}
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Presets</div>
    <div class="cfg-preset-row">
      ${PRESETS.map(p => `
        <button class="cfg-preset-btn" data-preset="${p.name}">${p.label}</button>
      `).join("")}
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Options</div>
    ${toggleRow("Progress bar", "showProgress", "Track position indicator")}
    ${toggleRow("Show BPM", "showBpm", "Tempo — albumfocus layout only")}
    ${toggleRow("Transparent bg", "transparent", "Remove background — for gameplay")}
    ${toggleRow("Mood sync", "moodSync", "Background shifts with song energy")}
    ${toggleRow("3D vinyl", "vinyl", "Spinning disc — OBS only, not in preview")}
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Twitch (optional)</div>
    <input id="ctrl-twitchChannel" class="cfg-input cfg-input-sm"
      placeholder="Channel name" value="${escCfg(state.twitchChannel)}" />
    <input id="ctrl-twitchToken" class="cfg-input cfg-input-sm" type="password"
      placeholder="OAuth token — twitchtokengenerator.com"
      value="${escCfg(state.twitchToken)}" />
    <div class="cfg-hint">Enables !sr · !skip · !prev in chat</div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section cfg-commands-section">
    <div class="cfg-section-label">Chat commands</div>
    <div class="cfg-cmd"><code>!sr song name</code><span>Queue a song</span></div>
    <div class="cfg-cmd"><code>!skip</code><span>Skip track</span></div>
    <div class="cfg-cmd"><code>!prev</code><span>Previous track</span></div>
    <div class="cfg-cmd"><code>!queue</code><span>Show queue</span></div>
  </div>
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

  sidebar.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const presetName = button.getAttribute("data-preset");
      const preset = PRESETS.find((item) => item.name === presetName);
      if (preset) {
        applyPreset(preset, state, update);
      }
    });
  });

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

  sidebar.scrollTop = scrollTop;
}

/** Merges state updates and refreshes preview URL and sidebar UI. */
function update(newState) {
  Object.assign(state, newState);
  const url = buildOverlayUrl(state);

  const iframe = document.getElementById("cfg-iframe");
  if (iframe) {
    iframe.src = url;
  }

  const urlDisplay = document.getElementById("cfg-url-display");
  if (urlDisplay) {
    urlDisplay.textContent = url;
  }

  renderSidebar();
}

/** Initializes configurator controls, preview syncing, and header actions. */
export function initConfig() {
  renderSidebar();
  update({});

  const copyButton = document.getElementById("btn-copy");
  const openButton = document.getElementById("btn-open");
  const resetButton = document.getElementById("btn-reset");

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(buildOverlayUrl(state));
      const previousText = copyButton.textContent;
      copyButton.textContent = "Copied!";
      window.setTimeout(() => {
        copyButton.textContent = previousText;
      }, 1000);
    });
  }

  if (openButton) {
    openButton.addEventListener("click", () => {
      window.open(buildOverlayUrl(state), "_blank");
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      state = { ...DEFAULT_STATE };
      update({});
    });
  }
}
