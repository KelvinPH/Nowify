const WORKER_BASE_URL = "https://api.nowify.dev";
const MAX_SESSION_TRACKS = 500;
const BANGER_VOTE_THRESHOLD = 5;
const BANGER_CHAT_THRESHOLD = 10;
const BANGER_WINDOW_MS = 10000;

let sessionTracks = [];
let currentEntry = null;
let chatMessageCounts = [];
let voteCounts = [];
let bangerTimestamps = [];

/** Starts a new track entry and persists the current session array. */
export function startTrack(track, extras) {
  const entry = {
    trackId: track?.trackId || "",
    title: track?.title || "",
    artist: track?.artist || "",
    albumArt: track?.albumArt || "",
    playedAt: new Date().toISOString(),
    bpm: extras?.bpm ?? null,
    energy: extras?.energy ?? null,
    valence: extras?.valence ?? null,
    isBanger: false,
  };

  sessionTracks.push(entry);
  if (sessionTracks.length > MAX_SESSION_TRACKS) {
    sessionTracks = sessionTracks.slice(sessionTracks.length - MAX_SESSION_TRACKS);
  }

  currentEntry = sessionTracks[sessionTracks.length - 1] || null;
  localStorage.setItem("nowify_session", JSON.stringify(sessionTracks));
}

/** Records a chat message timestamp and flags bangers on chat spikes. */
export function recordChatMessage() {
  const now = Date.now();
  chatMessageCounts.push(now);
  chatMessageCounts = chatMessageCounts.filter((ts) => now - ts <= BANGER_WINDOW_MS);
  if (chatMessageCounts.length >= BANGER_CHAT_THRESHOLD) {
    flagBanger("chat");
  }
}

/** Records a vote timestamp and flags bangers on vote spikes. */
export function recordVote() {
  const now = Date.now();
  voteCounts.push(now);
  voteCounts = voteCounts.filter((ts) => now - ts <= BANGER_WINDOW_MS);
  if (voteCounts.length >= BANGER_VOTE_THRESHOLD) {
    flagBanger("vote");
  }
}

/** Returns current in-memory session data and detected banger times. */
export function getSession() {
  return {
    tracks: sessionTracks,
    bangers: bangerTimestamps,
  };
}

/** Clears in-memory session state and removes persisted session storage. */
export function clearSession() {
  sessionTracks = [];
  currentEntry = null;
  chatMessageCounts = [];
  voteCounts = [];
  bangerTimestamps = [];
  localStorage.removeItem("nowify_session");
}

/** Loads persisted session tracks from localStorage into memory. */
export function loadSession() {
  const raw = localStorage.getItem("nowify_session");
  if (!raw) {
    sessionTracks = [];
    currentEntry = null;
    return sessionTracks;
  }

  try {
    const parsed = JSON.parse(raw);
    sessionTracks = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Nowify: Failed to parse stored session data", error);
    sessionTracks = [];
  }

  currentEntry = sessionTracks[sessionTracks.length - 1] || null;
  return sessionTracks;
}

/** Persists all in-memory session tracks to the history worker endpoint. */
export async function saveToWorker(streamerId) {
  let saved = 0;
  let failed = 0;

  for (const track of sessionTracks) {
    const url = `${WORKER_BASE_URL}/history?streamerId=${encodeURIComponent(
      streamerId || ""
    )}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });

      if (!response.ok) {
        failed += 1;
        const bodyText = await response.text();
        console.warn(
          `Nowify: Worker save failed (${response.status}) for track ${track.trackId}: ${bodyText}`
        );
        continue;
      }

      saved += 1;
    } catch (error) {
      failed += 1;
      console.warn("Nowify: Worker save request failed", error);
    }
  }

  return { saved, failed };
}

function flagBanger(reason) {
  if (!currentEntry || currentEntry.isBanger) {
    return;
  }

  currentEntry.isBanger = true;
  const timestamp = new Date().toISOString();
  bangerTimestamps.push(timestamp);

  window.dispatchEvent(
    new CustomEvent("nowify:banger", {
      detail: { track: currentEntry, reason, timestamp },
    })
  );

  localStorage.setItem("nowify_session", JSON.stringify(sessionTracks));
}
