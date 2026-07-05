import { initWizard, isSetupComplete, showWizard } from "./wizard.js";
import {
  ANIM_BG_STYLE_TIPS,
  CUSTOM_PRESETS_KEY,
  LAYOUT_CONTENT,
  LAYOUT_HINTS_SHORT,
  LAYOUT_LABELS,
  LAYOUT_OPTIONS,
  LAYOUT_TOOLTIPS,
  OWNER_KEY_STORAGE,
  SOURCE_TOOLTIPS,
  THEME_TOOLTIPS,
  TOGGLE_KEY_TIPS,
  TWITCH_COMMAND_ORDER,
  WORKER_BASE_URL,
} from "./constants.js";
import {
  applyLayoutOverlayConstraints,
  getExpandedCommands,
  getOpenSections,
  getPreviousLayout,
  getState,
  isUniqueLayout,
  readAnimBgForEditor,
  readArtBackdropForEditor,
  readSongifyArtFlags,
  readTransitionsForEditor,
  resetState,
  setPreviousLayout,
  setQueueConfigOpen,
  isQueueConfigOpen,
  getQueueConfigSidebarTab,
  setQueueConfigSidebarTab,
} from "./state.js";
import {
  checkSongifyStatus,
  clearConfigDraft,
  invalidatePublicPresetsCache,
  invalidateSongifyStatusCache,
  loadConfigDraft,
  loadPlatformState,
  readPublicPresetsCache,
  saveConfigDraft,
  savePlatformState,
  writePublicPresetsCache,
} from "./storage.js";
import { buildPreviewUrl, setPreviewIframe } from "./preview.js";
import {
  buildOverlayUrl,
  buildQueueFinalUrl,
  buildQueueUrl,
  getRedirectUri,
  queuePreviewIframeSrc,
} from "./url.js";
import {
  attachCfgTooltips,
  clampByte,
  compactToggle,
  copyText,
  escAttr,
  escCfg,
  extractAlphaFromCss,
  hexToRgba,
  parseColorToHexForPicker,
  renderSection,
  rgbToHex,
  showCfgToast,
  themeLabel,
  wheelHexToQueueColorValue,
} from "./ui.js";
import {
  initMainSidebarEvents,
  needsSidebarRebuild,
  patchSidebarValues,
} from "./sidebar-events.js";

export {
  readAnimBgForEditor,
  readArtBackdropForEditor,
  readSongifyArtFlags,
  readTransitionsForEditor,
  buildOverlayUrl,
  buildQueueUrl,
};

let state = getState();

let queueRangeDebounceTimer = null;
let queueColorDebounceTimer = null;

function exitQueueDesignerMode() {
  if (!isQueueConfigOpen() && !document.body.classList.contains("cfg-queue-mode")) {
    return;
  }
  setQueueConfigOpen(false);
  setQueueConfigSidebarTab("look");
  document.body.classList.remove("cfg-queue-mode");
  restoreConfiguratorPreviewShell();
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
  if (iframe) iframe.src = buildPreviewUrl(state, url);
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
      setQueueConfigSidebarTab(
        id === "queue" || id === "style" || id === "colors" || id === "obs" ? id : "look"
      );
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
  setQueueConfigOpen(true);
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
    const ok = await copyText(buildQueueFinalUrl(state));
    const btn = document.getElementById("btn-copy-queue");
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = ok ? "Copied!" : "Copy failed";
    window.setTimeout(() => {
      btn.textContent = prev;
    }, 1200);
  });
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
    <div class="cfg-layout-hint cfg-layout-hint-short">${hint}</div>
    <button
      type="button"
      class="cfg-layout-unique-btn"
      id="btn-layout-unique-presets"
      data-cfg-tip="${escAttr("Showcase-only layouts that are not reproducible in the custom editor.")}"
    >
      Unique presets
    </button>`;
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
  if (isUniqueLayout(state.layout)) {
    const rows = [];
    if (state.layout === "terminal") {
      rows.push(compactToggle("Next track", "showNextTrack", true, "", TOGGLE_KEY_TIPS.showNextTrack));
    }
    if (state.layout === "gameboy") {
      rows.push(compactToggle("Album art", "gameboyArt", true, "Pixelated art on screen"));
    }
    rows.push(compactToggle("Idle message", "showIdleMessage", true, "", TOGGLE_KEY_TIPS.showIdleMessage));
    return rows.join("");
  }

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
  if (isUniqueLayout(state.layout)) {
    if (state.layout !== "vinyl") {
      return "";
    }
    const parts = [];
    parts.push(
      compactToggle(
        "Transparent background",
        "transparent",
        true,
        "",
        TOGGLE_KEY_TIPS.transparent
      )
    );
    if (state.source === "songify") {
      parts.push(
        compactToggle(
          "Mood sync",
          "moodSync",
          true,
          "",
          TOGGLE_KEY_TIPS.moodSync
        )
      );
    }
    return parts.join("");
  }
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

function renderTransitionsContent() {
  const animBtnRow = (stateKey) =>
    [
      ["fade", "Fade"],
      ["zoom", "Zoom"],
      ["slide_up", "Slide up"],
      ["slide_down", "Slide down"],
      ["blur", "Blur"],
      ["pop", "Pop"],
      ["shrink", "Shrink"],
      ["none", "None"],
    ]
      .map(
        ([v, l]) => `
      <button type="button" class="cfg-btn cfg-sm-btn ${state[stateKey] === v ? "cfg-active" : ""}"
        data-set-key="${stateKey}" data-set-value="${v}">${l}</button>`
      )
      .join("");
  return `
  <div class="cfg-sub-label">Entrance</div>
  <div class="cfg-btn-group cfg-btn-group-wrap">${animBtnRow("enterAnim")}</div>
  <div class="cfg-slider-row cfg-slider-row-tight">
    <span class="cfg-slider-label" id="ctrl-enter-duration-label">Duration (${state.enterDuration}ms)</span>
    <input id="ctrl-enter-duration" type="range" min="100" max="1200" step="100" value="${state.enterDuration}" />
  </div>
  <div class="cfg-section-sep"></div>
  <div class="cfg-sub-label">Exit</div>
  <div class="cfg-btn-group cfg-btn-group-wrap">${animBtnRow("exitAnim")}</div>
  <div class="cfg-slider-row cfg-slider-row-tight">
    <span class="cfg-slider-label" id="ctrl-exit-duration-label">Duration (${state.exitDuration}ms)</span>
    <input id="ctrl-exit-duration" type="range" min="100" max="1200" step="100" value="${state.exitDuration}" />
  </div>
  <div class="cfg-slider-row cfg-slider-row-tight">
    <span class="cfg-slider-label" id="ctrl-exit-delay-label">Pause delay (${state.exitDelay}ms)</span>
    <input id="ctrl-exit-delay" type="range" min="0" max="10000" step="500" value="${state.exitDelay}" />
  </div>
  <p class="cfg-hint" style="margin:4px 0 0;line-height:1.45">Pause delay: how long to wait after playback stops before animating out. Prevents flickering on brief pauses. 0 = immediate.</p>`;
}

function renderStyleContent() {
  if (isUniqueLayout(state.layout)) {
    if (state.layout === "cassette") {
      return `<div class="cfg-sub-label">Label style</div>
      <div class="cfg-btn-group">
        <button class="cfg-btn cfg-sm-btn ${state.cassetteStyle === "classic" ? "cfg-active" : ""}" data-set-key="cassetteStyle" data-set-value="classic">Classic</button>
        <button class="cfg-btn cfg-sm-btn ${state.cassetteStyle === "mixtape" ? "cfg-active" : ""}" data-set-key="cassetteStyle" data-set-value="mixtape">Mixtape</button>
      </div>`;
    }
    return "";
  }
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
  const expanded = getExpandedCommands().has(cmd);
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

/** Renders all sidebar controls (event handlers live in sidebar-events.js). */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
  if (isQueueConfigOpen()) {
    renderQueueSidebar();
    return;
  }
  sidebar.classList.remove("cfg-queue-sidebar-mode");
  const scrollTop = sidebar.scrollTop;
  const layoutOptions = [
    "glasscard",
    "pill",
    "island",
    "strip",
    "albumfocus",
    "sidebar",
    "custom",
  ];
  const themeOptions = ["obsidian", "midnight", "aurora", "forest", "amber", "glass"];

  const uniqueLayout = isUniqueLayout(state.layout);
  const twitchBlock =
    state.source !== "songify"
      ? renderSection("twitch", "Twitch", renderTwitchContent())
      : "";
  if (uniqueLayout) {
    const uniqueContent = renderContentContent();
    const uniqueVisuals = renderVisualsContent();
    const uniqueStyle = renderStyleContent();
    const showThemeSection = state.layout !== "spotifycard";
    sidebar.innerHTML = `
      ${renderSection("source", "Source", renderSourceContent())}
      ${renderSection("layout", "Layout", renderLayoutContent(layoutOptions))}
      ${showThemeSection ? renderSection("theme", "Theme", renderThemeContent(themeOptions)) : ""}
      ${uniqueContent ? renderSection("content", "Content", uniqueContent) : ""}
      ${uniqueVisuals ? renderSection("visuals", "Visuals", uniqueVisuals) : ""}
      ${renderSection("transitions", "Transitions", renderTransitionsContent())}
      ${uniqueStyle ? renderSection("style", "Style", uniqueStyle) : ""}
    `;
  } else {
    sidebar.innerHTML = `
      ${renderSection("source", "Source", renderSourceContent())}
      ${renderSection("layout", "Layout", renderLayoutContent(layoutOptions))}
      ${renderSection("theme", "Theme", renderThemeContent(themeOptions))}
      ${renderSection("content", "Content", renderContentContent())}
      ${renderSection("visuals", "Visuals", renderVisualsContent())}
      ${renderSection("transitions", "Transitions", renderTransitionsContent())}
      ${renderSection("style", "Style", renderStyleContent())}
      ${twitchBlock}
    `;
  }

  sidebar.dataset.sidebarLayout = `${state.source}:${state.layout}:${isUniqueLayout(state.layout)}`;

  if (state.source === "songify") {
    const statusEl = document.getElementById("cfg-songify-status");
    if (statusEl) {
      checkSongifyStatus(statusEl, state.songifyPort);
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
    document.getElementById("cfg-custom-transitions-rail")?.remove();
    normalSidebar.style.display = "none";
    if (!customContainer) {
      customContainer = document.createElement("div");
      customContainer.id = "cfg-custom-editor";
    }
    if (!customContainer.parentNode) {
      body.insertBefore(customContainer, body.firstChild);
    }
    customContainer.style.display = "flex";
    customContainer.style.flex = "0 0 320px";
    customContainer.style.width = "320px";
    import("./custom-editor.js").then(({ initCustomEditor }) => {
      initCustomEditor(customContainer, getPreviousLayout(), (customState) => {
        updateCustomPreview(customState);
      });
    });
    renderHeaderDynamic();
  } else {
    normalSidebar.style.display = "";
    if (!normalSidebar.querySelector(".cfg-section-block")) {
      renderSidebar();
    }
    if (customContainer) {
      customContainer.style.display = "none";
      customContainer.style.flex = "";
      customContainer.style.width = "";
    }
    setPreviousLayout(state.layout);
    renderHeaderDynamic();
    document.getElementById("cfg-custom-transitions-rail")?.remove();
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
  invalidatePublicPresetsCache();
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
      update({ layout: getPreviousLayout() || "glasscard" });
    });
    addButton("btn-publish-custom-preset", "Publish preset", "cfg-nav-btn", () => {
      publishCustomPresetWithPrompt();
    });
  }

  addButton("btn-setup", "Setup", "cfg-nav-btn", () => openSetupWizard());
  addButton(
    "btn-preview-mode",
    state.previewDemo ? "Live preview" : "Demo preview",
    state.previewDemo ? "cfg-nav-btn cfg-nav-btn--accent" : "cfg-nav-btn",
    () => update({ previewDemo: !state.previewDemo })
  );
  addButton("btn-presets", "Presets", "cfg-nav-btn", () => openPresetsModal());
  addButton("btn-clear-cache", "Clear cache", "cfg-nav-btn cfg-nav-btn--danger", () => {
    const ok = window.confirm(
      "Are you sure? Everything will go back to default and your saved Nowify settings will be removed."
    );
    if (!ok) return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("nowify_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  });
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
        ${
          state.layout === "spotifycard"
            ? `<p class="cfg-obs-p"><strong>Spotify Card preset:</strong> Recommended size is <strong>900 × 394 px</strong>. It has no border radius and is designed to fill the entire browser source.</p>`
            : ""
        }
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
    const ok = await copyText(t);
    if (ok) {
      const btn = document.getElementById("cfg-obs-copy-url");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Copied!";
        window.setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
      }
    } else {
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

function paintPublicPresetList(listEl, presets) {
  const ownerKey = getOrCreateOwnerKey();
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
      invalidatePublicPresetsCache();
      await renderPublicPresetList();
    });
  });
}

async function renderPublicPresetList() {
  const listEl = document.getElementById("cfg-presets-public");
  if (!listEl) return;
  const cached = readPublicPresetsCache();
  if (cached) {
    paintPublicPresetList(listEl, cached);
    return;
  }
  listEl.innerHTML = '<div class="cfg-presets-empty">Loading presets...</div>';
  try {
    const res = await fetch(`${WORKER_BASE_URL}/presets`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const presets = (data?.presets || []).filter((p) => p?.customState);
    writePublicPresetsCache(presets);
    paintPublicPresetList(listEl, presets);
  } catch (_error) {
    listEl.innerHTML = '<div class="cfg-presets-empty">Could not load public presets.</div>';
  }
}

async function openPresetsModal(options = {}) {
  const uniqueOnly = Boolean(options.uniqueOnly);
  closePresetsModal();
  const shell = document.getElementById("cfg-shell");
  if (!shell) return;
  const quickPresets = [
    {
      name: "vinyl",
      label: "Vinyl",
      desc: "Record player with spinning disc",
      state: {
        layout: "vinyl",
        theme: "obsidian",
        transparent: false,
      },
    },
    {
      name: "terminal",
      label: "Terminal",
      desc: "Command line interface style",
      state: {
        layout: "terminal",
        theme: "forest",
        transparent: false,
        msgOpacity: 100,
        msgRadius: 4,
      },
    },
    {
      name: "cassette",
      label: "Cassette",
      desc: "Tape deck with spinning reels",
      state: {
        layout: "cassette",
        theme: "amber",
        transparent: false,
        cassetteStyle: "classic",
      },
    },
    {
      name: "cassette-mix",
      label: "Mixtape",
      desc: "Handwritten cassette label",
      state: {
        layout: "cassette",
        theme: "midnight",
        transparent: false,
        cassetteStyle: "mixtape",
      },
    },
    {
      name: "gameboy",
      label: "Game Boy",
      desc: "GBC handheld console",
      state: {
        layout: "gameboy",
        theme: "forest",
        transparent: false,
        gameboyArt: false,
      },
    },
    {
      name: "hud",
      label: "HUD",
      desc: "Heads-up display with targeting reticle",
      state: {
        layout: "hud",
        theme: "forest",
        transparent: false,
      },
    },
    {
      name: "stickynote",
      label: "Sticky Note",
      desc: "Handwritten note with pin",
      state: {
        layout: "stickynote",
        theme: "amber",
        transparent: true,
      },
    },
    {
      name: "spotifycard",
      label: "Spotify Card",
      desc: "Social share card style",
      state: {
        layout: "spotifycard",
        theme: "obsidian",
        transparent: false,
      },
    },
  ];
  const modal = document.createElement("div");
  modal.id = "cfg-presets-modal";
  modal.className = "cfg-presets-modal";
  const bodySections = uniqueOnly
    ? `<div class="cfg-presets-section-label">Unique presets</div>
      <div class="cfg-preset-grid" id="cfg-presets-quick">
        ${quickPresets
          .map(
            (p) => `<button class="cfg-preset-btn" data-preset="${escCfg(p.name)}">
              <span class="cfg-preset-name">${p.label}</span>
              <span class="cfg-preset-desc">${p.desc}</span>
            </button>`
          )
          .join("")}
      </div>`
    : `<div class="cfg-presets-section-label">Unique presets</div>
      <div class="cfg-preset-grid" id="cfg-presets-quick">
        ${quickPresets
          .map(
            (p) => `<button class="cfg-preset-btn" data-preset="${escCfg(p.name)}">
              <span class="cfg-preset-name">${p.label}</span>
              <span class="cfg-preset-desc">${p.desc}</span>
            </button>`
          )
          .join("")}
      </div>
      <div class="cfg-presets-section-label">Saved presets</div>
      <div class="cfg-presets-list" id="cfg-presets-local"></div>
      <div class="cfg-presets-section-label">Public presets</div>
      <div class="cfg-presets-list" id="cfg-presets-public"></div>`;
  modal.innerHTML = `
    <div class="cfg-presets-dialog">
      <div class="cfg-presets-header">
        <div class="cfg-presets-title">${uniqueOnly ? "Unique presets" : "Presets"}</div>
        <button class="cfg-btn" id="cfg-presets-close">Close</button>
      </div>
      ${bodySections}
    </div>
  `;
  shell.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closePresetsModal();
  });
  const closeBtn = document.getElementById("cfg-presets-close");
  if (closeBtn) closeBtn.addEventListener("click", () => closePresetsModal());
  modal.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetName = btn.getAttribute("data-preset");
      const preset = quickPresets.find((item) => item.name === presetName);
      if (!preset) return;
      update({ ...preset.state });
      closePresetsModal();
    });
  });
  if (!uniqueOnly) {
    renderLocalPresetList();
    await renderPublicPresetList();
  }
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
    const urlDisplay = document.getElementById("cfg-url-display");
    if (urlDisplay) urlDisplay.textContent = url;
    setPreviewIframe(url, false, state);
  });
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
    if (state.layout !== "vinyl") {
      state.moodSync = false;
    }
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
    if (state.layout !== "vinyl") {
      state.moodSync = false;
    }
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

  savePlatformState(state, newState);
  saveConfigDraft(state);
  const url = buildOverlayUrl(state);
  const urlDisplay = document.getElementById("cfg-url-display");
  const previewImmediate =
    Object.keys(newState).length === 0 ||
    newState.source !== undefined ||
    newState.layout !== undefined ||
    newState.songifyPort !== undefined ||
    newState.previewDemo !== undefined;
  if (newState.songifyPort !== undefined) {
    invalidateSongifyStatusCache();
  }
  if (isQueueConfigOpen()) {
    refreshQueueConfiguratorPreview();
  } else {
    if (urlDisplay) urlDisplay.textContent = url;
    setPreviewIframe(url, previewImmediate, state);
  }
  renderHeaderDynamic();
  const sidebar = document.getElementById("cfg-sidebar");
  const layoutKey = `${state.layout}:${state.source}:${isUniqueLayout(state.layout)}`;
  const sidebarHidden = sidebar?.style.display === "none";
  if (
    state.layout !== "custom" &&
    (needsSidebarRebuild(newState) ||
      sidebarHidden ||
      !sidebar?.querySelector(".cfg-section-block") ||
      sidebar?.dataset.sidebarLayout !== layoutKey)
  ) {
    renderSidebar();
  } else if (!isQueueConfigOpen() && state.layout !== "custom") {
    patchSidebarValues();
  }
  checkCustomMode();
}

/** Initializes configurator controls, preview syncing, and header actions. */
export function initConfig() {
  function finishInit() {
    loadPlatformState(state);
    loadConfigDraft(state);

    initMainSidebarEvents(update, {
      onOpenQueueConfig: () => renderQueueConfig(),
      onOpenUniquePresets: () => openPresetsModal({ uniqueOnly: true }),
    });

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
          (isQueueConfigOpen() ? buildQueueFinalUrl(state) : buildOverlayUrl(state));
        const previousText = copyButton.textContent;
        const ok = await copyText(activeUrl);
        copyButton.textContent = ok ? "Copied!" : "Copy failed";
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
          (isQueueConfigOpen() ? buildQueueFinalUrl(state) : buildOverlayUrl(state));
        window.open(activeUrl, "_blank");
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        exitQueueDesignerMode();
        clearConfigDraft();
        resetState();
        state = getState();
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
