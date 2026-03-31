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
};

let state = { ...DEFAULT_STATE };
let clientIdDebounceTimer = null;

/** Builds the full overlay URL from the current configurator state. */
export function buildOverlayUrl(currentState) {
  const base = `${window.location.origin}/overlay.html`;
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
  const toggleRow = (label, key) => `
    <label class="cfg-toggle-row">
      <span>${label}</span>
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
    <section class="cfg-section">
      ${sectionLabel("SETUP")}
      <input
        id="ctrl-clientId"
        class="cfg-input"
        type="text"
        placeholder="Paste your Client ID"
        value="${state.clientId.replace(/"/g, "&quot;")}"
      />
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
      ${sectionLabel("THEME")}
      <div class="cfg-btn-group">
        ${optionButtons(themeOptions, "theme")}
      </div>
    </section>

    <section class="cfg-section">
      ${sectionLabel("OPTIONS")}
      ${toggleRow("Show progress bar", "showProgress")}
      ${toggleRow("Show BPM", "showBpm")}
      ${toggleRow("Transparent bg", "transparent")}
      ${toggleRow("3D vinyl (record)", "vinyl")}
      ${toggleRow("Mood sync", "moodSync")}
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
