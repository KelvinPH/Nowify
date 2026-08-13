/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

/** Centers the overlay widget inside the configurator preview iframe. */
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

function getWidgetRoot() {
  const app = document.getElementById("app");
  if (!app) {
    return null;
  }
  return app.querySelector(
    ".nw-overlay, .vl-wrap, .tm-wrap, .cs-wrap, .gb-wrap, .hud-wrap, .sn-wrap, .sc-wrap"
  );
}

function clearPositionStyles(el) {
  if (!el) return;
  el.style.position = "";
  el.style.top = "";
  el.style.right = "";
  el.style.bottom = "";
  el.style.left = "";
  el.style.transform = "";
  el.style.margin = "";
}

/** Configurator preview only — centers the card. OBS placement is done by dragging the Browser Source. */
export function applyWidgetPositionFromConfig(config) {
  const root = getWidgetRoot();
  if (!root) {
    return;
  }
  clearPositionStyles(root);
  if (config?.cfgPreview) {
    applyConfiguratorPreviewLayout();
  }
}
