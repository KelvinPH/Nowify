const DEFAULT_PORT = 4002;
const RECONNECT_DELAYS = [2000, 4000, 8000, 15000, 30000];

let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let port = DEFAULT_PORT;
let onTrackCallback = null;
let onConnectCallback = null;
let onDisconnectCallback = null;
let lastTrackId = "";
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
      connect();
    }, delay);
  } catch (_error) {}
}

function handleMessage(data) {
  try {
    if (!data || typeof data !== "object") return;
    const title = data.title || data.song || data.track || "";
    const artist = data.artist || data.artists || "";
    const album = data.album || "";
    const cover = data.cover || data.albumCover || data.albumArt || data.image || "";
    const isPlaying = data.isPlaying !== false;
    const songId = data.songId || data.trackId || data.id || `${artist}-${title}`;
    const durationMs = normalizeMs(data.duration);
    const progressMs = normalizeMs(data.progress || data.elapsed);

    const track = {
      isPlaying,
      trackId: String(songId || "").trim(),
      title: String(title || "").trim(),
      artist: String(artist || "").trim(),
      album: String(album || "").trim(),
      albumArt: String(cover || "").trim(),
      durationMs,
      progressMs,
      trackUrl: String(data.spotifyUrl || data.url || "").trim(),
      source: "songify",
      requester: String(data.requester || "").trim(),
    };

    if (!track.title) return;
    if (track.trackId !== lastTrackId) {
      lastTrackId = track.trackId;
      if (typeof onTrackCallback === "function") onTrackCallback(track);
    }
  } catch (_error) {}
}

function connect() {
  try {
    if (socket) {
      try {
        socket.close();
      } catch (_error) {}
      socket = null;
    }

    socket = new WebSocket(`ws://localhost:${port}`);

    socket.addEventListener("open", function () {
      try {
        _isConnected = true;
        reconnectAttempts = 0;
        if (typeof onConnectCallback === "function") onConnectCallback();
        console.warn("[Songify] Connected on port", port);
      } catch (_error) {}
    });

    socket.addEventListener("message", function (event) {
      try {
        const parsed = JSON.parse(String(event?.data || "{}"));
        handleMessage(parsed);
      } catch (_error) {}
    });

    socket.addEventListener("close", function () {
      try {
        _isConnected = false;
        if (typeof onDisconnectCallback === "function") onDisconnectCallback();
        scheduleReconnect();
      } catch (_error) {}
    });

    socket.addEventListener("error", function () {
      console.warn("[Songify] WebSocket error");
    });
  } catch (_error) {
    _isConnected = false;
    scheduleReconnect();
  }
}

export function init({ port: p, onTrack, onConnect, onDisconnect } = {}) {
  try {
    onTrackCallback = onTrack || null;
    onConnectCallback = onConnect || null;
    onDisconnectCallback = onDisconnect || null;
    port = Number(p) || DEFAULT_PORT;
    connect();
  } catch (_error) {}
}

export function disconnect() {
  try {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      try {
        socket.close();
      } catch (_error) {}
    }
    socket = null;
    _isConnected = false;
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
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("[Songify] Cannot send command - not connected");
      return false;
    }
    const message = JSON.stringify(data ? { action, data } : { action });
    socket.send(message);
    return true;
  } catch (_error) {
    return false;
  }
}

