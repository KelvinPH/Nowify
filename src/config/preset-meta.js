/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

/** Fixed categories for community preset discovery. */
export const PRESET_CATEGORIES = [
  { id: "minimal", label: "Minimal" },
  { id: "retro", label: "Retro" },
  { id: "gaming", label: "Gaming" },
  { id: "aesthetic", label: "Aesthetic" },
  { id: "high-contrast", label: "High contrast" },
];

export const PRESET_CATEGORY_IDS = new Set([
  ...PRESET_CATEGORIES.map((c) => c.id),
  "uncategorized",
]);

export const PRESET_MAX_TAGS = 5;

export function presetCategoryLabel(id) {
  const found = PRESET_CATEGORIES.find((c) => c.id === id);
  if (found) return found.label;
  if (id === "uncategorized") return "Uncategorized";
  return "Uncategorized";
}

/** Trim, lowercase, dedupe; max PRESET_MAX_TAGS. */
export function normalizePresetTags(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const tag = String(item || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= PRESET_MAX_TAGS) break;
  }
  return out;
}

export function normalizePresetCategory(input) {
  const id = String(input || "uncategorized")
    .trim()
    .toLowerCase();
  return PRESET_CATEGORY_IDS.has(id) ? id : "uncategorized";
}

export function normalizePublicPreset(preset) {
  if (!preset || typeof preset !== "object") return preset;
  return {
    ...preset,
    tags: normalizePresetTags(preset.tags),
    category: normalizePresetCategory(preset.category),
  };
}
