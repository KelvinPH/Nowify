let cfg = {};
let rootEl = null;
let artistEl = null;
let titleEl = null;
let albumEl = null;
let barEl = null;
let pctEl = null;
let metaEl = null;
let nextLineEl = null;
let nextEl = null;
let statusTextEl = null;
let cursorEl = null;
let progressTimer = null;
let cursorTimer = null;
let currentTrack = null;

function formatTime(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const s = Math.floor(safe / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function energyLabel(val) {
  if (!Number.isFinite(val)) return "";
  if (val < 0.33) return "LOW";
  if (val < 0.66) return "MED";
  return "HIGH";
}

function stopTimers() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
}

function drawProgressLine(track) {
  const duration = Number(track?.durationMs) || 0;
  const progress = Number(track?.progressMs) || 0;
  const pct = duration > 0 ? Math.round((progress / duration) * 100) : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 5);
  const empty = 20 - filled;
  if (barEl) barEl.textContent = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  if (pctEl) pctEl.textContent = ` ${clamped}%`;
}

function startTimers() {
  progressTimer = setInterval(function () {
    if (!currentTrack) return;
    if (currentTrack.isPlaying && currentTrack.durationMs) {
      currentTrack = {
        ...currentTrack,
        progressMs: Math.min(
          currentTrack.durationMs,
          (Number(currentTrack.progressMs) || 0) + 500
        ),
      };
    }
    drawProgressLine(currentTrack);
  }, 500);

  cursorTimer = setInterval(function () {
    if (!cursorEl) return;
    cursorEl.classList.toggle("tm-cursor-hidden");
  }, 600);
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="tm-wrap">
      <div class="tm-scanlines"></div>
      <div class="tm-screen">
        <div class="tm-line tm-dim">nowify v2 - music overlay</div>
        <div class="tm-line tm-dim">-------------------------</div>
        <div class="tm-line">
          <span class="tm-prompt">></span>
          <span class="tm-key"> NOW PLAYING</span>
        </div>
        <div class="tm-line tm-indent">
          <span class="tm-key">ARTIST</span>
          <span class="tm-sep">  </span>
          <span class="tm-val" id="tm-artist"></span>
        </div>
        <div class="tm-line tm-indent">
          <span class="tm-key">TRACK </span>
          <span class="tm-sep">  </span>
          <span class="tm-val" id="tm-title"></span>
        </div>
        <div class="tm-line tm-indent">
          <span class="tm-key">ALBUM </span>
          <span class="tm-sep">  </span>
          <span class="tm-val tm-dim" id="tm-album"></span>
        </div>
        <div class="tm-line" style="margin-top:6px">
          <span class="tm-prompt">></span>
          <span class="tm-key"> PROGRESS</span>
        </div>
        <div class="tm-line tm-indent" id="tm-progress-line">
          <span class="tm-bar" id="tm-bar"></span>
          <span class="tm-pct tm-dim" id="tm-pct"></span>
        </div>
        <div class="tm-line tm-indent tm-dim" id="tm-meta"></div>
        <div class="tm-line" id="tm-next-line" style="display:none;margin-top:6px">
          <span class="tm-prompt">></span>
          <span class="tm-key"> NEXT</span>
          <span class="tm-sep">     </span>
          <span class="tm-val tm-dim" id="tm-next"></span>
        </div>
        <div class="tm-line tm-status" id="tm-status">
          <span class="tm-prompt">></span>
          <span id="tm-status-text"> PLAYING</span>
          <span class="tm-cursor" id="tm-cursor">_</span>
        </div>
      </div>
    </div>
  `;
  rootEl = app.querySelector(".tm-wrap");
  artistEl = document.getElementById("tm-artist");
  titleEl = document.getElementById("tm-title");
  albumEl = document.getElementById("tm-album");
  barEl = document.getElementById("tm-bar");
  pctEl = document.getElementById("tm-pct");
  metaEl = document.getElementById("tm-meta");
  nextLineEl = document.getElementById("tm-next-line");
  nextEl = document.getElementById("tm-next");
  statusTextEl = document.getElementById("tm-status-text");
  cursorEl = document.getElementById("tm-cursor");
  startTimers();
}

function render(track, extras) {
  if (!rootEl) return;
  const safeTrack = track || {};
  currentTrack = {
    ...safeTrack,
    progressMs: Number(safeTrack.progressMs) || 0,
    durationMs: Number(safeTrack.durationMs) || 0,
  };

  if (artistEl) artistEl.textContent = safeTrack.artist || "";
  if (titleEl) titleEl.textContent = safeTrack.title || "";
  if (albumEl) albumEl.textContent = safeTrack.album || "";

  drawProgressLine(currentTrack);

  const parts = [];
  if (extras?.bpm) parts.push(`BPM:${extras.bpm}`);
  if (Number.isFinite(extras?.energy)) parts.push(`ENERGY:${energyLabel(extras.energy)}`);
  if (metaEl) metaEl.textContent = parts.join("  ");

  const nextTrack = safeTrack.nextTrack;
  if (cfg.showNextTrack && nextTrack?.title) {
    if (nextLineEl) nextLineEl.style.display = "";
    if (nextEl) nextEl.textContent = `${nextTrack.title || ""} - ${nextTrack.artist || ""}`;
  } else {
    if (nextLineEl) nextLineEl.style.display = "none";
    if (nextEl) nextEl.textContent = "";
  }

  if (statusTextEl) {
    statusTextEl.textContent = safeTrack.isPlaying ? " PLAYING" : " PAUSED ";
  }
}

function destroy() {
  stopTimers();
  const app = document.getElementById("app");
  app?.querySelector(".tm-wrap")?.remove();
  rootEl = null;
  artistEl = null;
  titleEl = null;
  albumEl = null;
  barEl = null;
  pctEl = null;
  metaEl = null;
  nextLineEl = null;
  nextEl = null;
  statusTextEl = null;
  cursorEl = null;
  currentTrack = null;
  cfg = {};
}

export { init, render, destroy };
