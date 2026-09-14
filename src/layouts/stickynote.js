/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import {
  estimatedProgressMs,
  mergeLiveProgress,
  syncProgressFill,
} from "../utils/progress-clock.js";

let cfg = {};
let rootEl = null;
let noteEl = null;
let titleEl = null;
let artistEl = null;
let metaEl = null;
let progressFillEl = null;
let labelTimer = null;
let currentTrack = null;
let rotationDeg = "0";

const NOTE_COLORS = {
  obsidian: "#f5f5f0",
  midnight: "#dce8ff",
  aurora: "#f0deff",
  forest: "#dcf5dc",
  amber: "#fff8dc",
  glass: "#f0f0f5",
};

const TEXT_COLORS = {
  obsidian: "#1a1a1a",
  midnight: "#1a2a4a",
  aurora: "#2a1a4a",
  forest: "#1a3a1a",
  amber: "#3a2a0a",
  glass: "#1a1a2a",
};

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

function stopTimer() {
  if (labelTimer) {
    clearInterval(labelTimer);
    labelTimer = null;
  }
}

function paintLabels() {
  const progress = estimatedProgressMs(trackClock());
  const duration = Number(currentTrack?.durationMs) || 0;
  if (progressFillEl) {
    progressFillEl.title = `${formatTime(progress)} / ${formatTime(duration)}`;
  }
}

function paintProgress() {
  syncProgressFill(progressFillEl, trackClock());
  paintLabels();
}

function startTimer() {
  stopTimer();
  paintProgress();
  if (!currentTrack?.isPlaying || !currentTrack?.durationMs) return;
  labelTimer = setInterval(paintLabels, 1000);
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;

  document.documentElement.style.setProperty("--sn-bg", NOTE_COLORS[cfg.theme] || NOTE_COLORS.amber);
  document.documentElement.style.setProperty("--sn-text", TEXT_COLORS[cfg.theme] || TEXT_COLORS.amber);

  app.innerHTML = `
    <div class="sn-wrap">
      <div class="sn-pin">
        <div class="sn-pin-head"></div>
        <div class="sn-pin-needle"></div>
      </div>
      <div class="sn-note" id="sn-note">
        <div class="sn-fold"></div>
        <div class="sn-lines"></div>
        <div class="sn-content">
          <div class="sn-label">now playing</div>
          <div class="sn-title" id="sn-title"></div>
          <div class="sn-sep">-</div>
          <div class="sn-artist" id="sn-artist"></div>
          <div class="sn-meta" id="sn-meta"></div>
          <div class="sn-progress-wrap">
            <div class="sn-progress-bar">
              <div class="sn-progress-fill" id="sn-progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  rootEl = app.querySelector(".sn-wrap");
  noteEl = document.getElementById("sn-note");
  titleEl = document.getElementById("sn-title");
  artistEl = document.getElementById("sn-artist");
  metaEl = document.getElementById("sn-meta");
  progressFillEl = document.getElementById("sn-progress-fill");

  rotationDeg = (Math.random() * 4 - 2).toFixed(1);
  if (noteEl) noteEl.style.transform = `rotate(${rotationDeg}deg)`;
  startTimer();
}

function render(track, extras) {
  if (!rootEl) return;
  currentTrack = mergeLiveProgress(currentTrack, {
    ...(track || {}),
    progressMs: Number(track?.progressMs) || 0,
    durationMs: Number(track?.durationMs) || 0,
  });
  if (titleEl) titleEl.textContent = currentTrack.title || "";
  if (artistEl) artistEl.textContent = currentTrack.artist || "";
  if (metaEl) metaEl.textContent = extras?.bpm ? `${extras.bpm} bpm` : "";
  startTimer();
}

function destroy() {
  stopTimer();
  const app = document.getElementById("app");
  app?.querySelector(".sn-wrap")?.remove();
  cfg = {};
  rootEl = null;
  noteEl = null;
  titleEl = null;
  artistEl = null;
  metaEl = null;
  progressFillEl = null;
  currentTrack = null;
  rotationDeg = "0";
}

export { init, render, destroy };
