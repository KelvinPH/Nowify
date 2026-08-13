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
  // Card-design iframe: centered layout; strip any leftover placement params.
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

/** HTML for the configurator preview column. */
export function getConfiguratorPreviewHtml() {
  return `
    <div id="cfg-preview-primary" class="cfg-preview-primary">
      <div class="cfg-preview-panel-head">
        <span class="cfg-preview-panel-label">Overlay preview</span>
      </div>
      <div id="cfg-preview-frame-wrap">
        <iframe id="cfg-iframe" src="./overlay.html" frameborder="0" title="Overlay preview"></iframe>
      </div>
    </div>
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
