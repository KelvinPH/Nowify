import {
  addToQueue,
  getQueue,
  skipToNext,
  skipToPrevious,
} from "../api/spotify.js";
import { getValidToken } from "../auth/spotify.js";
import { recordChatMessage } from "../stats/session.js";

const ROLE_RANK = {
  everyone: 0,
  subscriber: 1,
  vip: 2,
  moderator: 3,
  broadcaster: 4,
};

const DEFAULT_COMMAND_CONFIGS = {
  sr: {
    enabled: true,
    minRole: "everyone",
    sessionLimit: 0,
    roleLimits: {
      everyone: 3,
      subscriber: 5,
      vip: 10,
      moderator: 0,
      broadcaster: 0,
    },
    cooldown: 30,
  },
  skip: {
    enabled: true,
    minRole: "moderator",
    sessionLimit: 0,
    roleLimits: {
      everyone: 0,
      subscriber: 0,
      vip: 0,
      moderator: 0,
      broadcaster: 0,
    },
    cooldown: 0,
  },
  prev: {
    enabled: true,
    minRole: "moderator",
    sessionLimit: 0,
    roleLimits: {
      everyone: 0,
      subscriber: 0,
      vip: 0,
      moderator: 0,
      broadcaster: 0,
    },
    cooldown: 0,
  },
  queue: {
    enabled: true,
    minRole: "everyone",
    sessionLimit: 0,
    roleLimits: {
      everyone: 0,
      subscriber: 0,
      vip: 0,
      moderator: 0,
      broadcaster: 0,
    },
    cooldown: 10,
  },
  vol: {
    enabled: false,
    minRole: "moderator",
    sessionLimit: 0,
    roleLimits: {
      everyone: 0,
      subscriber: 0,
      vip: 0,
      moderator: 0,
      broadcaster: 0,
    },
    cooldown: 5,
  },
};

const sessionCounts = {};
const userCounts = {};
const userCooldowns = {};

let commandConfigs = {};
let twitchHandlers = {};
let initialized = false;

function mergeCommandConfigs(saved) {
  const out = {};
  for (const name of Object.keys(DEFAULT_COMMAND_CONFIGS)) {
    const def = DEFAULT_COMMAND_CONFIGS[name];
    const s = saved?.[name];
    out[name] = {
      ...def,
      ...(s && typeof s === "object" ? s : {}),
      roleLimits: { ...def.roleLimits, ...(s?.roleLimits && typeof s.roleLimits === "object" ? s.roleLimits : {}) },
    };
  }
  return out;
}

function loadCommandConfigsFromStorage() {
  try {
    const raw = localStorage.getItem("nowify_commands");
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === "object") {
      return mergeCommandConfigs(saved);
    }
  } catch (_e) {}
  return mergeCommandConfigs(null);
}

function getUserRole(msg) {
  if (msg.isBroadcaster) return "broadcaster";
  if (msg.isMod) return "moderator";
  if (msg.isVip) return "vip";
  if (msg.isSubscriber) return "subscriber";
  return "everyone";
}

function checkPermissions(config, msg) {
  if (msg.isBroadcaster) return true;
  const userRole = getUserRole(msg);
  const userRank = ROLE_RANK[userRole];
  const minRank = ROLE_RANK[config.minRole] ?? 0;
  return userRank >= minRank;
}

function checkLimits(cmd, config, msg) {
  if (msg.isBroadcaster) return true;
  const userRole = getUserRole(msg);
  if (config.sessionLimit > 0) {
    const total = sessionCounts[cmd] || 0;
    if (total >= config.sessionLimit) return false;
  }
  const roleLimit = config.roleLimits?.[userRole] ?? 0;
  if (roleLimit > 0) {
    const key = `${cmd}:${msg.username}`;
    const count = userCounts[key] || 0;
    if (count >= roleLimit) return false;
  }
  return true;
}

function checkCooldown(cmd, config, msg) {
  if (msg.isBroadcaster) return true;
  if (!config.cooldown || config.cooldown <= 0) return true;
  const key = `${cmd}:${msg.username}`;
  const lastUsed = userCooldowns[key] || 0;
  const elapsed = (Date.now() - lastUsed) / 1000;
  return elapsed >= config.cooldown;
}

function incrementSessionCount(cmd) {
  sessionCounts[cmd] = (sessionCounts[cmd] || 0) + 1;
}

function incrementUserCount(cmd, username) {
  const key = `${cmd}:${username}`;
  userCounts[key] = (userCounts[key] || 0) + 1;
}

function setUserCooldown(cmd, username) {
  userCooldowns[`${cmd}:${username}`] = Date.now();
}

export function resetCounts() {
  Object.keys(sessionCounts).forEach((k) => {
    delete sessionCounts[k];
  });
  Object.keys(userCounts).forEach((k) => {
    delete userCounts[k];
  });
  Object.keys(userCooldowns).forEach((k) => {
    delete userCooldowns[k];
  });
}

export function init(configs, handlers) {
  commandConfigs = configs && typeof configs === "object" ? configs : {};
  twitchHandlers = handlers && typeof handlers === "object" ? handlers : {};
  resetCounts();
}

function buildDefaultHandlers() {
  return {
    sr: handleSongRequestWrapped,
    skip: handleSkipWrapped,
    prev: handlePrevWrapped,
    queue: handleQueueWrapped,
    vol: handleVolWrapped,
  };
}

function ensureInitialized() {
  if (!initialized) {
    twitchHandlers = buildDefaultHandlers();
    initialized = true;
  }
  commandConfigs = loadCommandConfigsFromStorage();
}

function normalizeIrcPayload({ username, message, tags }) {
  const badgesRaw = tags?.badges || "";
  const badgeParts = {};
  if (badgesRaw) {
    String(badgesRaw).split(",").forEach((part) => {
      const name = part.split("/")[0];
      if (name) badgeParts[name] = true;
    });
  }
  return {
    username: username || "",
    message: message || "",
    tags: tags || {},
    isBroadcaster: Boolean(badgeParts.broadcaster),
    isMod: tags?.mod === "1",
    isVip: Boolean(badgeParts.vip),
    isSubscriber: tags?.subscriber === "1" || Boolean(badgeParts.subscriber),
  };
}

export async function handleMessage(msg) {
  if (!msg?.message || !String(msg.message).trim().startsWith("!")) {
    return;
  }
  ensureInitialized();

  const parts = String(msg.message).trim().split(/\s+/);
  const cmd = parts[0].slice(1).toLowerCase();
  const args = parts.slice(1).join(" ");
  const config = commandConfigs[cmd];
  if (!config) {
    return;
  }
  if (!config.enabled) {
    return;
  }
  if (!checkPermissions(config, msg)) {
    return;
  }
  if (!checkLimits(cmd, config, msg)) {
    return;
  }
  if (!checkCooldown(cmd, config, msg)) {
    return;
  }

  incrementSessionCount(cmd);
  incrementUserCount(cmd, msg.username);
  setUserCooldown(cmd, msg.username);

  const fn = twitchHandlers[cmd];
  if (typeof fn !== "function") {
    return;
  }
  try {
    await fn(args, msg);
  } catch (error) {
    console.warn(`Nowify: command ${cmd} failed`, error);
  }
}

export async function handleCommand(payload) {
  if (!payload?.message || !String(payload.message).trim().startsWith("!")) {
    recordChatMessage();
    return;
  }
  recordChatMessage();
  const msg = normalizeIrcPayload(payload);
  try {
    await handleMessage(msg);
  } catch (error) {
    console.warn("Nowify: command handling failed", error);
  }
}

async function handleSongRequestWrapped(args, msg) {
  const query = String(args || "").trim();
  if (!query) {
    return;
  }

  const token = await getValidToken();
  const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
    query
  )}&type=track&limit=1`;
  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Spotify search failed ${response.status}: ${bodyText}`);
  }

  const data = await response.json();
  const track = data?.tracks?.items?.[0];
  if (!track) {
    return;
  }

  const trackUri = track.uri || `spotify:track:${track.id}`;
  await addToQueue(trackUri);
  window.dispatchEvent(
    new CustomEvent("nowify:sr", {
      detail: {
        username: msg.username,
        trackName: track.name,
        artistName: track.artists?.[0]?.name || "Unknown artist",
      },
    })
  );
}

async function handleSkipWrapped(_args, msg) {
  await skipToNext();
  window.dispatchEvent(
    new CustomEvent("nowify:skip", {
      detail: { username: msg.username },
    })
  );
}

async function handlePrevWrapped(_args, msg) {
  await skipToPrevious();
  window.dispatchEvent(
    new CustomEvent("nowify:prev", {
      detail: { username: msg.username },
    })
  );
}

async function handleQueueWrapped(_args, msg) {
  await getQueue();
  window.dispatchEvent(
    new CustomEvent("nowify:queue", {
      detail: { username: msg.username },
    })
  );
}

async function handleVolWrapped(_args, _msg) {}
