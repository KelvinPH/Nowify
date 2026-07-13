/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import { PREVIEW_DEBOUNCE_MS } from "./constants.js";

let previewReloadTimer = null;

export function buildPreviewUrl(state, copyUrl) {
  if (!state.previewDemo) {
    return copyUrl;
  }
  const parsed = new URL(copyUrl, window.location.href);
  parsed.searchParams.set("demo", "1");
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
