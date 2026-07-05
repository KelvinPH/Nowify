import {
  CONFIG_DRAFT_KEY,
  PUBLIC_PRESETS_CACHE_KEY,
  PUBLIC_PRESETS_CACHE_MS,
  SONGIFY_STATUS_TTL_MS,
} from "./constants.js";
import { DEFAULT_STATE } from "./state.js";

let songifyStatusCache = { port: null, ok: null, at: 0 };

export function invalidatePublicPresetsCache() {
  try {
    sessionStorage.removeItem(PUBLIC_PRESETS_CACHE_KEY);
  } catch (_error) {
    /* ignore */
  }
}

export function readPublicPresetsCache() {
  try {
    const raw = sessionStorage.getItem(PUBLIC_PRESETS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > PUBLIC_PRESETS_CACHE_MS) {
      return null;
    }
    return Array.isArray(parsed.presets) ? parsed.presets : null;
  } catch (_error) {
    return null;
  }
}

export function writePublicPresetsCache(presets) {
  try {
    sessionStorage.setItem(
      PUBLIC_PRESETS_CACHE_KEY,
      JSON.stringify({ at: Date.now(), presets })
    );
  } catch (_error) {
    /* ignore */
  }
}

export function mergeCommandsIntoDefaults(saved) {
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE.commands));
  for (const name of Object.keys(base)) {
    const sc = saved[name];
    if (sc && typeof sc === "object") {
      base[name] = {
        ...base[name],
        ...sc,
        roleLimits: { ...base[name].roleLimits, ...(sc.roleLimits || {}) },
      };
    }
  }
  return base;
}

export function loadPlatformState(state) {
  const savedTwitch = localStorage.getItem("nowify_twitch");
  if (savedTwitch) {
    try {
      const tw = JSON.parse(savedTwitch || "{}");
      state.twitchChannel = tw.channel || "";
      state.twitchToken = tw.token || "";
    } catch (_e) {}
  }

  try {
    const saved = JSON.parse(localStorage.getItem("nowify_commands") || "null");
    if (saved && typeof saved === "object") {
      state.commands = mergeCommandsIntoDefaults(saved);
    }
  } catch (_e) {}

  state.clientId = localStorage.getItem("nowify_client_id") || "";

  const savedLastfm = localStorage.getItem("nowify_lastfm");
  if (savedLastfm) {
    try {
      const parsed = JSON.parse(savedLastfm);
      state.lastfmUsername = parsed.username || "";
      state.lastfmApiKey = parsed.apiKey || "";
    } catch (_error) {}
  }

  const savedSongify = localStorage.getItem("nowify_songify");
  if (savedSongify) {
    try {
      const parsed = JSON.parse(savedSongify);
      state.songifyPort = Number(parsed.port) || 4002;
    } catch (_error) {}
  }

  try {
    const qSaved = JSON.parse(localStorage.getItem("nowify_queue") || "null");
    if (qSaved && typeof qSaved === "object") {
      Object.keys(qSaved).forEach((k) => {
        if (k.startsWith("queue") && qSaved[k] !== undefined) {
          state[k] = qSaved[k];
        }
      });
    }
  } catch (_e) {}
}

export function saveConfigDraft(state) {
  const draft = {};
  Object.keys(state).forEach((key) => {
    if (key === "commands" || key.startsWith("queue")) {
      return;
    }
    if (
      key === "clientId" ||
      key === "lastfmUsername" ||
      key === "lastfmApiKey" ||
      key === "twitchChannel" ||
      key === "twitchToken"
    ) {
      return;
    }
    draft[key] = state[key];
  });
  try {
    localStorage.setItem(CONFIG_DRAFT_KEY, JSON.stringify(draft));
  } catch (_error) {
    /* ignore */
  }
}

export function loadConfigDraft(state) {
  try {
    const raw = localStorage.getItem(CONFIG_DRAFT_KEY);
    if (!raw) {
      return;
    }
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== "object") {
      return;
    }
    Object.assign(state, draft);
  } catch (_error) {
    /* ignore */
  }
}

export function clearConfigDraft() {
  try {
    localStorage.removeItem(CONFIG_DRAFT_KEY);
  } catch (_error) {
    /* ignore */
  }
}

function applySongifyStatus(statusEl, connected) {
  statusEl.textContent = connected ? "Connected" : "Not connected";
  statusEl.classList.toggle("cfg-status-connected", connected);
  statusEl.classList.toggle("cfg-status-error", !connected);
}

export function invalidateSongifyStatusCache() {
  songifyStatusCache = { port: null, ok: null, at: 0 };
}

export function checkSongifyStatus(statusEl, port) {
  const now = Date.now();
  if (
    songifyStatusCache.port === port &&
    songifyStatusCache.ok !== null &&
    now - songifyStatusCache.at < SONGIFY_STATUS_TTL_MS
  ) {
    applySongifyStatus(statusEl, songifyStatusCache.ok);
    return;
  }

  statusEl.textContent = "Checking...";
  statusEl.classList.remove("cfg-status-connected", "cfg-status-error");
  try {
    const testWs = new WebSocket(`ws://localhost:${port}/ws/data`);
    let settled = false;
    const finalize = (ok) => {
      if (settled) {
        return;
      }
      settled = true;
      songifyStatusCache = { port, ok, at: Date.now() };
      applySongifyStatus(statusEl, ok);
      try {
        testWs.close();
      } catch (_error) {}
    };
    testWs.addEventListener("open", () => finalize(true));
    testWs.addEventListener("error", () => finalize(false));
    testWs.addEventListener("close", () => {
      if (!settled) {
        finalize(false);
      }
    });
    window.setTimeout(() => finalize(false), 2000);
  } catch (_error) {
    songifyStatusCache = { port, ok: false, at: Date.now() };
    statusEl.textContent = "Error";
    statusEl.classList.remove("cfg-status-connected");
    statusEl.classList.add("cfg-status-error");
  }
}

export function savePlatformState(state, newState) {
  if (newState.twitchChannel !== undefined || newState.twitchToken !== undefined) {
    localStorage.setItem(
      "nowify_twitch",
      JSON.stringify({
        channel: state.twitchChannel,
        token: state.twitchToken,
      })
    );
  }

  if (newState.lastfmUsername !== undefined || newState.lastfmApiKey !== undefined) {
    localStorage.setItem(
      "nowify_lastfm",
      JSON.stringify({
        username: state.lastfmUsername,
        apiKey: state.lastfmApiKey,
      })
    );
  }

  if (newState.songifyPort !== undefined) {
    localStorage.setItem(
      "nowify_songify",
      JSON.stringify({
        port: state.songifyPort,
      })
    );
  }

  try {
    localStorage.setItem("nowify_commands", JSON.stringify(state.commands));
  } catch (_e) {}

  try {
    const qSnap = {};
    Object.keys(state).forEach((k) => {
      if (k.startsWith("queue")) {
        qSnap[k] = state[k];
      }
    });
    localStorage.setItem("nowify_queue", JSON.stringify(qSnap));
  } catch (_e) {}
}
