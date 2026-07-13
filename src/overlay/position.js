/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

export const POSITION_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const POSITION_ANCHOR_LABELS = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "center-left": "Center left",
  center: "Center",
  "center-right": "Center right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
};

export const POSITION_ANCHOR_ICONS = {
  "top-left": "fa-solid fa-arrow-up-left",
  "top-center": "fa-solid fa-arrow-up",
  "top-right": "fa-solid fa-arrow-up-right",
  "center-left": "fa-solid fa-arrow-left",
  center: "fa-solid fa-circle",
  "center-right": "fa-solid fa-arrow-right",
  "bottom-left": "fa-solid fa-arrow-down-left",
  "bottom-center": "fa-solid fa-arrow-down",
  "bottom-right": "fa-solid fa-arrow-down-right",
};

const POSITION_ANCHOR_SET = new Set(POSITION_ANCHORS);

export function isValidPositionAnchor(anchor) {
  return POSITION_ANCHOR_SET.has(anchor);
}

export function isCenterAnchor(anchor) {
  return anchor === "center";
}

/** Pixel top/left for a widget footprint on a canvas of known size. */
export function computeBlockPosition(
  anchor,
  offsetX,
  offsetY,
  canvasW,
  canvasH,
  blockW,
  blockH
) {
  const ox = Math.max(0, Number(offsetX) || 0);
  const oy = Math.max(0, Number(offsetY) || 0);
  let left = 0;
  let top = 0;

  switch (anchor) {
    case "top-left":
      left = ox;
      top = oy;
      break;
    case "top-right":
      left = canvasW - blockW - ox;
      top = oy;
      break;
    case "bottom-left":
      left = ox;
      top = canvasH - blockH - oy;
      break;
    case "bottom-right":
      left = canvasW - blockW - ox;
      top = canvasH - blockH - oy;
      break;
    case "top-center":
      left = (canvasW - blockW) / 2;
      top = oy;
      break;
    case "bottom-center":
      left = (canvasW - blockW) / 2;
      top = canvasH - blockH - oy;
      break;
    case "center-left":
      left = ox;
      top = (canvasH - blockH) / 2;
      break;
    case "center-right":
      left = canvasW - blockW - ox;
      top = (canvasH - blockH) / 2;
      break;
    case "center":
    default:
      left = (canvasW - blockW) / 2;
      top = (canvasH - blockH) / 2;
      break;
  }

  return {
    left: Math.max(0, Math.round(left)),
    top: Math.max(0, Math.round(top)),
  };
}

function clearPositionStyles(el) {
  el.style.position = "";
  el.style.top = "";
  el.style.right = "";
  el.style.bottom = "";
  el.style.left = "";
  el.style.transform = "";
  el.style.margin = "";
}

/** Applies fixed anchor positioning to the overlay widget root. */
export function applyWidgetPositionStyles(el, anchor, offsetX, offsetY) {
  if (!el || !isValidPositionAnchor(anchor)) {
    if (el) {
      clearPositionStyles(el);
    }
    return;
  }

  el.style.position = "fixed";
  el.style.margin = "0";
  el.style.top = "auto";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.left = "auto";
  el.style.transform = "";

  const ox = Math.max(0, Number(offsetX) || 0);
  const oy = Math.max(0, Number(offsetY) || 0);

  switch (anchor) {
    case "top-left":
      el.style.top = `${oy}px`;
      el.style.left = `${ox}px`;
      break;
    case "top-right":
      el.style.top = `${oy}px`;
      el.style.right = `${ox}px`;
      break;
    case "bottom-left":
      el.style.bottom = `${oy}px`;
      el.style.left = `${ox}px`;
      break;
    case "bottom-right":
      el.style.bottom = `${oy}px`;
      el.style.right = `${ox}px`;
      break;
    case "top-center":
      el.style.top = `${oy}px`;
      el.style.left = "50%";
      el.style.transform = "translateX(-50%)";
      break;
    case "bottom-center":
      el.style.bottom = `${oy}px`;
      el.style.left = "50%";
      el.style.transform = "translateX(-50%)";
      break;
    case "center-left":
      el.style.left = `${ox}px`;
      el.style.top = "50%";
      el.style.transform = "translateY(-50%)";
      break;
    case "center-right":
      el.style.right = `${ox}px`;
      el.style.top = "50%";
      el.style.transform = "translateY(-50%)";
      break;
    case "center":
      el.style.top = "50%";
      el.style.left = "50%";
      el.style.transform = "translate(-50%, -50%)";
      break;
    default:
      clearPositionStyles(el);
  }
}

export function getWidgetRoot() {
  const app = document.getElementById("app");
  if (!app) {
    return null;
  }
  return app.querySelector(
    ".nw-overlay, .vl-wrap, .tm-wrap, .cs-wrap, .gb-wrap, .hud-wrap, .sn-wrap, .sc-wrap"
  );
}

export function applyConfiguratorPreviewLayout() {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }
  app.style.display = "flex";
  app.style.alignItems = "center";
  app.style.justifyContent = "center";
  app.style.width = "100%";
  app.style.height = "100%";
  app.style.padding = "0";
  app.style.boxSizing = "border-box";
  app.style.overflow = "hidden";
}

export function applyWidgetPositionFromConfig(config) {
  const root = getWidgetRoot();
  if (!root) {
    return;
  }
  if (config?.cfgPreview) {
    clearPositionStyles(root);
    applyConfiguratorPreviewLayout();
    return;
  }
  if (!config?.positionAnchor || !isValidPositionAnchor(config.positionAnchor)) {
    clearPositionStyles(root);
    return;
  }
  applyWidgetPositionStyles(
    root,
    config.positionAnchor,
    config.positionOffsetX,
    config.positionOffsetY
  );
}

/** Plain-language placement line for the OBS setup guide. */
export function formatPositionGuide(anchor, offsetX, offsetY) {
  if (!isValidPositionAnchor(anchor)) {
    return "";
  }
  const ox = Math.max(0, Number(offsetX) || 0);
  const oy = Math.max(0, Number(offsetY) || 0);
  const readable = anchor.replace(/-/g, " ");

  let detail = readable;
  if (anchor === "center") {
    detail = "center of the canvas";
  } else if (
    anchor === "top-left" ||
    anchor === "top-right" ||
    anchor === "bottom-left" ||
    anchor === "bottom-right"
  ) {
    detail =
      ox === oy
        ? `${readable}, ${ox}px from each edge`
        : `${readable}, ${ox}px horizontal / ${oy}px vertical from the edges`;
  } else if (anchor === "top-center" || anchor === "bottom-center") {
    detail = `${readable}, ${oy}px from the ${anchor.startsWith("top") ? "top" : "bottom"}`;
  } else if (anchor === "center-left" || anchor === "center-right") {
    detail = `${readable}, ${ox}px from the ${anchor.endsWith("left") ? "left" : "right"}`;
  }

  return `Positioned: ${detail} — move the Browser Source in OBS to match. This is guidance only; OBS Browser Sources are not controlled from this page.`;
}
