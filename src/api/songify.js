const DEFAULT_PORT = 4002;
const RECONNECT_DELAYS = [2000, 4000, 8000, 15000, 30000];
const HTTP_POLL_MS = 1500;
const DATA_PATH = "/ws/data";

/** Root path: Songify command API (skip, queue_add, …). */
let commandSocket = null;
/** Track updates are pushed on this path (not on `/`). */
let dataSocket = null;
let reconnectTimer = null;
let commandReconnectTimer = null;
let reconnectAttempts = 0;
let port = DEFAULT_PORT;
let onTrackCallback = null;
let onConnectCallback = null;
let onDisconnectCallback = null;
let httpPollTimer = null;
let lastEmitSig = "";
let versionLogged = false;
let _isConnected = false;

function normalizeMs(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1000 ? n * 1000 : n;
}

function scheduleReconnect() {
  try {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    reconnectAttempts += 1;
    reconnectTimer = window.setTimeout(function () {
      connectDataSocket();
    }, delay);
  } catch (_error) {}
}

function pickStr(obj, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    const v = obj[k];
    if (v != null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
}

function normalizeArtist(data) {
  const a = data.Artists ?? data.artists ?? data.artist;
  if (Array.isArray(a)) {
    return a
      .map((x) => (typeof x === "string" ? x : x?.name || x?.Name || ""))
      .filter(Boolean)
      .join(", ");
  }
  return String(a || "").trim();
}

function albumArtFromAlbums(data) {
  const albums = data.Albums ?? data.albums;
  if (!Array.isArray(albums) || !albums.length) {
    return "";
  }
  const img = albums[0];
  if (typeof img === "string") {
    return img;
  }
  return String(img?.Url || img?.url || "").trim();
}

/** Songify HTTP API and occasional WS payloads use PascalCase (see Songify docs). */
function unwrapPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const inner = raw.data;
  if (
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    (inner.Title || inner.title || inner.SongId || inner.songId)
  ) {
    return inner;
  }
  return raw;
}

function computeDurationMs(data) {
  let d = Number(data.DurationMs ?? data.durationMs ?? 0);
  if (Number.isFinite(d) && d > 0) {
    return d < 10000 ? d * 1000 : d;
  }
  const total = Number(data.DurationTotal ?? data.durationTotal ?? 0);
  if (Number.isFinite(total) && total > 0) {
    return total < 100000 ? total * 1000 : total;
  }
  return 0;
}

function computeProgressMs(data, durationMs) {
  const pct = Number(data.DurationPercentage ?? data.durationPercentage);
  if (Number.isFinite(pct) && durationMs > 0 && pct >= 0 && pct <= 100) {
    return Math.round((pct / 100) * durationMs);
  }
  let p = Number(data.Progress ?? data.progress ?? data.progressMs ?? 0);
  if (!Number.isFinite(p) || p < 0) {
    return 0;
  }
  if (durationMs > 0 && p <= 100 && p === Math.floor(p)) {
    return Math.round((p / 100) * durationMs);
  }
  if (durationMs > 0 && p > durationMs * 2) {
    return normalizeMs(p);
  }
  if (p > 0 && p < 1000 && durationMs > 5000) {
    return Math.round((p / 100) * durationMs);
  }
  return normalizeMs(p);
}

function resolvedFromEnvelope(data) {
  if (!data || typeof data !== "object") {
    return { queueTracks: [], queueRequests: [], queueCount: 0 };
  }
  const isNew = Boolean(data.Track?.Data);
  if (isNew) {
    return {
      queueTracks: Array.isArray(data.Queue?.Tracks) ? data.Queue.Tracks : [],
      queueRequests: Array.isArray(data.Queue?.Requests) ? data.Queue.Requests : [],
      queueCount: Number(data.Queue?.Count) || 0,
    };
  }
  return {
    queueTracks: Array.isArray(data.Queue) ? data.Queue : [],
    queueRequests: Array.isArray(data.RequestQueue) ? data.RequestQueue : [],
    queueCount: Number(data.QueueCount) || 0,
  };
}

/**
 * Maps Songify's public HTTP JSON (GET /) or WS payloads to the overlay track shape.
 * Supports the envelope { Track: { Data, … }, Queue, … } and legacy flat payloads.
 */
export function mapSongifyPayload(raw) {
  try {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const isNew = Boolean(raw.Track?.Data);
    const data = isNew ? raw.Track.Data : unwrapPayload(raw);
    if (!data || typeof data !== "object") {
      return null;
    }

    const title = String(data.Title ?? data.title ?? "").trim();
    const artist = isNew ? String(data.Artists ?? "").trim() : normalizeArtist(data);
    if (!title && !artist) {
      return null;
    }

    const albums = Array.isArray(data.Albums) ? data.Albums : [];
    const albumArt =
      albums[0]?.Url || albums[1]?.Url || albums[2]?.Url || albumArtFromAlbums(data);
    const album =
      albums[0] && (albums[0].Width != null || albums[0].Height != null)
        ? `${albums[0].Width}x${albums[0].Height}`
        : pickStr(data, ["Album", "album"]);

    const isPlaying = data.IsPlaying !== false && data.isPlaying !== false;
    const songId =
      pickStr(data, ["SongId", "songId", "trackId", "id"]) || `${artist}-${title}`;

    const durationMs = computeDurationMs(data);
    const progressMs = computeProgressMs(data, durationMs);

    const trackUrl = pickStr(data, ["Url", "spotifyUrl", "url"]);
    const canvasUrl = isNew
      ? String(raw.Track?.CanvasUrl || "").trim()
      : pickStr(data, [
          "CanvasUrl",
          "canvasUrl",
          "canvasURL",
          "SpotifyCanvasUrl",
          "spotifyCanvasUrl",
        ]);
    const isLiked = isNew ? Boolean(raw.Track?.IsInLikedPlaylist) : Boolean(data.IsInLikedPlaylist);
    const requester = isNew
      ? String(raw.Track?.Requester?.Name || "").trim()
      : pickStr(data, ["requester", "Requester"]);

    return {
      isPlaying,
      trackId: String(songId || "").trim(),
      title,
      artist,
      album: String(album || "").trim(),
      albumArt: String(albumArt || "").trim(),
      durationMs,
      progressMs,
      trackUrl,
      canvasUrl,
      source: "songify",
      requester,
      isLiked,
    };
  } catch (_error) {
    return null;
  }
}

function handleMessage(data) {
  try {
    if (!data) {
      return;
    }

    const isNewStructure = Boolean(data?.Track?.Data);

    let trackData;
    let canvasUrl;
    let isLiked;
    let requester;
    let queueTracks;
    let queueRequests;
    let queueCount;

    if (isNewStructure) {
      trackData = data.Track.Data;
      canvasUrl = data.Track?.CanvasUrl || "";
      isLiked = data.Track?.IsInLikedPlaylist || false;
      requester = data.Track?.Requester?.Name || "";
      queueTracks = data.Queue?.Tracks || [];
      queueRequests = data.Queue?.Requests || [];
      queueCount = data.Queue?.Count || 0;
    } else {
      trackData = data;
      canvasUrl = data.CanvasUrl || "";
      isLiked = data.IsInLikedPlaylist || false;
      requester =
        typeof data.Requester === "object" && data.Requester !== null
          ? String(data.Requester.Name || "").trim()
          : String(data.Requester || "").trim();
      queueTracks = data.Queue || [];
      queueRequests = data.RequestQueue || [];
      queueCount = data.QueueCount || 0;
    }

    const resolved = {
      queueTracks,
      queueRequests,
      queueCount,
    };

    const title = isNewStructure
      ? String(trackData?.Title || "").trim()
      : pickStr(trackData, ["Title", "title", "song", "track"]);
    const artist = isNewStructure
      ? String(trackData?.Artists || "").trim()
      : normalizeArtist(trackData);
    if (!title && !artist) {
      return;
    }

    if (!versionLogged && data?.SongifyInfo?.Version) {
      console.warn(
        `[Songify] Version: ${data.SongifyInfo.Version}`,
        data.SongifyInfo.Beta ? "(beta)" : ""
      );
      versionLogged = true;
    }

    const albums = Array.isArray(trackData?.Albums) ? trackData.Albums : [];
    const albumArt = albums[0]?.Url || albums[1]?.Url || albums[2]?.Url || "";

    const durationMs = computeDurationMs(trackData);
    const progressMs = computeProgressMs(trackData, durationMs);

    const isPlaying = trackData?.IsPlaying !== false;

    const songId =
      pickStr(trackData, ["SongId", "songId", "trackId", "id"]) || `${artist}-${title}`;

    const album =
      albums[0] && (albums[0].Width != null || albums[0].Height != null)
        ? `${albums[0].Width}x${albums[0].Height}`
        : "";

    const track = {
      isPlaying,
      trackId: songId,
      title,
      artist,
      album,
      albumArt,
      durationMs,
      progressMs,
      trackUrl: trackData?.Url || "",
      source: "songify",
      requester: String(requester || "").trim(),
      canvasUrl: String(canvasUrl || "").trim(),
      isLiked,
    };

    if (typeof onTrackCallback === "function") {
      onTrackCallback(track, resolved);
    }
  } catch (e) {
    console.warn("[Songify] handleMessage error:", e);
  }
}

function stopHttpPoll() {
  if (httpPollTimer) {
    window.clearInterval(httpPollTimer);
    httpPollTimer = null;
  }
}

async function pollNowPlayingHttp() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
    });
    if (!res.ok) {
      return;
    }
    const text = await res.text();
    if (!text || !String(text).trim()) {
      return;
    }
    const data = JSON.parse(text);
    const track = mapSongifyPayload(data);
    if (track) {
      const sig = `${track.trackId}\0${track.title}\0${track.artist}\0${track.progressMs}\0${track.durationMs}\0${track.isPlaying}\0${track.canvasUrl || ""}`;
      if (sig === lastEmitSig) {
        return;
      }
      lastEmitSig = sig;
      if (typeof onTrackCallback === "function") {
        onTrackCallback(track, resolvedFromEnvelope(data));
      }
    }
  } catch (_error) {
    /* CORS, offline, or empty body */
  }
}

function startHttpPoll() {
  stopHttpPoll();
  pollNowPlayingHttp();
  httpPollTimer = window.setInterval(pollNowPlayingHttp, HTTP_POLL_MS);
}

function connectCommandSocket() {
  try {
    if (commandSocket) {
      try {
        commandSocket.close();
      } catch (_e) {}
      commandSocket = null;
    }

    commandSocket = new WebSocket(`ws://127.0.0.1:${port}/`);

    commandSocket.addEventListener("message", function (event) {
      try {
        const parsed = JSON.parse(
          typeof event.data === "string" ? event.data : "{}"
        );
        handleMessage(parsed);
      } catch (_error) {}
    });

    commandSocket.addEventListener("close", function () {
      try {
        if (commandReconnectTimer) {
          window.clearTimeout(commandReconnectTimer);
        }
        commandReconnectTimer = window.setTimeout(function () {
          commandReconnectTimer = null;
          connectCommandSocket();
        }, 2000);
      } catch (_e) {}
    });

    commandSocket.addEventListener("error", function () {
      console.warn("[Songify] Command WebSocket error (/)");
    });
  } catch (_error) {
    if (commandReconnectTimer) {
      window.clearTimeout(commandReconnectTimer);
    }
    commandReconnectTimer = window.setTimeout(function () {
      commandReconnectTimer = null;
      connectCommandSocket();
    }, 2000);
  }
}

function connectDataSocket() {
  try {
    if (dataSocket) {
      try {
        dataSocket.close();
      } catch (_e) {}
      dataSocket = null;
    }

    const host = reconnectAttempts % 2 === 0 ? "localhost" : "127.0.0.1";
    const url = `ws://${host}:${port}${DATA_PATH}`;

    console.warn(`[Songify] Connecting to ${url}`);

    dataSocket = new WebSocket(url);

    dataSocket.addEventListener("open", function () {
      try {
        _isConnected = true;
        reconnectAttempts = 0;
        if (typeof onConnectCallback === "function") {
          onConnectCallback();
        }
        console.warn("[Songify] Connected — waiting for data");
      } catch (_error) {}
    });

    dataSocket.addEventListener("message", function (event) {
      try {
        const data = JSON.parse(
          typeof event.data === "string" ? event.data : "{}"
        );
        handleMessage(data);
      } catch (e) {
        console.warn("[Songify] Message parse error:", e);
      }
    });

    dataSocket.addEventListener("close", function () {
      try {
        _isConnected = false;
        versionLogged = false;
        if (typeof onDisconnectCallback === "function") {
          onDisconnectCallback();
        }
        scheduleReconnect();
      } catch (_error) {}
    });

    dataSocket.addEventListener("error", function () {
      console.warn("[Songify] WebSocket error");
    });
  } catch (_error) {
    _isConnected = false;
    scheduleReconnect();
  }
}

function connect() {
  connectDataSocket();
  connectCommandSocket();
}

export function init({ port: p, onTrack, onConnect, onDisconnect } = {}) {
  try {
    onTrackCallback = onTrack || null;
    onConnectCallback = onConnect || null;
    onDisconnectCallback = onDisconnect || null;
    port = Number(p) || DEFAULT_PORT;
    lastEmitSig = "";
    versionLogged = false;
    startHttpPoll();
    connect();
  } catch (_error) {}
}

export function disconnect() {
  try {
    stopHttpPoll();
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (commandReconnectTimer) {
      window.clearTimeout(commandReconnectTimer);
      commandReconnectTimer = null;
    }
    if (dataSocket) {
      try {
        dataSocket.close();
      } catch (_error) {}
    }
    if (commandSocket) {
      try {
        commandSocket.close();
      } catch (_error) {}
    }
    dataSocket = null;
    commandSocket = null;
    _isConnected = false;
    lastEmitSig = "";
    versionLogged = false;
  } catch (_error) {}
}

export function isConnected() {
  return _isConnected;
}

export function getPort() {
  return port;
}

export function sendCommand(action, data) {
  try {
    if (!commandSocket || commandSocket.readyState !== WebSocket.OPEN) {
      console.warn("[Songify] Cannot send command - command socket not connected");
      return false;
    }
    const message = JSON.stringify(data ? { action, data } : { action });
    commandSocket.send(message);
    return true;
  } catch (_error) {
    return false;
  }
}
