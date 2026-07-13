/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import { WORKER_BASE_URL } from "./constants.js";
import {
  normalizePresetTags,
  normalizePublicPreset,
  PRESET_CATEGORIES,
  presetCategoryLabel,
} from "./preset-meta.js";
import {
  invalidatePublicPresetsCache,
  readPublicPresetsCache,
  writePublicPresetsCache,
} from "./storage.js";
import { escAttr, escCfg } from "./ui.js";

/**
 * Client-side mini preview from customState (no image upload).
 * Renders a simplified card using the preset's colours and layout hints.
 */
export function buildPresetThumbnailHtml(customState) {
  const cs = customState && typeof customState === "object" ? customState : {};
  const accent = cs.colorAccent || "#1db954";
  const titleColor = cs.colorTitle || "#ffffff";
  const artistColor = cs.colorArtist || "rgba(255,255,255,0.45)";
  const radius = Math.min(Number(cs.cardRadius) || 12, 14);
  const artSize = Math.min(Number(cs.artSize) || 40, 36);
  const row = cs.direction !== "column";

  let background = "rgba(12,12,14,0.92)";
  if (cs.bgType === "solid") {
    background = cs.customColors ? cs.colorBg || background : "rgba(12,12,14,0.92)";
  } else if (cs.bgType === "gradient" || cs.bgType === "radial") {
    const c1 = cs.gradientColor1 || "rgba(20,20,30,0.9)";
    const c2 = cs.gradientColor2 || "rgba(40,20,50,0.9)";
    const angle = Number(cs.gradientAngle) || 135;
    background =
      cs.bgType === "radial"
        ? `radial-gradient(circle at 30% 30%, ${c1}, ${c2})`
        : `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  } else if (cs.animBgEnabled) {
    background = `linear-gradient(135deg, ${cs.animBgColor1 || "rgba(80,40,120,0.7)"}, ${cs.animBgColor2 || "rgba(20,30,80,0.8)"})`;
  }

  const layout = row ? "row" : "column";
  const align = row ? "flex-start" : "center";

  return `<div class="cfg-gallery-thumb" style="background:${escAttr(background)};border-radius:${radius}px;">
    <div class="cfg-gallery-thumb-inner" style="flex-direction:${layout};align-items:${align};">
      <div class="cfg-gallery-thumb-art" style="width:${artSize}px;height:${artSize}px;border-radius:${Math.min(Number(cs.artRadius) || 6, 10)}px;background:linear-gradient(145deg, ${escAttr(accent)}55, ${escAttr(accent)}22);"></div>
      <div class="cfg-gallery-thumb-text" style="text-align:${row ? "left" : "center"};">
        <div class="cfg-gallery-thumb-title" style="color:${escAttr(titleColor)};">Track</div>
        <div class="cfg-gallery-thumb-artist" style="color:${escAttr(artistColor)};">Artist</div>
        ${cs.showProgress !== false ? `<div class="cfg-gallery-thumb-progress" style="background:${escAttr(accent)};"></div>` : ""}
      </div>
    </div>
  </div>`;
}

function filterPresets(presets, { search, category, tag }) {
  const q = String(search || "")
    .trim()
    .toLowerCase();
  return presets.filter((p) => {
    const cat = p.category || "uncategorized";
    if (category && category !== "all" && cat !== category) return false;
    if (tag && !(p.tags || []).includes(tag)) return false;
    if (!q) return true;
    const hay = [
      p.name,
      p.author,
      cat,
      presetCategoryLabel(cat),
      ...(p.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function renderCategoryFilters(activeCategory, onChange) {
  const buttons = [
    { id: "all", label: "All" },
    ...PRESET_CATEGORIES,
    { id: "uncategorized", label: "Uncategorized" },
  ];
  return buttons
    .map(
      (c) => `<button type="button" class="cfg-gallery-filter${activeCategory === c.id ? " cfg-gallery-filter--active" : ""}" data-gallery-category="${escCfg(c.id)}">${c.label}</button>`
    )
    .join("");
}

function renderPresetCard(preset, ownerKey) {
  const tags = preset.tags || [];
  const category = preset.category || "uncategorized";
  const canDelete = preset.ownerKey && preset.ownerKey === ownerKey;

  return `<article class="cfg-gallery-card" data-preset-id="${escCfg(preset.id)}">
    <button type="button" class="cfg-gallery-card-main" data-gallery-apply="${escCfg(preset.id)}">
      ${buildPresetThumbnailHtml(preset.customState)}
      <div class="cfg-gallery-card-body">
        <div class="cfg-gallery-card-title">${escCfg(preset.name || "Untitled")}</div>
        <div class="cfg-gallery-card-author">by ${escCfg(preset.author || "anonymous")}</div>
        <div class="cfg-gallery-card-category">${escCfg(presetCategoryLabel(category))}</div>
        ${
          tags.length
            ? `<div class="cfg-gallery-tags">${tags.map((t) => `<span class="cfg-gallery-tag" data-gallery-tag="${escCfg(t)}">${escCfg(t)}</span>`).join("")}</div>`
            : ""
        }
      </div>
    </button>
    ${
      canDelete
        ? `<button type="button" class="cfg-gallery-delete" data-gallery-delete="${escCfg(preset.id)}">Delete</button>`
        : ""
    }
  </article>`;
}

function paintGalleryGrid(root, presets, filters, ownerKey, handlers) {
  const grid = root.querySelector("#cfg-gallery-grid");
  const empty = root.querySelector("#cfg-gallery-empty");
  const countEl = root.querySelector("#cfg-gallery-count");
  if (!grid || !empty) return;

  const filtered = filterPresets(presets, filters);
  if (countEl) {
    countEl.textContent =
      filtered.length === presets.length
        ? `${presets.length} preset${presets.length === 1 ? "" : "s"}`
        : `${filtered.length} of ${presets.length}`;
  }

  if (!filtered.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.textContent = presets.length
      ? "No presets match your filters."
      : "No public presets yet.";
    return;
  }

  empty.hidden = true;
  grid.innerHTML = filtered.map((p) => renderPresetCard(p, ownerKey)).join("");

  grid.querySelectorAll("[data-gallery-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-gallery-apply");
      const selected = presets.find((p) => p.id === id);
      if (selected?.customState && handlers.onApply) handlers.onApply(selected);
    });
  });

  grid.querySelectorAll("[data-gallery-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-gallery-delete");
      if (handlers.onDelete) handlers.onDelete(id);
    });
  });

  grid.querySelectorAll("[data-gallery-tag]").forEach((pill) => {
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      const tag = pill.getAttribute("data-gallery-tag");
      if (handlers.onTagClick) handlers.onTagClick(tag);
    });
  });
}

function bindGalleryControls(root, state, getPresets, ownerKey, handlers) {
  const searchInput = root.querySelector("#cfg-gallery-search");
  const filtersEl = root.querySelector("#cfg-gallery-filters");

  const refresh = () =>
    paintGalleryGrid(root, getPresets(), state, ownerKey, handlers);

  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value;
    refresh();
  });

  filtersEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gallery-category]");
    if (!btn) return;
    state.category = btn.getAttribute("data-gallery-category") || "all";
    filtersEl.querySelectorAll("[data-gallery-category]").forEach((el) => {
      el.classList.toggle(
        "cfg-gallery-filter--active",
        el.getAttribute("data-gallery-category") === state.category
      );
    });
    refresh();
  });

  return {
    refresh,
    setTag(tag) {
      state.tag = tag || null;
      refresh();
    },
    clearTag() {
      state.tag = null;
      refresh();
    },
  };
}

/**
 * Mounts searchable public preset gallery into container.
 */
export async function mountPublicPresetGallery(container, { ownerKey, onApply, onDelete }) {
  if (!container) return null;

  const filterState = { search: "", category: "all", tag: null };
  let presets = [];

  container.innerHTML = `
    <div class="cfg-gallery-toolbar">
      <input id="cfg-gallery-search" class="cfg-gallery-search" type="search" placeholder="Search presets, tags, authors…" autocomplete="off" />
      <span id="cfg-gallery-count" class="cfg-gallery-count"></span>
    </div>
    <div id="cfg-gallery-filters" class="cfg-gallery-filters">
      ${renderCategoryFilters("all")}
    </div>
    <div id="cfg-gallery-active-tag" class="cfg-gallery-active-tag" hidden>
      <span>Tag:</span>
      <button type="button" id="cfg-gallery-clear-tag" class="cfg-gallery-tag cfg-gallery-tag--active"></button>
    </div>
    <div id="cfg-gallery-grid" class="cfg-gallery-grid"></div>
    <div id="cfg-gallery-empty" class="cfg-presets-empty" hidden>No public presets yet.</div>
  `;

  const handlers = {
    onApply,
    onDelete: async (id) => {
      if (onDelete) await onDelete(id);
      presets = presets.filter((p) => p.id !== id);
      invalidatePublicPresetsCache();
      galleryApi.refresh();
    },
    onTagClick: (tag) => {
      filterState.tag = tag;
      const tagBar = container.querySelector("#cfg-gallery-active-tag");
      const tagBtn = container.querySelector("#cfg-gallery-clear-tag");
      if (tagBar && tagBtn) {
        tagBar.hidden = false;
        tagBtn.textContent = tag;
      }
      galleryApi.refresh();
    },
  };

  const getPresets = () => presets;
  const galleryApi = bindGalleryControls(
    container,
    filterState,
    getPresets,
    ownerKey,
    handlers
  );

  container.querySelector("#cfg-gallery-clear-tag")?.addEventListener("click", () => {
    filterState.tag = null;
    const tagBar = container.querySelector("#cfg-gallery-active-tag");
    if (tagBar) tagBar.hidden = true;
    galleryApi.refresh();
  });

  const cached = readPublicPresetsCache();
  if (cached?.length) {
    presets = cached.map(normalizePublicPreset);
    galleryApi.refresh();
    void loadPresets({ background: true });
    return { reload: () => loadPresets() };
  }

  async function loadPresets({ background = false } = {}) {
    const grid = container.querySelector("#cfg-gallery-grid");
    const empty = container.querySelector("#cfg-gallery-empty");
    if (!background) {
      if (grid) grid.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Loading presets…";
      }
    }
    try {
      const res = await fetch(`${WORKER_BASE_URL}/presets`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      presets = (data?.presets || [])
        .filter((p) => p?.customState)
        .map(normalizePublicPreset);
      writePublicPresetsCache(presets);
      if (empty) empty.hidden = true;
      galleryApi.refresh();
    } catch (_error) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Could not load public presets.";
      }
    }
  }

  await loadPresets();
  return { reload: loadPresets };
}

let publishModalEl = null;

function closePublishModal() {
  publishModalEl?.remove();
  publishModalEl = null;
}

/**
 * Modal for publishing a custom preset with category and tags.
 */
export function openPublishPresetModal({ customState, ownerKey, onPublished }) {
  closePublishModal();
  const shell = document.getElementById("cfg-shell");
  if (!shell || !customState) return;

  const categoryOptions = PRESET_CATEGORIES.map(
    (c) => `<option value="${escCfg(c.id)}">${escCfg(c.label)}</option>`
  ).join("");

  const modal = document.createElement("div");
  modal.id = "cfg-publish-modal";
  modal.className = "cfg-presets-modal";
  modal.innerHTML = `
    <div class="cfg-presets-dialog cfg-publish-dialog" role="dialog" aria-labelledby="cfg-publish-title">
      <div class="cfg-presets-header">
        <div class="cfg-presets-title" id="cfg-publish-title">Publish preset</div>
        <button type="button" class="cfg-btn" id="cfg-publish-close">Close</button>
      </div>
      <p class="cfg-publish-lead">Share your custom layout with the community. Others can browse and apply it from the preset gallery.</p>
      <label class="cfg-publish-label" for="cfg-publish-name">Name</label>
      <input id="cfg-publish-name" class="cfg-input cfg-publish-input" type="text" maxlength="80" placeholder="My stream overlay" />
      <label class="cfg-publish-label" for="cfg-publish-author">Author (optional)</label>
      <input id="cfg-publish-author" class="cfg-input cfg-publish-input" type="text" maxlength="40" placeholder="anonymous" />
      <label class="cfg-publish-label" for="cfg-publish-category">Category</label>
      <select id="cfg-publish-category" class="cfg-input cfg-publish-input">
        ${categoryOptions}
      </select>
      <label class="cfg-publish-label" for="cfg-publish-tags">Tags (optional, comma-separated, max 5)</label>
      <input id="cfg-publish-tags" class="cfg-input cfg-publish-input" type="text" placeholder="minimal, dark, glass" />
      <div class="cfg-publish-preview-label">Preview</div>
      <div class="cfg-publish-preview-wrap">${buildPresetThumbnailHtml(customState)}</div>
      <div class="cfg-publish-actions">
        <button type="button" class="cfg-btn" id="cfg-publish-cancel">Cancel</button>
        <button type="button" class="cfg-btn cfg-btn-primary" id="cfg-publish-submit">Publish</button>
      </div>
      <p id="cfg-publish-error" class="cfg-publish-error" hidden></p>
    </div>
  `;

  shell.appendChild(modal);
  publishModalEl = modal;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closePublishModal();
  });
  document.getElementById("cfg-publish-close")?.addEventListener("click", closePublishModal);
  document.getElementById("cfg-publish-cancel")?.addEventListener("click", closePublishModal);

  document.getElementById("cfg-publish-submit")?.addEventListener("click", async () => {
    const nameEl = document.getElementById("cfg-publish-name");
    const authorEl = document.getElementById("cfg-publish-author");
    const categoryEl = document.getElementById("cfg-publish-category");
    const tagsEl = document.getElementById("cfg-publish-tags");
    const errorEl = document.getElementById("cfg-publish-error");
    const submitBtn = document.getElementById("cfg-publish-submit");

    const name = nameEl?.value?.trim();
    if (!name) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Please enter a preset name.";
      }
      nameEl?.focus();
      return;
    }

    if (errorEl) errorEl.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Publishing…";
    }

    const tags = normalizePresetTags(tagsEl?.value || "");
    const category = categoryEl?.value || "minimal";

    try {
      const res = await fetch(`${WORKER_BASE_URL}/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          author: authorEl?.value?.trim() || "anonymous",
          customState,
          ownerKey,
          tags,
          category,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      invalidatePublicPresetsCache();
      closePublishModal();
      if (onPublished) onPublished();
    } catch (_error) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Could not publish preset. Try again later.";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Publish";
      }
    }
  });
}
