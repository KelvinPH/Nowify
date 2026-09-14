/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import {
  createProgressLoop,
  estimatedProgressMs,
  mergeLiveProgress,
} from "../utils/progress-clock.js";

let cfg = {};
let rootEl = null;
let recordEl = null;
let tonearmEl = null;
let labelArtEl = null;
let titleEl = null;
let artistEl = null;
let progressFillEl = null;
let elapsedEl = null;
let durationEl = null;
let bpmEl = null;
let progressLoop = null;
let currentTrack = null;
let lastTrackId = null;

function formatTime(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const s = Math.floor(safe / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function trackClock() {
  if (!currentTrack) return null;
  return {
    trackId: currentTrack.trackId || "",
    progressMs: Number(currentTrack.progressMs) || 0,
    durationMs: Number(currentTrack.durationMs) || 0,
    isPlaying: currentTrack.isPlaying !== false,
    updatedAt: Number(currentTrack.progressUpdatedAt) || Date.now(),
  };
}

function stopProgressTimer() {
  progressLoop?.stop();
}

function paintProgress(progressMs) {
  const duration = Number(currentTrack?.durationMs) || 0;
  const progress = Number(progressMs) || 0;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  if (elapsedEl) elapsedEl.textContent = formatTime(progress);
}

function startProgressTimer() {
  if (!progressLoop) {
    progressLoop = createProgressLoop({
      getClock: trackClock,
      paint: (progressMs) => paintProgress(progressMs),
    });
  }
  if (currentTrack?.isPlaying && currentTrack?.durationMs) {
    progressLoop.start();
  } else {
    progressLoop.stop();
    paintProgress(estimatedProgressMs(trackClock()));
  }
}

function setPlayingState(isPlaying) {
  if (!rootEl || !recordEl || !tonearmEl) return;
  rootEl.setAttribute("data-playing", isPlaying ? "true" : "false");
  recordEl.style.animationPlayState = isPlaying ? "running" : "paused";
  tonearmEl.classList.toggle("vl-arm-playing", Boolean(isPlaying));
}

function transitionLabelArt(nextArtUrl) {
  if (!labelArtEl) return;
  labelArtEl.style.opacity = "0";
  window.setTimeout(function () {
    labelArtEl.style.backgroundImage = nextArtUrl ? `url("${nextArtUrl}")` : "";
    labelArtEl.style.opacity = "0.85";
  }, 180);
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="vl-wrap" data-playing="false">
      <div class="vl-table">
        <div class="vl-platter-shadow"></div>
        <div class="vl-record" id="vl-record">
          <div class="vl-grooves"></div>
          <div class="vl-label" id="vl-label">
            <div class="vl-label-art" id="vl-label-art"></div>
            <div class="vl-label-hole"></div>
          </div>
        </div>
        <div class="vl-tonearm-wrap" id="vl-tonearm-wrap">
          <div class="vl-tonearm-pivot"></div>
          <div class="vl-tonearm-arm">
            <div class="vl-tonearm-head"></div>
          </div>
        </div>
      </div>
      <div class="vl-info">
        <div class="vl-title" id="vl-title"></div>
        <div class="vl-artist" id="vl-artist"></div>
        <div class="vl-progress-wrap">
          <div class="vl-progress-bar">
            <div class="vl-progress-fill" id="vl-progress-fill"></div>
          </div>
          <div class="vl-times">
            <span id="vl-elapsed">0:00</span>
            <span id="vl-duration">0:00</span>
          </div>
        </div>
        <div class="vl-meta">
          <span id="vl-bpm"></span>
        </div>
      </div>
    </div>
  `;

  rootEl = app.querySelector(".vl-wrap");
  recordEl = document.getElementById("vl-record");
  tonearmEl = document.getElementById("vl-tonearm-wrap");
  labelArtEl = document.getElementById("vl-label-art");
  titleEl = document.getElementById("vl-title");
  artistEl = document.getElementById("vl-artist");
  progressFillEl = document.getElementById("vl-progress-fill");
  elapsedEl = document.getElementById("vl-elapsed");
  durationEl = document.getElementById("vl-duration");
  bpmEl = document.getElementById("vl-bpm");

  setPlayingState(false);
  startProgressTimer();
}

function render(track, extras) {
  if (!rootEl) return;
  const safeTrack = track || {};
  const nextTrackId = safeTrack.trackId || "";
  const changed = Boolean(nextTrackId && nextTrackId !== lastTrackId);
  currentTrack = mergeLiveProgress(currentTrack, {
    ...safeTrack,
    progressMs: Number(safeTrack.progressMs) || 0,
    durationMs: Number(safeTrack.durationMs) || 0,
  });

  if (titleEl) titleEl.textContent = safeTrack.title || "";
  if (artistEl) artistEl.textContent = safeTrack.artist || "";
  if (durationEl) durationEl.textContent = formatTime(currentTrack.durationMs || 0);
  if (bpmEl) bpmEl.textContent = extras?.bpm ? `${extras.bpm} BPM` : "";
  paintProgress(estimatedProgressMs(trackClock()));
  startProgressTimer();

  if (changed) {
    if (recordEl) recordEl.style.animationPlayState = "paused";
    transitionLabelArt(safeTrack.albumArt || "");
    window.setTimeout(function () {
      setPlayingState(Boolean(safeTrack.isPlaying));
    }, 240);
  } else if (labelArtEl && !labelArtEl.style.backgroundImage && safeTrack.albumArt) {
    labelArtEl.style.backgroundImage = `url("${safeTrack.albumArt}")`;
    labelArtEl.style.opacity = "0.85";
  }

  setPlayingState(Boolean(safeTrack.isPlaying));
  lastTrackId = nextTrackId || lastTrackId;
}

function destroy() {
  stopProgressTimer();
  progressLoop = null;
  const app = document.getElementById("app");
  app?.querySelector(".vl-wrap")?.remove();
  rootEl = null;
  recordEl = null;
  tonearmEl = null;
  labelArtEl = null;
  titleEl = null;
  artistEl = null;
  progressFillEl = null;
  elapsedEl = null;
  durationEl = null;
  bpmEl = null;
  currentTrack = null;
  lastTrackId = null;
  cfg = {};
}

export { init, render, destroy };
