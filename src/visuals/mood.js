const MOODS = {
  euphoric: { bg: "#0a1628", accent: "#1DB954" },
  chill: { bg: "#0d1f2d", accent: "#64b5f6" },
  melancholy: { bg: "#1a1025", accent: "#9575cd" },
  intense: { bg: "#1a0a0a", accent: "#ef5350" },
  neutral: { bg: "#121212", accent: "#1DB954" },
};

/** Returns a mood name derived from valence and energy values. */
export function getMood(extras) {
  if (!extras) {
    return "neutral";
  }

  const valence = extras.valence ?? 0;
  const energy = extras.energy ?? 0;

  if (valence > 0.7 && energy > 0.7) {
    return "euphoric";
  }
  if (valence > 0.6 && energy < 0.4) {
    return "chill";
  }
  if (valence < 0.4 && energy < 0.4) {
    return "melancholy";
  }
  if (valence < 0.4 && energy > 0.7) {
    return "intense";
  }
  return "neutral";
}

/** Applies mood class and theme variables to the overlay root element. */
export function applyMood(rootEl, extras) {
  if (!rootEl) {
    return;
  }

  const mood = getMood(extras);
  const colors = MOODS[mood];

  [...rootEl.classList]
    .filter((name) => name.startsWith("nw-mood-"))
    .forEach((name) => rootEl.classList.remove(name));

  rootEl.style.setProperty("--nw-bg", colors.bg);
  rootEl.style.setProperty("--nw-accent", colors.accent);
  rootEl.classList.add(`nw-mood-${mood}`);
  rootEl.style.transition = "background-color 2s ease, color 2s ease";
}

/** Clears mood classes and inline mood overrides from the overlay root. */
export function clearMood(rootEl) {
  if (!rootEl) {
    return;
  }

  [...rootEl.classList]
    .filter((name) => name.startsWith("nw-mood-"))
    .forEach((name) => rootEl.classList.remove(name));

  rootEl.style.removeProperty("--nw-bg");
  rootEl.style.removeProperty("--nw-accent");
  rootEl.style.transition = "";
}
