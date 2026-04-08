let cfg = {};
let rootEl = null;
let reelLeftEl = null;
let reelRightEl = null;
let labelEl = null;
let titleEl = null;
let artistEl = null;
let progressFillEl = null;
let elapsedEl = null;
let durationEl = null;
let statusEl = null;
let progressTimer = null;
let reelSizeTimer = null;
let currentTrack = null;

function formatTime(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const s = Math.floor(safe / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function truncateTitle(text, maxLen) {
  const s = String(text || "");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function stopTimers() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (reelSizeTimer) {
    clearInterval(reelSizeTimer);
    reelSizeTimer = null;
  }
}

function applyReelSizes() {
  if (!reelLeftEl || !reelRightEl || !currentTrack?.durationMs) return;
  const pct = Math.max(
    0,
    Math.min(1, (Number(currentTrack.progressMs) || 0) / Number(currentTrack.durationMs))
  );
  const leftSize = 36 - pct * 16;
  const rightSize = 20 + pct * 16;
  reelLeftEl.style.setProperty("--cs-reel-size", `${leftSize}px`);
  reelRightEl.style.setProperty("--cs-reel-size", `${rightSize}px`);
  const speed = 3 - pct * 0.8;
  reelLeftEl.style.animationDuration = `${Math.max(1.6, speed)}s`;
  reelRightEl.style.animationDuration = `${Math.max(1.6, speed)}s`;
}

function updateProgressUi() {
  const duration = Number(currentTrack?.durationMs) || 0;
  const progress = Number(currentTrack?.progressMs) || 0;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  if (elapsedEl) elapsedEl.textContent = formatTime(progress);
  if (durationEl) durationEl.textContent = formatTime(duration);
}

function setPlayingState(isPlaying) {
  const state = isPlaying ? "running" : "paused";
  if (reelLeftEl) reelLeftEl.style.animationPlayState = state;
  if (reelRightEl) reelRightEl.style.animationPlayState = state;
  if (statusEl) statusEl.textContent = isPlaying ? "PLAY ▶" : "PAUSE ⏸";
}

function startTimers() {
  progressTimer = setInterval(function () {
    if (!currentTrack) return;
    if (currentTrack.isPlaying && currentTrack.durationMs) {
      currentTrack = {
        ...currentTrack,
        progressMs: Math.min(
          currentTrack.durationMs,
          (Number(currentTrack.progressMs) || 0) + 100
        ),
      };
    }
    updateProgressUi();
  }, 100);

  reelSizeTimer = setInterval(function () {
    applyReelSizes();
  }, 2000);
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="cs-wrap">
      <div class="cs-body">
        <div class="cs-shell">
          <div class="cs-screw cs-screw-tl"></div>
          <div class="cs-screw cs-screw-tr"></div>
          <div class="cs-screw cs-screw-bl"></div>
          <div class="cs-screw cs-screw-br"></div>
          <div class="cs-window">
            <div class="cs-reel cs-reel-left" id="cs-reel-left">
              <div class="cs-reel-inner"></div>
              <div class="cs-reel-spoke"></div>
              <div class="cs-reel-spoke cs-spoke-2"></div>
              <div class="cs-reel-spoke cs-spoke-3"></div>
            </div>
            <div class="cs-tape-path"></div>
            <div class="cs-reel cs-reel-right" id="cs-reel-right">
              <div class="cs-reel-inner"></div>
              <div class="cs-reel-spoke"></div>
              <div class="cs-reel-spoke cs-spoke-2"></div>
              <div class="cs-reel-spoke cs-spoke-3"></div>
            </div>
          </div>
          <div class="cs-label" id="cs-label" data-style="classic">
            <div class="cs-label-title" id="cs-label-title"></div>
            <div class="cs-label-artist" id="cs-label-artist"></div>
            <div class="cs-label-side">A</div>
          </div>
        </div>
      </div>
      <div class="cs-info">
        <div class="cs-progress-wrap">
          <div class="cs-progress-bar">
            <div class="cs-progress-fill" id="cs-progress-fill"></div>
          </div>
          <div class="cs-times">
            <span id="cs-elapsed">0:00</span>
            <span id="cs-duration">0:00</span>
          </div>
        </div>
        <div class="cs-status" id="cs-status">PLAY</div>
      </div>
    </div>
  `;

  rootEl = app.querySelector(".cs-wrap");
  reelLeftEl = document.getElementById("cs-reel-left");
  reelRightEl = document.getElementById("cs-reel-right");
  labelEl = document.getElementById("cs-label");
  titleEl = document.getElementById("cs-label-title");
  artistEl = document.getElementById("cs-label-artist");
  progressFillEl = document.getElementById("cs-progress-fill");
  elapsedEl = document.getElementById("cs-elapsed");
  durationEl = document.getElementById("cs-duration");
  statusEl = document.getElementById("cs-status");

  if (labelEl) {
    labelEl.setAttribute(
      "data-style",
      cfg.cassetteStyle === "mixtape" ? "mixtape" : "classic"
    );
  }
  startTimers();
}

function render(track) {
  if (!rootEl) return;
  currentTrack = {
    ...(track || {}),
    progressMs: Number(track?.progressMs) || 0,
    durationMs: Number(track?.durationMs) || 0,
  };

  if (titleEl) titleEl.textContent = truncateTitle(currentTrack.title || "", 20);
  if (artistEl) artistEl.textContent = currentTrack.artist || "";
  if (labelEl) {
    labelEl.setAttribute(
      "data-style",
      cfg.cassetteStyle === "mixtape" ? "mixtape" : "classic"
    );
  }

  updateProgressUi();
  applyReelSizes();
  setPlayingState(Boolean(currentTrack.isPlaying));
}

function destroy() {
  stopTimers();
  const app = document.getElementById("app");
  app?.querySelector(".cs-wrap")?.remove();
  cfg = {};
  rootEl = null;
  reelLeftEl = null;
  reelRightEl = null;
  labelEl = null;
  titleEl = null;
  artistEl = null;
  progressFillEl = null;
  elapsedEl = null;
  durationEl = null;
  statusEl = null;
  currentTrack = null;
}

export { init, render, destroy };
