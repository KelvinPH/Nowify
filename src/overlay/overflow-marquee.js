/**
 * Enables horizontal marquee only when a line's text overflows its layout width
 * (per layout / card size), not from character heuristics.
 */

const PAD = 2;

let resizeObserver = null;

export function disconnectOverflowMarquees() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

function wrapSpec(lineEl) {
  if (lineEl.classList.contains("nw-albumfocus-line")) {
    return {
      wrap: "nw-marquee-wrap nw-albumfocus-marquee",
      inner: "nw-marquee-inner nw-albumfocus-marquee-inner",
    };
  }
  return { wrap: "nw-marquee-wrap", inner: "nw-marquee-inner" };
}

function normalizeLine(lineEl) {
  const wrap = lineEl.querySelector(":scope > .nw-marquee-wrap");
  if (!wrap) return;
  const first = wrap.querySelector(".nw-marquee-inner span:first-child");
  if (!first) return;
  const plain = document.createElement("div");
  plain.className = first.className;
  plain.style.cssText = first.style.cssText;
  plain.textContent = first.textContent;
  lineEl.replaceChildren(plain);
}

function upgradeLine(lineEl, textEl) {
  const cls = textEl.className;
  const fragment = textEl.innerHTML;
  const styleCss = textEl.style.cssText;
  const { wrap, inner } = wrapSpec(lineEl);

  const wrapEl = document.createElement("div");
  wrapEl.className = wrap;
  const innerEl = document.createElement("div");
  innerEl.className = inner;

  for (let i = 0; i < 2; i++) {
    const s = document.createElement("span");
    s.className = cls;
    s.innerHTML = fragment;
    s.style.cssText = styleCss;
    if (i === 1) s.setAttribute("aria-hidden", "true");
    innerEl.appendChild(s);
  }
  wrapEl.appendChild(innerEl);
  lineEl.replaceChildren(wrapEl);
}

export function applyOverflowMarquees(rootEl) {
  if (!rootEl) return;
  const lines = rootEl.querySelectorAll("[data-nw-overflow-measure]");
  for (const lineEl of lines) {
    normalizeLine(lineEl);
    const textEl = lineEl.querySelector(
      ":scope > .nw-title, :scope > .nw-artist, :scope > .nw-strip-text",
    );
    if (!textEl) continue;

    const overflows = textEl.scrollWidth > lineEl.clientWidth + PAD;
    if (overflows) {
      upgradeLine(lineEl, textEl);
    }
  }
}

export function bindOverflowMarquees(rootEl) {
  disconnectOverflowMarquees();
  if (!rootEl) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      applyOverflowMarquees(rootEl);
      resizeObserver = new ResizeObserver(() => {
        applyOverflowMarquees(rootEl);
      });
      resizeObserver.observe(rootEl);
    });
  });
}
