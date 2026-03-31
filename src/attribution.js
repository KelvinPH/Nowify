const ATTRIBUTION_CLASS = "nowify-attribution";
const ATTRIBUTION_HREF = "https://github.com/KelvinPH/Nowify";
const ATTRIBUTION_TEXT = "Built by KelvinPH • github.com/KelvinPH/Nowify";

function createAttributionNode() {
  const el = document.createElement("a");
  el.className = ATTRIBUTION_CLASS;
  el.href = ATTRIBUTION_HREF;
  el.target = "_blank";
  el.rel = "noopener noreferrer";
  el.textContent = ATTRIBUTION_TEXT;
  return el;
}

function ensureAttributionPresent() {
  if (!document.body) return;
  if (document.querySelector(`.${ATTRIBUTION_CLASS}`)) return;
  document.body.appendChild(createAttributionNode());
}

function initAttributionGuard() {
  ensureAttributionPresent();
  const observer = new MutationObserver(() => {
    ensureAttributionPresent();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAttributionGuard, { once: true });
} else {
  initAttributionGuard();
}
