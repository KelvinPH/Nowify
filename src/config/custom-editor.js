import {
  applyConfiguratorPatch,
  getConfiguratorNextTrackMode,
  readAnimBgForEditor,
  readArtBackdropForEditor,
  readSongifyArtFlags,
  readTransitionsForEditor,
} from "./controls.js";

export const CUSTOM_DEFAULTS = {
  direction: "row",
  cardWidth: 400,
  cardHeight: 80,
  maxCardWidth: 900,
  cardRadius: 16,
  cardPadding: 14,
  blurAmount: 24,
  bgOpacity: 85,
  borderWidth: 0.5,
  borderColor: "rgba(255,255,255,0.12)",
  borderStyle: "solid",
  fontFamily: "system",
  titleSize: 14,
  artistSize: 12,
  titleWeight: "600",
  artistWeight: "400",
  contentAlign: "left",
  contentGap: 6,
  letterSpacing: 0,
  textShadow: false,
  artSize: 52,
  artShape: "rounded",
  artRadius: 10,
  artShadow: 0,
  artPosition: "left",
  artBorder: false,
  artBorderColor: "rgba(255,255,255,0.2)",
  showArtist: true,
  showAlbum: false,
  showProgress: true,
  progressHeight: 2,
  showRemainingTime: false,
  showNextTrack: false,
  showPlayState: false,
  showBpm: false,
  contentOrder: ["title", "artist", "album", "progress"],
  separatorStyle: "none",
  progressStyle: "line",
  progressPosition: "bottom",
  bgType: "solid",
  gradientAngle: 135,
  gradientRadius: 70,
  gradientColor1: "rgba(10,10,10,0.85)",
  gradientColor2: "rgba(30,30,30,0.85)",
  gradientColor3: "rgba(20,20,20,0.85)",
  gradientColor4: "rgba(15,15,15,0.85)",
  gradientPos1: 0,
  gradientPos2: 100,
  gradientPos3: 50,
  gradientPos4: 75,
  customColors: false,
  colorBg: "#0a0a0a",
  colorAccent: "#1db954",
  colorTitle: "#ffffff",
  colorArtist: "rgba(255,255,255,0.5)",
  colorProgress: "#ffffff",
  colorBorder: "rgba(255,255,255,0.12)",
  animBgEnabled: false,
  animBgStyle: "aurora",
  animBgSpeed: 12,
  animBgColorMode: "mood",
  animBgColor1: "rgba(145,70,255,0.6)",
  animBgColor2: "rgba(30,30,80,0.8)",
  canvasEnabled: false,
  artBackdropEnabled: false,
  artBackdropBlur: 48,
};

const EFFECTS_STYLE_HINTS = {
  aurora: "Organic blobs shift and breathe. macOS Sonoma feel.",
  flow: "Gradient slowly flows across the card.",
  pulse: "Colors expand and contract from the center.",
  breathe: "Colors gently fade in and out.",
};

function escAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

const LAYOUT_SEEDS = {
  glasscard: { direction: "row", cardWidth: 380, cardHeight: 80, artSize: 52, cardRadius: 16 },
  pill: { direction: "row", cardWidth: 300, cardHeight: 54, artSize: 36, cardRadius: 50 },
  island: { direction: "column", cardWidth: 160, cardHeight: 180, artSize: 88, cardRadius: 24 },
  strip: { direction: "row", cardWidth: 400, cardHeight: 40, artSize: 26, cardRadius: 8 },
  albumfocus: { direction: "column", cardWidth: 160, cardHeight: 220, artSize: 120, cardRadius: 20 },
  sidebar: { direction: "column", cardWidth: 72, cardHeight: 140, artSize: 72, cardRadius: 16 },
};

let customState = { ...CUSTOM_DEFAULTS };
let debounceTimer = null;
let onChangeCallback = null;
let activeColorKey = null;
let wheelRaf = null;
let activeSeedLayout = "glasscard";
/** Preserved when the configurator re-inits the editor after global state updates. */
let activeEditorPanel = "container";

const cfgPatchSliderTimers = {};

function renderTabButton(name, label, svg, active = false) {
  return `<button class="ce-tab ${active ? "ce-tab-active" : ""}" data-tab="${name}">
    ${svg}<span>${label}</span>
  </button>`;
}

function sliderRow(label, key, min, max, value, unit = "", step = "1", conditional = "") {
  const classes = conditional ? "ce-slider-row ce-conditional" : "ce-slider-row";
  const condAttr = conditional ? `data-condition="${conditional}"` : "";
  return `<div class="${classes}" ${condAttr}>
    <span class="ce-slider-label">${label}</span>
    <div class="ce-slider-right">
      <input type="range" data-custom-key="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${value}" />
      <span class="ce-slider-value">${formatSliderValue(key, value, unit)}</span>
    </div>
  </div>`;
}

function toggleRow(label, key, desc = "") {
  return `<label class="ce-toggle-row">
    <span class="ce-toggle-info">
      <span class="ce-toggle-label">${label}</span>
      ${desc ? `<span class="ce-toggle-desc">${desc}</span>` : ""}
    </span>
    <span class="ce-toggle">
      <input type="checkbox" data-custom-key="${key}" ${customState[key] ? "checked" : ""} />
      <span class="ce-toggle-track"></span><span class="ce-toggle-thumb"></span>
    </span>
  </label>`;
}

function buttonGroup(key, options) {
  return `<div class="ce-btn-group">
    ${options
      .map(
        (opt) =>
          `<button type="button" class="ce-btn ${String(customState[key]) === String(opt.value) ? "ce-btn-active" : ""}" data-custom-key="${key}" data-custom-value="${opt.value}">${opt.label}</button>`
      )
      .join("")}
  </div>`;
}

function renderNextTrackModeSpotifyOnly() {
  if (readSongifyArtFlags().source !== "spotify") {
    return "";
  }
  const m = getConfiguratorNextTrackMode();
  return `<div class="ce-subregion-title ce-subregion-title--nested">Next track updates (Spotify)</div>
    <p class="ce-region-lead ce-region-lead--inline"><strong>Always refresh</strong> — fetches the queue every poll (stays in sync; can flicker if the API is empty). <strong>Per song (~10s)</strong> — after each new track, shows the next title for about 10 seconds, then hides until the next song.</p>
    <div class="ce-btn-group">
      <button type="button" class="ce-btn ${m === "always" ? "ce-btn-active" : ""}" data-next-track-mode="always">Always refresh</button>
      <button type="button" class="ce-btn ${m === "perSong" ? "ce-btn-active" : ""}" data-next-track-mode="perSong">Per song (~10s)</button>
    </div>
    <p class="ce-mini-info ce-mini-info--tight" style="margin-top:8px">Enable <strong>Show next track</strong> below for the overlay to show the queue line.</p>`;
}

function renderContainerPanel() {
  return `<div class="ce-section">
      <div class="ce-section-label">Direction</div>
      ${buttonGroup("direction", [
        { label: "Horizontal", value: "row" },
        { label: "Vertical", value: "column" },
      ])}
      <div class="ce-section-label" style="margin-top:12px">Art position</div>
      ${buttonGroup("artPosition", [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
        { label: "Hidden", value: "hidden" },
      ])}
      ${sliderRow("Card width", "cardWidth", 80, 900, customState.cardWidth, "px")}
      ${sliderRow("Max card width", "maxCardWidth", 80, 900, customState.maxCardWidth, "px")}
      ${sliderRow("Card height", "cardHeight", 40, 400, customState.cardHeight, "px")}
      ${sliderRow("Corner radius", "cardRadius", 0, 60, customState.cardRadius, "px")}
      ${sliderRow("Padding", "cardPadding", 4, 40, customState.cardPadding, "px")}
      ${sliderRow("Blur", "blurAmount", 0, 40, customState.blurAmount, "px")}
      ${sliderRow("Opacity", "bgOpacity", 0, 100, customState.bgOpacity, "%")}
      ${sliderRow("Border width", "borderWidth", 0, 4, customState.borderWidth, "px", "0.5")}
      <div class="ce-section-label" style="margin-top:10px">Border style</div>
      ${buttonGroup("borderStyle", [
        { label: "Solid", value: "solid" },
        { label: "Gradient", value: "gradient" },
      ])}
    </div>`;
}

function renderTypographyPanel() {
  return `<div class="ce-section">
    <div class="ce-section-label">Typography</div>
    ${buttonGroup("fontFamily", [
      { label: "System", value: "system" },
      { label: "Inter", value: "inter" },
      { label: "Mono", value: "mono" },
      { label: "Serif", value: "serif" },
    ])}
    ${sliderRow("Title size", "titleSize", 10, 32, customState.titleSize, "px")}
    ${sliderRow("Artist size", "artistSize", 9, 24, customState.artistSize, "px")}
    <div class="ce-section-label">Title weight</div>
    ${buttonGroup("titleWeight", [
      { label: "Light", value: "300" },
      { label: "Regular", value: "400" },
      { label: "Bold", value: "600" },
    ])}
    <div class="ce-section-label">Artist weight</div>
    ${buttonGroup("artistWeight", [
      { label: "Light", value: "300" },
      { label: "Regular", value: "400" },
      { label: "Bold", value: "600" },
    ])}
    ${sliderRow("Letter spacing", "letterSpacing", 0, 20, customState.letterSpacing)}
    ${toggleRow("Text shadow", "textShadow")}
  </div>`;
}

function renderArtPanel() {
  const songify = readSongifyArtFlags();
  const songifyCanvasSection =
    songify.source === "songify"
      ? `<div class="ce-art-songify-block">
          <div class="ce-subregion-title ce-subregion-title--songify">Songify</div>
          ${toggleRow(
            "Canvas videos",
            "canvasEnabled",
            "Spotify Canvas loop instead of album art when Songify sends a URL"
          )}
        </div>`
      : "";

  return `<div class="ce-section">
    <div class="ce-section-label">Art</div>
    ${buttonGroup("artShape", [
      { label: "Square", value: "square" },
      { label: "Rounded", value: "rounded" },
      { label: "Circle", value: "circle" },
    ])}
    ${sliderRow("Art size", "artSize", 24, 160, customState.artSize, "px")}
    ${sliderRow("Corner radius", "artRadius", 0, 40, customState.artRadius, "px", "1", "artShape:rounded")}
    ${sliderRow("Shadow", "artShadow", 0, 3, customState.artShadow)}
    ${toggleRow("Art border", "artBorder")}
    ${songifyCanvasSection}
  </div>`;
}

function renderArtBackdropBlock() {
  return `<div class="ce-colours-region ce-colours-region--motion">
    <div class="ce-region-title">Album art backdrop</div>
    <p class="ce-region-lead">Blurred cover art behind the card. Works with the animated gradient (art stays underneath).</p>
    ${toggleRow("Enable", "artBackdropEnabled", "")}
    <div class="ce-effects-detail" data-condition="artBackdropEnabled:true">
      ${sliderRow("Blur", "artBackdropBlur", 0, 120, customState.artBackdropBlur, "px", "2")}
      <p class="ce-mini-info ce-mini-info--tight">Higher values soften the image; 0 keeps it sharp but enlarged.</p>
    </div>
  </div>`;
}

function renderAnimatedBackgroundBlock() {
  const animColorRows =
    customState.animBgEnabled && customState.animBgColorMode === "custom"
      ? `<div class="ce-anim-custom-colors">
          <div class="ce-subregion-title ce-subregion-title--nested">Gradient colors</div>
          ${renderColorPicker("Color 1", "animBgColor1")}
          ${renderColorPicker("Color 2", "animBgColor2")}
        </div>`
      : "";

  return `<div class="ce-colours-region ce-colours-region--motion">
    <div class="ce-region-title">Animated background</div>
    <p class="ce-region-lead">Optional moving gradient behind the card while a track is playing.</p>
    ${toggleRow("Enable", "animBgEnabled", "")}
    <div class="ce-effects-detail" data-condition="animBgEnabled:true">
      <div class="ce-subregion-title">Style</div>
      <div class="ce-btn-group ce-btn-group--wrap">
        ${[
          ["aurora", "Aurora"],
          ["flow", "Flow"],
          ["pulse", "Pulse"],
          ["breathe", "Breathe"],
        ]
          .map(
            ([v, l]) =>
              `<button type="button" class="ce-btn ce-btn-compact ${String(customState.animBgStyle) === v ? "ce-btn-active" : ""}" data-custom-key="animBgStyle" data-custom-value="${v}">${l}</button>`
          )
          .join("")}
      </div>
      <div class="ce-anim-hint">${EFFECTS_STYLE_HINTS[customState.animBgStyle] || ""}</div>
      ${sliderRow("Speed", "animBgSpeed", 3, 30, customState.animBgSpeed, "s")}
      <p class="ce-mini-info ce-mini-info--tight">3s = fast · 30s = slow</p>
      <div class="ce-subregion-title" style="margin-top:10px">Color source</div>
      ${buttonGroup("animBgColorMode", [
        { label: "Mood sync", value: "mood" },
        { label: "Custom", value: "custom" },
      ])}
      <p class="ce-mini-info ce-mini-info--tight">${
        customState.animBgColorMode === "custom"
          ? "Set both colors below."
          : "Follows album art each track."
      }</p>
      ${animColorRows}
    </div>
  </div>`;
}

function renderContentPanel() {
  const orderLabels = {
    title: "Title",
    artist: "Artist",
    album: "Album",
    progress: "Progress",
  };

  const order = Array.isArray(customState.contentOrder)
    ? customState.contentOrder
    : ["title", "artist", "album", "progress"];

  const orderItemsHtml = order
    .map((key, idx) => {
      const label = orderLabels[key] || key;
      const upBtn =
        idx > 0
          ? `<button type="button" class="ce-order-btn" data-order-key="${escAttr(
              key
            )}" data-order-dir="up" aria-label="Move ${label} up">^</button>`
          : "";
      const downBtn =
        idx < order.length - 1
          ? `<button type="button" class="ce-order-btn" data-order-key="${escAttr(
              key
            )}" data-order-dir="down" aria-label="Move ${label} down">v</button>`
          : "";
      return `<div class="ce-order-item">
        <span>${label}</span>
        <div class="ce-order-btns">${upBtn}${downBtn}</div>
      </div>`;
    })
    .join("");

  return `<div class="ce-section">
    <div class="ce-section-label">Content</div>
    <div class="ce-section-label">Text alignment</div>
    ${buttonGroup("contentAlign", [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ])}
    ${sliderRow("Content spacing", "contentGap", 0, 24, customState.contentGap, "px", "1")}

    <div class="ce-section-label" style="margin-top:12px">Order</div>
    ${orderItemsHtml}

    ${buttonGroup("separatorStyle", [
      { label: "None", value: "none" },
      { label: "Dot", value: "dot" },
      { label: "Dash", value: "dash" },
      { label: "Pipe", value: "pipe" },
    ])}

    ${toggleRow("Show artist", "showArtist")}
    ${toggleRow("Show album", "showAlbum")}
    ${toggleRow("Show progress bar", "showProgress")}
    ${sliderRow("Progress height", "progressHeight", 1, 8, customState.progressHeight, "px", "1", "showProgress:true")}

    <div class="ce-section-label" style="margin-top:12px">Progress style</div>
    ${buttonGroup("progressStyle", [
      { label: "Line", value: "line" },
      { label: "Thick", value: "thick" },
      { label: "Dots", value: "dots" },
    ])}

    ${toggleRow("Show remaining time", "showRemainingTime", "Shows time left instead of elapsed time")}
    ${renderNextTrackModeSpotifyOnly()}
    ${toggleRow("Show next track", "showNextTrack", "Uses your Spotify queue data")}
    <div class="ce-disclaimer">If next track is blank, reconnect Spotify in OBS
      to refresh your session permissions and player state.
    </div>
    ${toggleRow("Show play state", "showPlayState", "Pulsing dot when track is playing")}
    ${toggleRow("Show BPM", "showBpm", "Tempo badge from Spotify audio features")}
  </div>`;
}

function renderColoursPanel() {
  const bg = customState.bgType;
  const showSolidFill = bg === "solid";
  const showGradientBlock = bg !== "solid";
  const showAngle = bg === "linear" || bg === "multistop" || bg === "conic";
  const showRadialRadius = bg === "radial";
  const showMultiStops = bg === "multistop";
  const showTwoColors = bg === "linear" || bg === "radial" || bg === "conic";

  let posRows = "";
  if (bg === "linear" || bg === "multistop") {
    posRows =
      sliderRow("Stop 1 position", "gradientPos1", 0, 100, customState.gradientPos1, "%", "1") +
      sliderRow("Stop 2 position", "gradientPos2", 0, 100, customState.gradientPos2, "%", "1");
  } else if (bg === "radial") {
    posRows = sliderRow("Inner stop position", "gradientPos1", 0, 100, customState.gradientPos1, "%", "1");
  }

  const pos34 = showMultiStops
    ? sliderRow("Stop 3 position", "gradientPos3", 0, 100, customState.gradientPos3, "%", "1") +
      sliderRow("Stop 4 position", "gradientPos4", 0, 100, customState.gradientPos4, "%", "1")
    : "";

  const colors12 =
    showTwoColors && !showMultiStops
      ? renderColorPicker("Colour 1", "gradientColor1") + renderColorPicker("Colour 2", "gradientColor2")
      : "";

  const colorsMulti = showMultiStops
    ? renderColorPicker("Colour 1", "gradientColor1") +
      renderColorPicker("Colour 2", "gradientColor2") +
      renderColorPicker("Colour 3", "gradientColor3") +
      renderColorPicker("Colour 4", "gradientColor4")
    : "";

  const angleSliders = showAngle
    ? sliderRow("Angle", "gradientAngle", 0, 360, customState.gradientAngle, "deg", "1")
    : "";
  const radialRadiusBlock = showRadialRadius
    ? sliderRow("Radius", "gradientRadius", 10, 100, customState.gradientRadius, "%", "1")
    : "";

  return `<div class="ce-section ce-section--colours">
    <div class="ce-colours-shell">
      <div class="ce-colours-region">
        <div class="ce-region-title">Card & interface</div>
        <p class="ce-region-lead">Replace the theme with custom fills and text colors for this layout.</p>
        ${toggleRow("Custom colors", "customColors", "When off, the Configurator theme applies")}
        <div class="ce-colours-section" style="${customState.customColors ? "" : "display:none;"}">
          <div class="ce-colour-block ce-colour-block--tight">
            <div class="ce-subregion-title">Background</div>
            <p class="ce-region-lead ce-region-lead--inline">Solid blends with Container → Opacity. Gradients replace the fill.</p>
            ${buttonGroup("bgType", [
              { label: "Solid", value: "solid" },
              { label: "Linear", value: "linear" },
              { label: "Radial", value: "radial" },
              { label: "Conic", value: "conic" },
              { label: "Multi", value: "multistop" },
            ])}
            ${showSolidFill ? renderColorPicker("Fill", "colorBg") : ""}
            <div class="ce-gradient-panel" style="${showGradientBlock ? "" : "display:none;"}">
              ${angleSliders}
              ${radialRadiusBlock}
              ${posRows}
              ${pos34}
              ${colors12}
              ${colorsMulti}
            </div>
          </div>

          <div class="ce-colour-block ce-colour-block--tight">
            <div class="ce-subregion-title">Chrome</div>
            ${renderColorPicker("Border", "colorBorder")}
            ${renderColorPicker("Accent", "colorAccent")}
          </div>

          <div class="ce-colour-block ce-colour-block--tight">
            <div class="ce-subregion-title">Text & progress</div>
            ${renderColorPicker("Title", "colorTitle")}
            ${renderColorPicker("Artist", "colorArtist")}
            ${renderColorPicker("Progress", "colorProgress")}
          </div>

          <div class="ce-colour-block ce-colour-block--wheel">
            <div class="ce-subregion-title">Color picker</div>
            <p class="ce-region-lead ce-region-lead--inline">Tap a row above, then the wheel — or sample from art.</p>
            <div class="ce-wheel-wrap" id="ce-color-wheel">
              <canvas id="ce-wheel-canvas" width="200" height="200"></canvas>
              <div class="ce-wheel-lightness"><input type="range" id="ce-lightness-slider" min="0" max="100" value="50" /></div>
              <div class="ce-wheel-active-label" id="ce-wheel-label">Select a swatch to edit</div>
            </div>
            <div class="ce-art-extract ce-art-extract--inline">
              <span class="ce-art-extract-label">From album art</span>
              <div class="ce-art-swatches" id="ce-art-swatches"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="ce-region-divider" role="presentation"></div>

      ${renderArtBackdropBlock()}

      <div class="ce-region-divider" role="presentation"></div>

      ${renderAnimatedBackgroundBlock()}
    </div>
  </div>`;
}

function renderColorPicker(label, key) {
  const value = customState[key];
  const safeVal = escAttr(value);
  return `<div class="ce-color-row">
    <span class="ce-color-label">${label}</span>
    <div class="ce-color-picker-wrap">
      <div class="ce-color-preview" style="background:${value}" data-color-key="${key}"></div>
      <input type="text" class="ce-color-hex" value="${safeVal}" data-color-key="${key}" placeholder="#000000" />
    </div>
  </div>`;
}

function pickDefaultActiveColorKey() {
  if (customState.bgType !== "solid") return "gradientColor1";
  return "colorBg";
}

const COLOR_KEY_LABELS = {
  colorBg: "card background",
  gradientColor1: "gradient colour 1",
  gradientColor2: "gradient colour 2",
  gradientColor3: "gradient colour 3",
  gradientColor4: "gradient colour 4",
  colorBorder: "card border",
  colorAccent: "accent",
  colorTitle: "title",
  colorArtist: "artist",
  colorProgress: "progress bar",
  animBgColor1: "animated background 1",
  animBgColor2: "animated background 2",
};

function transitionAnimButtonRow(stateKey, activeVal) {
  const opts = [
    ["fade", "Fade"],
    ["zoom", "Zoom"],
    ["slide_up", "Slide up"],
    ["slide_down", "Slide down"],
    ["blur", "Blur"],
    ["pop", "Pop"],
    ["shrink", "Shrink"],
    ["none", "None"],
  ];
  return opts
    .map(
      ([v, l]) =>
        `<button type="button" class="ce-btn ce-btn-compact ${activeVal === v ? "ce-btn-active" : ""}" data-cfg-patch-key="${stateKey}" data-cfg-patch-value="${v}">${l}</button>`
    )
    .join("");
}

function transitionSliderRow(label, key, min, max, step, value, unit) {
  return `<div class="ce-slider-row">
    <span class="ce-slider-label">${label}</span>
    <div class="ce-slider-right">
      <input type="range" data-cfg-patch-slider="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${value}" />
      <span class="ce-slider-value">${value}${unit}</span>
    </div>
  </div>`;
}

function renderTransitionsPanel() {
  const t = readTransitionsForEditor();
  return `<div class="ce-section">
    <div class="ce-region-title">Playback transitions</div>
    <p class="ce-region-lead">Animate the overlay when playback starts and stops. When not playing, the card stays fully hidden so OBS does not show a frozen frame.</p>
    <div class="ce-subregion-title">Entrance</div>
    <div class="ce-btn-group ce-btn-group--wrap">${transitionAnimButtonRow("enterAnim", t.enterAnim)}</div>
    ${transitionSliderRow("Duration", "enterDuration", 100, 1200, 100, t.enterDuration, "ms")}
    <div class="ce-subregion-title" style="margin-top:12px">Exit</div>
    <div class="ce-btn-group ce-btn-group--wrap">${transitionAnimButtonRow("exitAnim", t.exitAnim)}</div>
    ${transitionSliderRow("Duration", "exitDuration", 100, 1200, 100, t.exitDuration, "ms")}
    ${transitionSliderRow("Pause delay", "exitDelay", 0, 10000, 500, t.exitDelay, "ms")}
    <p class="ce-mini-info ce-mini-info--tight" style="margin-top:8px">Pause delay waits after playback stops before hiding. Use a few seconds to avoid flicker between Spotify tracks. 0 = hide immediately.</p>
  </div>`;
}

function updateActiveColorUi(containerEl) {
  if (!activeColorKey) return;
  const swatches = containerEl.querySelectorAll(".ce-color-preview");
  swatches.forEach((s) => s.classList.remove("ce-color-active"));
  const activeSwatch = containerEl.querySelector(`.ce-color-preview[data-color-key="${activeColorKey}"]`);
  if (activeSwatch) activeSwatch.classList.add("ce-color-active");
  const label = containerEl.querySelector("#ce-wheel-label");
  if (label) {
    const human = COLOR_KEY_LABELS[activeColorKey] || activeColorKey;
    label.textContent = `Editing ${human}`;
  }
}

function renderEditor(containerEl, activePanel) {
  const panel = typeof activePanel === "string" ? activePanel : activeEditorPanel;
  activeEditorPanel = panel;
  containerEl.innerHTML = `<div class="ce-shell">
    <div class="ce-header">
      <div class="ce-header-brand">
        <span class="ce-header-title">Custom layout</span>
      </div>
      <button type="button" id="ce-reset-custom" class="cfg-nav-btn cfg-nav-btn--danger ce-header-reset">Reset</button>
    </div>
    <div class="ce-tabs">
      ${renderTabButton("container", "Container", '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor"/></svg>', panel === "container")}
      ${renderTabButton("typography", "Typography", '<svg viewBox="0 0 24 24"><path d="M4 6h16v2h-7v10h-2V8H4z" fill="currentColor"/></svg>', panel === "typography")}
      ${renderTabButton("art", "Art", '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor"/></svg>', panel === "art")}
      ${renderTabButton("content", "Content", '<svg viewBox="0 0 24 24"><path d="M6 7h12v2H6zm0 4h12v2H6zm0 4h8v2H6z" fill="currentColor"/></svg>', panel === "content")}
      ${renderTabButton("transitions", "Transitions", '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', panel === "transitions")}
      ${renderTabButton("colours", "Colours", '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>', panel === "colours")}
    </div>
    <div class="ce-panels">
      <div class="ce-panel ${panel === "container" ? "ce-panel-active" : ""}" data-panel="container">${renderContainerPanel()}</div>
      <div class="ce-panel ${panel === "typography" ? "ce-panel-active" : ""}" data-panel="typography">${renderTypographyPanel()}</div>
      <div class="ce-panel ${panel === "art" ? "ce-panel-active" : ""}" data-panel="art">${renderArtPanel()}</div>
      <div class="ce-panel ${panel === "content" ? "ce-panel-active" : ""}" data-panel="content">${renderContentPanel()}</div>
      <div class="ce-panel ${panel === "transitions" ? "ce-panel-active" : ""}" data-panel="transitions">${renderTransitionsPanel()}</div>
      <div class="ce-panel ${panel === "colours" ? "ce-panel-active" : ""}" data-panel="colours">${renderColoursPanel()}</div>
    </div>
  </div>`;
  if (!activeColorKey) {
    activeColorKey = pickDefaultActiveColorKey();
  }
  if (!containerEl.querySelector(`.ce-color-preview[data-color-key="${activeColorKey}"]`)) {
    activeColorKey = pickDefaultActiveColorKey();
  }
  attachListeners(containerEl);
  updateActiveColorUi(containerEl);
}

/** Reads saved custom layout state from localStorage. */
export function loadCustomState() {
  try {
    const raw = localStorage.getItem("nowify_custom_layout");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function saveCustomState() {
  localStorage.setItem("nowify_custom_layout", JSON.stringify(customState));
}

function resetCustomState(containerEl) {
  const seed = LAYOUT_SEEDS[activeSeedLayout] || {};
  customState = { ...CUSTOM_DEFAULTS, ...seed, maxCardWidth: seed.cardWidth || CUSTOM_DEFAULTS.maxCardWidth };
  activeColorKey = pickDefaultActiveColorKey();
  activeEditorPanel = "container";
  saveCustomState();
  renderEditor(containerEl, "container");
  if (onChangeCallback) onChangeCallback(customState);
}

/** Builds overlay URL including c_ prefixed custom params. */
export function buildCustomUrl(baseState, providedCustomState) {
  const mergedState = providedCustomState || customState;
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();
  Object.entries(baseState || {}).forEach(([key, value]) => {
    params.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });
  params.set("layout", "custom");
  Object.keys(CUSTOM_DEFAULTS).forEach((key) => {
    const value = mergedState[key];
    params.set(`c_${key}`, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });
  return `${base}?${params.toString()}`;
}

/** Initializes custom editor with seed, saved state, and onChange callback. */
export function initCustomEditor(containerEl, seedLayout, onChange) {
  activeSeedLayout = seedLayout || "glasscard";
  const seed = LAYOUT_SEEDS[seedLayout] || {};
  customState = { ...CUSTOM_DEFAULTS, ...seed };
  const saved = loadCustomState();
  if (saved) customState = { ...customState, ...saved };
  if (customState.animBgStyle === "conic") {
    customState.animBgStyle = "aurora";
  }
  const animEd = readAnimBgForEditor();
  if (!saved || saved.animBgColor1 === undefined) {
    customState.animBgColor1 = animEd.animBgColor1 || CUSTOM_DEFAULTS.animBgColor1;
  }
  if (!saved || saved.animBgColor2 === undefined) {
    customState.animBgColor2 = animEd.animBgColor2 || CUSTOM_DEFAULTS.animBgColor2;
  }
  if (!saved || saved.animBgEnabled === undefined) {
    customState.animBgEnabled = animEd.animBgEnabled;
  }
  if (!saved || saved.animBgStyle === undefined) {
    customState.animBgStyle = animEd.animBgStyle || CUSTOM_DEFAULTS.animBgStyle;
  }
  if (!saved || saved.animBgSpeed === undefined) {
    customState.animBgSpeed = animEd.animBgSpeed;
  }
  if (!saved || saved.animBgColorMode === undefined) {
    customState.animBgColorMode = animEd.animBgColorMode || CUSTOM_DEFAULTS.animBgColorMode;
  }
  const songifyFlags = readSongifyArtFlags();
  if (!saved || saved.canvasEnabled === undefined) {
    customState.canvasEnabled = songifyFlags.canvasEnabled;
  }
  const artBd = readArtBackdropForEditor();
  if (!saved || saved.artBackdropEnabled === undefined) {
    customState.artBackdropEnabled = artBd.artBackdropEnabled;
  }
  if (!saved || saved.artBackdropBlur === undefined) {
    customState.artBackdropBlur = artBd.artBackdropBlur;
  }
  // Keep maxCardWidth aligned with the selected seed by default.
  // (If the user already saved a custom value, we keep that.)
  if (!saved || saved.maxCardWidth === undefined) {
    customState.maxCardWidth = customState.cardWidth;
  }
  onChangeCallback = onChange;
  renderEditor(containerEl);
  triggerChange();

  // Note: renderer.js should dispatch `nowify:trackchange` on render()
  // to power album-art color sampling in this editor.
  window.addEventListener("nowify:trackchange", (e) => {
    const art = e?.detail?.track?.albumArt;
    if (art) extractArtColors(art, containerEl);
  });
}

function attachListeners(containerEl) {
  const resetBtn = containerEl.querySelector("#ce-reset-custom");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetCustomState(containerEl);
    });
  }

  containerEl.querySelectorAll("[data-next-track-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-next-track-mode");
      if (mode !== "always" && mode !== "perSong") return;
      saveCustomState();
      applyConfiguratorPatch({ nextTrackMode: mode });
      const activePanel = containerEl.querySelector(".ce-tab-active")?.dataset.tab || "content";
      renderEditor(containerEl, activePanel);
      triggerChange();
    });
  });

  containerEl.querySelectorAll(".ce-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      if (target) {
        activeEditorPanel = target;
      }
      containerEl.querySelectorAll(".ce-tab").forEach((t) => t.classList.toggle("ce-tab-active", t === tab));
      containerEl
        .querySelectorAll(".ce-panel")
        .forEach((p) => p.classList.toggle("ce-panel-active", p.dataset.panel === target));
    });
  });

  containerEl.querySelectorAll("[data-cfg-patch-key][data-cfg-patch-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.cfgPatchKey;
      const value = btn.dataset.cfgPatchValue;
      if (!key || value === undefined) return;
      applyConfiguratorPatch({ [key]: value });
    });
  });

  containerEl.querySelectorAll('input[type="range"][data-cfg-patch-slider]').forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.cfgPatchSlider;
      if (!key) return;
      updateSliderLabel(input);
      window.clearTimeout(cfgPatchSliderTimers[key]);
      cfgPatchSliderTimers[key] = window.setTimeout(() => {
        applyConfiguratorPatch({ [key]: Number(input.value) });
      }, 200);
    });
  });

  containerEl.querySelectorAll(".ce-order-btn[data-order-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.orderKey;
      const dir = btn.dataset.orderDir;
      const order = Array.isArray(customState.contentOrder) ? customState.contentOrder : [];
      const idx = order.indexOf(key);
      if (idx === -1) return;
      const nextIdx = dir === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= order.length) return;

      const nextOrder = order.slice();
      nextOrder.splice(idx, 1);
      nextOrder.splice(nextIdx, 0, key);
      customState.contentOrder = nextOrder;

      const activePanel = containerEl.querySelector(".ce-tab-active")?.dataset.tab || "content";
      renderEditor(containerEl, activePanel);
      triggerChange();
    });
  });

  containerEl.querySelectorAll('input[type="range"][data-custom-key]').forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.customKey;
      customState[key] = Number(input.value);
      updateSliderLabel(input);
      triggerChange();
    });
  });

  containerEl.querySelectorAll('input[type="checkbox"][data-custom-key]').forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.customKey;
      customState[key] = input.checked;
      if (key === "customColors") {
        activeColorKey = pickDefaultActiveColorKey();
      }
      updateConditionals(containerEl);
      if (key === "customColors") {
        setupColorWheel(containerEl);
        updateActiveColorUi(containerEl);
      }
      if (key === "animBgEnabled") {
        const activePanel = containerEl.querySelector(".ce-tab-active")?.dataset.tab || "colours";
        renderEditor(containerEl, activePanel);
        triggerChange();
        return;
      }
      triggerChange();
    });
  });

  containerEl.querySelectorAll("[data-custom-key][data-custom-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.customKey;
      const value = btn.dataset.customValue;
      customState[key] = value;
      // Gradients rely on custom colours being enabled.
      if (key === "borderStyle" && value === "gradient") {
        customState.customColors = true;
      }
      if (key === "bgType" && value !== "solid") {
        customState.customColors = true;
      }
      if (key === "bgType") {
        activeColorKey = value === "solid" ? "colorBg" : "gradientColor1";
      }

      // bgType/borderStyle drive conditional UI fragments rendered with inline styles.
      // Re-render active panel so gradient controls and color rows appear immediately.
      if (key === "bgType" || key === "borderStyle") {
        const activePanel = containerEl.querySelector(".ce-tab-active")?.dataset.tab || "colours";
        renderEditor(containerEl, activePanel);
        triggerChange();
        return;
      }

      if (key === "animBgStyle" || key === "animBgColorMode") {
        const activePanel = containerEl.querySelector(".ce-tab-active")?.dataset.tab || "colours";
        renderEditor(containerEl, activePanel);
        triggerChange();
        return;
      }

      const siblings = containerEl.querySelectorAll(`[data-custom-key="${key}"][data-custom-value]`);
      siblings.forEach((s) => s.classList.toggle("ce-btn-active", s === btn));
      updateConditionals(containerEl);
      updateActiveColorUi(containerEl);
      triggerChange();
    });
  });

  containerEl.querySelectorAll(".ce-color-hex").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.colorKey;
      const val = input.value.trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(val) || /^rgba?\(/.test(val)) {
        customState[key] = val;
        const preview = containerEl.querySelector(`.ce-color-preview[data-color-key="${key}"]`);
        if (preview) preview.style.background = val;
        triggerChange();
      }
    });
  });

  containerEl.querySelectorAll(".ce-color-preview").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      activeColorKey = swatch.dataset.colorKey;
      updateActiveColorUi(containerEl);
    });
  });

  setupColorWheel(containerEl);
  updateConditionals(containerEl);
}

function updateConditionals(containerEl) {
  containerEl.querySelectorAll("[data-condition]").forEach((el) => {
    const [key, val] = String(el.getAttribute("data-condition") || "").split(":");
    const expected = val === "true" ? true : val === "false" ? false : val;
    const show = customState[key] === expected;
    el.style.display = show ? "flex" : "none";
  });
  const colorsSection = containerEl.querySelector(".ce-colours-section");
  if (colorsSection) {
    colorsSection.style.display = customState.customColors ? "" : "none";
  }
}

function triggerChange() {
  saveCustomState();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (onChangeCallback) onChangeCallback(customState);
  }, 300);
}

function formatSliderValue(key, value, unit) {
  if (key === "letterSpacing") return `${(Number(value) / 100).toFixed(2)}em`;
  if (key === "artShadow") return ["None", "Soft", "Medium", "Strong"][Number(value)] || "None";
  if (key === "animBgSpeed") return `${value}${unit || "s"}`;
  if (key === "artBackdropBlur") return `${value}px`;
  return `${value}${unit || ""}`;
}

function updateSliderLabel(input) {
  const valueEl = input.closest(".ce-slider-right")?.querySelector(".ce-slider-value");
  if (!valueEl) return;
  const unit = input.dataset.unit || "";
  if (input.dataset.cfgPatchSlider) {
    valueEl.textContent = `${input.value}${unit}`;
    return;
  }
  valueEl.textContent = formatSliderValue(input.dataset.customKey, input.value, unit);
}

function setupColorWheel(containerEl) {
  const canvas = containerEl.querySelector("#ce-wheel-canvas");
  const lightnessSlider = containerEl.querySelector("#ce-lightness-slider");
  if (!canvas || !lightnessSlider) return;

  const redraw = () => {
    drawColorWheel(canvas, Number(lightnessSlider.value));
  };
  redraw();

  lightnessSlider.addEventListener("input", () => {
    if (wheelRaf) cancelAnimationFrame(wheelRaf);
    wheelRaf = requestAnimationFrame(redraw);
  });

  canvas.addEventListener("click", (event) => {
    if (!activeColorKey) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(x, y, 1, 1).data;
    if (!data || data[3] === 0) return;
    const hex = rgbToHex(data[0], data[1], data[2]);
    customState[activeColorKey] = hex;
    const preview = containerEl.querySelector(`.ce-color-preview[data-color-key="${activeColorKey}"]`);
    const input = containerEl.querySelector(`.ce-color-hex[data-color-key="${activeColorKey}"]`);
    if (preview) preview.style.background = hex;
    if (input) input.value = hex;
    triggerChange();
  });
}

function drawColorWheel(canvas, lightness) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.createImageData(200, 200);
  const cx = 100;
  const cy = 100;
  const r = 96;
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x < 200; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const sat = (dist / r) * 100;
      const [r2, g, b] = hslToRgb(hue, sat, lightness);
      const idx = (y * 200 + x) * 4;
      imageData.data[idx] = r2;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHex(r, g, b) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function extractArtColors(imgUrl, containerEl) {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgUrl;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 50, 50);
    const buckets = new Map();

    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 50; x += 10) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        const h = rgbToH(Math.round(d[0]), Math.round(d[1]), Math.round(d[2]));
        const bucket = Math.floor(h / 36);
        const count = buckets.get(bucket) || { count: 0, rgb: [d[0], d[1], d[2]] };
        count.count += 1;
        buckets.set(bucket, count);
      }
    }

    const colors = [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((v) => rgbToHex(v.rgb[0], v.rgb[1], v.rgb[2]));
    const swatches = containerEl.querySelector("#ce-art-swatches");
    if (!swatches) return;
    swatches.innerHTML = colors
      .map((color) => `<button class="ce-art-swatch" style="background:${color}" data-art-color="${color}" aria-label="Apply ${color}"></button>`)
      .join("");
    swatches.querySelectorAll("[data-art-color]").forEach((node) => {
      node.addEventListener("click", () => {
        if (!activeColorKey) return;
        const color = node.getAttribute("data-art-color");
        customState[activeColorKey] = color;
        const preview = containerEl.querySelector(`.ce-color-preview[data-color-key="${activeColorKey}"]`);
        const input = containerEl.querySelector(`.ce-color-hex[data-color-key="${activeColorKey}"]`);
        if (preview) preview.style.background = color;
        if (input) input.value = color;
        triggerChange();
      });
    });
  } catch (_error) {
    // non-fatal for tainted images or decode failures
  }
}

function rgbToH(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return (h * 60 + 360) % 360;
}
