import { PRESETS, applyPreset } from "./presets.js";

const DEFAULT_STATE = {
  layout: "record",
  theme: "spotify",
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
let clientIdDebounceTimer = null;

/** Builds the full overlay URL from the current configurator state. */
export function buildOverlayUrl(currentState) {
  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.slice(0, window.location.pathname.lastIndexOf("/") + 1);
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

function getLayoutDescription(layout) {
  const descriptions = {
    record:
      "Large spinning disc with album art. Best for music-focused streams. Supports 3D vinyl, BPM, and mood sync.",
    card: "Album art + title/artist side by side. Clean and compact, works well in corners.",
    bar: "Thin horizontal strip. Minimal footprint, great for gameplay overlays.",
    ticker:
      "Full-width scrolling text bar. Good for bottom of screen like a news ticker.",
    compact:
      "Tiny album art only (60px). For when you want music info without taking up space.",
  };
  return `<p class="cfg-layout-desc">${descriptions[layout] || ""}</p>`;
}

function updateThemePreview() {
  const themes = {
    spotify: { bg: "#121212", accent: "#1DB954", surface: "#1e1e1e", text: "#fff" },
    dark: { bg: "#0a0a0a", accent: "#ffffff", surface: "#141414", text: "#fff" },
    minimal: { bg: "#000000", accent: "#ffffff", surface: "#111111", text: "#fff" },
    neon: { bg: "#0d0d1a", accent: "#00ffcc", surface: "#12122a", text: "#e0e0ff" },
    lofi: { bg: "#1a1209", accent: "#d4915a", surface: "#241a0d", text: "#e8d5b7" },
  };
  const t = themes[state.theme] || themes.spotify;
  const preview = document.getElementById("cfg-theme-preview");
  if (!preview) return;
  preview.style.setProperty("--preview-bg", t.bg);
  preview.style.setProperty("--preview-accent", t.accent);
  preview.style.setProperty("--preview-surface", t.surface);
  preview.style.setProperty("--preview-text", t.text);
}

/** Renders all sidebar controls and re-attaches listeners. */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) {
    return;
  }

  const scrollTop = sidebar.scrollTop;
  const layoutOptions = ["record", "card", "bar", "ticker", "compact"];
  const themeOptions = ["spotify", "dark", "minimal", "neon", "lofi"];

  const sectionLabel = (text) => `<div class="cfg-section-label">${text}</div>`;
  const optionButtons = (options, key) =>
    options
      .map(
        (opt) =>
          `<button class="cfg-btn ${
            state[key] === opt ? "cfg-active" : ""
          }" data-set-key="${key}" data-set-value="${opt}">${opt}</button>`
      )
      .join("");
  const toggleRow = (label, key, description = "") => `
    <label class="cfg-toggle-row">
      <span class="cfg-toggle-label-wrap">
        <span class="cfg-toggle-label">${label}</span>
        ${
          description
            ? `<span class="cfg-toggle-desc">${description}</span>`
            : ""
        }
      </span>
      <span class="cfg-toggle">
        <input type="checkbox" data-toggle-key="${key}" ${
    state[key] ? "checked" : ""
  } />
        <span class="cfg-toggle-track"></span>
        <span class="cfg-toggle-thumb"></span>
      </span>
    </label>
  `;

  sidebar.innerHTML = `
    <div class="cfg-banner">
      <div class="cfg-banner-step">
        <span class="cfg-banner-num">1</span>
        <span>Get a Spotify Client ID at
          <a href="https://developer.spotify.com/dashboard"
             target="_blank" class="cfg-link">developer.spotify.com</a>
        </span>
      </div>
      <div class="cfg-banner-step">
        <span class="cfg-banner-num">2</span>
        <span>Paste it in the Setup field below and add this redirect URI
        to your Spotify app:<br>
        <code class="cfg-code">${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html</code>
        </span>
      </div>
      <div class="cfg-banner-step">
        <span class="cfg-banner-num">3</span>
        <span>Design your overlay, then click <strong>Copy URL</strong>
        and paste it into OBS as a Browser Source (900 × 300 px)</span>
      </div>
    </div>

    <section class="cfg-section">
      ${sectionLabel("SETUP")}
      <input
        id="ctrl-clientId"
        class="cfg-input"
        type="text"
        placeholder="Spotify Client ID"
        value="${state.clientId.replace(/"/g, "&quot;")}"
        style="margin-bottom: 8px;"
      />
    </section>

    <section class="cfg-section">
      ${sectionLabel("TWITCH (OPTIONAL)")}
      <input
        id="ctrl-twitchChannel"
        class="cfg-input"
        type="text"
        placeholder="Channel name (e.g. kelvinph)"
        value="${state.twitchChannel.replace(/"/g, "&quot;")}"
        style="margin-bottom: 8px;"
      />
      <input
        id="ctrl-twitchToken"
        class="cfg-input"
        type="password"
        placeholder="OAuth token (from twitchtokengenerator.com)"
        value="${state.twitchToken.replace(/"/g, "&quot;")}"
      />
      <div style="font-size: 11px; color: var(--cfg-muted); margin-top: 6px; line-height: 1.5;">
        Token scope needed: <code>chat:read</code><br>
        Enables !sr, !skip, !prev in your chat
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("QUICK PRESETS")}
      <div class="cfg-btn-group">
        ${PRESETS.map(
          (preset) =>
            `<button class="cfg-btn cfg-preset-btn" data-preset="${preset.name}">${preset.label}</button>`
        ).join("")}
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("LAYOUT")}
      <div class="cfg-btn-group">
        ${optionButtons(layoutOptions, "layout")}
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("LAYOUT GUIDE")}
      <div class="cfg-layout-guide" id="cfg-layout-guide">
        ${getLayoutDescription(state.layout)}
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("THEME")}
      <div class="cfg-btn-group">
        ${optionButtons(themeOptions, "theme")}
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("THEME PREVIEW")}
      <div class="cfg-theme-preview" id="cfg-theme-preview">
        <div class="cfg-theme-swatch" style="background: var(--preview-bg, #121212);">
          <span style="color: var(--preview-text, #fff); font-size: 12px;">
            Background
          </span>
        </div>
        <div class="cfg-theme-swatch" style="background: var(--preview-accent, #1DB954);">
          <span style="color: #000; font-size: 12px;">Accent</span>
        </div>
        <div class="cfg-theme-swatch" style="background: var(--preview-surface, #1e1e1e);">
          <span style="color: var(--preview-text, #fff); font-size: 12px;">
            Surface
          </span>
        </div>
      </div>
      <div style="font-size: 11px; color: var(--cfg-muted); margin-top: 8px;">
        Full theme studio coming in v1.1
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("OPTIONS")}
      ${toggleRow(
        "Show progress bar",
        "showProgress",
        "Thin bar showing track position"
      )}
      ${toggleRow("Show BPM", "showBpm", "Shows tempo — record layout only")}
      ${toggleRow(
        "Transparent background",
        "transparent",
        "Removes background for use over gameplay"
      )}
      ${toggleRow(
        "3D vinyl",
        "vinyl",
        "Spinning Three.js disc — record layout only. Visible in OBS, not in this preview"
      )}
      ${toggleRow(
        "Mood sync",
        "moodSync",
        "Background colour shifts with song energy and mood"
      )}
    </section>

    <section class="cfg-section">
      ${sectionLabel("OBS SETUP")}
      <div class="cfg-obs-steps">
        <div class="cfg-obs-step">Add a <strong>Browser Source</strong> in OBS</div>
        <div class="cfg-obs-step">Paste the copied URL into the URL field</div>
        <div class="cfg-obs-step">Set width <strong>900</strong>, height <strong>300</strong></div>
        <div class="cfg-obs-step">First time: right-click source →
          <strong>Interact</strong> → log into Spotify</div>
        <div class="cfg-obs-step">After login OBS remembers your session permanently</div>
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("CHAT COMMANDS")}
      <div class="cfg-commands">
        <div class="cfg-command"><code>!sr song name</code>
          <span>Add to queue</span></div>
        <div class="cfg-command"><code>!skip</code>
          <span>Skip track</span></div>
        <div class="cfg-command"><code>!prev</code>
          <span>Previous track</span></div>
        <div class="cfg-command"><code>!queue</code>
          <span>Show queue</span></div>
      </div>
      <div style="font-size: 11px; color: var(--cfg-muted); margin-top: 8px;">
        Requires Twitch channel + token above
      </div>
    </section>
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

  const clientIdInput = document.getElementById("ctrl-clientId");
  if (clientIdInput) {
    clientIdInput.addEventListener("input", () => {
      window.clearTimeout(clientIdDebounceTimer);
      clientIdDebounceTimer = window.setTimeout(() => {
        update({ clientId: clientIdInput.value.trim() });
      }, 600);
    });
  }

  const twitchChannelInput = document.getElementById("ctrl-twitchChannel");
  if (twitchChannelInput) {
    twitchChannelInput.addEventListener("input", () => {
      window.clearTimeout(clientIdDebounceTimer);
      clientIdDebounceTimer = window.setTimeout(() => {
        update({ twitchChannel: twitchChannelInput.value.trim() });
      }, 600);
    });
  }

  const twitchTokenInput = document.getElementById("ctrl-twitchToken");
  if (twitchTokenInput) {
    twitchTokenInput.addEventListener("input", () => {
      window.clearTimeout(clientIdDebounceTimer);
      clientIdDebounceTimer = window.setTimeout(() => {
        update({ twitchToken: twitchTokenInput.value.trim() });
      }, 600);
    });
  }

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
  updateThemePreview();
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

  updateThemePreview();
}
