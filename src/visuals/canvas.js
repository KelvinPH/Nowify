const FADE_DURATION = 400;

let currentCanvasUrl = "";
let videoEl = null;
/** Album art slot (positioning box) */
let artHost = null;
/** Visible face: <img> or .nw-art-placeholder — opacity toggled when swapping to canvas video */
let artFace = null;

/**
 * @param {Element | null} artElement — `.nw-art`, or `img` inside it (callers often pass querySelector result)
 */
export function initCanvas(artElement) {
  artHost = null;
  artFace = null;
  if (!artElement || typeof artElement.closest !== "function") {
    return;
  }
  const host =
    artElement.closest(".nw-art") ||
    (artElement.classList?.contains("nw-art") ? artElement : null);
  if (!host) {
    return;
  }
  artHost = host;
  artFace =
    host.querySelector("img") || host.querySelector(".nw-art-placeholder");
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
  if (!artHost) return;

  const existing = artHost.querySelector(".nw-canvas-video");
  if (existing) {
    existing.style.opacity = "0";
    window.setTimeout(() => existing.remove(), FADE_DURATION);
  }

  if (artFace) {
    artFace.style.opacity = "1";
  }
  videoEl = null;
}

/** Show video, hide album art — video stays inside `.nw-art` over the art face */
function showVideo(url) {
  if (!artHost) return;

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
  video.style.position = "absolute";
  video.style.top = "0";
  video.style.left = "0";
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  video.style.borderRadius = getComputedStyle(artHost).borderRadius;
  video.style.pointerEvents = "none";
  video.style.zIndex = "2";

  artHost.appendChild(video);

  video.addEventListener(
    "canplay",
    () => {
      if (artFace) {
        artFace.style.transition = `opacity ${FADE_DURATION}ms ease`;
        artFace.style.opacity = "0";
      }
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
