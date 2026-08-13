/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import { copyText } from "./ui.js";

const STEPS = [
  {
    id: "copy",
    title: "Copy your overlay URL",
    body: "This link is your live overlay. You’ll paste it into OBS next.",
  },
  {
    id: "add",
    title: "Add a Browser source",
    body: "In OBS: Sources → <strong>+</strong> → <strong>Browser</strong>. Name it something like Nowify.",
  },
  {
    id: "paste",
    title: "Paste URL & set size",
    body: "Paste into the URL field. Start with the size below, then tweak if it feels tight or empty.",
  },
  {
    id: "place",
    title: "Make it sit cleanly",
    body: "Turn on <strong>Transparent background</strong> in Nowify. In OBS, enable transparent output if you see that option. Click OK, then drag the source into place.",
  },
];

let obsStep = 0;
let obsEscCleanup = null;
let obsUrl = "";

function suggestedSize(layout) {
  const sizes = {
    glasscard: "900 × 300",
    pill: "520 × 120",
    island: "280 × 320",
    strip: "900 × 100",
    albumfocus: "280 × 360",
    sidebar: "160 × 360",
    vinyl: "560 × 360",
    terminal: "640 × 360",
    cassette: "480 × 280",
    gameboy: "360 × 360",
    hud: "640 × 220",
    stickynote: "360 × 320",
    spotifycard: "900 × 420",
    custom: "900 × 300",
  };
  return sizes[layout] || "900 × 300";
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function closeObsGuideModal() {
  if (obsEscCleanup) {
    obsEscCleanup();
    obsEscCleanup = null;
  }
  document.getElementById("cfg-obs-modal")?.remove();
  obsStep = 0;
  obsUrl = "";
}

function renderObsStep(state) {
  const dialog = document.querySelector("#cfg-obs-modal .cfg-obs-dialog");
  if (!dialog) return;

  const step = STEPS[obsStep];
  const isFirst = obsStep === 0;
  const isLast = obsStep === STEPS.length - 1;
  const sizeHint = suggestedSize(state?.layout);
  const layoutLabel = String(state?.layout || "glasscard");

  const dots = STEPS.map(
    (_, i) =>
      `<span class="cfg-obs-dot${i === obsStep ? " cfg-obs-dot-active" : ""}${i < obsStep ? " cfg-obs-dot-done" : ""}" aria-hidden="true"></span>`
  ).join("");

  let stepExtra = "";
  if (step.id === "copy") {
    stepExtra = `
      <div class="cfg-obs-url-block">
        <div class="cfg-obs-url-row">
          <input id="cfg-obs-url-field" class="cfg-obs-url-input" type="text" readonly spellcheck="false" aria-label="Overlay URL" />
          <button type="button" class="cfg-btn cfg-btn-primary" id="cfg-obs-copy-url">Copy</button>
        </div>
      </div>`;
  } else if (step.id === "paste") {
    stepExtra = `
      <div class="cfg-obs-size-chip" role="note">
        Suggested size for <strong>${esc(layoutLabel)}</strong>
        <span class="cfg-obs-size-value">${esc(sizeHint)}</span>
      </div>`;
  } else if (step.id === "place") {
    stepExtra = `
      <details class="cfg-obs-tips">
        <summary>Optional OBS tips</summary>
        <ul class="cfg-obs-tips-list">
          <li><strong>FPS</strong> — 30 is usually enough.</li>
          <li><strong>Custom CSS</strong> — leave empty.</li>
          <li><strong>Localhost / file://</strong> — OBS must reach the same machine or server.</li>
        </ul>
      </details>`;
  }

  dialog.innerHTML = `
    <div class="cfg-obs-header">
      <div class="cfg-obs-header-text">
        <p class="cfg-obs-kicker">Add to OBS · ${obsStep + 1} of ${STEPS.length}</p>
        <h2 class="cfg-obs-title" id="cfg-obs-title">${step.title}</h2>
      </div>
      <button type="button" class="cfg-btn cfg-btn-ghost cfg-obs-close-btn" id="cfg-obs-close" aria-label="Close">Close</button>
    </div>
    <div class="cfg-obs-progress" aria-hidden="true">${dots}</div>
    <p class="cfg-obs-lead">${step.body}</p>
    ${stepExtra}
    <div class="cfg-obs-footer">
      <button type="button" class="cfg-btn cfg-btn-ghost" id="cfg-obs-back" ${isFirst ? "disabled" : ""}>Back</button>
      <button type="button" class="cfg-btn cfg-btn-primary" id="cfg-obs-next">${isLast ? "Done" : "Next"}</button>
    </div>
  `;

  const urlField = document.getElementById("cfg-obs-url-field");
  if (urlField) urlField.value = obsUrl;

  document.getElementById("cfg-obs-close")?.addEventListener("click", closeObsGuideModal);
  document.getElementById("cfg-obs-back")?.addEventListener("click", () => {
    if (obsStep > 0) {
      obsStep -= 1;
      renderObsStep(state);
    }
  });
  document.getElementById("cfg-obs-next")?.addEventListener("click", () => {
    if (obsStep >= STEPS.length - 1) {
      closeObsGuideModal();
      return;
    }
    obsStep += 1;
    renderObsStep(state);
  });
  document.getElementById("cfg-obs-copy-url")?.addEventListener("click", async () => {
    const field = document.getElementById("cfg-obs-url-field");
    const t = field?.value || obsUrl;
    const ok = await copyText(t);
    const btn = document.getElementById("cfg-obs-copy-url");
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = ok ? "Copied!" : "Copy failed";
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 1200);
    }
    if (!ok) field?.select();
  });
}

/** Opens a short step-by-step OBS Browser Source setup wizard. */
export function openObsGuideModal({ url, state }) {
  closeObsGuideModal();
  const shell = document.getElementById("cfg-shell");
  if (!shell) return;

  obsStep = 0;
  obsUrl = url || "";

  const modal = document.createElement("div");
  modal.id = "cfg-obs-modal";
  modal.className = "cfg-obs-modal";
  modal.innerHTML = `<div class="cfg-obs-dialog" role="dialog" aria-labelledby="cfg-obs-title" aria-modal="true"></div>`;
  shell.appendChild(modal);

  const onEsc = (e) => {
    if (e.key === "Escape") closeObsGuideModal();
  };
  document.addEventListener("keydown", onEsc);
  obsEscCleanup = () => document.removeEventListener("keydown", onEsc);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeObsGuideModal();
  });

  renderObsStep(state || {});
}

export { closeObsGuideModal };
