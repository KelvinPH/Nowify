let cfg = {};
let rootEl = null;
let artistEl = null;
let titleEl = null;
let albumEl = null;
let artEl = null;
let bpmEl = null;
let energyEl = null;
let statusEl = null;
let gaugeFillEl = null;
let elapsedEl = null;
let durationEl = null;
let lockEl = null;
let progressTimer = null;
let lockTimer = null;
let currentTrack = null;
let lastTrackId = "";

const HUD_COLORS = {
  obsidian: "rgba(255,255,255,0.85)",
  midnight: "rgba(88,166,255,0.9)",
  aurora: "rgba(191,90,242,0.9)",
  forest: "rgba(48,209,88,0.9)",
  amber: "rgba(255,159,10,0.9)",
  glass: "rgba(255,255,255,0.7)",
};

function formatTime(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const s = Math.floor(safe / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function energyBar(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "---";
  const filled = Math.max(0, Math.min(5, Math.round(n * 5)));
  return `${"█".repeat(filled)}${"░".repeat(5 - filled)}`;
}

function stopTimers() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
}

function updateProgressUi() {
  const duration = Number(currentTrack?.durationMs) || 0;
  const progress = Number(currentTrack?.progressMs) || 0;
  const pct = duration > 0 ? Math.max(0, Math.min(100, (progress / duration) * 100)) : 0;
  if (gaugeFillEl) gaugeFillEl.style.width = `${pct}%`;
  if (elapsedEl) elapsedEl.textContent = formatTime(progress);
  if (durationEl) durationEl.textContent = formatTime(duration);
}

function setPlayingState(isPlaying) {
  if (!rootEl) return;
  rootEl.classList.toggle("hud-playing", Boolean(isPlaying));
  rootEl.setAttribute("data-playing", isPlaying ? "true" : "false");
  if (statusEl) statusEl.textContent = isPlaying ? "ACTIVE" : "PAUSED";
}

function showLockIndicator() {
  if (!lockEl) return;
  lockEl.classList.add("hud-lock-visible");
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(function () {
    lockEl?.classList.remove("hud-lock-visible");
  }, 1500);
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

function buildMarkersHtml() {
  return [0, 25, 50, 75, 100]
    .map(
      function (n) {
        return `<div class="hud-gauge-marker" style="left:${n}%"><div class="hud-marker-tick"></div><div class="hud-marker-label">${n}</div></div>`;
      }
    )
    .join("");
}

function init(config) {
  cfg = config || {};
  const app = document.getElementById("app");
  if (!app) return;

  const hudColor = HUD_COLORS[cfg.theme] || HUD_COLORS.forest;
  document.documentElement.style.setProperty("--hud-color", hudColor);
  document.documentElement.style.setProperty(
    "--hud-bg",
    cfg.transparent ? "transparent" : "rgba(0,0,0,0.75)"
  );

  app.innerHTML = `
    <div class="hud-wrap" data-playing="false">
      <div class="hud-scanlines"></div>
      <div class="hud-corner hud-tl"></div>
      <div class="hud-corner hud-tr"></div>
      <div class="hud-corner hud-bl"></div>
      <div class="hud-corner hud-br"></div>
      <div class="hud-content">
        <div class="hud-col hud-col-left">
          <div class="hud-readout">
            <div class="hud-readout-label">ARTIST</div>
            <div class="hud-readout-val" id="hud-artist"></div>
          </div>
          <div class="hud-readout">
            <div class="hud-readout-label">TRACK</div>
            <div class="hud-readout-val" id="hud-title"></div>
          </div>
          <div class="hud-readout">
            <div class="hud-readout-label">ALBUM</div>
            <div class="hud-readout-val hud-dim" id="hud-album"></div>
          </div>
        </div>
        <div class="hud-center">
          <div class="hud-reticle" id="hud-reticle">
            <div class="hud-ring hud-ring-outer"></div>
            <div class="hud-ring hud-ring-inner"></div>
            <div class="hud-cross hud-cross-h"></div>
            <div class="hud-cross hud-cross-v"></div>
            <div class="hud-art" id="hud-art"></div>
            <div class="hud-sweep" id="hud-sweep"></div>
            <div class="hud-lock" id="hud-lock">LOCK</div>
          </div>
        </div>
        <div class="hud-col hud-col-right">
          <div class="hud-readout">
            <div class="hud-readout-label">BPM</div>
            <div class="hud-readout-val" id="hud-bpm">---</div>
          </div>
          <div class="hud-readout">
            <div class="hud-readout-label">ENERGY</div>
            <div class="hud-readout-val" id="hud-energy">---</div>
          </div>
          <div class="hud-readout">
            <div class="hud-readout-label">STATUS</div>
            <div class="hud-readout-val" id="hud-status">STANDBY</div>
          </div>
        </div>
      </div>
      <div class="hud-gauge">
        <div class="hud-gauge-label">PROGRESS</div>
        <div class="hud-gauge-track">
          <div class="hud-gauge-fill" id="hud-gauge-fill"></div>
          <div class="hud-gauge-markers">${buildMarkersHtml()}</div>
        </div>
        <div class="hud-times">
          <span id="hud-elapsed">00:00</span>
          <span id="hud-duration">00:00</span>
        </div>
      </div>
    </div>
  `;

  rootEl = app.querySelector(".hud-wrap");
  artistEl = document.getElementById("hud-artist");
  titleEl = document.getElementById("hud-title");
  albumEl = document.getElementById("hud-album");
  artEl = document.getElementById("hud-art");
  bpmEl = document.getElementById("hud-bpm");
  energyEl = document.getElementById("hud-energy");
  statusEl = document.getElementById("hud-status");
  gaugeFillEl = document.getElementById("hud-gauge-fill");
  elapsedEl = document.getElementById("hud-elapsed");
  durationEl = document.getElementById("hud-duration");
  lockEl = document.getElementById("hud-lock");
  startTimer();
}

function render(track, extras) {
  if (!rootEl) return;
  currentTrack = {
    ...(track || {}),
    progressMs: Number(track?.progressMs) || 0,
    durationMs: Number(track?.durationMs) || 0,
  };
  const trackId = currentTrack.id || currentTrack.uri || `${currentTrack.title || ""}|${currentTrack.artist || ""}`;
  if (trackId && trackId !== lastTrackId) {
    showLockIndicator();
    lastTrackId = trackId;
  }

  if (artistEl) artistEl.textContent = String(currentTrack.artist || "").toUpperCase();
  if (titleEl) titleEl.textContent = String(currentTrack.title || "").toUpperCase();
  if (albumEl) albumEl.textContent = String(currentTrack.album || "").toUpperCase();
  if (artEl) artEl.style.backgroundImage = currentTrack.albumArt ? `url("${currentTrack.albumArt}")` : "";
  if (bpmEl) bpmEl.textContent = extras?.bpm ? String(extras.bpm).padStart(3, "0") : "---";
  if (energyEl) energyEl.textContent = extras?.energy !== undefined ? energyBar(extras.energy) : "---";
  setPlayingState(Boolean(currentTrack.isPlaying));
  updateProgressUi();
}

function destroy() {
  stopTimers();
  const app = document.getElementById("app");
  app?.querySelector(".hud-wrap")?.remove();
  cfg = {};
  rootEl = null;
  artistEl = null;
  titleEl = null;
  albumEl = null;
  artEl = null;
  bpmEl = null;
  energyEl = null;
  statusEl = null;
  gaugeFillEl = null;
  elapsedEl = null;
  durationEl = null;
  lockEl = null;
  currentTrack = null;
  lastTrackId = "";
}

export { init, render, destroy };
