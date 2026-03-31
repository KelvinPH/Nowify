/** Applies BPM-driven pulse and energy glow styling to the overlay root. */
export function applyBeatSync(rootEl, extras) {
  if (!rootEl) {
    return;
  }

  if (!extras || typeof extras.bpm !== "number") {
    clearBeatSync(rootEl);
    return;
  }

  const beatMs = Math.round(60000 / extras.bpm);
  rootEl.style.setProperty("--nw-beat-ms", `${beatMs}ms`);
  rootEl.style.setProperty("--nw-energy", String(extras.energy ?? 0));
  rootEl.style.setProperty("--nw-valence", String(extras.valence ?? 0));

  const artEls = rootEl.querySelectorAll(".nw-disc, .nw-art");
  let glowSize = "0px";
  if ((extras.energy ?? 0) >= 0.4 && (extras.energy ?? 0) <= 0.7) {
    glowSize = "4px";
  } else if ((extras.energy ?? 0) > 0.7) {
    glowSize = "10px";
  }

  artEls.forEach((el) => {
    el.classList.add("nw-beat-pulse");
    el.style.setProperty("--nw-glow-size", glowSize);
    if (glowSize === "0px") {
      el.style.boxShadow = "";
    } else {
      el.style.boxShadow = `0 0 var(--nw-glow-size) var(--nw-accent)`;
    }
  });
}

/** Clears beat-sync classes and inline style properties from the overlay root. */
export function clearBeatSync(rootEl) {
  if (!rootEl) {
    return;
  }

  rootEl.style.removeProperty("--nw-beat-ms");
  rootEl.style.removeProperty("--nw-energy");
  rootEl.style.removeProperty("--nw-valence");

  const artEls = rootEl.querySelectorAll(".nw-disc, .nw-art");
  artEls.forEach((el) => {
    el.classList.remove("nw-beat-pulse");
    el.style.removeProperty("--nw-glow-size");
    el.style.boxShadow = "";
  });
}

/*
Add this to src/styles/overlay.css:
@keyframes nw-beat-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
.nw-beat-pulse {
  animation: nw-beat-pulse var(--nw-beat-ms) ease-in-out infinite;
}
*/
