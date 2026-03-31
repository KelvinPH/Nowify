import { getAudioFeatures, getNowPlaying } from "../api/spotify.js";
import { init as initAuth, login } from "../auth/spotify.js";
import { LAYOUTS, escHtml, fmtTime } from "./layouts.js";
import { initVinyl, setVinylPlaying } from "../visuals/vinyl.js";
import { applyBeatSync, clearBeatSync } from "../visuals/beatsync.js";
import { applyMood, clearMood } from "../visuals/mood.js";
import { connectIRC, connectEventSub } from "../platforms/twitch.js";
import { startTrack } from "../stats/session.js";

let currentTrackId = null;
let pollInterval = null;
let config = {};
let progressTimer = null;
const blockedAudioFeaturesTrackIds = new Set();
let lastKnownProgress = {
  progressMs: 0,
  durationMs: 0,
  isPlaying: false,
  updatedAt: 0,
};

/** Parses URL params into a normalized overlay config object. */
export function parseConfig() {
  const params = new URLSearchParams(window.location.search);
  const toBool = (value, fallback) => {
    if (value === null) {
      return fallback;
    }
    return value === "1" || value.toLowerCase() === "true";
  };

  return {
    layout: params.get("layout") || "glasscard",
    theme: params.get("theme") || "spotify",
    clientId: params.get("clientId") || "",
    showBpm: toBool(params.get("showBpm"), false),
    showProgress: toBool(params.get("showProgress"), true),
    transparent: toBool(params.get("transparent"), false),
    moodSync: toBool(params.get("moodSync"), true),
    twitchChannel: params.get("twitchChannel") || "",
    twitchUsername: params.get("twitchUsername") || "",
    twitchToken: params.get("twitchToken") || "",
  };
}

/** Polls Spotify and updates overlay content based on track changes. */
async function poll() {
  try {
    const track = await getNowPlaying();
    if (!track) {
      currentTrackId = null;
      showIdle();
      return;
    }

    if (track.trackId !== currentTrackId) {
      currentTrackId = track.trackId;
      let extras = null;
      if (!blockedAudioFeaturesTrackIds.has(track.trackId)) {
        try {
          extras = await getAudioFeatures(track.trackId);
        } catch (error) {
          const message = String(error?.message || "");
          if (message.includes("Spotify API error 403")) {
            blockedAudioFeaturesTrackIds.add(track.trackId);
          }
          extras = null;
        }
      }
      render(track, extras);
      updateProgress(track);
      return;
    }

    updateProgress(track);
    updateStripTime(track);
  } catch (error) {
    console.warn("Overlay poll failed:", error);
  }
}

/** Starts immediate polling plus a recurring poll interval. */
export async function startPolling(intervalMs = 3000) {
  await poll();
  pollInterval = window.setInterval(() => {
    poll();
  }, intervalMs);
  return pollInterval;
}

/** Renders a track using the selected layout and transition class. */
function render(track, extras) {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  startTrack(track, extras);
  const layoutFn = LAYOUTS[config.layout] || LAYOUTS.glasscard;
  app.innerHTML = layoutFn(track, extras, config);

  const rootEl = app.querySelector(".nw-overlay");
  if (!rootEl) {
    return;
  }

  const fill = app.querySelector(".nw-progress-fill");
  if (fill) fill.style.transition = "width 0.1s linear";

  applyBeatSync(rootEl, extras);
  if (config.moodSync) {
    applyMood(rootEl, extras);
  } else {
    clearMood(rootEl);
  }

  rootEl.classList.add("nw-animate-in");
  window.setTimeout(() => {
    rootEl.classList.remove("nw-animate-in");
  }, 600);
}

/** Updates progress bar width for the currently rendered track. */
function updateProgress(track) {
  if (!track?.durationMs) {
    return;
  }
  lastKnownProgress = {
    progressMs: track.progressMs || 0,
    durationMs: track.durationMs,
    isPlaying: track.isPlaying !== false,
    updatedAt: Date.now(),
  };
  const pct = Math.min(100, ((track.progressMs || 0) / track.durationMs) * 100);
  const fill = document.querySelector(".nw-progress-fill");
  if (fill) {
    fill.style.transition = "width 0.1s linear";
    fill.style.width = `${pct}%`;
  }
}

function updateStripTime(track) {
  const timeEl = document.querySelector(".nw-strip-time");
  if (timeEl && track?.progressMs) {
    timeEl.textContent = fmtTime(track.progressMs);
  }
}

function startProgressTimer() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!lastKnownProgress.isPlaying || !lastKnownProgress.durationMs) return;
    const elapsed = Date.now() - lastKnownProgress.updatedAt;
    const estimated = lastKnownProgress.progressMs + elapsed;
    const pct = Math.min(100, (estimated / lastKnownProgress.durationMs) * 100);
    const fill = document.querySelector(".nw-progress-fill");
    if (fill) fill.style.width = `${pct}%`;
  }, 100);
}

/** Renders a minimal idle state when no track is active. */
function showIdle() {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const message = escHtml("Nothing playing");
  app.innerHTML = `<div class="nw-idle">${message}</div>`;
  clearBeatSync(app.querySelector(".nw-overlay"));
  clearMood(app.querySelector(".nw-overlay"));
}

function showSrToast(detail) {
  const username = escHtml(detail?.username || "Someone");
  const trackName = escHtml(detail?.trackName || "a track");
  const artistName = escHtml(detail?.artistName || "Unknown artist");
  const toast = document.createElement("div");
  toast.className = "nw-toast";
  toast.textContent = `${username} added: ${trackName} by ${artistName}`;
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 4000);
}

async function resolveTwitchUserId(channelName, token) {
  const clientId = localStorage.getItem("nowify_client_id") || "";
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelName)}`,
    {
      headers: {
        Authorization: `Bearer ${token.replace(/^oauth:/i, "")}`,
        "Client-Id": clientId,
      },
    }
  );
  if (!res.ok) {
    console.warn("Nowify: Could not resolve Twitch user ID", res.status);
    return null;
  }
  const data = await res.json();
  return data?.data?.[0]?.id || null;
}

/** Initializes auth, applies config, and starts overlay polling. */
export async function init() {
  config = parseConfig();
  document.documentElement.setAttribute("data-theme", config.theme);
  await initAuth();

  const hasToken = Boolean(localStorage.getItem("nowify_access_token"));
  if (config.clientId && !hasToken) {
    await login(config.clientId);
    return;
  }

  if (config.transparent) {
    document.body.style.background = "transparent";
  }

  await startPolling();
  startProgressTimer();

  if (config.twitchChannel && config.twitchToken) {
    connectIRC({
      channel: config.twitchChannel,
      username: config.twitchUsername || config.twitchChannel,
      token: config.twitchToken,
    });
  }

  window.addEventListener("nowify:sr", (e) => {
    showSrToast(e.detail);
  });

  // TODO: wire up follow/sub/raid alert UI in a future update

  if (config.twitchToken && config.twitchChannel) {
    const broadcasterId = await resolveTwitchUserId(
      config.twitchChannel,
      config.twitchToken
    );
    if (broadcasterId) {
      connectEventSub({ broadcasterId, token: config.twitchToken });
    }
  }
}
