/**
 * Full-card blurred album art behind the glass layer (optional; works with animated background on top).
 * @param {HTMLElement | null} rootEl
 * @param {object | null} track
 * @param {{ enabled: boolean, blurPx: number }} opts
 */
export function syncArtBackdrop(rootEl, track, opts) {
  const { enabled, blurPx } = opts;
  if (!rootEl) {
    return;
  }
  const blur = Math.max(0, Math.min(120, Number(blurPx) || 48));
  if (!enabled) {
    rootEl.querySelector(".nw-art-backdrop")?.remove();
    return;
  }

  let wrap = rootEl.querySelector(".nw-art-backdrop");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "nw-art-backdrop";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    wrap.appendChild(img);
    rootEl.prepend(wrap);
  }

  wrap.style.setProperty("--nw-art-backdrop-blur", `${blur}px`);
  const img = wrap.querySelector("img");
  const url = track?.albumArt || "";
  if (url && img) {
    img.src = url;
    wrap.classList.add("nw-art-backdrop-visible");
  } else if (img) {
    img.removeAttribute("src");
    wrap.classList.remove("nw-art-backdrop-visible");
  }
}

export function removeAllArtBackdrops() {
  document.querySelectorAll(".nw-art-backdrop").forEach((el) => el.remove());
}
