function clampMaxItems(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

/** @type {ReturnType<typeof parseConfig> | null} */
let config = null;
let headerTimer = null;
let lastPayloadAt = 0;
let lastTrackSnap = null;
let lastQueuedTitles = [];

function parseConfig() {
  const params = new URLSearchParams(window.location.search);
  const toBool = (key, fallback) => {
    const v = params.get(key);
    if (v === null) return fallback;
    return v !== "0" && String(v).toLowerCase() !== "false";
  };
  let layout = params.get("layout") || "glasscard";
  if (layout === "sidebar") {
    layout = "glasscard";
  }
  return {
    songifyPort: Number(params.get("songifyPort")) || 4002,
    theme: params.get("theme") || "obsidian",
    layout,
    artPosition: params.get("artPosition") || "left",
    maxItems: clampMaxItems(params.get("maxItems")),
    queueSource: params.get("queueSource") || "queue",
    showPosition: toBool("showPosition", true),
    showArt: toBool("showArt", true),
    showTitle: toBool("showTitle", true),
    showArtist: toBool("showArtist", true),
    showAlbum: toBool("showAlbum", false),
    showDuration: toBool("showDuration", true),
    showRequester: toBool("showRequester", true),
    showRequesterAvatar: toBool("showRequesterAvatar", true),
    showLiked: toBool("showLiked", true),
    highlightRequests: toBool("highlightRequests", false),
    showTimeLeft: toBool("showTimeLeft", false),
    showNextTrack: toBool("showNextTrack", false),
    showPlayState: toBool("showPlayState", false),
    showProgress: toBool("showProgress", false),
    transparent: params.get("transparent") === "1",
    demo: params.get("demo") === "1",
    animateIn: params.get("animateIn") || "slide",
    fontSize: Number(params.get("fontSize")) || 13,
    itemRadius: Number(params.get("itemRadius")) || 10,
    itemPadding: Number(params.get("itemPadding")) || 10,
    itemOpacity: Number(params.get("itemOpacity")) || 80,
    artSize: Number(params.get("artSize")) || 40,
    gap: Number(params.get("gap")) || 6,
    blurStrength: Number(params.get("blurStrength")) || 24,
    maxWidth: Number(params.get("maxWidth")) || 480,
    customColors: params.get("customColors") === "1",
    colorAccent: params.get("colorAccent") || "",
    colorTitle: params.get("colorTitle") || "",
    colorMuted: params.get("colorMuted") || "",
    colorCard: params.get("colorCard") || "",
  };
}

/** youtube | spotify | twitch | "" — from Songify metadata or track URL heuristics */
function inferRequesterSource(raw) {
  if (!raw || typeof raw !== "object") return "";
  const fr = raw.FullRequester ?? raw.fullRequester ?? {};
  const blob = [
    fr.Source,
    fr.source,
    fr.Service,
    fr.service,
    fr.Provider,
    fr.provider,
    fr.Platform,
    fr.platform,
    fr.Type,
    fr.type,
    raw.RequestSource,
    raw.requestSource,
    raw.RequestProvider,
    raw.requestProvider,
    raw.Provider,
    raw.provider,
  ]
    .filter((v) => v != null && String(v).trim())
    .join(" ")
    .toLowerCase();
  if (blob.includes("youtube") || blob.includes("youtu.")) return "youtube";
  if (blob.includes("spotify")) return "spotify";
  if (blob.includes("twitch")) return "twitch";
  const url = String(
    raw.Url ?? raw.url ?? raw.spotifyUrl ?? raw.YoutubeUrl ?? raw.youtubeUrl ?? ""
  ).toLowerCase();
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("spotify.com") || url.startsWith("spotify:")) return "spotify";
  return "";
}

function shouldShowRequesterRow(item) {
  const name = String(item.requesterDisplay ?? "").trim();
  if (!name) return false;
  if (!item.isSR && /^spotify$/i.test(name)) return false;
  return true;
}

function buildQueueItems(resolved) {
  if (!config || !resolved) {
    return [];
  }

  let items = [];

  if (config.queueSource === "requestqueue") {
    items = resolved.queueRequests || [];
  } else if (config.queueSource === "both") {
    function itemTrackId(i) {
      return String(i?.trackid ?? i?.trackId ?? "").trim();
    }
    const srIds = new Set(
      (resolved.queueRequests || [])
        .map(itemTrackId)
        .filter(Boolean)
    );
    const autoplay = (resolved.queueTracks || []).filter(function (i) {
      return !srIds.has(itemTrackId(i));
    });
    items = (resolved.queueRequests || []).concat(autoplay);
  } else {
    items = resolved.queueTracks || [];
  }

  return items.slice(0, config.maxItems).map(function (item, i) {
    return {
      position: i + 1,
      trackId: String(item.trackid ?? item.trackId ?? "").trim(),
      title: item.title || "",
      artist: item.artist || "",
      duration: item.length || "",
      requester: item.requester || "",
      requesterAvatar: item.FullRequester?.ProfileImageUrl || "",
      requesterDisplay:
        item.FullRequester?.DisplayName || item.requester || "",
      requesterSource: inferRequesterSource(item),
      album: "",
      albumArt: item.albumcover || "",
      isLiked: Boolean(item.IsLiked),
      isSR: Boolean(item.FullRequester),
    };
  });
}

/** Slice pre-shaped queue rows (e.g. demo) to config.maxItems and renumber positions. */
function limitDisplayQueueItems(items) {
  if (!config || !Array.isArray(items)) return [];
  const max = clampMaxItems(config.maxItems);
  return items.slice(0, max).map((item, index) => ({
    ...item,
    position: index + 1,
  }));
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMs(ms) {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function currentProgressMs() {
  const track = lastTrackSnap;
  if (!track?.durationMs) return 0;
  if (!track.isPlaying) return track.progressMs || 0;
  const elapsed = Date.now() - lastPayloadAt;
  return Math.min(track.durationMs, (track.progressMs || 0) + elapsed);
}

function renderQueueHeader(items) {
  if (!config) return "";
  const needHeader =
    config.showTimeLeft ||
    config.showProgress ||
    config.showPlayState ||
    config.showNextTrack;
  if (!needHeader) return "";

  const track = lastTrackSnap;
  const remain =
    track?.durationMs && track.durationMs > 0
      ? Math.max(0, track.durationMs - currentProgressMs())
      : 0;
  const pct =
    track?.durationMs && track.durationMs > 0
      ? Math.min(100, (currentProgressMs() / track.durationMs) * 100)
      : 0;

  let nextTitle = "";
  if (config.showNextTrack && items.length) {
    nextTitle = items[0].title || "";
  }

  const playDot =
    config.showPlayState && track?.isPlaying
      ? '<span class="q-header-dot q-header-dot-playing" aria-hidden="true"></span>'
      : config.showPlayState
        ? '<span class="q-header-dot" aria-hidden="true"></span>'
        : "";

  const timeRow =
    config.showTimeLeft && track?.title
      ? `<div class="q-header-row q-header-time">Next track in <strong>−${escHtml(fmtMs(remain))}</strong></div>`
      : config.showTimeLeft && config.demo
        ? `<div class="q-header-row q-header-time">Next track in <strong>−2:14</strong></div>`
        : "";

  const progressRow =
    config.showProgress && (track?.durationMs || config.demo)
      ? `<div class="q-header-progress" role="presentation"><div class="q-header-progress-fill" style="width:${config.demo ? 62 : pct}%"></div></div>`
      : "";

  const nextRow =
    config.showNextTrack && nextTitle
      ? `<div class="q-header-row q-header-next">Up next: ${escHtml(nextTitle)}</div>`
      : "";

  if (!playDot && !timeRow && !progressRow && !nextRow) return "";

  return `<div class="q-header">${playDot}<div class="q-header-body">${timeRow}${progressRow}${nextRow}</div></div>`;
}

function renderQueueItem(item, index) {
  if (!config) {
    return "";
  }
  const animateClass = config.animateIn !== "none" ? "q-animate" : "";
  const srClass = config.highlightRequests && item.isSR ? "q-item-sr" : "";
  const layoutClass = `q-item-${config.layout || "glasscard"}`;
  const albumLine =
    config.showAlbum && item.album
      ? `<div class="q-album">${escHtml(item.album)}</div>`
      : "";
  return `<div class="q-item ${layoutClass} ${animateClass} ${srClass}"
       style="animation-delay: ${index * 40}ms"
       data-trackid="${escHtml(item.trackId)}">

    ${
      config.showPosition
        ? `<span class="q-position">${item.position}</span>`
        : ""
    }

    ${
      config.showArt
        ? `<img class="q-art"
              src="${escHtml(item.albumArt)}"
              alt=""
              loading="lazy" />`
        : ""
    }

    <div class="q-info">
      ${
        config.showTitle
          ? `<div class="q-title">${escHtml(item.title)}</div>`
          : ""
      }
      ${
        config.showArtist
          ? `<div class="q-artist">${escHtml(item.artist)}</div>`
          : ""
      }
      ${albumLine}
      ${
        config.showRequester && shouldShowRequesterRow(item)
          ? `<div class="q-requester">
             ${
               config.showRequesterAvatar && item.requesterAvatar
                 ? `<img class="q-requester-avatar"
                       src="${escHtml(item.requesterAvatar)}"
                       alt="" />`
                 : ""
             }
             <span class="q-requester-line">
               <span class="q-requester-name">${escHtml(item.requesterDisplay)}</span>
               ${
                 item.requesterSource === "youtube"
                   ? '<span class="q-requester-badge q-requester-badge-yt">YouTube</span>'
                   : item.requesterSource === "spotify"
                     ? '<span class="q-requester-badge q-requester-badge-sp">Spotify</span>'
                     : item.requesterSource === "twitch"
                       ? '<span class="q-requester-badge q-requester-badge-tw">Twitch</span>'
                       : ""
               }
             </span>
           </div>`
          : ""
      }
    </div>

    <div class="q-meta">
      ${
        config.showDuration
          ? `<span class="q-duration">${escHtml(item.duration)}</span>`
          : ""
      }
      ${
        config.showLiked && item.isLiked
          ? `<span class="q-liked">♥</span>`
          : ""
      }
    </div>

  </div>`;
}

function applyColorOverrides() {
  const r = document.documentElement;
  if (!config || !config.customColors) {
    r.style.removeProperty("--nw-accent");
    r.style.removeProperty("--nw-text");
    r.style.removeProperty("--nw-text-muted");
    r.style.removeProperty("--q-card-bg");
    return;
  }
  if (config.colorAccent) r.style.setProperty("--nw-accent", config.colorAccent);
  if (config.colorTitle) r.style.setProperty("--nw-text", config.colorTitle);
  if (config.colorMuted) r.style.setProperty("--nw-text-muted", config.colorMuted);
  if (config.colorCard) r.style.setProperty("--q-card-bg", config.colorCard);
}

function applyLayoutRoot() {
  const app = document.getElementById("queue-app");
  if (!app || !config) return;
  app.setAttribute("data-q-layout", config.layout || "glasscard");
  app.setAttribute("data-q-art", config.artPosition === "right" ? "right" : "left");
  app.style.maxWidth = `${config.maxWidth || 480}px`;
  app.style.marginLeft = "auto";
  app.style.marginRight = "auto";
}

function renderQueue(items) {
  const app = document.getElementById("queue-app");
  if (!app) {
    return;
  }
  const header = renderQueueHeader(items);
  const body = items.map((item, i) => renderQueueItem(item, i)).join("");
  const layout = config?.layout || "glasscard";
  if (layout === "strip") {
    app.innerHTML = `${header}<div class="q-strip-track" role="list">${body}</div>`;
  } else {
    app.innerHTML = header + body;
  }
}

function stopHeaderTimer() {
  if (headerTimer) {
    window.clearInterval(headerTimer);
    headerTimer = null;
  }
}

function startHeaderTimerIfNeeded() {
  stopHeaderTimer();
  if (!config || config.demo) return;
  if (!config.showTimeLeft && !config.showProgress) return;
  headerTimer = window.setInterval(() => {
    const app = document.getElementById("queue-app");
    if (!app || !config) return;
    const items = lastQueuedTitles;
    const header = renderQueueHeader(items);
    const headerEl = app.querySelector(".q-header");
    if (headerEl) {
      headerEl.outerHTML = header || "";
    } else if (header) {
      app.insertAdjacentHTML("afterbegin", header);
    }
  }, 1000);
}

function applyDomConfig() {
  if (!config) return;
  document.documentElement.setAttribute("data-theme", config.theme);
  document.documentElement.setAttribute(
    "data-animate",
    config.animateIn === "none" ? "none" : config.animateIn
  );
  document.documentElement.style.setProperty("--nw-font-size", `${config.fontSize}px`);
  document.documentElement.style.setProperty("--q-item-radius", `${config.itemRadius}px`);
  document.documentElement.style.setProperty("--q-item-padding", `${config.itemPadding}px`);
  document.documentElement.style.setProperty(
    "--q-item-opacity",
    String(config.itemOpacity / 100)
  );
  document.documentElement.style.setProperty("--q-art-size", `${config.artSize}px`);
  document.documentElement.style.setProperty("--q-gap", `${config.gap}px`);
  document.documentElement.style.setProperty(
    "--nw-blur",
    `blur(${config.blurStrength}px) saturate(180%)`
  );
  applyColorOverrides();
  applyLayoutRoot();
  if (config.transparent) {
    document.body.style.background = "transparent";
  } else {
    document.body.style.background = "#0b0c0f";
  }
}

export async function init() {
  config = parseConfig();
  applyDomConfig();

  if (config.demo) {
    const { buildDemoQueue } = await import("./demo.js");
    const demoItems = limitDisplayQueueItems(buildDemoQueue());
    lastQueuedTitles = demoItems;
    lastTrackSnap = { title: "Current track", durationMs: 210000, progressMs: 60000, isPlaying: true };
    lastPayloadAt = Date.now();
    renderQueue(demoItems);
    return;
  }

  const { init: initSongify } = await import("../api/songify.js");
  initSongify({
    port: config.songifyPort,
    onTrack: function (track, resolved) {
      try {
        lastPayloadAt = Date.now();
        lastTrackSnap = track;
        if (!resolved) {
          return;
        }
        const items = buildQueueItems(resolved);
        if (!items.length) {
          const app = document.getElementById("queue-app");
          if (app) {
            app.innerHTML = "";
          }
          lastQueuedTitles = [];
          return;
        }
        lastQueuedTitles = items;
        renderQueue(items);
      } catch (e) {
        console.warn("[Queue] render failed:", e);
      }
    },
    onConnect: function () {
      console.warn("[Queue] Songify connected");
      startHeaderTimerIfNeeded();
    },
    onDisconnect: function () {
      const app = document.getElementById("queue-app");
      if (app) {
        app.innerHTML = "";
      }
      console.warn("[Queue] Songify disconnected");
      stopHeaderTimer();
      lastTrackSnap = null;
      lastQueuedTitles = [];
    },
  });
  startHeaderTimerIfNeeded();
}
