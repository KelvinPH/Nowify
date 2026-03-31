import {
  addToQueue,
  getQueue,
  skipToNext,
  skipToPrevious,
} from "../api/spotify.js";
import { getValidToken } from "../auth/spotify.js";
import { recordChatMessage } from "../stats/session.js";

const cooldowns = new Map();
const COOLDOWN_MS = 15000;

/** Routes supported chat commands and enforces command cooldowns. */
export async function handleCommand({ username, message, tags }) {
  if (!message || !message.trim().startsWith("!")) {
    recordChatMessage();
    return;
  }
  recordChatMessage();

  const [cmd, ...args] = message.trim().slice(1).split(" ");
  const command = (cmd || "").toLowerCase();
  const lastUsed = cooldowns.get(command) || 0;
  if (Date.now() - lastUsed < COOLDOWN_MS) {
    return;
  }
  cooldowns.set(command, Date.now());

  try {
    if (command === "sr") {
      await handleSongRequest(args, username);
      return;
    }
    if (command === "skip") {
      await handleSkip(username);
      return;
    }
    if (command === "prev") {
      await handlePrev(username);
      return;
    }
    if (command === "queue") {
      await handleQueueInfo(username);
    }
  } catch (error) {
    console.warn(`Nowify: command ${command} failed`, error);
  }
}

async function handleSongRequest(args, username) {
  const query = args.join(" ").trim();
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
        username,
        trackName: track.name,
        artistName: track.artists?.[0]?.name || "Unknown artist",
      },
    })
  );
}

async function handleSkip(username) {
  await skipToNext();
  window.dispatchEvent(
    new CustomEvent("nowify:skip", {
      detail: { username },
    })
  );
}

async function handlePrev(username) {
  await skipToPrevious();
  window.dispatchEvent(
    new CustomEvent("nowify:prev", {
      detail: { username },
    })
  );
}

async function handleQueueInfo(username) {
  await getQueue();
  window.dispatchEvent(
    new CustomEvent("nowify:queue", {
      detail: { username },
    })
  );
}
