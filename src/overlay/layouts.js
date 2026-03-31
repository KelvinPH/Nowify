/** Escapes unsafe HTML characters in text content. */
export function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Returns escaped title and artist strings used by layouts. */
function getSafeMeta(track) {
  return {
    title: escHtml(track?.title || "Unknown title"),
    artist: escHtml(track?.artist || "Unknown artist"),
  };
}

/** Returns album art image markup or a disc placeholder. */
function getArtMarkup(track, cls) {
  if (track?.albumArt) {
    return `<div class="${cls}"><img src="${track.albumArt}" alt="Album art" /></div>`;
  }
  return `<div class="${cls} nw-art-placeholder" aria-hidden="true"></div>`;
}

/** Returns optional progress bar markup based on configuration. */
function getProgressMarkup(config) {
  if (config?.showProgress === false) {
    return "";
  }
  return '<div class="nw-progress"><div class="nw-progress-fill"></div></div>';
}

export const LAYOUTS = {
  record(track, extras, config) {
    const safe = getSafeMeta(track);
    const bpm =
      config?.showBpm && extras?.bpm
        ? `<div class="nw-bpm">${escHtml(extras.bpm)} BPM</div>`
        : "";
    const artMarkup = track?.albumArt
      ? `<div class="nw-disc"><img src="${track.albumArt}" alt="Album art" /></div>`
      : '<div class="nw-disc nw-art-placeholder" aria-hidden="true"></div>';

    return `
      <section class="nw-overlay nw-record">
        ${artMarkup}
        <div class="nw-title">${safe.title}</div>
        <div class="nw-artist">${safe.artist}</div>
        ${bpm}
        ${getProgressMarkup(config)}
      </section>
    `;
  },

  card(track, extras, config) {
    const safe = getSafeMeta(track);
    return `
      <section class="nw-overlay nw-card">
        ${getArtMarkup(track, "nw-art")}
        <div class="nw-info">
          <div class="nw-title">${safe.title}</div>
          <div class="nw-artist">${safe.artist}</div>
        </div>
        ${getProgressMarkup(config)}
      </section>
    `;
  },

  bar(track, extras, config) {
    const safe = getSafeMeta(track);
    const text = `${safe.title} - ${safe.artist}`;
    return `
      <section class="nw-overlay nw-bar">
        ${getArtMarkup(track, "nw-art")}
        <div class="nw-info">
          <div class="nw-marquee"><span>${text}</span><span>${text}</span></div>
        </div>
      </section>
    `;
  },

  ticker(track, extras, config) {
    const safe = getSafeMeta(track);
    const text = `${safe.title} - ${safe.artist}`;
    return `
      <section class="nw-overlay nw-ticker">
        <div class="nw-label">NOW PLAYING</div>
        <div class="nw-info">
          <div class="nw-marquee"><span>${text}</span><span>${text}</span></div>
        </div>
      </section>
    `;
  },

  compact(track, extras, config) {
    const safe = getSafeMeta(track);
    const tooltip = `${safe.title} - ${safe.artist}`;
    const compactContent = track?.albumArt
      ? `<img src="${track.albumArt}" alt="Album art" title="${tooltip}" />`
      : '<div class="nw-art-placeholder" title="Nothing playing"></div>';
    return `
      <section class="nw-overlay nw-compact" title="${tooltip}">
        ${compactContent}
      </section>
    `;
  },
};
