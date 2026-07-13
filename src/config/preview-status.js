/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

const STATUS_LABELS = {
  live: "Live",
  stale: "Stale",
  reconnecting: "Reconnecting",
};

let messageBound = false;

/** Shows overlay fetch health in the configurator preview bar (not on OBS output). */
export function initOverlaySourceStatusIndicator() {
  const bar = document.getElementById("cfg-preview-bar");
  if (!bar) {
    return;
  }

  let wrap = document.getElementById("cfg-source-status-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "cfg-source-status-wrap";
    wrap.className = "cfg-source-status-wrap";
    wrap.innerHTML = `<span id="cfg-source-status" class="cfg-source-status cfg-source-status--reconnecting" aria-hidden="true"></span><span id="cfg-source-status-label" class="cfg-source-status-label">Reconnecting</span>`;
    bar.insertBefore(wrap, bar.firstChild);
  }

  if (messageBound) {
    return;
  }
  messageBound = true;

  function apply(status, source) {
    const key = status || "reconnecting";
    const statusWrap = document.getElementById("cfg-source-status-wrap");
    const statusDot = document.getElementById("cfg-source-status");
    const statusLabel = document.getElementById("cfg-source-status-label");
    if (statusDot) {
      statusDot.className = `cfg-source-status cfg-source-status--${key}`;
    }
    if (statusLabel) {
      statusLabel.textContent = STATUS_LABELS[key] || key;
    }
    if (statusWrap) {
      statusWrap.title = `Overlay source (${source || "unknown"}): ${STATUS_LABELS[key] || key}`;
    }
  }

  window.addEventListener("message", (event) => {
    if (event?.data?.type !== "nowify:source-status") {
      return;
    }
    apply(event.data.status, event.data.source);
  });
}
