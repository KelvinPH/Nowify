/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

const API = "https://ws.audioscrobbler.com/2.0";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";
/** Min gap between worker proxy calls (Last.fm scrobbles are not sub-second). */
const PROXY_MIN_INTERVAL_MS = 10_000;

let apiKey = "";
let username = "";
let lastTrackId = "";
let lastProxyFetchAt = 0;
let lastCachedTrack = null;

function getLargestImage(imageArray) {
  if (!Array.isArray(imageArray)) return "";

  const pick =
    imageArray.find((img) => img?.size === "extralarge") ||
    imageArray.find((img) => img?.size === "large") ||
    imageArray.find((img) => img?.size === "medium") ||
    imageArray[0];

  let url = String(pick?.["#text"] || "");
  if (url.startsWith("http://")) {
    url = `https://${url.slice("http://".length)}`;
  }
  return url;
}

function normalizeTrackId(artist, title) {
  return `${artist}-${title}`;
}

export function init({ apiKey: key, username: user }) {
  apiKey = String(key || "");
  username = String(user || "");
  lastTrackId = "";
  lastProxyFetchAt = 0;
  lastCachedTrack = null;
  return isConfigured();
}

export function isConfigured() {
  return Boolean(apiKey && username);
}

/** Returns now playing track from Last.fm (returns null when not now playing). */
export async function getNowPlaying() {
  try {
    if (!apiKey || !username) return null;

    const now = Date.now();
    if (lastCachedTrack !== null && now - lastProxyFetchAt < PROXY_MIN_INTERVAL_MS) {
      return lastCachedTrack;
    }

    const target = new URL(`${API}/`);
    target.searchParams.set("method", "user.getrecenttracks");
    target.searchParams.set("user", username);
    target.searchParams.set("api_key", apiKey);
    target.searchParams.set("format", "json");
    target.searchParams.set("limit", "1");
    target.searchParams.set("nowplaying", "true");

    const url = `${WORKER_BASE_URL}/proxy?url=${encodeURIComponent(target.toString())}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data?.error) return null;

    const tracks = data?.recenttracks?.track;
    const track = Array.isArray(tracks) ? tracks[0] : tracks;
    if (!track) return null;

    const isNowPlaying = String(track?.["@attr"]?.nowplaying || "") === "true";
    if (!isNowPlaying) {
      lastProxyFetchAt = now;
      lastCachedTrack = null;
      return null;
    }

    const artist = String(track?.artist?.["#text"] || track?.artist || "").trim();
    const title = String(track?.name || "").trim();
    const trackId = normalizeTrackId(artist, title);
    lastTrackId = trackId;

    const result = {
      isPlaying: true,
      trackId,
      title,
      artist,
      album: String(track?.album?.["#text"] || "").trim(),
      albumArt: getLargestImage(track?.image),
      durationMs: 0,
      progressMs: 0,
      trackUrl: String(track?.url || ""),
      source: "lastfm",
    };
    lastProxyFetchAt = now;
    lastCachedTrack = result;
    return result;
  } catch (_error) {
    return lastCachedTrack;
  }
}

// Backwards-compatible wrapper for older overlay code paths.
export async function getLastfmNowPlaying(user, key) {
  init({ apiKey: key, username: user });
  return getNowPlaying();
}
