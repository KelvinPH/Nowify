function renderLanding() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0c0f;color:#f3f4f7;font-family:-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif;">
      <section style="width:min(720px,100%);background:#101216;border:0.5px solid rgba(255,255,255,0.14);border-radius:14px;padding:28px;">
        <img src="assets/logo/logo.png" alt="Nowify" style="height:34px;width:auto;display:block;margin-bottom:14px;" />
        <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);margin-bottom:18px;">
          Real-time music overlays for OBS, Streamlabs, and StreamElements.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="config.html" style="background:#d2d7e0;color:#0b0d10;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;">Open Configurator</a>
          <a href="overlay.html" style="background:#171a20;color:#f3f4f7;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;border:0.5px solid rgba(255,255,255,0.14);">Open Overlay</a>
          <a href="stats.html" style="background:#171a20;color:#f3f4f7;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;border:0.5px solid rgba(255,255,255,0.14);">Open Stats</a>
          <a href="https://github.com/KelvinPH/Nowify" target="_blank" rel="noopener noreferrer" style="background:#171a20;color:#f3f4f7;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;border:0.5px solid rgba(255,255,255,0.14);">GitHub</a>
        </div>
      </section>
    </main>
  `;
}

function parseSongifyConfig() {
  const params = new URLSearchParams(window.location.search);
  const toBool = (value, fallback) => {
    if (value === null) return fallback;
    return value === "1" || String(value).toLowerCase() === "true";
  };
  return {
    source: params.get("source") || "spotify",
    songifyPort: Number(params.get("songifyPort")) || 4002,
    layout: params.get("layout") || "glasscard",
    theme: params.get("theme") || "obsidian",
    transparent: toBool(params.get("transparent"), false),
    showProgress: toBool(params.get("showProgress"), true),
    showAlbum: toBool(params.get("showAlbum"), false),
    showTimeLeft: toBool(params.get("showTimeLeft"), false),
    showNextTrack: toBool(params.get("showNextTrack"), false),
    showPlayState: toBool(params.get("showPlayState"), false),
  };
}

function fmtTime(ms) {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function initSongifyOverlay() {
  const config = parseSongifyConfig();
  const app = document.getElementById("app");
  if (!app) return;

  document.documentElement.setAttribute("data-theme", config.theme);
  if (config.transparent) {
    document.documentElement.setAttribute("data-transparent", "1");
  } else {
    document.documentElement.removeAttribute("data-transparent");
  }

  const [{ LAYOUTS }, { init: initSongify, sendCommand }] = await Promise.all([
    import("./overlay/layouts.js"),
    import("./api/songify.js"),
  ]);

  let currentTrack = null;
  let currentTrackTs = 0;
  let hasRenderedTrack = false;

  function renderSongifyTrack(track) {
    hasRenderedTrack = true;
    currentTrack = track;
    currentTrackTs = Date.now();
    app.innerHTML = (LAYOUTS[config.layout] || LAYOUTS.glasscard)(track, null, config);

    const albumEl = app.querySelector(".nw-meta-album");
    const timeEl = app.querySelector(".nw-meta-time");
    const nextEl = app.querySelector(".nw-meta-next");
    const playEl = app.querySelector(".nw-meta-playstate");
    if (albumEl) albumEl.textContent = config.showAlbum && track?.album ? `Album: ${track.album}` : "";
    if (timeEl) timeEl.textContent = "";
    if (nextEl) nextEl.textContent = config.showNextTrack ? "Next track unavailable on Songify feed" : "";
    if (playEl) playEl.innerHTML = config.showPlayState && track?.isPlaying ? '<div class="nw-playing-dot"></div>' : "";
    updateProgress();
  }

  function showIdle() {
    hasRenderedTrack = false;
    app.innerHTML =
      '<div class="nw-idle">Cannot reach Songify — start the web server and check the port.</div>';
  }

  function showWaitingForTrack() {
    if (hasRenderedTrack) {
      return;
    }
    app.innerHTML =
      '<div class="nw-idle">Songify connected — waiting for track (HTTP + WebSocket)</div>';
  }

  function updateProgress() {
    if (!currentTrack?.durationMs || !currentTrack?.progressMs) return;
    const fill = app.querySelector(".nw-progress-fill");
    if (!fill) return;
    const elapsed = Date.now() - currentTrackTs;
    const live = currentTrack.isPlaying ? currentTrack.progressMs + elapsed : currentTrack.progressMs;
    const pct = Math.min(100, (live / currentTrack.durationMs) * 100);
    fill.style.width = `${pct}%`;

    const timeEl = app.querySelector(".nw-meta-time");
    if (timeEl && config.showTimeLeft) {
      const remain = Math.max(0, currentTrack.durationMs - live);
      timeEl.textContent = `-${fmtTime(remain)}`;
    }
  }

  showIdle();
  window.__songifySendCommand = sendCommand;

  initSongify({
    port: config.songifyPort || 4002,
    onTrack: function (track) {
      try {
        renderSongifyTrack(track);
      } catch (e) {
        console.warn("[Songify] render failed", e);
      }
    },
    onConnect: function () {
      console.warn("[Songify] Track stream open on /ws/data (HTTP GET / still polls as fallback)");
      showWaitingForTrack();
    },
    onDisconnect: function () {
      console.warn("[Songify] WebSocket closed — reconnecting");
      showIdle();
    },
  });

  window.setInterval(updateProgress, 1000);
}

export function init() {
  if (window.location.pathname.endsWith("overlay.html")) {
    const config = parseSongifyConfig();
    if (config.source === "songify") {
      initSongifyOverlay();
      return;
    }
    import("./overlay/renderer.js").then(({ init }) => init());
    return;
  }
  renderLanding();
}

init();
