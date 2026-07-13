/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

/** Builds the full overlay URL from the current configurator state. */
export function buildOverlayUrl(currentState) {
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();

  Object.entries(currentState).forEach(([key, value]) => {
    if (key === "commands" || key === "previewDemo") {
      return;
    }
    if (key.startsWith("queue")) {
      return;
    }
    if (value !== null && typeof value === "object") {
      return;
    }
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
      return;
    }
    params.set(key, String(value));
  });

  return `${base}?${params.toString()}`;
}

export function buildQueueSearchParams(inputState, forConfiguratorPreview) {
  const params = new URLSearchParams({
    songifyPort: String(inputState.songifyPort || 4002),
    theme: inputState.theme || "obsidian",
    layout:
      inputState.queueLayout === "sidebar"
        ? "glasscard"
        : inputState.queueLayout || "glasscard",
    artPosition: inputState.queueArtPosition || "left",
    maxItems: String(inputState.queueMaxItems || 5),
    queueSource: inputState.queueSource || "queue",
    showPosition: inputState.queueShowPosition ? "1" : "0",
    showArt: inputState.queueShowArt ? "1" : "0",
    showTitle: inputState.queueShowTitle ? "1" : "0",
    showArtist: inputState.queueShowArtist ? "1" : "0",
    showAlbum: inputState.queueShowAlbum ? "1" : "0",
    showDuration: inputState.queueShowDuration ? "1" : "0",
    showRequester: inputState.queueShowRequester ? "1" : "0",
    showRequesterAvatar: inputState.queueShowAvatar ? "1" : "0",
    showLiked: inputState.queueShowLiked ? "1" : "0",
    highlightRequests: inputState.queueHighlightRequests ? "1" : "0",
    showTimeLeft: inputState.queueShowTimeLeft ? "1" : "0",
    showNextTrack: inputState.queueShowNextTrack ? "1" : "0",
    showPlayState: inputState.queueShowPlayState ? "1" : "0",
    showProgress: inputState.queueShowProgress ? "1" : "0",
    transparent: inputState.queueTransparent ? "1" : "0",
    animateIn: inputState.queueAnimateIn || "slide",
    fontSize: String(inputState.queueFontSize || 13),
    itemRadius: String(inputState.queueItemRadius || 10),
    itemPadding: String(inputState.queueItemPadding || 10),
    itemOpacity: String(inputState.queueItemOpacity || 80),
    artSize: String(inputState.queueArtSize || 40),
    gap: String(inputState.queueGap || 6),
    blurStrength: String(inputState.queueBlur ?? 24),
    maxWidth: String(inputState.queueMaxWidth ?? 480),
  });
  if (forConfiguratorPreview && inputState.queueDemoPreview) {
    params.set("demo", "1");
  }
  if (inputState.queueCustomColors) {
    params.set("customColors", "1");
    if (inputState.queueColorAccent) params.set("colorAccent", inputState.queueColorAccent);
    if (inputState.queueColorTitle) params.set("colorTitle", inputState.queueColorTitle);
    if (inputState.queueColorMuted) params.set("colorMuted", inputState.queueColorMuted);
    if (inputState.queueColorCard) params.set("colorCard", inputState.queueColorCard);
  }
  return params;
}

/** Queue overlay URL (preview uses demo when queueDemoPreview is on). */
export function buildQueueUrl(inputState) {
  const base =
    window.location.origin + window.location.pathname.replace("config.html", "") + "queue.html";
  return `${base}?${buildQueueSearchParams(inputState, true).toString()}`;
}

export function queuePreviewIframeSrc(inputState) {
  const url = buildQueueUrl(inputState);
  const u = new URL(url);
  u.searchParams.set("nwPv", String(Date.now()));
  return u.toString();
}

export function buildQueueFinalUrl(inputState) {
  const base =
    window.location.origin + window.location.pathname.replace("config.html", "") + "queue.html";
  return `${base}?${buildQueueSearchParams(inputState, false).toString()}`;
}

export function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
}
