/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import { CFG_TIP_SHOW_MS } from "./constants.js";
import { getOpenSections, getState } from "./state.js";

let cfgTipEl = null;
let cfgTipShowTimer = null;
let cfgTipHideTimer = null;
let cfgSidebarScrollBound = false;
let cfgTipEscapeBound = false;
let cfgToastTimer = null;

export function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

export function escAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

export const CFG_WAVEFORM_MARK_HTML = `<span class="cfg-waveform-mark cfg-waveform-mark--sm" aria-hidden="true"><svg viewBox="0 0 20 16" width="14" height="11" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/><rect x="11" y="7" width="3" height="8" rx="1" fill="currentColor"/><rect x="16" y="2" width="3" height="13" rx="1" fill="currentColor"/></svg></span>`;

const SECTION_ICONS = {
  source: "fa-solid fa-broadcast-tower",
  layout: "fa-solid fa-grip",
  theme: "fa-solid fa-palette",
  content: "fa-solid fa-font",
  visuals: "fa-solid fa-eye",
  transitions: "fa-solid fa-right-left",
  style: "fa-solid fa-paintbrush",
  twitch: "fa-brands fa-twitch",
};

const SOURCE_SECTION_ICONS = {
  spotify: "fa-brands fa-spotify",
  lastfm: "fa-brands fa-lastfm",
  songify: "fa-solid fa-tower-broadcast",
};

export function getSectionIcon(sectionId, source) {
  if (sectionId === "source" && source && SOURCE_SECTION_ICONS[source]) {
    return SOURCE_SECTION_ICONS[source];
  }
  return SECTION_ICONS[sectionId] || "fa-solid fa-sliders";
}

export function renderSidebarSearch() {
  return `<div class="cfg-sidebar-search">
    <div class="cfg-sidebar-search-wrap">
      <input id="cfg-sidebar-filter" type="search" placeholder="Filter settings" autocomplete="off" spellcheck="false" aria-label="Filter settings" />
      <kbd class="cfg-sidebar-search-kbd" aria-hidden="true">/</kbd>
    </div>
  </div>`;
}

export function ensureCfgTipElement() {
  if (cfgTipEl && document.body.contains(cfgTipEl)) {
    return cfgTipEl;
  }
  cfgTipEl = document.createElement("div");
  cfgTipEl.id = "cfg-tip-floater";
  cfgTipEl.className = "cfg-tip-floater";
  cfgTipEl.setAttribute("role", "tooltip");
  document.body.appendChild(cfgTipEl);
  if (!cfgTipEscapeBound) {
    cfgTipEscapeBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideCfgTip();
      }
    });
  }
  return cfgTipEl;
}

export function hideCfgTip() {
  window.clearTimeout(cfgTipShowTimer);
  cfgTipShowTimer = null;
  if (cfgTipEl) {
    cfgTipEl.classList.remove("cfg-tip-visible");
    cfgTipEl.textContent = "";
    cfgTipEl.style.left = "";
    cfgTipEl.style.top = "";
  }
}

export function positionCfgTip(anchor, tip) {
  tip.classList.add("cfg-tip-visible");
  window.requestAnimationFrame(() => {
    const tr = tip.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const pad = 8;
    let top = ar.bottom + pad;
    let left = ar.left + ar.width / 2 - tr.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
    if (top + tr.height > window.innerHeight - pad) {
      top = ar.top - tr.height - pad;
    }
    top = Math.max(pad, top);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  });
}

export function scheduleShowCfgTip(anchor, text) {
  window.clearTimeout(cfgTipHideTimer);
  cfgTipHideTimer = null;
  window.clearTimeout(cfgTipShowTimer);
  const tip = ensureCfgTipElement();
  cfgTipShowTimer = window.setTimeout(() => {
    cfgTipShowTimer = null;
    tip.textContent = text;
    positionCfgTip(anchor, tip);
  }, CFG_TIP_SHOW_MS);
}

export function bindCfgSidebarScrollOnce() {
  const sb = document.getElementById("cfg-sidebar");
  if (!sb || cfgSidebarScrollBound) {
    return;
  }
  cfgSidebarScrollBound = true;
  sb.addEventListener("scroll", hideCfgTip);
}

export function attachCfgTooltips(container) {
  if (!container) {
    return;
  }
  ensureCfgTipElement();
  bindCfgSidebarScrollOnce();
  container.querySelectorAll("[data-cfg-tip]").forEach((el) => {
    const raw = el.getAttribute("data-cfg-tip");
    if (!raw) {
      return;
    }
    const onEnter = () => scheduleShowCfgTip(el, raw);
    const onLeave = () => {
      window.clearTimeout(cfgTipShowTimer);
      cfgTipShowTimer = null;
      cfgTipHideTimer = window.setTimeout(hideCfgTip, 80);
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
  });
}

export function renderSection(id, label, content, options = {}) {
  const open = getOpenSections().has(id);
  const icon = options.icon || getSectionIcon(id, options.source);
  const body =
    content && content.trim()
      ? content
      : `<div class="cfg-section-empty">${CFG_WAVEFORM_MARK_HTML}<span>Nothing configured yet</span></div>`;
  return `<div class="cfg-section-block${open ? " cfg-section-open" : ""}" data-section-id="${id}">
    <button type="button" class="cfg-section-header" data-toggle-section="${id}" data-label="${escAttr(label)}">
      <span class="cfg-section-header-left">
        <i class="cfg-section-header-icon ${icon}" aria-hidden="true"></i>
        <span class="cfg-section-header-label">${label}</span>
      </span>
      <span class="cfg-section-header-chevron" aria-hidden="true">›</span>
    </button>
    <div class="cfg-section-body">
      ${body}
    </div>
  </div>`;
}

export function compactToggle(label, key, visible = true, desc = "", tooltip = "") {
  if (!visible) return "";
  const state = getState();
  const descHtml = desc
    ? `<span class="cfg-toggle-desc">${desc}</span>`
    : "";
  const tipAttr = tooltip ? ` data-cfg-tip="${escAttr(tooltip)}"` : "";
  return `<label class="cfg-toggle-row cfg-toggle-row-compact" data-label="${escAttr(label)}"${tipAttr}>
    <span class="cfg-toggle-label-wrap">
      <span class="cfg-toggle-label">${label}</span>
      ${descHtml}
    </span>
    <span class="cfg-toggle">
      <input type="checkbox" data-toggle-key="${key}" ${state[key] ? "checked" : ""} />
      <span class="cfg-toggle-track"></span>
      <span class="cfg-toggle-thumb"></span>
    </span>
  </label>`;
}

export function themeLabel(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function showCfgToast(message) {
  const shell = document.getElementById("cfg-shell");
  if (!shell) {
    return;
  }
  let el = document.getElementById("cfg-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "cfg-toast";
    el.className = "cfg-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    shell.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("cfg-toast-visible");
  window.clearTimeout(cfgToastTimer);
  cfgToastTimer = window.setTimeout(() => {
    el.classList.remove("cfg-toast-visible");
  }, 3200);
}

export async function copyText(text) {
  const value = String(text || "");
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_error) {}

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return Boolean(ok);
  } catch (_error) {
    return false;
  }
}

export function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((x) => clampByte(x).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function parseColorToHexForPicker(css) {
  const s = String(css || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  const hex3 = s.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const h = hex3[1];
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  const rgb = s.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)/i
  );
  if (rgb) return rgbToHex(rgb[1], rgb[2], rgb[3]);
  return "#ffffff";
}

export function extractAlphaFromCss(css) {
  const s = String(css || "");
  const m = s.match(/rgba\s*\([\d\s,]+,\s*([\d.]+)\s*\)/i);
  if (m) {
    const a = parseFloat(m[1]);
    return Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1;
  }
  return 1;
}

export function hexToRgba(hex, a) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = Math.min(1, Math.max(0, Number(a) || 1));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function wheelHexToQueueColorValue(key, hex) {
  const state = getState();
  if (key === "queueColorMuted" || key === "queueColorCard") {
    const alpha =
      extractAlphaFromCss(state[key]) || (key === "queueColorMuted" ? 0.45 : 0.85);
    return hexToRgba(hex, alpha);
  }
  return hex;
}
