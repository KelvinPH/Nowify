export function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function artEl(track, cls, shape = "rounded") {
  const r = shape === "circle" ? "50%" : "";
  const style = r ? `border-radius: ${r};` : "";
  if (track?.albumArt) {
    return `<div class="${cls} nw-art" style="${style}">
      <img src="${escHtml(track.albumArt)}" alt="" />
    </div>`;
  }
  return `<div class="${cls} nw-art nw-art-placeholder" style="${style}"></div>`;
}

function progressEl(config) {
  if (config?.showProgress !== false) {
    return '<div class="nw-progress"><div class="nw-progress-fill"></div></div>';
  }
  return "";
}

export function fmtTime(ms) {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const LAYOUTS = {
  pill(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    return `<section class="nw-overlay nw-pill">
    ${artEl(track, "", "circle")}
    <div class="nw-info">
      <div class="nw-title">${title}</div>
      <div class="nw-artist">${artist}</div>
    </div>
    <div class="nw-playing-dot"></div>
  </section>`;
  },

  glasscard(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    return `<section class="nw-overlay nw-glasscard">
    ${artEl(track, "")}
    <div class="nw-info">
      <div class="nw-title">${title}</div>
      <div class="nw-artist">${artist}</div>
      ${progressEl(config)}
    </div>
  </section>`;
  },

  island(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    return `<section class="nw-overlay nw-island">
    ${artEl(track, "")}
    <div class="nw-title">${title}</div>
    <div class="nw-artist">${artist}</div>
    ${progressEl(config)}
  </section>`;
  },

  strip(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    const text = `${title} — ${artist}`;
    const useMarquee = text.length > 40;
    const textMarkup = useMarquee
      ? `<div class="nw-marquee-wrap">
    <div class="nw-marquee-inner">
      <span>${text}</span>
      <span>${text}</span>
    </div>
  </div>`
      : `<div class="nw-strip-text">${text}</div>`;
    return `<section class="nw-overlay nw-strip">
    ${artEl(track, "nw-strip-art")}
    <div class="nw-accent-bar"></div>
    ${textMarkup}
    <div class="nw-strip-time">${fmtTime(track?.progressMs)}</div>
  </section>`;
  },

  albumfocus(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    const bpm =
      config?.showBpm === true && extras?.bpm
        ? `<div class="nw-bpm">${escHtml(extras.bpm)} BPM</div>`
        : "";
    return `<section class="nw-overlay nw-albumfocus">
    ${artEl(track, "")}
    <div class="nw-title">${title}</div>
    <div class="nw-artist">${artist}</div>
    ${bpm}
  </section>`;
  },

  sidebar(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    return `<section class="nw-overlay nw-sidebar">
    ${artEl(track, "")}
    <div class="nw-sidebar-body">
      <div class="nw-title">${title}</div>
      <div class="nw-artist">${artist}</div>
      ${progressEl(config)}
    </div>
  </section>`;
  },
};
