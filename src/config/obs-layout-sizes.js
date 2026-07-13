/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

/** Common OBS stream/output resolutions. */
export const OBS_CANVAS_PRESETS = [
  { id: "1080p", label: "1920×1080", width: 1920, height: 1080 },
  { id: "720p", label: "1280×720", width: 1280, height: 720 },
  { id: "custom", label: "Custom", width: 1920, height: 1080 },
];

const STORAGE_KEY = "nowify_obs_canvas";

function readCustomLayout() {
  try {
    const raw = localStorage.getItem("nowify_custom_layout");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function extraTextRows(state) {
  let rows = 0;
  if (state.showAlbum) rows += 1;
  if (state.showBpm) rows += 1;
  if (state.showNextTrack) rows += 1;
  if (state.showPlayState) rows += 1;
  return rows * 14;
}

/**
 * Approximate OBS Browser Source width × height for the current layout.
 * These are planning values for the configurator — not URL params.
 */
export function estimateObsBrowserSourceSize(state) {
  const layout = state?.layout || "glasscard";
  const maxW = Number(state?.maxCardWidth) || 900;
  const extra = extraTextRows(state);
  const progressH = state?.showProgress !== false ? 18 : 0;

  if (layout === "custom") {
    const custom = readCustomLayout();
    const cardW = Number(custom?.maxCardWidth ?? custom?.cardWidth) || 400;
    const cardH = Number(custom?.cardHeight) || 80;
    const pad = Number(custom?.cardPadding) || 14;
    return {
      width: Math.min(Math.round(cardW), maxW),
      height: Math.round(cardH + pad * 2),
    };
  }

  const sizes = {
    glasscard: { width: 520, height: 80 + progressH + extra },
    pill: { width: 340, height: 54 },
    island: { width: 200, height: 180 + progressH + extra },
    strip: { width: 720, height: 48 },
    albumfocus: { width: 210, height: 220 + progressH },
    sidebar: { width: 100, height: 200 + progressH },
    vinyl: { width: 480, height: 280 },
    terminal: { width: 520, height: 260 },
    cassette: { width: 400, height: 200 },
    gameboy: { width: 320, height: 300 },
    hud: { width: 520, height: 140 },
    stickynote: { width: 280, height: 220 },
    spotifycard: { width: 900, height: 394 },
  };

  const base = sizes[layout] || sizes.glasscard;
  return {
    width: Math.min(base.width, maxW),
    height: base.height,
  };
}

export function formatObsSizeLabel(obsSize, canvasSize) {
  return `${obsSize.width}×${obsSize.height} source · ${canvasSize.width}×${canvasSize.height} canvas`;
}

/** Compact widget layouts where stream-canvas anchor placement is meaningful in OBS. */
const CANVAS_PLACEMENT_LAYOUTS = new Set([
  "pill",
  "island",
  "albumfocus",
  "sidebar",
  "vinyl",
  "terminal",
  "cassette",
  "gameboy",
  "hud",
  "stickynote",
  "custom",
]);

export function layoutSupportsCanvasPlacement(layout) {
  return CANVAS_PLACEMENT_LAYOUTS.has(layout || "glasscard");
}
