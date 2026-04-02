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
    const style = config?.progressStyle || "line";
    return `<div class="nw-progress" data-progress-style="${escHtml(style)}"><div class="nw-progress-fill"></div></div>`;
  }
  return "";
}

function metaEl(config) {
  if (!config) return "";
  const album = config.showAlbum ? '<div class="nw-meta-album"></div>' : "";
  const time = config.showTimeLeft ? '<div class="nw-meta-time"></div>' : "";
  const next = config.showNextTrack ? '<div class="nw-meta-next"></div>' : "";
  const play = config.showPlayState ? '<div class="nw-meta-playstate"></div>' : "";
  if (!album && !time && !next && !play) return "";
  return `<div class="nw-meta">${album}${time}${next}${play}</div>`;
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
      ${metaEl(config)}
    </div>
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
      ${metaEl(config)}
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
    ${metaEl(config)}
  </section>`;
  },

  strip(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    const text = `${title} - ${artist}`;
    const useMarquee = text.length > 40;
    const textMarkup = useMarquee
      ? `<div class="nw-marquee-wrap">
    <div class="nw-marquee-inner">
      <span>${text}</span>
      <span>${text}</span>
    </div>
  </div>`
      : `<div class="nw-strip-text">${text}</div>`;
    const stripTime = config?.showTimeLeft ? `<div class="nw-strip-time">${fmtTime(track?.progressMs)}</div>` : "";
    return `<section class="nw-overlay nw-strip">
    ${artEl(track, "nw-strip-art")}
    <div class="nw-accent-bar"></div>
    ${textMarkup}
    ${stripTime}
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
    ${metaEl(config)}
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
      ${metaEl(config)}
    </div>
  </section>`;
  },

  custom(track, extras, config) {
    const title = escHtml(track?.title || "Unknown title");
    const artist = escHtml(track?.artist || "Unknown artist");
    const album = escHtml(track?.album || "");
    const custom = config?.custom || {};

    const order =
      Array.isArray(custom.contentOrder) && custom.contentOrder.length
        ? custom.contentOrder
        : ["title", "artist", "album", "progress"];
    const separatorStyle = custom.separatorStyle || "none";

    const sepChar =
      separatorStyle === "dot"
        ? "."
        : separatorStyle === "dash"
          ? "-"
          : separatorStyle === "pipe"
            ? "|"
            : "";

    const sepHtml =
      separatorStyle !== "none" && sepChar
        ? `<div class="nw-custom-sep" style="text-align:${escHtml(custom.contentAlign || "left")}">${escHtml(sepChar)}</div>`
        : "";

    const renderedParts = [];
    for (const key of order) {
      if (key === "title") {
        renderedParts.push(`<div class="nw-title">${title}</div>`);
        continue;
      }
      if (key === "artist" && custom.showArtist) {
        renderedParts.push(`<div class="nw-artist">${artist}</div>`);
        continue;
      }
      if (key === "album" && custom.showAlbum) {
        renderedParts.push(`<div class="nw-custom-album">${album}</div>`);
        continue;
      }
      if (key === "progress" && custom.showProgress !== false) {
        renderedParts.push(progressEl({ showProgress: custom.showProgress, progressStyle: custom.progressStyle }));
      }
    }

    const orderedContentHtml = renderedParts
      .map((html, idx) => (sepHtml && idx < renderedParts.length - 1 ? `${html}${sepHtml}` : html))
      .join("");

    const bpm =
      config?.custom?.showBpm === true && extras?.bpm
        ? `<div class="nw-bpm">${escHtml(extras.bpm)} BPM</div>`
        : '<div class="nw-bpm"></div>';

    return `<section class="nw-overlay nw-glasscard nw-custom">
      ${artEl(track, "")}
      <div class="nw-info">
        ${orderedContentHtml}
        <div class="nw-custom-meta">
          <div class="nw-custom-time">0:00</div>
          <div class="nw-custom-next"></div>
          <div class="nw-custom-playstate"></div>
          ${bpm}
        </div>
      </div>
    </section>`;
  },
};
