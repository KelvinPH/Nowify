import { getValidToken } from "../auth/spotify.js";

const BASE_URL = "https://api.spotify.com/v1";

/** Maps Spotify track payloads to a simplified track shape. */
function mapTrack(track) {
  if (!track) {
    return null;
  }

  return {
    trackId: track.id,
    title: track.name,
    artist: (track.artists || []).map((artist) => artist.name).join(", "),
    albumArt: (track.album?.images || [])[0]?.url || "",
  };
}

/** Makes an authenticated GET request to the Spotify API. */
async function spotifyFetch(endpoint) {
  const token = await getValidToken();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (response.status === 401) {
    throw new Error("Spotify token invalid or expired");
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Spotify API error ${response.status}: ${bodyText}`);
  }

  return response.json();
}

/** Makes an authenticated POST request to the Spotify API. */
async function spotifyPost(endpoint) {
  const token = await getValidToken();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204) {
    return true;
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Spotify API error ${response.status}: ${bodyText}`);
  }

  return true;
}

/** Returns the currently playing track details or null. */
export async function getNowPlaying() {
  const data = await spotifyFetch("/me/player/currently-playing");
  if (!data || !data.item) {
    return null;
  }

  const images = data.item.album?.images || [];
  const largestImage = images[0]?.url || "";

  return {
    isPlaying: Boolean(data.is_playing),
    trackId: data.item.id,
    title: data.item.name,
    artist: (data.item.artists || []).map((artist) => artist.name).join(", "),
    album: data.item.album?.name || "",
    albumArt: largestImage,
    durationMs: data.item.duration_ms,
    progressMs: data.progress_ms,
    trackUrl: data.item.external_urls?.spotify || "",
  };
}

/** Picks a finite number from an API field, or null. */
function featureNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

/** Returns key audio feature values for a Spotify track. */
export async function getAudioFeatures(trackId) {
  const data = await spotifyFetch(`/audio-features/${encodeURIComponent(trackId)}`);
  if (!data || typeof data !== "object") {
    return null;
  }

  const tempo = featureNumber(data.tempo);
  const bpm = tempo !== null ? Math.round(tempo) : null;
  const energy = featureNumber(data.energy);
  const valence = featureNumber(data.valence);

  if (bpm === null && energy === null && valence === null) {
    return null;
  }

  return {
    bpm,
    energy,
    valence,
    danceability: featureNumber(data.danceability),
    acousticness: featureNumber(data.acousticness),
  };
}

/** Returns current track plus up to 10 upcoming queue tracks. */
export async function getQueue() {
  const data = await spotifyFetch("/me/player/queue");

  return {
    currentTrack: mapTrack(data.currently_playing),
    queue: (data.queue || []).slice(0, 10).map((track) => mapTrack(track)),
  };
}

/** Returns the next track in the queue or null. */
export async function getNextTrack() {
  const data = await spotifyFetch("/me/player/queue");
  const next = data?.queue?.[0];
  if (!next) return null;
  return {
    trackId: next.id,
    title: next.name,
    artist: (next.artists || []).map((a) => a.name).join(", "),
    albumArt: (next.album?.images || [])[0]?.url || "",
  };
}

/** Returns a list of recently played tracks with timestamps. */
export async function getRecentlyPlayed(limit = 10) {
  const data = await spotifyFetch(
    `/me/player/recently-played?limit=${encodeURIComponent(limit)}`
  );

  return (data.items || []).map((item) => {
    const mapped = mapTrack(item.track);
    return {
      trackId: mapped?.trackId || "",
      title: mapped?.title || "",
      artist: mapped?.artist || "",
      albumArt: mapped?.albumArt || "",
      playedAt: item.played_at,
    };
  });
}

/** Returns the current playback/device state or null. */
export async function getPlaybackState() {
  const data = await spotifyFetch("/me/player");
  if (!data) {
    return null;
  }

  return {
    isPlaying: Boolean(data.is_playing),
    deviceName: data.device?.name || "",
    volumePct: data.device?.volume_percent ?? 0,
    shuffleState: Boolean(data.shuffle_state),
    repeatState: data.repeat_state,
  };
}

/** Adds a track URI to the active Spotify queue. */
export async function addToQueue(trackUri) {
  return spotifyPost(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`);
}

/** Skips playback to the next Spotify track. */
export async function skipToNext() {
  return spotifyPost("/me/player/next");
}

/** Skips playback to the previous Spotify track. */
export async function skipToPrevious() {
  return spotifyPost("/me/player/previous");
}
