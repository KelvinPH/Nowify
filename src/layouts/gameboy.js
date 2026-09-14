/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import {
  createProgressLoop,
  estimatedProgressMs,
  mergeLiveProgress,
} from "../utils/progress-clock.js";

const EMPTY_ART =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let cfg = {};
let wrapEl = null;
let bodyEl = null;
let screenEl = null;
let ledEl = null;
let artAreaEl = null;
let artImgEl = null;
let titleEl = null;
let artistEl = null;
let progressEl = null;
let bpmEl = null;
let progressLoop = null;
let currentTrack = null;

const BODY_COLORS = {
  obsidian: "#2a2a2a",
  midnight: "#1a2040",
  aurora: "#3a1a4a",
  forest: "#1a3a2a",
  amber: "#3a2a1a",
  glass: "#2a2a3a",
};

const HUE_ROTATE = {
  obsidian: "90deg",
  midnight: "200deg",
  aurora: "280deg",
  forest: "90deg",
  amber: "30deg",
  glass: "180deg",
};

function formatTime(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const s = Math.floor(safe / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function truncateText(text, maxLen) {
  const s = String(text || "");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
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

function stopTimers() {
  progressLoop?.stop();
}

function renderProgressLine(progressMs) {
  const duration = Number(currentTrack?.durationMs) || 0;
  const progress =
    progressMs != null ? Number(progressMs) : estimatedProgressMs(trackClock());
  const pct = duration > 0 ? Math.round((progress / duration) * 100) : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 10);
  const empty = Math.max(0, 10 - filled);
  if (progressEl) {
    progressEl.textContent = `${"▓".repeat(filled)}${"░".repeat(empty)}`;
    progressEl.title = `${formatTime(progress)} / ${formatTime(duration)}`;
  }
}

function setPlayingState(isPlaying) {
  if (!ledEl) return;
  if (isPlaying) ledEl.classList.add("gb-led-on");
  else ledEl.classList.remove("gb-led-on");
}

function syncArtMode() {
  const showArt = Boolean(cfg.gameboyArt);
  if (artAreaEl) artAreaEl.style.display = showArt ? "block" : "none";
  const contentEl = document.getElementById("gb-content");
  if (contentEl) contentEl.classList.toggle("gb-content-compact", showArt);
}

function startTimer() {
  if (!progressLoop) {
    progressLoop = createProgressLoop({
      getClock: trackClock,
      paint: (progressMs) => renderProgressLine(progressMs),
    });
  }
  if (currentTrack?.isPlaying && currentTrack?.durationMs) {
    progressLoop.start();
  } else {
    progressLoop.stop();
    renderProgressLine(estimatedProgressMs(trackClock()));
  }
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="gb-wrap">
      <div class="gb-body">
        <div class="gb-speaker">
          <div class="gb-speaker-dot"></div><div class="gb-speaker-dot"></div><div class="gb-speaker-dot"></div>
          <div class="gb-speaker-dot"></div><div class="gb-speaker-dot"></div><div class="gb-speaker-dot"></div>
        </div>
        <div class="gb-screen-bezel">
          <div class="gb-power-led" id="gb-power-led"></div>
          <div class="gb-screen" id="gb-screen">
            <div class="gb-pixel-grid"></div>
            <div class="gb-art-area" id="gb-art-area" style="display:none">
              <img class="gb-art-img" id="gb-art-img" alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
            </div>
            <div class="gb-content" id="gb-content">
              <div class="gb-screen-title" id="gb-screen-title"></div>
              <div class="gb-screen-artist" id="gb-screen-artist"></div>
              <div class="gb-screen-progress" id="gb-screen-progress"></div>
              <div class="gb-screen-bpm" id="gb-screen-bpm"></div>
            </div>
          </div>
        </div>
        <div class="gb-controls">
          <div class="gb-dpad">
            <div class="gb-dpad-h"></div>
            <div class="gb-dpad-v"></div>
            <div class="gb-dpad-center"></div>
          </div>
          <div class="gb-buttons">
            <div class="gb-btn gb-btn-a">A</div>
            <div class="gb-btn gb-btn-b">B</div>
          </div>
        </div>
        <div class="gb-menu-btns"><div class="gb-menu-btn">SELECT</div><div class="gb-menu-btn">START</div></div>
        <div class="gb-brand">GAME BOY COLOR</div>
      </div>
    </div>
  `;

  wrapEl = app.querySelector(".gb-wrap");
  bodyEl = app.querySelector(".gb-body");
  screenEl = document.getElementById("gb-screen");
  ledEl = document.getElementById("gb-power-led");
  artAreaEl = document.getElementById("gb-art-area");
  artImgEl = document.getElementById("gb-art-img");
  titleEl = document.getElementById("gb-screen-title");
  artistEl = document.getElementById("gb-screen-artist");
  progressEl = document.getElementById("gb-screen-progress");
  bpmEl = document.getElementById("gb-screen-bpm");

  if (bodyEl) {
    const bodyColor = BODY_COLORS[cfg.theme] || BODY_COLORS.obsidian;
    bodyEl.style.setProperty("--gb-body-color", bodyColor);
  }
  if (screenEl) {
    const hue = HUE_ROTATE[cfg.theme] || HUE_ROTATE.obsidian;
    screenEl.style.setProperty("--gb-hue", hue);
  }
  syncArtMode();
  startTimer();
}

function render(track, extras) {
  if (!wrapEl) return;
  currentTrack = mergeLiveProgress(currentTrack, {
    ...(track || {}),
    progressMs: Number(track?.progressMs) || 0,
    durationMs: Number(track?.durationMs) || 0,
  });
  if (titleEl) titleEl.textContent = truncateText(currentTrack.title || "", 14);
  if (artistEl) artistEl.textContent = truncateText(currentTrack.artist || "", 14);
  renderProgressLine();
  if (bpmEl) bpmEl.textContent = extras?.bpm ? `♪ ${extras.bpm}` : "";
  setPlayingState(Boolean(currentTrack.isPlaying));

  syncArtMode();
  if (cfg.gameboyArt && artImgEl) {
    artImgEl.src = currentTrack.albumArt || EMPTY_ART;
  }
  startTimer();
}

function destroy() {
  stopTimers();
  progressLoop = null;
  const app = document.getElementById("app");
  app?.querySelector(".gb-wrap")?.remove();
  cfg = {};
  wrapEl = null;
  bodyEl = null;
  screenEl = null;
  ledEl = null;
  artAreaEl = null;
  artImgEl = null;
  titleEl = null;
  artistEl = null;
  progressEl = null;
  bpmEl = null;
  currentTrack = null;
}

export { init, render, destroy };
