const API = "https://ws.audioscrobbler.com/2.0";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";

let apiKey = "";
let username = "";
let lastTrackId = "";

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
  return isConfigured();
}

export function isConfigured() {
  return Boolean(apiKey && username);
}

/** Returns now playing track from Last.fm (returns null when not now playing). */
export async function getNowPlaying() {
  try {
    if (!apiKey || !username) return null;

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
    if (!isNowPlaying) return null;

    const artist = String(track?.artist?.["#text"] || track?.artist || "").trim();
    const title = String(track?.name || "").trim();
    const trackId = normalizeTrackId(artist, title);
    lastTrackId = trackId;

    return {
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
  } catch (_error) {
    return null;
  }
}

// Backwards-compatible wrapper for older overlay code paths.
export async function getLastfmNowPlaying(user, key) {
  init({ apiKey: key, username: user });
  return getNowPlaying();
}
