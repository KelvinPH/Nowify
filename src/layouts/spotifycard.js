let cfg = {};
let rootEl = null;
let bgEl = null;
let artEl = null;
let titleEl = null;
let artistEl = null;
let albumEl = null;
let progressFillEl = null;
let remainingEl = null;
let progressTimer = null;
let currentTrack = null;
let lastTrackId = "";

function formatTime(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const s = Math.floor(safe / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function stopTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function updateProgressUi() {
  const duration = Number(currentTrack?.durationMs) || 0;
  const progress = Number(currentTrack?.progressMs) || 0;
  const pct = duration > 0 ? Math.max(0, Math.min(100, (progress / duration) * 100)) : 0;
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  const remaining = Math.max(0, duration - progress);
  if (remainingEl) remainingEl.textContent = `-${formatTime(remaining)}`;
}

function startTimer() {
  progressTimer = setInterval(function () {
    if (!currentTrack) return;
    if (currentTrack.isPlaying && currentTrack.durationMs) {
      currentTrack = {
        ...currentTrack,
        progressMs: Math.min(
          Number(currentTrack.durationMs) || 0,
          (Number(currentTrack.progressMs) || 0) + 100
        ),
      };
    }
    updateProgressUi();
  }, 100);
}

function setBackgroundWithCrossfade(url) {
  if (!bgEl) return;
  const safeUrl = url || "";
  bgEl.style.opacity = "0";
  window.setTimeout(function () {
    bgEl.style.backgroundImage = safeUrl ? `url("${safeUrl}")` : "";
    bgEl.style.opacity = "1";
  }, 300);
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="sc-wrap">
      <div class="sc-bg" id="sc-bg"></div>
      <div class="sc-overlay"></div>
      <div class="sc-content">
        <div class="sc-art-wrap">
          <img class="sc-art" id="sc-art" alt="" />
        </div>
        <div class="sc-info">
          <div class="sc-title" id="sc-title"></div>
          <div class="sc-artist" id="sc-artist"></div>
          <div class="sc-album" id="sc-album"></div>
        </div>
        <div class="sc-brand">
          <div class="sc-spotify-icon">
            <img class="sc-logo" src="assets/icons/spotify.png" alt="Spotify" />
            <span class="sc-spotify-text">Spotify</span>
          </div>
          <div class="sc-listen">Listen on Spotify</div>
        </div>
      </div>
      <div class="sc-progress-wrap">
        <div class="sc-progress-fill" id="sc-progress-fill"></div>
      </div>
      <div class="sc-times">
        <span id="sc-remaining">-0:00</span>
      </div>
    </div>
  `;

  rootEl = app.querySelector(".sc-wrap");
  bgEl = document.getElementById("sc-bg");
  artEl = document.getElementById("sc-art");
  titleEl = document.getElementById("sc-title");
  artistEl = document.getElementById("sc-artist");
  albumEl = document.getElementById("sc-album");
  progressFillEl = document.getElementById("sc-progress-fill");
  remainingEl = document.getElementById("sc-remaining");

  startTimer();
}

function render(track) {
  if (!rootEl) return;
  currentTrack = {
    ...(track || {}),
    progressMs: Number(track?.progressMs) || 0,
    durationMs: Number(track?.durationMs) || 0,
  };

  const trackId =
    currentTrack.id ||
    currentTrack.uri ||
    `${currentTrack.title || ""}|${currentTrack.artist || ""}|${currentTrack.albumArt || ""}`;
  if (trackId !== lastTrackId) {
    setBackgroundWithCrossfade(currentTrack.albumArt || "");
    lastTrackId = trackId;
  } else if (bgEl && !bgEl.style.backgroundImage) {
    bgEl.style.backgroundImage = currentTrack.albumArt ? `url("${currentTrack.albumArt}")` : "";
  }

  if (artEl) artEl.src = currentTrack.albumArt || "";
  if (titleEl) titleEl.textContent = currentTrack.title || "";
  if (artistEl) artistEl.textContent = currentTrack.artist || "";
  if (albumEl) albumEl.textContent = currentTrack.album || "";
  updateProgressUi();
}

function destroy() {
  stopTimer();
  const app = document.getElementById("app");
  app?.querySelector(".sc-wrap")?.remove();
  cfg = {};
  rootEl = null;
  bgEl = null;
  artEl = null;
  titleEl = null;
  artistEl = null;
  albumEl = null;
  progressFillEl = null;
  remainingEl = null;
  currentTrack = null;
  lastTrackId = "";
}

export { init, render, destroy };
