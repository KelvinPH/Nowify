import { getAudioFeatures, getNextTrack, getNowPlaying } from "../api/spotify.js";
import { getLastfmNowPlaying } from "../api/lastfm.js";
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
let activeSource = "spotify";
let sourceErrorMessage = "";
let lastKnownProgress = {
  progressMs: 0,
  durationMs: 0,
  isPlaying: false,
  updatedAt: 0,
};

function toCustomBool(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  return value === "1" || String(value).toLowerCase() === "true";
}

function toCustomNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCustomConfig(params) {
  return {
    direction: params.get("c_direction") || "row",
    cardWidth: toCustomNumber(params.get("c_cardWidth"), 400),
    cardHeight: toCustomNumber(params.get("c_cardHeight"), 80),
    cardRadius: toCustomNumber(params.get("c_cardRadius"), 16),
    cardPadding: toCustomNumber(params.get("c_cardPadding"), 14),
    blurAmount: toCustomNumber(params.get("c_blurAmount"), 24),
    bgOpacity: toCustomNumber(params.get("c_bgOpacity"), 85),
    borderWidth: toCustomNumber(params.get("c_borderWidth"), 0.5),
    borderColor: params.get("c_borderColor") || "rgba(255,255,255,0.12)",
    fontFamily: params.get("c_fontFamily") || "system",
    titleSize: toCustomNumber(params.get("c_titleSize"), 14),
    artistSize: toCustomNumber(params.get("c_artistSize"), 12),
    titleWeight: params.get("c_titleWeight") || "600",
    artistWeight: params.get("c_artistWeight") || "400",
    contentAlign: params.get("c_contentAlign") || "left",
    letterSpacing: toCustomNumber(params.get("c_letterSpacing"), 0),
    textShadow: toCustomBool(params.get("c_textShadow"), false),
    artSize: toCustomNumber(params.get("c_artSize"), 52),
    artShape: params.get("c_artShape") || "rounded",
    artRadius: toCustomNumber(params.get("c_artRadius"), 10),
    artShadow: toCustomNumber(params.get("c_artShadow"), 0),
    artBorder: toCustomBool(params.get("c_artBorder"), false),
    artBorderColor: params.get("c_artBorderColor") || "rgba(255,255,255,0.2)",
    showArtist: toCustomBool(params.get("c_showArtist"), true),
    showAlbum: toCustomBool(params.get("c_showAlbum"), false),
    showProgress: toCustomBool(params.get("c_showProgress"), true),
    showRemainingTime: toCustomBool(params.get("c_showRemainingTime"), false),
    showNextTrack: toCustomBool(params.get("c_showNextTrack"), false),
    showPlayState: toCustomBool(params.get("c_showPlayState"), false),
    showBpm: toCustomBool(params.get("c_showBpm"), false),
    progressHeight: toCustomNumber(params.get("c_progressHeight"), 2),
    customColors: toCustomBool(params.get("c_customColors"), false),
    colorBg: params.get("c_colorBg") || "#0a0a0a",
    colorAccent: params.get("c_colorAccent") || "#1db954",
    colorTitle: params.get("c_colorTitle") || "#ffffff",
    colorArtist: params.get("c_colorArtist") || "rgba(255,255,255,0.5)",
    colorProgress: params.get("c_colorProgress") || "#ffffff",
    colorBorder: params.get("c_colorBorder") || "rgba(255,255,255,0.12)",
  };
}

function customShadow(level) {
  if (level <= 0) return "none";
  if (level === 1) return "0 4px 12px rgba(0,0,0,0.2)";
  if (level === 2) return "0 8px 20px rgba(0,0,0,0.3)";
  return "0 12px 28px rgba(0,0,0,0.42)";
}

function customFontFamily(value) {
  if (value === "inter") return "Inter, -apple-system, BlinkMacSystemFont, sans-serif";
  if (value === "mono") return "'SF Mono', Menlo, Monaco, Consolas, monospace";
  if (value === "serif") return "ui-serif, Georgia, Cambria, 'Times New Roman', serif";
  return "-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
}

function applyCustomStyles(rootEl, custom) {
  if (!rootEl || !custom) return;

  rootEl.style.display = "flex";
  rootEl.style.flexDirection = custom.direction === "column" ? "column" : "row";
  rootEl.style.width = `${custom.cardWidth}px`;
  rootEl.style.height = `${custom.cardHeight}px`;
  rootEl.style.maxWidth = "100%";
  rootEl.style.borderRadius = `${custom.cardRadius}px`;
  rootEl.style.padding = `${custom.cardPadding}px`;
  rootEl.style.borderWidth = `${custom.borderWidth}px`;
  rootEl.style.borderColor = custom.borderColor;
  rootEl.style.backdropFilter = `blur(${custom.blurAmount}px) saturate(180%)`;
  rootEl.style.webkitBackdropFilter = `blur(${custom.blurAmount}px) saturate(180%)`;
  rootEl.style.overflow = "hidden";
  rootEl.style.gap = "12px";
  rootEl.style.alignItems = custom.direction === "column" ? "center" : "center";
  rootEl.style.justifyContent = custom.direction === "column" ? "center" : "flex-start";
  rootEl.style.fontFamily = customFontFamily(custom.fontFamily);
  rootEl.style.background = custom.customColors
    ? custom.colorBg
    : `rgba(10,10,10,${Math.max(0, Math.min(1, custom.bgOpacity / 100))})`;

  const titleEl = rootEl.querySelector(".nw-title");
  const artistEl = rootEl.querySelector(".nw-artist");
  const albumEl = rootEl.querySelector(".nw-custom-album");
  const nextEl = rootEl.querySelector(".nw-custom-next");
  const timeEl = rootEl.querySelector(".nw-custom-time");
  const playStateEl = rootEl.querySelector(".nw-custom-playstate");
  const artEl = rootEl.querySelector(".nw-art");
  const progressEl = rootEl.querySelector(".nw-progress");
  const progressFill = rootEl.querySelector(".nw-progress-fill");
  const bpmEl = rootEl.querySelector(".nw-bpm");
  const infoEl = rootEl.querySelector(".nw-info");

  if (titleEl) {
    titleEl.style.fontSize = `${custom.titleSize}px`;
    titleEl.style.fontWeight = custom.titleWeight;
    titleEl.style.letterSpacing = `${(custom.letterSpacing || 0) / 100}em`;
    titleEl.style.color = custom.customColors ? custom.colorTitle : "";
    titleEl.style.textShadow = custom.textShadow ? "0 1px 6px rgba(0,0,0,0.45)" : "none";
    titleEl.style.textAlign = custom.contentAlign;
  }

  if (artistEl) {
    artistEl.style.display = custom.showArtist ? "" : "none";
    artistEl.style.fontSize = `${custom.artistSize}px`;
    artistEl.style.fontWeight = custom.artistWeight;
    artistEl.style.letterSpacing = `${(custom.letterSpacing || 0) / 100}em`;
    artistEl.style.color = custom.customColors ? custom.colorArtist : "";
    artistEl.style.textShadow = custom.textShadow ? "0 1px 6px rgba(0,0,0,0.45)" : "none";
    artistEl.style.textAlign = custom.contentAlign;
  }

  if (albumEl) {
    albumEl.style.display = custom.showAlbum ? "" : "none";
    albumEl.style.fontSize = `${Math.max(10, custom.artistSize - 1)}px`;
    albumEl.style.color = custom.customColors ? custom.colorArtist : "";
    albumEl.style.opacity = "0.9";
    albumEl.style.whiteSpace = "nowrap";
    albumEl.style.overflow = "hidden";
    albumEl.style.textOverflow = "ellipsis";
    albumEl.style.textAlign = custom.contentAlign;
  }

  if (artEl) {
    artEl.style.width = `${custom.artSize}px`;
    artEl.style.height = `${custom.artSize}px`;
    if (custom.artShape === "circle") {
      artEl.style.borderRadius = "50%";
    } else if (custom.artShape === "square") {
      artEl.style.borderRadius = "0";
    } else {
      artEl.style.borderRadius = `${custom.artRadius}px`;
    }
    artEl.style.boxShadow = customShadow(custom.artShadow);
    artEl.style.border = custom.artBorder ? `1px solid ${custom.artBorderColor}` : "none";
  }

  if (progressEl) {
    progressEl.style.display = custom.showProgress ? "" : "none";
    progressEl.style.height = `${custom.progressHeight}px`;
  }

  if (progressFill) {
    progressFill.style.background = custom.customColors ? custom.colorProgress : "";
  }

  if (bpmEl) {
    bpmEl.style.display = custom.showBpm ? "" : "none";
  }

  if (timeEl) {
    timeEl.style.display = custom.showRemainingTime ? "" : "none";
    timeEl.style.fontSize = "11px";
    timeEl.style.color = custom.customColors ? custom.colorArtist : "";
    timeEl.style.textAlign = custom.contentAlign;
  }

  if (nextEl) {
    nextEl.style.display = custom.showNextTrack ? "" : "none";
    nextEl.style.fontSize = "11px";
    nextEl.style.color = custom.customColors ? custom.colorArtist : "";
    nextEl.style.whiteSpace = "nowrap";
    nextEl.style.overflow = "hidden";
    nextEl.style.textOverflow = "ellipsis";
    nextEl.style.maxWidth = "220px";
    nextEl.style.textAlign = custom.contentAlign;
  }

  if (playStateEl) {
    playStateEl.style.display = custom.showPlayState ? "" : "none";
    playStateEl.style.fontSize = "11px";
    playStateEl.style.color = custom.customColors ? custom.colorArtist : "";
    playStateEl.style.textAlign = custom.contentAlign;
  }

  if (infoEl) {
    infoEl.style.width = "100%";
    infoEl.style.alignItems =
      custom.contentAlign === "center"
        ? "center"
        : custom.contentAlign === "right"
          ? "flex-end"
          : "flex-start";
  }

  const metaEl = rootEl.querySelector(".nw-custom-meta");
  if (metaEl) {
    metaEl.style.display = "flex";
    metaEl.style.gap = "8px";
    metaEl.style.alignItems = "center";
    metaEl.style.marginTop = "6px";
    metaEl.style.minHeight = "14px";
    metaEl.style.flexWrap = "nowrap";
    metaEl.style.width = "100%";
    metaEl.style.justifyContent =
      custom.contentAlign === "center"
        ? "center"
        : custom.contentAlign === "right"
          ? "flex-end"
          : "flex-start";
  }

  if (custom.customColors) {
    rootEl.style.setProperty("--nw-bg", custom.colorBg);
    rootEl.style.setProperty("--nw-accent", custom.colorAccent);
    rootEl.style.setProperty("--nw-text", custom.colorTitle);
    rootEl.style.setProperty("--nw-text-muted", custom.colorArtist);
    rootEl.style.setProperty("--nw-progress-bg", custom.colorBorder);
    rootEl.style.setProperty("--nw-glass-border", custom.colorBorder);
  }
}

function applyCustomDynamicFields(rootEl, track, extras, nextTrack) {
  if (!rootEl) return;
  const custom = config.custom || {};
  const albumEl = rootEl.querySelector(".nw-custom-album");
  const timeEl = rootEl.querySelector(".nw-custom-time");
  const nextEl = rootEl.querySelector(".nw-custom-next");
  const playStateEl = rootEl.querySelector(".nw-custom-playstate");
  const bpmEl = rootEl.querySelector(".nw-bpm");

  if (albumEl) {
    albumEl.textContent = track?.album || "";
  }

  if (timeEl) {
    if (custom.showRemainingTime && track?.durationMs) {
      const remainingMs = Math.max(0, (track.durationMs || 0) - (track.progressMs || 0));
      timeEl.textContent = `-${fmtTime(remainingMs)}`;
    } else {
      timeEl.textContent = "";
    }
  }

  if (nextEl) {
    if (custom.showNextTrack && nextTrack?.title) {
      nextEl.textContent = `Next: ${nextTrack.title}`;
    } else {
      nextEl.textContent = "";
    }
  }

  if (playStateEl) {
    if (custom.showPlayState) {
      playStateEl.textContent = track?.isPlaying ? "Playing" : "Paused";
    } else {
      playStateEl.textContent = "";
    }
  }

  if (bpmEl) {
    if (custom.showBpm && extras?.bpm) {
      bpmEl.textContent = `${extras.bpm} BPM`;
    } else {
      bpmEl.textContent = "";
    }
  }
}

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
    lastfmUsername: params.get("lastfmUsername") || "",
    lastfmApiKey: params.get("lastfmApiKey") || "",
    custom: parseCustomConfig(params),
  };
}

/** Polls Spotify and updates overlay content based on track changes. */
async function poll() {
  try {
    const useLastfm = !config.clientId && config.lastfmUsername && config.lastfmApiKey;
    sourceErrorMessage = "";
    const track = useLastfm
      ? await getLastfmNowPlaying(config.lastfmUsername, config.lastfmApiKey)
      : await getNowPlaying();
    activeSource = useLastfm ? "lastfm" : "spotify";
    if (!track) {
      currentTrackId = null;
      showIdle();
      return;
    }

    if (track.trackId !== currentTrackId) {
      currentTrackId = track.trackId;
      let extras = null;
      if (!useLastfm && !blockedAudioFeaturesTrackIds.has(track.trackId)) {
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
      let nextTrack = null;
      if (!useLastfm && config.layout === "custom" && config.custom?.showNextTrack) {
        try {
          nextTrack = await getNextTrack();
        } catch (_error) {
          nextTrack = null;
        }
      }
      render(track, extras, nextTrack);
      updateProgress(track);
      return;
    }

    updateProgress(track);
    updateStripTime(track);
    if (config.layout === "custom") {
      const rootEl = document.querySelector(".nw-overlay.nw-custom");
      if (rootEl) {
        applyCustomDynamicFields(rootEl, track, null, null);
      }
    }
  } catch (error) {
    const message = String(error?.message || "").trim();
    sourceErrorMessage = message;
    showIdle();
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
function render(track, extras, nextTrack = null) {
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
  if (config.layout === "custom") {
    applyCustomStyles(rootEl, config.custom);
    applyCustomDynamicFields(rootEl, track, extras, nextTrack);
  }

  applyBeatSync(rootEl, extras);
  if (config.moodSync) {
    applyMood(rootEl, extras, track);
  } else {
    clearMood(rootEl);
  }

  rootEl.classList.add("nw-animate-in");
  window.setTimeout(() => {
    rootEl.classList.remove("nw-animate-in");
  }, 600);

  window.dispatchEvent(new CustomEvent("nowify:trackchange", { detail: { track } }));
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

  const fallbackMessage = activeSource === "lastfm" ? "No recent Last.fm track" : "Nothing playing";
  const message = escHtml(sourceErrorMessage || fallbackMessage);
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
  const useLastfm = !config.clientId && config.lastfmUsername && config.lastfmApiKey;

  if (!useLastfm) {
    await initAuth();
    const hasToken = Boolean(localStorage.getItem("nowify_access_token"));
    if (config.clientId && !hasToken) {
      await login(config.clientId);
      return;
    }
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
