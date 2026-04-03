const MOODS = {
  euphoric: { bg: "#0a1628", accent: "#1DB954" },
  chill: { bg: "#0d1f2d", accent: "#64b5f6" },
  melancholy: { bg: "#1a1025", accent: "#9575cd" },
  intense: { bg: "#1a0a0a", accent: "#ef5350" },
  neutral: { bg: "#121212", accent: "#1DB954" },
};

const artPaletteCache = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return [18, 18, 18];
}

function toHex(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(a, b, ratio) {
  const t = clamp(ratio, 0, 1);
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

async function extractPaletteFromArt(url) {
  if (!url) return null;
  if (artPaletteCache.has(url)) return artPaletteCache.get(url);
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    let maxSat = -1;
    let accent = [255, 255, 255];

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 20) continue;
      const rr = data[i];
      const gg = data[i + 1];
      const bb = data[i + 2];
      r += rr;
      g += gg;
      b += bb;
      count += 1;

      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      const sat = max === 0 ? 0 : (max - min) / max;
      const brightness = (rr + gg + bb) / 3;
      if (sat > maxSat && brightness > 40) {
        maxSat = sat;
        accent = [rr, gg, bb];
      }
    }

    if (!count) return null;
    const avg = [r / count, g / count, b / count];
    const palette = {
      bg: rgbToHex(avg[0] * 0.34, avg[1] * 0.34, avg[2] * 0.34),
      accent: rgbToHex(accent[0], accent[1], accent[2]),
    };
    artPaletteCache.set(url, palette);
    return palette;
  } catch (_error) {
    return null;
  }
}

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

const MOOD_COLOR_TRANSITION =
  "background-color 1.2s ease, color 1.2s ease, border-color 1.2s ease";

function applyPaletteVars(rootEl, bg, accent) {
  const glassBorder = mixHex(accent, "#ffffff", 0.55);
  const textMuted = mixHex(accent, "#a8afba", 0.6);
  const progressBg = mixHex(bg, "#ffffff", 0.25);
  rootEl.style.setProperty("--nw-bg", bg);
  rootEl.style.setProperty("--nw-accent", accent);
  rootEl.style.setProperty("--nw-glass-border", glassBorder);
  rootEl.style.setProperty("--nw-text-muted", textMuted);
  rootEl.style.setProperty("--nw-progress-bg", progressBg);
}

/**
 * Applies mood class and theme variables to the overlay root element.
 * Mood colours are applied synchronously first so the selected CSS theme does not flash
 * while album art is decoded; if art yields a palette, we then transition to it.
 */
export async function applyMood(rootEl, extras, track = null) {
  if (!rootEl) {
    return;
  }

  const lockCustomColours = rootEl.dataset?.nwCustomColors === "1";
  const mood = getMood(extras);
  const moodBase = MOODS[mood];

  [...rootEl.classList]
    .filter((name) => name.startsWith("nw-mood-"))
    .forEach((name) => rootEl.classList.remove(name));
  rootEl.classList.add(`nw-mood-${mood}`);

  if (lockCustomColours) {
    rootEl.style.transition = "";
    return;
  }

  rootEl.style.transition = "none";
  applyPaletteVars(rootEl, moodBase.bg, moodBase.accent);

  const artPalette = await extractPaletteFromArt(track?.albumArt || "");
  if (artPalette) {
    rootEl.style.transition = MOOD_COLOR_TRANSITION;
    applyPaletteVars(rootEl, artPalette.bg, artPalette.accent);
  } else {
    rootEl.style.transition = "";
  }
}

/** Clears mood classes and inline mood overrides from the overlay root. */
export function clearMood(rootEl) {
  if (!rootEl) {
    return;
  }

  const lockCustomColours = rootEl.dataset?.nwCustomColors === "1";

  [...rootEl.classList]
    .filter((name) => name.startsWith("nw-mood-"))
    .forEach((name) => rootEl.classList.remove(name));

  if (!lockCustomColours) {
    rootEl.style.removeProperty("--nw-bg");
    rootEl.style.removeProperty("--nw-accent");
    rootEl.style.removeProperty("--nw-glass-border");
    rootEl.style.removeProperty("--nw-text-muted");
    rootEl.style.removeProperty("--nw-progress-bg");
  }
  rootEl.style.transition = "";
}
