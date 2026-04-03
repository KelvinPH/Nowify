import { getAudioFeatures, getNextTrack, getNowPlaying } from "../api/spotify.js";
import { getLastfmNowPlaying } from "../api/lastfm.js";
import {
  handleAuthCallback,
  getValidToken,
  initiateAuth,
  NoTokenError,
} from "../auth/spotify.js";
import { LAYOUTS, escHtml, fmtTime } from "./layouts.js";
import { bindOverflowMarquees, disconnectOverflowMarquees } from "./overflow-marquee.js";
import { initVinyl, setVinylPlaying } from "../visuals/vinyl.js";
import { applyBeatSync, clearBeatSync } from "../visuals/beatsync.js";
import { applyMood, clearMood, onMoodColorsUpdated } from "../visuals/mood.js";
import { connectIRC, connectEventSub } from "../platforms/twitch.js";
import {
  backfillCurrentTrackFeatures,
  getSession,
  loadSession,
  startTrack,
} from "../stats/session.js";

let currentTrackId = null;
let pollInterval = null;
let pollingTimer = null;
let config = {};
let progressTimer = null;
const blockedAudioFeaturesTrackIds = new Set();
const audioFeaturesBackfillAttempted = new Set();
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
    contentGap: toCustomNumber(params.get("c_contentGap"), 6),
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
    contentOrder: (params.get("c_contentOrder") || "title,artist,album,progress").split(","),
    separatorStyle: params.get("c_separatorStyle") || "none",
    showTimeLeft: toCustomBool(params.get("c_showTimeLeft"), false),
    stackDir: params.get("c_stackDir") || "row",
    artPosition: params.get("c_artPosition") || "left",
    textAlign: params.get("c_textAlign") || "left",
    maxCardWidth: toCustomNumber(params.get("c_maxCardWidth"), 900),
    bgType: params.get("c_bgType") || "solid",
    gradientAngle: toCustomNumber(params.get("c_gradientAngle"), 135),
    gradientRadius: toCustomNumber(params.get("c_gradientRadius"), 70),
    gradientColor1: params.get("c_gradientColor1") || "rgba(10,10,10,0.85)",
    gradientColor2: params.get("c_gradientColor2") || "rgba(30,30,30,0.85)",
    gradientColor3: params.get("c_gradientColor3") || "rgba(20,20,20,0.85)",
    gradientColor4: params.get("c_gradientColor4") || "rgba(15,15,15,0.85)",
    gradientPos1: toCustomNumber(params.get("c_gradientPos1"), 0),
    gradientPos2: toCustomNumber(params.get("c_gradientPos2"), 100),
    gradientPos3: toCustomNumber(params.get("c_gradientPos3"), 50),
    gradientPos4: toCustomNumber(params.get("c_gradientPos4"), 75),
    borderStyle: params.get("c_borderStyle") || "solid",
    accentLine: toCustomBool(params.get("c_accentLine"), false),
    accentLineColor: params.get("c_accentLineColor") || "#1DB954",
    cardShadow: toCustomNumber(params.get("c_cardShadow"), 0),
    innerGlow: toCustomNumber(params.get("c_innerGlow"), 0),
    progressStyle: params.get("c_progressStyle") || "line",
    progressPosition: params.get("c_progressPosition") || "bottom",
    animateIn: params.get("c_animateIn") || "slide",
    animateSpeed: toCustomNumber(params.get("c_animateSpeed"), 250),
    trackTransition: params.get("c_trackTransition") || "crossfade",
    moodTransition: toCustomBool(params.get("c_moodTransition"), true),
    progressHeight: toCustomNumber(params.get("c_progressHeight"), 2),
    customColors: toCustomBool(params.get("c_customColors"), false),
    colorBg: params.get("c_colorBg") || "#0a0a0a",
    colorAccent: params.get("c_colorAccent") || "#1db954",
    colorTitle: params.get("c_colorTitle") || "#ffffff",
    colorArtist: params.get("c_colorArtist") || "rgba(255,255,255,0.5)",
    colorProgress: params.get("c_colorProgress") || "#ffffff",
    colorBorder: params.get("c_colorBorder") || "rgba(255,255,255,0.12)",
    animBgEnabled: params.has("c_animBgEnabled")
      ? toCustomBool(params.get("c_animBgEnabled"), false)
      : undefined,
    animBgStyle: params.has("c_animBgStyle") ? params.get("c_animBgStyle") || "aurora" : undefined,
    animBgSpeed: params.has("c_animBgSpeed")
      ? toCustomNumber(params.get("c_animBgSpeed"), 12)
      : undefined,
    animBgColorMode: params.has("c_animBgColorMode")
      ? params.get("c_animBgColorMode") || "mood"
      : undefined,
    animBgColor1: params.get("c_animBgColor1") || "",
    animBgColor2: params.get("c_animBgColor2") || "",
  };
}

function buildBackgroundCSS(custom) {
  // If user disabled custom colours, don't override theme/mood background.
  if (!custom?.customColors) return "var(--nw-bg)";

  const c1 = custom.gradientColor1 || "rgba(10,10,10,0.85)";
  const c2 = custom.gradientColor2 || "rgba(30,30,30,0.85)";
  const c3 = custom.gradientColor3 || "rgba(20,20,20,0.85)";
  const c4 = custom.gradientColor4 || "rgba(15,15,15,0.85)";
  const p1 = custom.gradientPos1 ?? 0;
  const p2 = custom.gradientPos2 ?? 100;
  const p3 = custom.gradientPos3 ?? 50;
  const p4 = custom.gradientPos4 ?? 75;
  const angle = custom.gradientAngle || 135;
  const radialRadius = custom.gradientRadius ?? 70;
  if (custom.bgType === "linear") return `linear-gradient(${angle}deg, ${c1} ${p1}%, ${c2} ${p2}%)`;
  if (custom.bgType === "radial")
    return `radial-gradient(circle at center, ${c1} ${p1}%, ${c2} ${radialRadius}%)`;
  if (custom.bgType === "conic") return `conic-gradient(from ${angle}deg, ${c1}, ${c2}, ${c1})`;
  if (custom.bgType === "multistop") {
    const stops = [
      { c: c1, p: p1 },
      { c: c2, p: p2 },
      { c: c3, p: p3 },
      { c: c4, p: p4 },
    ].sort((a, b) => a.p - b.p);
    const body = stops.map((s) => `${s.c} ${s.p}%`).join(", ");
    return `linear-gradient(${angle}deg, ${body})`;
  }
  const solid = custom.colorBg || "var(--nw-bg)";
  const op = Number(custom.bgOpacity);
  if (Number.isFinite(op) && op < 100 && op >= 0) {
    return `color-mix(in srgb, ${solid} ${op}%, transparent)`;
  }
  return solid;
}

function applyAdvancedCssVars(custom) {
  if (!custom) return;
  const root = document.documentElement;
  root.style.setProperty("--nw-stack-dir", custom.stackDir || "row");
  root.style.setProperty("--nw-art-order", custom.artPosition === "right" ? "2" : "0");
  root.style.setProperty("--nw-art-display", custom.artPosition === "hidden" ? "none" : "flex");
  root.style.setProperty("--nw-text-align", custom.textAlign || "left");
  root.style.setProperty("--nw-max-width", `${custom.maxCardWidth || 900}px`);
  // background is derived from var(--nw-card-bg) which is now safe because buildBackgroundCSS
  // respects custom.customColors.
  root.style.setProperty("--nw-card-bg", buildBackgroundCSS(custom));
  root.style.setProperty("--nw-border-width", `${custom.borderWidth || 0.5}px`);
  root.style.setProperty("--nw-border-style", custom.borderStyle || "solid");
  const borderTint = custom.customColors
    ? custom.colorBorder || "rgba(255,255,255,0.12)"
    : custom.borderColor || "rgba(255,255,255,0.12)";
  root.style.setProperty("--nw-border-color", borderTint);
  const shadows = [
    "none",
    "0 2px 8px rgba(0,0,0,0.3)",
    "0 4px 20px rgba(0,0,0,0.4)",
    "0 8px 32px rgba(0,0,0,0.5)",
    "0 16px 48px rgba(0,0,0,0.6)",
  ];
  root.style.setProperty("--nw-card-shadow", shadows[custom.cardShadow || 0]);
  const accent = custom.colorAccent || "var(--nw-accent)";
  const glows = [
    "none",
    `inset 0 0 8px ${accent}22`,
    `inset 0 0 16px ${accent}33`,
    `inset 0 0 24px ${accent}44`,
    `inset 0 0 32px ${accent}55`,
  ];
  root.style.setProperty("--nw-inner-glow", glows[custom.innerGlow || 0]);
  if (custom.accentLine) {
    root.style.setProperty("--nw-accent-line-color", custom.accentLineColor || "var(--nw-accent)");
    root.style.setProperty("--nw-accent-line", "3px");
  } else {
    root.style.removeProperty("--nw-accent-line");
  }
  root.style.setProperty("--nw-animate-speed", `${custom.animateSpeed || 250}ms`);

  // Keep border rendering radius-safe by using normal border style.
  root.style.removeProperty("--nw-border-gradient");
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
  const widthPx = custom.maxCardWidth || custom.cardWidth || 400;
  rootEl.style.width = `${widthPx}px`;
  rootEl.style.maxWidth = "100%";
  rootEl.style.borderRadius = `${custom.cardRadius}px`;
  rootEl.style.padding = `${custom.cardPadding}px`;
  rootEl.style.borderWidth = `${custom.borderWidth}px`;
  rootEl.dataset.nwBorderGradient = "";
  rootEl.style.borderColor = custom.customColors
    ? custom.colorBorder || custom.borderColor
    : custom.borderColor;
  rootEl.style.backdropFilter = `blur(${custom.blurAmount}px) saturate(180%)`;
  rootEl.style.webkitBackdropFilter = `blur(${custom.blurAmount}px) saturate(180%)`;
  rootEl.style.overflow = "hidden";
  rootEl.style.gap = "12px";
  rootEl.style.alignItems = custom.direction === "column" ? "center" : "center";
  rootEl.style.justifyContent = custom.direction === "column" ? "center" : "flex-start";
  rootEl.style.fontFamily = customFontFamily(custom.fontFamily);
  // For gradients we must use var(--nw-card-bg) instead of custom.colorBg.
  rootEl.style.background = custom.customColors
    ? "var(--nw-card-bg)"
    : `rgba(10,10,10,${Math.max(0, Math.min(1, custom.bgOpacity / 100))})`;

  // Mood sync should not override user-chosen colours.
  rootEl.dataset.nwCustomColors = custom.customColors ? "1" : "";

  // Allow the card to grow when more elements are enabled, instead of hard-clipping.
  const visibleMetaCount =
    (custom.showRemainingTime || custom.showTimeLeft ? 1 : 0) +
    (custom.showNextTrack ? 1 : 0) +
    (custom.showPlayState ? 1 : 0) +
    (custom.showBpm ? 1 : 0);
  const visibleContentCount =
    (custom.showArtist ? 1 : 0) +
    (custom.showAlbum ? 1 : 0) +
    (custom.showProgress ? 1 : 0);
  const extra = visibleMetaCount * 18 + visibleContentCount * 10;
  rootEl.style.height = "auto";
  rootEl.style.minHeight = `${Math.max(custom.cardHeight || 80, (custom.cardHeight || 80) + extra)}px`;

  const titleEls = rootEl.querySelectorAll(".nw-title");
  const artistEls = rootEl.querySelectorAll(".nw-artist");
  const albumEl = rootEl.querySelector(".nw-custom-album");
  const nextEl = rootEl.querySelector(".nw-custom-next");
  const timeEl = rootEl.querySelector(".nw-custom-time");
  const playStateEl = rootEl.querySelector(".nw-custom-playstate");
  const artEl = rootEl.querySelector(".nw-art");
  const progressEl = rootEl.querySelector(".nw-progress");
  const progressFill = rootEl.querySelector(".nw-progress-fill");
  const bpmEl = rootEl.querySelector(".nw-bpm");
  const infoEl = rootEl.querySelector(".nw-info");

  titleEls.forEach((titleEl) => {
    titleEl.style.fontSize = `${custom.titleSize}px`;
    titleEl.style.fontWeight = custom.titleWeight;
    titleEl.style.letterSpacing = `${(custom.letterSpacing || 0) / 100}em`;
    titleEl.style.color = custom.customColors ? custom.colorTitle : "";
    titleEl.style.textShadow = custom.textShadow ? "0 1px 6px rgba(0,0,0,0.45)" : "none";
    titleEl.style.textAlign = custom.contentAlign;
  });

  artistEls.forEach((artistEl) => {
    artistEl.style.display = custom.showArtist ? "" : "none";
    artistEl.style.fontSize = `${custom.artistSize}px`;
    artistEl.style.fontWeight = custom.artistWeight;
    artistEl.style.letterSpacing = `${(custom.letterSpacing || 0) / 100}em`;
    artistEl.style.color = custom.customColors ? custom.colorArtist : "";
    artistEl.style.textShadow = custom.textShadow ? "0 1px 6px rgba(0,0,0,0.45)" : "none";
    artistEl.style.textAlign = custom.contentAlign;
  });

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
    const artBorderCol = custom.customColors
      ? custom.colorBorder || "rgba(255,255,255,0.25)"
      : "rgba(255,255,255,0.25)";
    artEl.style.border = custom.artBorder ? `1px solid ${artBorderCol}` : "none";
  }

  if (progressEl) {
    progressEl.style.display = custom.showProgress ? "" : "none";
    progressEl.style.height = `${custom.progressHeight}px`;
    progressEl.dataset.progressStyle = custom.progressStyle || "line";
  }

  if (progressFill) {
    if (custom.progressStyle === "dots") {
      const accentColor = custom.customColors ? custom.colorProgress : "var(--nw-accent)";
      progressFill.style.background = `repeating-radial-gradient(circle at center, ${accentColor} 0 1.1px, transparent 1.25px)`;
    } else {
      progressFill.style.background = custom.customColors ? custom.colorProgress : "";
    }
  }

  if (bpmEl) {
    bpmEl.style.display = custom.showBpm ? "" : "none";
  }

  if (timeEl) {
    timeEl.style.display =
      custom.showTimeLeft || custom.showRemainingTime ? "" : "none";
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
    infoEl.style.display = "flex";
    infoEl.style.flexDirection = "column";
    infoEl.style.width = "100%";
    infoEl.style.gap = `${Math.max(0, custom.contentGap ?? 6)}px`;
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

function applyDefaultDynamicFields(rootEl, track, nextTrack) {
  if (!rootEl) return;
  const albumEl = rootEl.querySelector(".nw-meta-album");
  const timeEl = rootEl.querySelector(".nw-meta-time");
  const nextEl = rootEl.querySelector(".nw-meta-next");
  const playEl = rootEl.querySelector(".nw-meta-playstate");

  if (albumEl) {
    albumEl.textContent = track?.album ? `Album: ${track.album}` : "";
  }

  if (timeEl) {
    if (config.showTimeLeft && track?.durationMs) {
      const remainingMs = Math.max(0, (track.durationMs || 0) - (track.progressMs || 0));
      timeEl.textContent = `-${fmtTime(remainingMs)}`;
    } else {
      timeEl.textContent = "";
    }
  }

  if (nextEl) {
    nextEl.textContent = config.showNextTrack && nextTrack?.title ? `Next: ${nextTrack.title}` : "";
  }

  if (playEl) {
    playEl.innerHTML = config.showPlayState && track?.isPlaying ? '<div class="nw-playing-dot"></div>' : "";
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
    if ((custom.showTimeLeft || custom.showRemainingTime) && track?.durationMs) {
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
      playStateEl.innerHTML = track?.isPlaying
        ? '<div class="nw-playing-dot"></div>'
        : "";
    } else {
      playStateEl.innerHTML = "";
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

  const layout = params.get("layout") || "glasscard";
  const isCustomLayout = layout === "custom";
  const custom = parseCustomConfig(params);

  const animBgEnabled = isCustomLayout
    ? custom.animBgEnabled !== undefined
      ? custom.animBgEnabled
      : toBool(params.get("animBgEnabled"), false)
    : toBool(params.get("animBgEnabled"), false);
  let animBgStyle = isCustomLayout
    ? custom.animBgStyle || params.get("animBgStyle") || "aurora"
    : params.get("animBgStyle") || "aurora";
  if (animBgStyle === "conic") {
    animBgStyle = "aurora";
  }
  const animBgSpeed = isCustomLayout
    ? custom.animBgSpeed !== undefined
      ? custom.animBgSpeed
      : Number(params.get("animBgSpeed")) || 12
    : Number(params.get("animBgSpeed")) || 12;
  const animBgColorMode = isCustomLayout
    ? custom.animBgColorMode || params.get("animBgColorMode") || "mood"
    : "mood";
  const animBgColor1 = isCustomLayout
    ? params.get("c_animBgColor1") || params.get("animBgColor1") || custom.animBgColor1 || ""
    : params.get("animBgColor1") || "";
  const animBgColor2 = isCustomLayout
    ? params.get("c_animBgColor2") || params.get("animBgColor2") || custom.animBgColor2 || ""
    : params.get("animBgColor2") || "";

  return {
    layout,
    theme: params.get("theme") || "spotify",
    source: params.get("source") || "spotify",
    songifyPort: Number(params.get("songifyPort")) || 4002,
    clientId: params.get("clientId") || "",
    demo: toBool(params.get("demo"), false),
    canvasEnabled: params.get("canvasEnabled") === "1",
    animBgEnabled,
    animBgStyle,
    animBgSpeed,
    animBgColorMode,
    animBgColor1,
    animBgColor2,
    showBpm: toBool(params.get("showBpm"), false),
    showTimeLeft: toBool(params.get("showTimeLeft"), false),
    showNextTrack: toBool(params.get("showNextTrack"), false),
    showAlbum: toBool(params.get("showAlbum"), false),
    showPlayState: toBool(params.get("showPlayState"), false),
    showProgress: toBool(params.get("showProgress"), true),
    showIdleMessage: toBool(params.get("showIdleMessage"), false),
    transparent: toBool(params.get("transparent"), false),
    moodSync: toBool(params.get("moodSync"), true),
    twitchChannel: params.get("twitchChannel") || "",
    twitchUsername: params.get("twitchUsername") || "",
    twitchToken: params.get("twitchToken") || "",
    lastfmUsername: params.get("lastfmUsername") || "",
    lastfmApiKey: params.get("lastfmApiKey") || "",
    custom,
  };
}

function removeAnimatedBackground() {
  document.querySelector(".nw-animated-bg")?.remove();
  document.documentElement.style.removeProperty("--nw-anim-color1");
  document.documentElement.style.removeProperty("--nw-anim-color2");
  document.documentElement.style.removeProperty("--nw-anim-speed");
}

function ensureAnimatedBackgroundLayer(rootEl) {
  if (!rootEl) {
    return null;
  }
  let bg = rootEl.querySelector(".nw-animated-bg");
  if (!bg) {
    bg = document.createElement("div");
    bg.className = "nw-animated-bg";
    rootEl.prepend(bg);
  }
  bg.dataset.style = config.animBgStyle;
  document.documentElement.style.setProperty("--nw-anim-speed", `${config.animBgSpeed}s`);
  return bg;
}

async function updateAnimatedBgColors() {
  const bg = document.querySelector(".nw-animated-bg");
  if (!bg) {
    return;
  }

  let c1;
  let c2;
  if (config.animBgColorMode === "custom" && config.animBgColor1 && config.animBgColor2) {
    c1 = config.animBgColor1;
    c2 = config.animBgColor2;
  } else {
    const { getMoodColors: getPalette } = await import("../visuals/mood.js");
    const [mc1, mc2] = getPalette();
    c1 = mc1 || "rgba(145,70,255,0.6)";
    c2 = mc2 || "rgba(30,30,80,0.8)";
  }

  document.documentElement.style.setProperty("--nw-anim-color1", c1);
  document.documentElement.style.setProperty("--nw-anim-color2", c2);
}

function registerAnimatedBackgroundMoodHook() {
  if (!config.animBgEnabled || config.animBgColorMode !== "mood") {
    return;
  }
  onMoodColorsUpdated((c1, c2) => {
    if (!config.animBgEnabled || config.animBgColorMode !== "mood") {
      return;
    }
    document.documentElement.style.setProperty("--nw-anim-color1", c1);
    document.documentElement.style.setProperty("--nw-anim-color2", c2);
  });
}

/** Loads Spotify audio features unless blocked or using Last.fm. */
async function fetchTrackAudioExtras(trackId, useLastfm) {
  if (useLastfm || blockedAudioFeaturesTrackIds.has(trackId)) {
    return null;
  }
  try {
    return await getAudioFeatures(trackId);
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("Spotify API error 403")) {
      blockedAudioFeaturesTrackIds.add(trackId);
      console.warn(
        "[Nowify] Spotify blocked audio-features for this track or app (403). BPM / energy stats need that endpoint."
      );
    }
    return null;
  }
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

    let nextTrack = null;
    if (!useLastfm && (config.showNextTrack || (config.layout === "custom" && config.custom?.showNextTrack))) {
      try {
        nextTrack = await getNextTrack();
      } catch (_error) {
        nextTrack = null;
      }
    }

    if (track.trackId !== currentTrackId) {
      audioFeaturesBackfillAttempted.clear();
      currentTrackId = track.trackId;
      const extras = await fetchTrackAudioExtras(track.trackId, useLastfm);
      await render(track, extras, nextTrack);
      updateProgress(track);
      return;
    }

    const appEl = document.getElementById("app");
    const needsInitialRender = Boolean(appEl && !appEl.querySelector(".nw-overlay"));
    if (needsInitialRender) {
      const extras = await fetchTrackAudioExtras(track.trackId, useLastfm);
      await render(track, extras, nextTrack, { skipSession: true });
      updateProgress(track);
      return;
    }

    updateProgress(track);
    updateStripTime(track);

    if (
      !useLastfm &&
      track.trackId &&
      !blockedAudioFeaturesTrackIds.has(track.trackId) &&
      !audioFeaturesBackfillAttempted.has(track.trackId)
    ) {
      const { tracks: sessionTracks } = getSession();
      const last = sessionTracks[sessionTracks.length - 1];
      if (
        last?.trackId === track.trackId &&
        (last.bpm == null || last.energy == null || last.valence == null)
      ) {
        audioFeaturesBackfillAttempted.add(track.trackId);
        try {
          const extras = await getAudioFeatures(track.trackId);
          if (extras) {
            backfillCurrentTrackFeatures(track.trackId, extras);
          }
        } catch (_error) {
          /* ignore */
        }
      }
    }

    if (config.layout === "custom") {
      const rootEl = document.querySelector(".nw-overlay.nw-custom");
      if (rootEl) {
        applyCustomDynamicFields(rootEl, track, null, null);
      }
    } else {
      const rootEl = document.querySelector(".nw-overlay");
      if (rootEl) {
        applyDefaultDynamicFields(rootEl, track, nextTrack);
      }
    }

    const syncRoot = document.querySelector(".nw-overlay");
    if (syncRoot) {
      if (config.animBgEnabled) {
        const bg = ensureAnimatedBackgroundLayer(syncRoot);
        if (track?.isPlaying) {
          bg?.classList.add("nw-bg-active");
        } else {
          bg?.classList.remove("nw-bg-active");
        }
      } else {
        removeAnimatedBackground();
      }

      if (config.source === "songify" && config.canvasEnabled) {
        void import("../visuals/canvas.js").then(({ initCanvas, updateCanvas }) => {
          const artEl = syncRoot.querySelector(".nw-art img, .nw-art");
          if (artEl) {
            initCanvas(artEl);
          }
          updateCanvas(track?.canvasUrl || "", true);
        });
      }
    }
  } catch (error) {
    if (error?.name === "NoTokenError" || error instanceof NoTokenError) {
      stopPolling();
      await initiateAuth(config.clientId);
      return;
    }
    console.warn("[Spotify] Poll error:", error);
  }
}

/** Starts immediate polling plus a recurring poll interval. */
export async function startPolling(intervalMs = 3000) {
  stopPolling();
  await poll();
  pollingTimer = window.setInterval(() => {
    poll();
  }, intervalMs);
  pollInterval = pollingTimer;
  return pollingTimer;
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function startAuthRedirect() {
  if (!config?.clientId) return;
  await initiateAuth(config.clientId);
}

function startDemo() {
  sourceErrorMessage = "Demo mode";
  showIdle();
}

/** Renders a track using the selected layout and transition class. */
async function render(track, extras, nextTrack = null, options = {}) {
  const { skipSession = false } = options;
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  if (!skipSession) {
    startTrack(track, extras);
  }
  const layoutFn = LAYOUTS[config.layout] || LAYOUTS.glasscard;
  app.innerHTML = layoutFn(track, extras, config);

  const rootEl = app.querySelector(".nw-overlay");
  if (!rootEl) {
    return;
  }

  const fill = app.querySelector(".nw-progress-fill");
  if (fill) fill.style.transition = "width 0.1s linear";
  if (config.layout === "custom") {
    rootEl.setAttribute("data-animate", config.custom?.animateIn || "slide");
    applyAdvancedCssVars(config.custom);
    applyCustomStyles(rootEl, config.custom);
    applyCustomDynamicFields(rootEl, track, extras, nextTrack);
  } else {
    applyDefaultDynamicFields(rootEl, track, nextTrack);
  }

  applyBeatSync(rootEl, extras);
  if (config.moodSync) {
    await applyMood(rootEl, extras, track);
  } else {
    clearMood(rootEl);
  }

  if (config.animBgEnabled) {
    const bg = ensureAnimatedBackgroundLayer(rootEl);
    if (track?.isPlaying) {
      bg?.classList.add("nw-bg-active");
      await updateAnimatedBgColors();
    } else {
      bg?.classList.remove("nw-bg-active");
    }
  } else {
    removeAnimatedBackground();
  }

  if (config.source === "songify" && config.canvasEnabled) {
    const { initCanvas, updateCanvas } = await import("../visuals/canvas.js");
    const artEl = rootEl.querySelector(".nw-art img, .nw-art");
    if (artEl) {
      initCanvas(artEl);
    }
    updateCanvas(track?.canvasUrl || "", true);
  }

  bindOverflowMarquees(rootEl);

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
  if (!timeEl) return;
  if (!config.showTimeLeft) {
    timeEl.textContent = "";
    return;
  }
  if (track?.durationMs) {
    const remainingMs = Math.max(0, (track.durationMs || 0) - (track.progressMs || 0));
    timeEl.textContent = `-${fmtTime(remainingMs)}`;
    return;
  }
  timeEl.textContent = "";
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

  disconnectOverflowMarquees();

  import("../visuals/canvas.js")
    .then(({ clearCanvas }) => clearCanvas())
    .catch(() => {});

  const fallbackMessage = activeSource === "lastfm" ? "No recent Last.fm track" : "Nothing playing";
  const text = sourceErrorMessage || (config.showIdleMessage ? fallbackMessage : "");
  if (!text) {
    app.innerHTML = "";
  } else {
    app.innerHTML = `<div class="nw-idle">${escHtml(text)}</div>`;
  }
  removeAnimatedBackground();
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
  loadSession();
  const { tracks: restoredTracks } = getSession();
  const lastRestored = restoredTracks[restoredTracks.length - 1];
  if (lastRestored?.trackId) {
    currentTrackId = lastRestored.trackId;
  }

  const callbackHasCode = new URLSearchParams(window.location.search).has("code");
  const storedClientId = localStorage.getItem("nowify_client_id") || "";
  if (!config.clientId && storedClientId) {
    config.clientId = storedClientId;
  }
  document.documentElement.setAttribute("data-theme", config.theme);
  const useLastfm = !config.clientId && config.lastfmUsername && config.lastfmApiKey;
  const hasSpotifySource = Boolean(config.clientId);
  const hasLastfmSource = Boolean(config.lastfmUsername && config.lastfmApiKey);

  if (callbackHasCode) {
    const callbackHandled = await handleAuthCallback();
    if (callbackHandled) {
      await startPolling();
      startProgressTimer();
      return;
    }
  }

  if (config.demo || (!config.clientId && !hasLastfmSource)) {
    startDemo();
    return;
  }

  // Direct overlay URL without source config should not poll endlessly.
  if (!hasSpotifySource && !hasLastfmSource) {
    sourceErrorMessage = "No source configured. Open the Configurator and copy your overlay URL.";
    showIdle();
    return;
  }

  if (!useLastfm) {
    localStorage.setItem("nowify_client_id", config.clientId);
    try {
      await getValidToken();
    } catch (error) {
      if (error?.name === "NoTokenError" || error instanceof NoTokenError) {
        await startAuthRedirect();
        return;
      }
      console.warn("[Spotify] Init token check failed:", error);
    }
  }

  if (config.transparent) {
    document.body.style.background = "transparent";
  }

  if (!config.animBgEnabled) {
    removeAnimatedBackground();
  } else {
    registerAnimatedBackgroundMoodHook();
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
