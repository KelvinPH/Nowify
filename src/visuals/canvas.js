const FADE_DURATION = 400;

let currentCanvasUrl = "";
let videoEl = null;
let artEl = null;

/** Initialize canvas system with references to art and video elements */
export function initCanvas(artElement) {
  artEl = artElement;
}

/** Update canvas for new track data */
export function updateCanvas(canvasUrl, enabled) {
  if (!enabled || !canvasUrl) {
    showArt();
    return;
  }

  if (canvasUrl === currentCanvasUrl) return;
  currentCanvasUrl = canvasUrl;

  showVideo(canvasUrl);
}

/** Show album art, hide video */
function showArt() {
  currentCanvasUrl = "";
  if (!artEl) return;

  const existing = artEl.parentElement?.querySelector(".nw-canvas-video");
  if (existing) {
    existing.style.opacity = "0";
    window.setTimeout(() => existing.remove(), FADE_DURATION);
  }

  artEl.style.opacity = "1";
  videoEl = null;
}

/** Show video, hide album art */
function showVideo(url) {
  if (!artEl) return;

  const video = document.createElement("video");
  video.className = "nw-canvas-video";
  video.src = url;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.style.opacity = "0";
  video.style.transition = `opacity ${FADE_DURATION}ms ease`;

  video.style.width = `${artEl.offsetWidth}px`;
  video.style.height = `${artEl.offsetHeight}px`;
  video.style.borderRadius = getComputedStyle(artEl).borderRadius;

  artEl.parentElement?.appendChild(video);

  video.addEventListener(
    "canplay",
    () => {
      artEl.style.transition = `opacity ${FADE_DURATION}ms ease`;
      artEl.style.opacity = "0";
      video.style.opacity = "1";
      videoEl = video;
    },
    { once: true }
  );

  video.addEventListener(
    "error",
    () => {
      showArt();
    },
    { once: true }
  );
}

/** Clear canvas state (e.g. on source disconnect) */
export function clearCanvas() {
  showArt();
  currentCanvasUrl = "";
}
