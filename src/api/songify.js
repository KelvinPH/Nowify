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

/**
 * Maps Songify's public HTTP JSON (GET /) or WS payloads to the overlay track shape.
 * @see https://github.com/songify-rocks/Songify/blob/master/docs/wiki/Web-server-and-API.md
 */
export function mapSongifyPayload(raw) {
  const data = unwrapPayload(raw);
  if (!data) {
    return null;
  }

  const title = pickStr(data, ["Title", "title", "song", "track"]);
  const artist = normalizeArtist(data);
  const album = pickStr(data, ["Album", "album"]);
  const cover =
    pickStr(data, ["cover", "albumCover", "albumArt", "image"]) ||
    albumArtFromAlbums(data);
  const isPlaying = data.IsPlaying !== false && data.isPlaying !== false;
  const songId =
    pickStr(data, ["SongId", "songId", "trackId", "id"]) ||
    (artist && title ? `${artist}::${title}` : "");
  const durationMs = computeDurationMs(data);
  const progressMs = computeProgressMs(data, durationMs);
  const trackUrl = pickStr(data, ["Url", "spotifyUrl", "url"]);

  return {
    isPlaying,
    trackId: String(songId || "").trim(),
    title: String(title || "").trim(),
    artist: String(artist || "").trim(),
    album: String(album || "").trim(),
    albumArt: String(cover || "").trim(),
    durationMs,
    progressMs,
    trackUrl,
    source: "songify",
    requester: pickStr(data, ["requester", "Requester"]),
  };
}

function emitTrack(track) {
  if (!track || !track.title || typeof onTrackCallback !== "function") {
    return;
  }
  const sig = `${track.trackId}\0${track.title}\0${track.artist}\0${track.progressMs}\0${track.durationMs}\0${track.isPlaying}`;
  if (sig === lastEmitSig) {
    return;
  }
  lastEmitSig = sig;
  onTrackCallback(track);
}

function handleMessage(data) {
  try {
    const track = mapSongifyPayload(data);
    if (track) {
      emitTrack(track);
    }
  } catch (_error) {}
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
      emitTrack(track);
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

function wsUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `ws://127.0.0.1:${port}${p}`;
}

function connectCommandSocket() {
  try {
    if (commandSocket) {
      try {
        commandSocket.close();
      } catch (_e) {}
      commandSocket = null;
    }

    commandSocket = new WebSocket(wsUrl("/"));

    commandSocket.addEventListener("message", function (event) {
      try {
        const parsed = JSON.parse(String(event?.data || "{}"));
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
      } catch (_error) {}
      dataSocket = null;
    }

    dataSocket = new WebSocket(wsUrl(DATA_PATH));

    dataSocket.addEventListener("open", function () {
      try {
        reconnectAttempts = 0;
        _isConnected = true;
        if (typeof onConnectCallback === "function") onConnectCallback();
        console.warn("[Songify] Track stream:", DATA_PATH, "port", port);
      } catch (_error) {}
    });

    dataSocket.addEventListener("message", function (event) {
      try {
        const parsed = JSON.parse(String(event?.data || "{}"));
        handleMessage(parsed);
      } catch (_error) {}
    });

    dataSocket.addEventListener("close", function () {
      try {
        _isConnected = false;
        if (typeof onDisconnectCallback === "function") onDisconnectCallback();
        scheduleReconnect();
      } catch (_error) {}
    });

    dataSocket.addEventListener("error", function () {
      console.warn("[Songify] Data WebSocket error", DATA_PATH);
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
