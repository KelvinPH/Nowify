/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import {
  estimateObsBrowserSourceSize,
  formatObsSizeLabel,
  layoutSupportsCanvasPlacement,
  OBS_CANVAS_PRESETS,
} from "./obs-layout-sizes.js";
import {
  computeBlockPosition,
  isCenterAnchor,
  POSITION_ANCHOR_ICONS,
  POSITION_ANCHOR_LABELS,
  POSITION_ANCHORS,
} from "../overlay/position.js";

const STORAGE_KEY = "nowify_obs_canvas";
const PRIMARY_PREVIEW_WIDTH = 900;
const PRIMARY_PREVIEW_HEIGHT = 360;

let canvasState = { presetId: "1080p", width: 1920, height: 1080 };
let minimapResizeObserver = null;
let boundState = null;
let linkBound = false;
let placementBound = false;
let onPositionChange = null;

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

function blockRadiusForLayout(layout) {
  if (layout === "pill") return "999px";
  if (layout === "spotifycard") return "2px";
  if (layout === "stickynote") return "2px 12px 12px 2px";
  return "6px";
}

function getPositionFromState(state) {
  return {
    anchor: state?.positionAnchor || "bottom-left",
    offsetX: Number(state?.positionOffsetX) || 40,
    offsetY: Number(state?.positionOffsetY) || 40,
  };
}

function styleFootprintBlock(block, state, canvasDisplayW, canvasDisplayH, canvasW, canvasH) {
  if (!block) return;

  const obsSize = estimateObsBrowserSourceSize(state || boundState || {});
  const { anchor, offsetX, offsetY } = getPositionFromState(state || boundState || {});

  const blockDisplayW = (obsSize.width / canvasW) * canvasDisplayW;
  const blockDisplayH = (obsSize.height / canvasH) * canvasDisplayH;
  const { left, top } = computeBlockPosition(
    anchor,
    offsetX,
    offsetY,
    canvasDisplayW,
    canvasDisplayH,
    blockDisplayW,
    blockDisplayH
  );

  block.style.width = `${Math.max(4, blockDisplayW)}px`;
  block.style.height = `${Math.max(3, blockDisplayH)}px`;
  block.style.left = `${left}px`;
  block.style.top = `${top}px`;
  block.style.borderRadius = blockRadiusForLayout(boundState?.layout || "glasscard");
  block.title = `Overlay footprint ≈ ${obsSize.width}×${obsSize.height} px`;
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
  if (!iframe) return;

  iframe.style.width = `${PRIMARY_PREVIEW_WIDTH}px`;
  iframe.style.height = `${PRIMARY_PREVIEW_HEIGHT}px`;
  iframe.style.transform = "none";
  iframe.style.position = "relative";
  iframe.style.top = "";
  iframe.style.left = "";
}

function fitMinimapCanvas() {
  const scaler = document.getElementById("cfg-obs-minimap-scaler");
  const canvas = document.getElementById("cfg-obs-canvas");
  if (!scaler || !canvas) return;

  const pad = 12;
  const maxW = Math.max(160, scaler.clientWidth - pad * 2);
  const maxH = Math.max(72, scaler.clientHeight - pad * 2);
  const { width: cw, height: ch } = getCanvasSize();
  const scale = Math.min(maxW / cw, maxH / ch);
  const displayW = Math.max(1, Math.round(cw * scale));
  const displayH = Math.max(1, Math.round(ch * scale));

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
}

function patchPlacementVisibility(state) {
  const supported = layoutSupportsCanvasPlacement(state?.layout);
  const controls = document.querySelector(".cfg-obs-placement-controls");
  const minimap = document.getElementById("cfg-obs-minimap");

  controls?.toggleAttribute("hidden", !supported);
  minimap?.classList.toggle("cfg-obs-minimap--no-placement", !supported);
}
function hydratePlacementControls(state) {
  patchPlacementVisibility(state);
  if (!layoutSupportsCanvasPlacement(state?.layout)) {
    return;
  }
  const grid = document.querySelector("#cfg-obs-minimap .cfg-anchor-grid");
  if (grid && !grid.querySelector("[data-set-key='positionAnchor']")) {
    grid.innerHTML = renderAnchorGrid(state);
  }
  patchPositionPanel(state);
}

function patchPositionPanel(state) {
  const anchor = state?.positionAnchor || "bottom-left";
  document.querySelectorAll("#cfg-obs-minimap [data-set-key='positionAnchor']").forEach((btn) => {
    btn.classList.toggle("cfg-active", btn.getAttribute("data-set-value") === anchor);
  });

  const offsetWrap = document.getElementById("cfg-position-offsets");
  if (offsetWrap) {
    offsetWrap.hidden = isCenterAnchor(anchor);
  }

  const ox = document.getElementById("ctrl-positionOffsetX");
  const oy = document.getElementById("ctrl-positionOffsetY");
  if (ox && document.activeElement !== ox) {
    ox.value = String(state?.positionOffsetX ?? 40);
  }
  if (oy && document.activeElement !== oy) {
    oy.value = String(state?.positionOffsetY ?? 40);
  }
}

function applyMinimapLayout(state) {
  const block = document.getElementById("cfg-obs-overlay-block");
  const label = document.getElementById("cfg-obs-size-label");
  const canvas = document.getElementById("cfg-obs-canvas");
  if (!block || !canvas) return;

  const canvasSize = getCanvasSize();
  const obsSize = estimateObsBrowserSourceSize(state || boundState || {});
  boundState = state || boundState;

  fitMinimapCanvas();

  styleFootprintBlock(
    block,
    boundState,
    canvas.clientWidth,
    canvas.clientHeight,
    canvasSize.width,
    canvasSize.height
  );

  if (!layoutSupportsCanvasPlacement(boundState?.layout)) {
    block.style.left = `${Math.round((canvas.clientWidth - block.offsetWidth) / 2)}px`;
    block.style.top = `${Math.round((canvas.clientHeight - block.offsetHeight) / 2)}px`;
  }

  if (label) {
    label.textContent = formatObsSizeLabel(obsSize, canvasSize);
  }

  patchPositionPanel(boundState);
}

function bindPlacementPanel() {
  const panel = document.getElementById("cfg-obs-minimap");
  if (!panel || placementBound) return;
  placementBound = true;

  panel.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-set-key="positionAnchor"]');
    if (!btn || !panel.contains(btn)) return;
    const value = btn.getAttribute("data-set-value");
    if (!value) return;
    const next = { ...(boundState || {}), positionAnchor: value };
    patchPositionPanel(next);
    applyMinimapLayout(next);
    onPositionChange?.({ positionAnchor: value });
  });

  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "ctrl-positionOffsetX") {
      const offset = Math.max(0, Number(target.value) || 0);
      const next = { ...(boundState || {}), positionOffsetX: offset };
      applyMinimapLayout(next);
      onPositionChange?.({ positionOffsetX: offset });
    }
    if (target.id === "ctrl-positionOffsetY") {
      const offset = Math.max(0, Number(target.value) || 0);
      const next = { ...(boundState || {}), positionOffsetY: offset };
      applyMinimapLayout(next);
      onPositionChange?.({ positionOffsetY: offset });
    }
  });
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
  if (!scaler) return;
  if (!minimapResizeObserver) {
    minimapResizeObserver = new ResizeObserver(() => {
      applyMinimapLayout(boundState);
    });
  }
  minimapResizeObserver.disconnect();
  minimapResizeObserver.observe(scaler);
}

function renderAnchorGrid(state) {
  const anchor = state?.positionAnchor || "bottom-left";
  return POSITION_ANCHORS.map((id) => {
    const label = POSITION_ANCHOR_LABELS[id] || id;
    const icon = POSITION_ANCHOR_ICONS[id] || "fa-solid fa-circle";
    return `<button type="button" class="cfg-anchor-cell ${anchor === id ? "cfg-active" : ""}" data-set-key="positionAnchor" data-set-value="${id}" aria-label="${label}" title="${label}"><i class="${icon}" aria-hidden="true"></i></button>`;
  }).join("");
}

function renderOffsetControls(state) {
  const hidden = isCenterAnchor(state?.positionAnchor || "bottom-left");
  return `<div id="cfg-position-offsets" class="cfg-position-offsets"${hidden ? " hidden" : ""}>
    <label class="cfg-position-offset-field">
      <span class="cfg-position-offset-label">X offset</span>
      <input type="number" id="ctrl-positionOffsetX" class="cfg-input-inline cfg-value-mono cfg-position-offset-input" min="0" max="2000" value="${state?.positionOffsetX ?? 40}" aria-label="Horizontal offset in pixels" />
    </label>
    <label class="cfg-position-offset-field">
      <span class="cfg-position-offset-label">Y offset</span>
      <input type="number" id="ctrl-positionOffsetY" class="cfg-input-inline cfg-value-mono cfg-position-offset-input" min="0" max="2000" value="${state?.positionOffsetY ?? 40}" aria-label="Vertical offset in pixels" />
    </label>
  </div>`;
}

/** HTML for the configurator preview column (primary preview + canvas minimap). */
export function getConfiguratorPreviewHtml(state = {}) {
  const presetButtons = OBS_CANVAS_PRESETS.map(
    (p) =>
      `<button type="button" class="cfg-btn cfg-sm-btn${p.id === "1080p" ? " cfg-active" : ""}" data-canvas-preset="${p.id}">${p.label}</button>`
  ).join("");

  return `
    <div id="cfg-preview-primary" class="cfg-preview-primary">
      <div class="cfg-preview-panel-head">
        <span class="cfg-preview-panel-label">Card design · zoomed</span>
      </div>
      <div id="cfg-preview-frame-wrap">
        <iframe id="cfg-iframe" src="./overlay.html" frameborder="0" title="Overlay preview"></iframe>
      </div>
    </div>
    <section id="cfg-obs-minimap" class="cfg-obs-minimap" aria-label="OBS canvas placement">
      <div class="cfg-obs-minimap-head">
        <div class="cfg-obs-minimap-head-top">
          <span class="cfg-obs-minimap-title">Canvas placement</span>
          <span id="cfg-obs-size-label" class="cfg-obs-size-label"></span>
        </div>
        <div id="cfg-obs-canvas-toolbar" class="cfg-obs-canvas-toolbar">
          <div class="cfg-obs-canvas-presets">${presetButtons}</div>
          <div id="cfg-obs-canvas-custom" class="cfg-obs-canvas-custom" hidden>
            <input id="cfg-obs-canvas-w" class="cfg-input cfg-obs-canvas-input" type="number" min="320" max="7680" value="1920" aria-label="Canvas width" />
            <span class="cfg-obs-canvas-times">×</span>
            <input id="cfg-obs-canvas-h" class="cfg-input cfg-obs-canvas-input" type="number" min="180" max="4320" value="1080" aria-label="Canvas height" />
          </div>
        </div>
      </div>
      <div class="cfg-obs-placement-body">
        <div id="cfg-obs-minimap-scaler" class="cfg-obs-minimap-scaler">
          <div id="cfg-obs-canvas" class="cfg-obs-canvas">
            <div id="cfg-obs-overlay-block" class="cfg-obs-overlay-block" tabindex="0" role="img" aria-label="Overlay footprint on stream canvas"></div>
          </div>
        </div>
        <div class="cfg-obs-placement-controls">
          <p class="cfg-placement-controls-label">Position on stream</p>
          <div class="cfg-placement-controls-inner">
            <div class="cfg-anchor-grid" role="group" aria-label="Overlay anchor on stream canvas">${renderAnchorGrid(state)}</div>
            ${renderOffsetControls(state)}
          </div>
        </div>
      </div>
    </section>
    <div id="cfg-preview-bar">
      <div class="cfg-preview-url-wrap">
        <span id="cfg-url-display" class="cfg-preview-url-text"></span>
      </div>
      <button type="button" id="btn-copy-bar" class="cfg-preview-copy-btn" aria-label="Copy URL" title="Copy URL">
        <i class="fa-regular fa-copy" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

export function initObsCanvasPreview(state, options = {}) {
  if (minimapResizeObserver) {
    minimapResizeObserver.disconnect();
  }
  linkBound = false;
  placementBound = false;
  onPositionChange = options.onPositionChange || null;
  loadCanvasState();
  boundState = state;
  hydratePlacementControls(state);
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
  bindPlacementPanel();
  applyMinimapLayout(state);
}

export function updateObsCanvasPreview(state) {
  boundState = state;
  hydratePlacementControls(state);
  applyMinimapLayout(state);
}
