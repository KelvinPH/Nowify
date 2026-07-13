/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import { PREVIEW_DEBOUNCE_MS } from "./constants.js";

let previewReloadTimer = null;

/** Short path+query for the footer; full URL kept in data-full-url for copy. */
export function setConfiguratorUrlDisplay(url) {
  const el = document.getElementById("cfg-url-display");
  if (!el) return;
  el.dataset.fullUrl = url;
  try {
    const parsed = new URL(url, window.location.href);
    el.textContent = `${parsed.pathname.replace(/^\//, "")}${parsed.search}`;
  } catch (_error) {
    el.textContent = url;
  }
}

export function getConfiguratorUrlForCopy() {
  const el = document.getElementById("cfg-url-display");
  return el?.dataset.fullUrl?.trim() || el?.textContent?.trim() || "";
}

export function buildPreviewUrl(state, copyUrl) {
  const parsed = new URL(copyUrl, window.location.href);
  // Card-design iframe: natural centered layout — placement is shown in the minimap only.
  parsed.searchParams.delete("positionAnchor");
  parsed.searchParams.delete("positionOffsetX");
  parsed.searchParams.delete("positionOffsetY");
  parsed.searchParams.set("cfgPreview", "1");
  if (state.previewDemo) {
    parsed.searchParams.set("demo", "1");
  } else {
    parsed.searchParams.delete("demo");
  }
  return parsed.toString();
}

export function setPreviewIframe(copyUrl, immediate, state) {
  window.clearTimeout(previewReloadTimer);
  const apply = () => {
    const iframe = document.getElementById("cfg-iframe");
    if (iframe) {
      iframe.src = buildPreviewUrl(state, copyUrl);
    }
  };
  if (immediate) {
    apply();
    return;
  }
  previewReloadTimer = window.setTimeout(apply, PREVIEW_DEBOUNCE_MS);
}
