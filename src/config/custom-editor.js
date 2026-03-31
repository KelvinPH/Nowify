export const CUSTOM_DEFAULTS = {
  direction: "row",
  cardWidth: 400,
  cardHeight: 80,
  cardRadius: 16,
  cardPadding: 14,
  blurAmount: 24,
  bgOpacity: 85,
  borderWidth: 0.5,
  borderColor: "rgba(255,255,255,0.12)",
  fontFamily: "system",
  titleSize: 14,
  artistSize: 12,
  titleWeight: "600",
  artistWeight: "400",
  contentAlign: "left",
  letterSpacing: 0,
  textShadow: false,
  artSize: 52,
  artShape: "rounded",
  artRadius: 10,
  artShadow: 0,
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
  customColors: false,
  colorBg: "#0a0a0a",
  colorAccent: "#1db954",
  colorTitle: "#ffffff",
  colorArtist: "rgba(255,255,255,0.5)",
  colorProgress: "#ffffff",
  colorBorder: "rgba(255,255,255,0.12)",
};

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
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
const LOCAL_PRESETS_KEY = "nowify_custom_presets";

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
          `<button class="ce-btn ${String(customState[key]) === String(opt.value) ? "ce-btn-active" : ""}" data-custom-key="${key}" data-custom-value="${opt.value}">${opt.label}</button>`
      )
      .join("")}
  </div>`;
}

function renderContainerPanel() {
  return `<div class="ce-section">
      <div class="ce-section-label">Direction</div>
      ${buttonGroup("direction", [
        { label: "Horizontal", value: "row" },
        { label: "Vertical", value: "column" },
      ])}
      ${sliderRow("Card width", "cardWidth", 80, 900, customState.cardWidth, "px")}
      ${sliderRow("Card height", "cardHeight", 40, 400, customState.cardHeight, "px")}
      ${sliderRow("Corner radius", "cardRadius", 0, 60, customState.cardRadius, "px")}
      ${sliderRow("Padding", "cardPadding", 4, 40, customState.cardPadding, "px")}
      ${sliderRow("Blur", "blurAmount", 0, 40, customState.blurAmount, "px")}
      ${sliderRow("Opacity", "bgOpacity", 0, 100, customState.bgOpacity, "%")}
      ${sliderRow("Border width", "borderWidth", 0, 4, customState.borderWidth, "px", "0.5")}
      <div class="ce-color-row"><span class="ce-color-label">Border colour</span>
        <div class="ce-color-picker-wrap">
          <div class="ce-color-preview" style="background:${customState.borderColor}" data-color-key="borderColor"></div>
          <input type="text" class="ce-color-hex" value="${customState.borderColor}" data-color-key="borderColor" />
        </div>
      </div>
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
    <div class="ce-section-label">Content alignment</div>
    ${buttonGroup("contentAlign", [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ])}
    ${toggleRow("Text shadow", "textShadow")}
  </div>`;
}

function renderArtPanel() {
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
    <div class="ce-color-row ce-conditional" data-condition="artBorder:true"><span class="ce-color-label">Art border colour</span>
      <div class="ce-color-picker-wrap">
        <div class="ce-color-preview" style="background:${customState.artBorderColor}" data-color-key="artBorderColor"></div>
        <input type="text" class="ce-color-hex" value="${customState.artBorderColor}" data-color-key="artBorderColor" />
      </div>
    </div>
  </div>`;
}

function renderContentPanel() {
  return `<div class="ce-section">
    <div class="ce-section-label">Content</div>
    ${toggleRow("Show artist", "showArtist")}
    ${toggleRow("Show album", "showAlbum")}
    ${toggleRow("Show progress bar", "showProgress")}
    ${sliderRow("Progress height", "progressHeight", 1, 8, customState.progressHeight, "px", "1", "showProgress:true")}
    ${toggleRow("Show remaining time", "showRemainingTime", "Shows time left instead of elapsed")}
    ${toggleRow("Show next track", "showNextTrack", "Requires Spotify queue permission")}
    <div class="ce-disclaimer">Enabling this adds the queue permission to your Spotify consent.
      If you've already connected, disconnect and reconnect Spotify
      in OBS to grant the new permission.
    </div>
    ${toggleRow("Show play state", "showPlayState", "Pulsing dot when track is playing")}
    ${toggleRow("Show BPM", "showBpm", "Tempo badge from Spotify audio features")}
  </div>`;
}

function renderColoursPanel() {
  return `<div class="ce-section">
    <div class="ce-section-label">Custom colours</div>
    ${toggleRow("Enable custom colours", "customColors", "When off, colours come from your selected theme")}
    <div class="ce-colours-section" style="${customState.customColors ? "" : "display:none;"}">
      ${renderColorPicker("Background", "colorBg")}
      ${renderColorPicker("Accent", "colorAccent")}
      ${renderColorPicker("Title text", "colorTitle")}
      ${renderColorPicker("Artist text", "colorArtist")}
      ${renderColorPicker("Progress bar", "colorProgress")}
      ${renderColorPicker("Border", "colorBorder")}
      <div class="ce-wheel-wrap" id="ce-color-wheel">
        <canvas id="ce-wheel-canvas" width="200" height="200"></canvas>
        <div class="ce-wheel-lightness"><input type="range" id="ce-lightness-slider" min="0" max="100" value="50" /></div>
        <div class="ce-wheel-active-label" id="ce-wheel-label">Select a colour above to edit</div>
      </div>
      <div class="ce-art-extract">
        <span class="ce-art-extract-label">Sample from album art</span>
        <div class="ce-art-swatches" id="ce-art-swatches"></div>
      </div>
    </div>
    <div class="ce-library">
      <div class="ce-section-label">Preset library</div>
      <div class="ce-library-actions">
        <button class="ce-btn" id="ce-refresh-library">Refresh public</button>
      </div>
      <div class="ce-library-subtitle">Your saved presets</div>
      <div class="ce-library-list" id="ce-library-local-list"></div>
      <div class="ce-library-subtitle">Public presets</div>
      <div class="ce-library-list" id="ce-library-list"></div>
    </div>
  </div>`;
}

function renderColorPicker(label, key) {
  const value = customState[key];
  return `<div class="ce-color-row">
    <span class="ce-color-label">${label}</span>
    <div class="ce-color-picker-wrap">
      <div class="ce-color-preview" style="background:${value}" data-color-key="${key}"></div>
      <input type="text" class="ce-color-hex" value="${value}" data-color-key="${key}" placeholder="#000000" />
    </div>
  </div>`;
}

function renderEditor(containerEl) {
  containerEl.innerHTML = `<div class="ce-shell">
    <div class="ce-tabs">
      ${renderTabButton("container", "Container", '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor"/></svg>', true)}
      ${renderTabButton("typography", "Typography", '<svg viewBox="0 0 24 24"><path d="M4 6h16v2h-7v10h-2V8H4z" fill="currentColor"/></svg>')}
      ${renderTabButton("art", "Art", '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor"/></svg>')}
      ${renderTabButton("content", "Content", '<svg viewBox="0 0 24 24"><path d="M6 7h12v2H6zm0 4h12v2H6zm0 4h8v2H6z" fill="currentColor"/></svg>')}
      ${renderTabButton("colours", "Colours", '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>')}
    </div>
    <div class="ce-panels">
      <div class="ce-panel ce-panel-active" data-panel="container">${renderContainerPanel()}</div>
      <div class="ce-panel" data-panel="typography">${renderTypographyPanel()}</div>
      <div class="ce-panel" data-panel="art">${renderArtPanel()}</div>
      <div class="ce-panel" data-panel="content">${renderContentPanel()}</div>
      <div class="ce-panel" data-panel="colours">${renderColoursPanel()}</div>
    </div>
  </div>`;
  attachListeners(containerEl);
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
  const seed = LAYOUT_SEEDS[seedLayout] || {};
  customState = { ...CUSTOM_DEFAULTS, ...seed };
  const saved = loadCustomState();
  if (saved) customState = { ...customState, ...saved };
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
  containerEl.querySelectorAll(".ce-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      containerEl.querySelectorAll(".ce-tab").forEach((t) => t.classList.toggle("ce-tab-active", t === tab));
      containerEl
        .querySelectorAll(".ce-panel")
        .forEach((p) => p.classList.toggle("ce-panel-active", p.dataset.panel === target));
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
      updateConditionals(containerEl);
      triggerChange();
    });
  });

  containerEl.querySelectorAll("[data-custom-key][data-custom-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.customKey;
      const value = btn.dataset.customValue;
      customState[key] = value;
      const siblings = containerEl.querySelectorAll(`[data-custom-key="${key}"][data-custom-value]`);
      siblings.forEach((s) => s.classList.toggle("ce-btn-active", s === btn));
      updateConditionals(containerEl);
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
      containerEl.querySelectorAll(".ce-color-preview").forEach((s) => s.classList.remove("ce-color-active"));
      swatch.classList.add("ce-color-active");
      const label = containerEl.querySelector("#ce-wheel-label");
      if (label) label.textContent = `Editing ${activeColorKey}`;
    });
  });

  setupColorWheel(containerEl);
  updateConditionals(containerEl);
  attachLibraryListeners(containerEl);
  refreshLibrary(containerEl);
  refreshLocalLibrary(containerEl);
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

function attachLibraryListeners(containerEl) {
  const refresh = containerEl.querySelector("#ce-refresh-library");
  if (refresh) {
    refresh.addEventListener("click", () => {
      refreshLibrary(containerEl);
    });
  }
}

function refreshLocalLibrary(containerEl) {
  const listEl = containerEl.querySelector("#ce-library-local-list");
  if (!listEl) return;
  let localPresets = [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    localPresets = Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    localPresets = [];
  }

  if (!localPresets.length) {
    listEl.innerHTML = '<div class="ce-library-empty">No local saved presets yet.</div>';
    return;
  }

  listEl.innerHTML = localPresets
    .slice()
    .reverse()
    .map(
      (p, idx) => `<div class="ce-library-row" data-local-idx="${idx}">
        <button class="ce-library-item ce-library-item-local" data-local-apply="${idx}">
          <span class="ce-library-name">${p.name || "Untitled"}</span>
          <span class="ce-library-meta">${p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "local"}</span>
        </button>
        <button class="ce-library-delete" data-local-delete="${idx}" title="Delete preset">Delete</button>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-local-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-local-apply"));
      const source = [...localPresets].reverse();
      const preset = source[i];
      if (!preset?.customState) return;
      customState = { ...CUSTOM_DEFAULTS, ...preset.customState };
      saveCustomState();
      renderEditor(containerEl);
      triggerChange();
    });
  });

  listEl.querySelectorAll("[data-local-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-local-delete"));
      const source = [...localPresets].reverse();
      const target = source[i];
      if (!target?.name) return;
      const kept = localPresets.filter((p) => p?.name !== target.name);
      localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(kept));
      refreshLocalLibrary(containerEl);
    });
  });
}

async function refreshLibrary(containerEl) {
  const listEl = containerEl.querySelector("#ce-library-list");
  if (!listEl) return;
  listEl.innerHTML = '<div class="ce-library-empty">Loading presets...</div>';
  try {
    const res = await fetch(`${WORKER_BASE_URL}/presets`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const presets = (data?.presets || []).filter((p) => p?.customState);
    if (!presets.length) {
      listEl.innerHTML = '<div class="ce-library-empty">No public custom presets yet.</div>';
      return;
    }
    listEl.innerHTML = presets
      .slice(0, 24)
      .map(
        (p) => `<button class="ce-library-item" data-preset-id="${p.id || ""}">
          <span class="ce-library-name">${p.name || "Untitled"}</span>
          <span class="ce-library-meta">by ${p.author || "anonymous"}</span>
        </button>`
      )
      .join("");
    listEl.querySelectorAll(".ce-library-item").forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        const selected = presets[idx];
        if (!selected?.customState) return;
        customState = { ...CUSTOM_DEFAULTS, ...selected.customState };
        saveCustomState();
        renderEditor(containerEl);
        triggerChange();
      });
    });
  } catch (_error) {
    listEl.innerHTML = '<div class="ce-library-empty">Could not load public presets.</div>';
  }
}

function formatSliderValue(key, value, unit) {
  if (key === "letterSpacing") return `${(Number(value) / 100).toFixed(2)}em`;
  if (key === "artShadow") return ["None", "Soft", "Medium", "Strong"][Number(value)] || "None";
  return `${value}${unit || ""}`;
}

function updateSliderLabel(input) {
  const valueEl = input.closest(".ce-slider-right")?.querySelector(".ce-slider-value");
  if (!valueEl) return;
  valueEl.textContent = formatSliderValue(input.dataset.customKey, input.value, input.dataset.unit || "");
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
