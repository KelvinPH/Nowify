const ANIMATIONS = {
  fade: {
    enter: [{ opacity: 0 }, { opacity: 1 }],
    exit: [{ opacity: 1 }, { opacity: 0 }],
  },
  zoom: {
    enter: [
      { opacity: 0, transform: "scale(0.85)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    exit: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.85)" },
    ],
  },
  slide_up: {
    enter: [
      { opacity: 0, transform: "translateY(20px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    exit: [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(20px)" },
    ],
  },
  slide_down: {
    enter: [
      { opacity: 0, transform: "translateY(-20px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    exit: [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(-20px)" },
    ],
  },
  blur: {
    enter: [
      { opacity: 0, filter: "blur(12px)" },
      { opacity: 1, filter: "blur(0px)" },
    ],
    exit: [
      { opacity: 1, filter: "blur(0px)" },
      { opacity: 0, filter: "blur(12px)" },
    ],
  },
  pop: {
    enter: [
      { opacity: 0, transform: "scale(0.7)" },
      { opacity: 1, transform: "scale(1.04)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    exit: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.7)" },
    ],
  },
  shrink: {
    enter: [
      { opacity: 0, transform: "scale(0.3)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    exit: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.3)" },
    ],
  },
  none: {
    enter: null,
    exit: null,
  },
};

let exitTimer = null;
let activeAnimation = null;
let overlayEl = null;
let isVisible = false;

function cancelActiveAnimation() {
  if (activeAnimation) {
    activeAnimation.cancel();
    activeAnimation = null;
  }
}

function playExit(animName, durationMs) {
  if (!overlayEl) {
    return;
  }
  cancelActiveAnimation();
  overlayEl.removeAttribute("data-hidden");
  if (animName === "none") {
    overlayEl.style.opacity = "0";
    overlayEl.style.visibility = "hidden";
    overlayEl.setAttribute("data-hidden", "true");
    isVisible = false;
    return;
  }
  const anim = ANIMATIONS[animName]?.exit;
  if (!anim) {
    overlayEl.style.opacity = "0";
    overlayEl.style.visibility = "hidden";
    overlayEl.setAttribute("data-hidden", "true");
    isVisible = false;
    return;
  }
  activeAnimation = overlayEl.animate(anim, {
    duration: durationMs,
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    fill: "forwards",
  });
  activeAnimation.onfinish = () => {
    overlayEl.style.opacity = "0";
    overlayEl.style.visibility = "hidden";
    overlayEl.setAttribute("data-hidden", "true");
    isVisible = false;
    activeAnimation = null;
  };
}

export function init(el) {
  if (!el) {
    return;
  }
  if (overlayEl && overlayEl !== el) {
    cancelActiveAnimation();
    cancelExit();
    isVisible = false;
  }
  overlayEl = el;
}

export function playEnter(animName, durationMs) {
  if (!overlayEl) {
    return;
  }
  cancelExit();
  cancelActiveAnimation();
  overlayEl.removeAttribute("data-hidden");
  if (animName === "none") {
    overlayEl.style.visibility = "visible";
    overlayEl.style.opacity = "1";
    isVisible = true;
    return;
  }
  overlayEl.style.visibility = "visible";
  overlayEl.style.opacity = "0";
  isVisible = true;
  const anim = ANIMATIONS[animName]?.enter;
  if (!anim) {
    overlayEl.style.opacity = "1";
    return;
  }
  activeAnimation = overlayEl.animate(anim, {
    duration: durationMs,
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    fill: "forwards",
  });
  activeAnimation.onfinish = () => {
    overlayEl.style.opacity = "1";
    activeAnimation = null;
  };
}

export function scheduleExit(animName, durationMs, delayMs) {
  if (exitTimer) {
    clearTimeout(exitTimer);
    exitTimer = null;
  }
  if (delayMs <= 0) {
    playExit(animName, durationMs);
    return;
  }
  exitTimer = window.setTimeout(() => {
    exitTimer = null;
    playExit(animName, durationMs);
  }, delayMs);
}

export function cancelExit() {
  if (exitTimer) {
    clearTimeout(exitTimer);
    exitTimer = null;
  }
}

export function getIsVisible() {
  return isVisible;
}
