/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import {
  estimateObsBrowserSourceSize,
  formatObsSizeLabel,
  OBS_CANVAS_PRESETS,
} from "./obs-layout-sizes.js";

const STORAGE_KEY = "nowify_obs_canvas";
const PRIMARY_PREVIEW_WIDTH = 900;
const PRIMARY_PREVIEW_HEIGHT = 300;

let canvasState = { presetId: "1080p", width: 1920, height: 1080 };
let resizeObserver = null;
let boundState = null;
let linkBound = false;

const THEME_BLOCK_COLORS = {
  obsidian: "rgba(200,200,200,0.85)",
  midnight: "rgba(74,158,255,0.85)",
  aurora: "rgba(180,100,255,0.85)",
  forest: "rgba(80,200,120,0.85)",
  amber: "rgba(255,170,70,0.85)",
  glass: "rgba(255,255,255,0.55)",
  spotify: "rgba(29,185,84,0.85)",
  minimal: "rgba(255,255,255,0.7)",
  neon: "rgba(0,255,200,0.75)",
  lofi: "rgba(220,180,140,0.8)",
  dark: "rgba(160,160,160,0.8)",
};

function loadCanvasState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const preset = OBS_CANVAS_PRESETS.find((p) => p.id === parsed.presetId);
    canvasState = {
      presetId: parsed.presetId || "1080p",
      width: Math.max(320, Number(parsed.width) || preset?.width || 1920),
      height: Math.max(180, Number(parsed.height) || preset?.height || 1080),
    };
  } catch (_error) {
    /* ignore */
  }
}

function saveCanvasState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(canvasState));
  } catch (_error) {
    /* ignore */
  }
}

function getCanvasSize() {
  return { width: canvasState.width, height: canvasState.height };
}

function blockColorForState(state) {
  const theme = state?.theme || "obsidian";
  return THEME_BLOCK_COLORS[theme] || "rgba(29,185,84,0.85)";
}

function blockRadiusForLayout(layout) {
  if (layout === "pill") return "999px";
  if (layout === "spotifycard") return "2px";
  if (layout === "stickynote") return "2px 12px 12px 2px";
  return "6px";
}

function setPreviewLink(active) {
  const primary = document.getElementById("cfg-preview-primary");
  const block = document.getElementById("cfg-obs-overlay-block");
  primary?.classList.toggle("cfg-preview-linked", active);
  block?.classList.toggle("cfg-minimap-block-linked", active);
}

function bindPreviewLink() {
  if (linkBound) return;
  const primary = document.getElementById("cfg-preview-primary");
  const block = document.getElementById("cfg-obs-overlay-block");
  if (!primary || !block) return;
  linkBound = true;

  block.addEventListener("mouseenter", () => setPreviewLink(true));
  block.addEventListener("mouseleave", () => setPreviewLink(false));
  block.addEventListener("focus", () => setPreviewLink(true));
  block.addEventListener("blur", () => setPreviewLink(false));

  primary.addEventListener("mouseenter", () => setPreviewLink(true));
  primary.addEventListener("mouseleave", () => setPreviewLink(false));
}

function applyPrimaryPreview() {
  const iframe = document.getElementById("cfg-iframe");
  const wrap = document.getElementById("cfg-preview-frame-wrap");
  if (!iframe) return;

  iframe.style.width = `${PRIMARY_PREVIEW_WIDTH}px`;
  iframe.style.height = `${PRIMARY_PREVIEW_HEIGHT}px`;
  iframe.style.transform = "none";
  iframe.style.position = "relative";
  iframe.style.top = "";
  iframe.style.left = "";

  if (wrap) {
    wrap.style.width = "";
    wrap.style.height = "";
  }
}

function fitMinimapCanvas() {
  const scaler = document.getElementById("cfg-obs-minimap-scaler");
  const canvas = document.getElementById("cfg-obs-canvas");
  if (!scaler || !canvas) return;

  const pad = 12;
  const maxW = Math.max(100, scaler.clientWidth - pad * 2);
  const maxH = Math.max(60, scaler.clientHeight - pad * 2);
  const { width: cw, height: ch } = getCanvasSize();
  const scale = Math.min(maxW / cw, maxH / ch);
  const displayW = Math.max(1, Math.round(cw * scale));
  const displayH = Math.max(1, Math.round(ch * scale));

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
}

function applyMinimapLayout(state) {
  const block = document.getElementById("cfg-obs-overlay-block");
  const label = document.getElementById("cfg-obs-size-label");
  const canvas = document.getElementById("cfg-obs-canvas");
  const tag = document.querySelector(".cfg-obs-canvas-tag");
  if (!block || !canvas) return;

  const canvasSize = getCanvasSize();
  const obsSize = estimateObsBrowserSourceSize(state || boundState || {});
  boundState = state || boundState;

  if (tag) {
    tag.textContent = `${canvasSize.width}×${canvasSize.height}`;
  }

  fitMinimapCanvas();

  const blockDisplayW = (obsSize.width / canvasSize.width) * canvas.clientWidth;
  const blockDisplayH = (obsSize.height / canvasSize.height) * canvas.clientHeight;

  block.style.width = `${Math.max(4, blockDisplayW)}px`;
  block.style.height = `${Math.max(3, blockDisplayH)}px`;
  block.style.left = "0";
  block.style.top = "0";
  block.style.background = `linear-gradient(135deg, ${blockColorForState(boundState)}, rgba(0,0,0,0.25))`;
  block.style.borderRadius = blockRadiusForLayout(boundState?.layout || "glasscard");
  block.title = `Overlay footprint ≈ ${obsSize.width}×${obsSize.height} px`;

  if (label) {
    label.textContent = formatObsSizeLabel(obsSize, canvasSize);
  }
}

function setCustomFieldsVisible(show) {
  const custom = document.getElementById("cfg-obs-canvas-custom");
  if (custom) {
    custom.hidden = !show;
  }
}

function bindToolbar() {
  const toolbar = document.getElementById("cfg-obs-canvas-toolbar");
  if (!toolbar || toolbar.dataset.bound === "1") return;
  toolbar.dataset.bound = "1";

  toolbar.querySelectorAll("[data-canvas-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-canvas-preset");
      const preset = OBS_CANVAS_PRESETS.find((p) => p.id === id);
      if (!preset) return;

      canvasState.presetId = id;
      if (id !== "custom") {
        canvasState.width = preset.width;
        canvasState.height = preset.height;
      }
      saveCanvasState();

      toolbar.querySelectorAll("[data-canvas-preset]").forEach((el) => {
        el.classList.toggle("cfg-active", el.getAttribute("data-canvas-preset") === id);
      });
      setCustomFieldsVisible(id === "custom");

      const wInput = document.getElementById("cfg-obs-canvas-w");
      const hInput = document.getElementById("cfg-obs-canvas-h");
      if (wInput) wInput.value = String(canvasState.width);
      if (hInput) hInput.value = String(canvasState.height);

      applyMinimapLayout(boundState);
    });
  });

  const wInput = document.getElementById("cfg-obs-canvas-w");
  const hInput = document.getElementById("cfg-obs-canvas-h");
  const applyCustom = () => {
    if (canvasState.presetId !== "custom") return;
    canvasState.width = Math.max(320, Number(wInput?.value) || 1920);
    canvasState.height = Math.max(180, Number(hInput?.value) || 1080);
    saveCanvasState();
    applyMinimapLayout(boundState);
  };
  wInput?.addEventListener("change", applyCustom);
  hInput?.addEventListener("change", applyCustom);
}

function observeMinimap() {
  const scaler = document.getElementById("cfg-obs-minimap-scaler");
  if (!scaler || resizeObserver) return;
  resizeObserver = new ResizeObserver(() => {
    applyMinimapLayout(boundState);
  });
  resizeObserver.observe(scaler);
}

/** HTML for the configurator preview column (primary preview + canvas minimap). */
export function getConfiguratorPreviewHtml() {
  const presetButtons = OBS_CANVAS_PRESETS.map(
    (p) =>
      `<button type="button" class="cfg-btn cfg-sm-btn${p.id === "1080p" ? " cfg-active" : ""}" data-canvas-preset="${p.id}">${p.label}</button>`
  ).join("");

  return `
    <div id="cfg-preview-primary" class="cfg-preview-primary">
      <div id="cfg-preview-frame-wrap">
        <iframe id="cfg-iframe" src="./overlay.html" frameborder="0" title="Overlay preview"></iframe>
      </div>
    </div>
    <section id="cfg-obs-minimap" class="cfg-obs-minimap" aria-label="OBS canvas placement">
      <div class="cfg-obs-minimap-head">
        <span class="cfg-obs-minimap-title">Canvas placement</span>
        <div id="cfg-obs-canvas-toolbar" class="cfg-obs-canvas-toolbar">
          <div class="cfg-obs-canvas-presets">${presetButtons}</div>
          <div id="cfg-obs-canvas-custom" class="cfg-obs-canvas-custom" hidden>
            <input id="cfg-obs-canvas-w" class="cfg-input cfg-obs-canvas-input" type="number" min="320" max="7680" value="1920" aria-label="Canvas width" />
            <span class="cfg-obs-canvas-times">×</span>
            <input id="cfg-obs-canvas-h" class="cfg-input cfg-obs-canvas-input" type="number" min="180" max="4320" value="1080" aria-label="Canvas height" />
          </div>
        </div>
        <span id="cfg-obs-size-label" class="cfg-obs-size-label"></span>
      </div>
      <div id="cfg-obs-minimap-scaler" class="cfg-obs-minimap-scaler">
        <div id="cfg-obs-canvas" class="cfg-obs-canvas">
          <span class="cfg-obs-canvas-tag">1920×1080</span>
          <div id="cfg-obs-overlay-block" class="cfg-obs-overlay-block" tabindex="0" role="img" aria-label="Overlay footprint on stream canvas"></div>
        </div>
      </div>
    </section>
    <p id="cfg-obs-workflow-hint" class="cfg-obs-workflow-hint">
      Copy URL and paste into an OBS Browser Source at the size shown in the canvas placement minimap.
    </p>
    <div id="cfg-preview-bar">
      <span id="cfg-url-display"></span>
    </div>
  `;
}

export function initObsCanvasPreview(state) {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  linkBound = false;
  loadCanvasState();
  boundState = state;
  setCustomFieldsVisible(canvasState.presetId === "custom");

  const toolbar = document.getElementById("cfg-obs-canvas-toolbar");
  if (toolbar) {
    toolbar.querySelectorAll("[data-canvas-preset]").forEach((btn) => {
      btn.classList.toggle(
        "cfg-active",
        btn.getAttribute("data-canvas-preset") === canvasState.presetId
      );
    });
  }

  const wInput = document.getElementById("cfg-obs-canvas-w");
  const hInput = document.getElementById("cfg-obs-canvas-h");
  if (wInput) wInput.value = String(canvasState.width);
  if (hInput) hInput.value = String(canvasState.height);

  applyPrimaryPreview();
  bindToolbar();
  observeMinimap();
  bindPreviewLink();
  applyMinimapLayout(state);
}

export function updateObsCanvasPreview(state) {
  boundState = state;
  applyPrimaryPreview();
  applyMinimapLayout(state);
}
