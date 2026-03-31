const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";

function normalizeTrackId(track) {
  if (track?.mbid) return track.mbid;
  const artist = String(track?.artist?.["#text"] || track?.artist || "").trim();
  const title = String(track?.name || "").trim();
  return `${artist}:${title}`.toLowerCase();
}

/** Returns now playing (or latest) track from Last.fm recent tracks feed. */
export async function getLastfmNowPlaying(username, apiKey) {
  if (!username || !apiKey) return null;
  const target = new URL("https://ws.audioscrobbler.com/2.0/");
  target.searchParams.set("method", "user.getrecenttracks");
  target.searchParams.set("user", username);
  target.searchParams.set("api_key", apiKey);
  target.searchParams.set("limit", "1");
  target.searchParams.set("format", "json");

  const url = `${WORKER_BASE_URL}/proxy?url=${encodeURIComponent(target.toString())}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Last.fm proxy error ${res.status}`);
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(`Last.fm error ${data.error}: ${data.message || "unknown error"}`);
  }
  const rawTrack = data?.recenttracks?.track;
  const track = Array.isArray(rawTrack) ? rawTrack[0] : rawTrack;
  if (!track?.name) return null;

  const image = Array.isArray(track.image)
    ? track.image.find((img) => img.size === "extralarge")?.["#text"] ||
      track.image.find((img) => img.size === "large")?.["#text"] ||
      track.image.find((img) => img.size === "medium")?.["#text"] ||
      ""
    : "";
  const artist = String(track?.artist?.["#text"] || track?.artist || "").trim();

  return {
    isPlaying: String(track?.["@attr"]?.nowplaying || "") === "true",
    trackId: normalizeTrackId(track),
    title: track.name || "",
    artist,
    album: String(track?.album?.["#text"] || "").trim(),
    albumArt: image,
    durationMs: 0,
    progressMs: 0,
    trackUrl: String(track?.url || ""),
  };
}
