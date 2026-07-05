import { LAYOUT_HINTS_SHORT } from "./constants.js";
import {
  getExpandedCommands,
  getOpenSections,
  getState,
  isQueueConfigOpen,
} from "./state.js";
import { savePlatformState } from "./storage.js";

let inputDebounceTimer = null;
let animBgSpeedDebounceTimer = null;
let artBackdropBlurDebounceTimer = null;
let transitionEnterDurDebounceTimer = null;
let transitionExitDurDebounceTimer = null;
let transitionExitDelayDebounceTimer = null;
let twitchCmdSliderDebounceTimer = null;
let mainSidebarBound = false;
let queueSidebarBound = false;

/** Keys that change which sidebar controls exist (full rebuild required). */
const SIDEBAR_STRUCTURAL_KEYS = new Set([
  "source",
  "layout",
  "animBgEnabled",
  "artBackdropEnabled",
  "showNextTrack",
]);

export function needsSidebarRebuild(newState) {
  if (Object.keys(newState).length === 0) {
    return true;
  }
  return Object.keys(newState).some((key) => SIDEBAR_STRUCTURAL_KEYS.has(key));
}

export function patchSidebarValues() {
  const state = getState();
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar || isQueueConfigOpen()) {
    return;
  }

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    const key = input.getAttribute("data-toggle-key");
    if (key in state) {
      input.checked = Boolean(state[key]);
    }
  });

  sidebar.querySelectorAll("[data-set-key]").forEach((btn) => {
    const key = btn.getAttribute("data-set-key");
    const val = btn.getAttribute("data-set-value");
    if (key in state) {
      const active = String(state[key]) === val;
      btn.classList.toggle("cfg-active", active);
      if (key === "source") {
        btn.classList.toggle("cfg-pill-active", active);
      }
    }
  });

  const hint = sidebar.querySelector(".cfg-layout-hint-short");
  if (hint) {
    hint.textContent = LAYOUT_HINTS_SHORT[state.layout] || "";
  }

  const speedLabel = document.getElementById("ctrl-anim-bg-speed-label");
  if (speedLabel) {
    speedLabel.textContent = `Speed (${state.animBgSpeed}s)`;
  }
  const blurLabel = document.getElementById("ctrl-art-backdrop-blur-label");
  if (blurLabel) {
    blurLabel.textContent = `Backdrop blur (${state.artBackdropBlur}px)`;
  }
  const enterLabel = document.getElementById("ctrl-enter-duration-label");
  if (enterLabel) {
    enterLabel.textContent = `Duration (${state.enterDuration}ms)`;
  }
  const exitLabel = document.getElementById("ctrl-exit-duration-label");
  if (exitLabel) {
    exitLabel.textContent = `Duration (${state.exitDuration}ms)`;
  }
  const delayLabel = document.getElementById("ctrl-exit-delay-label");
  if (delayLabel) {
    delayLabel.textContent = `Pause delay (${state.exitDelay}ms)`;
  }
}

function getRoleLabel(role) {
  const labels = {
    everyone: "Everyone",
    subscriber: "Subs+",
    vip: "VIPs+",
    moderator: "Mods+",
    broadcaster: "Me only",
  };
  return labels[role] || role;
}

function handleDebouncedInput(id, key, updateFn) {
  const input = document.getElementById(id);
  if (!input) {
    return;
  }
  window.clearTimeout(inputDebounceTimer);
  inputDebounceTimer = window.setTimeout(() => {
    updateFn({ [key]: input.value.trim() });
  }, 600);
}

function handleRangeDebounce(timerRef, callback, ms) {
  window.clearTimeout(timerRef.value);
  timerRef.value = window.setTimeout(callback, ms);
}

const animBgSpeedTimer = { value: null };
const artBackdropBlurTimer = { value: null };
const transitionEnterDurTimer = { value: null };
const transitionExitDurTimer = { value: null };
const transitionExitDelayTimer = { value: null };
const twitchCmdSliderTimer = { value: null };

export function initMainSidebarEvents(updateFn, callbacks = {}) {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar || mainSidebarBound) {
    return;
  }
  mainSidebarBound = true;

  sidebar.addEventListener("click", (event) => {
    const state = getState();
    const target = event.target.closest("[data-set-key], [data-toggle-section], [data-toggle-cmd], [data-cmd-set], #btn-lastfm-disconnect, #btn-open-queue-config, #btn-open-custom-editor, #btn-layout-unique-presets");
    if (!target || !sidebar.contains(target)) {
      return;
    }

    if (target.id === "btn-lastfm-disconnect") {
      localStorage.removeItem("nowify_lastfm");
      updateFn({ lastfmUsername: "", lastfmApiKey: "" });
      return;
    }
    if (target.id === "btn-open-queue-config") {
      callbacks.onOpenQueueConfig?.();
      return;
    }
    if (target.id === "btn-open-custom-editor") {
      updateFn({ layout: "custom" });
      return;
    }
    if (target.id === "btn-layout-unique-presets") {
      callbacks.onOpenUniquePresets?.();
      return;
    }

    const sectionBtn = target.closest("[data-toggle-section]");
    if (sectionBtn) {
      const id = sectionBtn.dataset.toggleSection;
      if (!id) {
        return;
      }
      const openSections = getOpenSections();
      if (openSections.has(id)) {
        openSections.delete(id);
      } else {
        openSections.add(id);
      }
      const block = sectionBtn.closest(".cfg-section-block");
      block?.classList.toggle("cfg-section-open", openSections.has(id));
      return;
    }

    const cmdToggle = target.closest("[data-toggle-cmd]");
    if (cmdToggle) {
      const cmd = cmdToggle.dataset.toggleCmd;
      if (!cmd) {
        return;
      }
      const expandedCommands = getExpandedCommands();
      if (expandedCommands.has(cmd)) {
        expandedCommands.delete(cmd);
      } else {
        expandedCommands.add(cmd);
      }
      cmdToggle.closest(".cfg-cmd-block")?.classList.toggle("cfg-cmd-expanded", expandedCommands.has(cmd));
      return;
    }

    const cmdSet = target.closest("[data-cmd-set]");
    if (cmdSet) {
      const cmd = cmdSet.dataset.cmdSet;
      const key = cmdSet.dataset.cmdKey;
      const val = cmdSet.dataset.cmdValue;
      if (!cmd || !key || val === undefined || !state.commands[cmd]) {
        return;
      }
      state.commands[cmd][key] = val;
      savePlatformState(state, {});
      sidebar.querySelectorAll(`[data-cmd-set="${cmd}"][data-cmd-key="${key}"]`).forEach((b) => {
        b.classList.toggle("cfg-active", b.dataset.cmdValue === val);
      });
      const badge = sidebar.querySelector(`[data-cmd="${cmd}"] .cfg-cmd-role-badge`);
      if (badge) {
        badge.textContent = getRoleLabel(val);
        badge.className = `cfg-cmd-role-badge cfg-role-${val}`;
      }
      return;
    }

    const setBtn = target.closest("[data-set-key]");
    if (setBtn) {
      const key = setBtn.getAttribute("data-set-key");
      const value = setBtn.getAttribute("data-set-value");
      if (key && value !== null) {
        updateFn({ [key]: value });
      }
    }
  });

  sidebar.addEventListener("change", (event) => {
    const state = getState();
    const target = event.target;

    if (target.matches("[data-toggle-key]")) {
      const key = target.getAttribute("data-toggle-key");
      if (key) {
        updateFn({ [key]: target.checked });
      }
      return;
    }

    if (target.matches("[data-cmd-enabled]")) {
      const id = target.dataset.cmdEnabled;
      if (!id) {
        return;
      }
      const cmd = id.replace(/^cmd_/, "").replace(/_enabled$/, "");
      if (state.commands[cmd]) {
        state.commands[cmd].enabled = target.checked;
        savePlatformState(state, {});
      }
      return;
    }

    if (target.id === "ctrl-songifyPort") {
      const val = Number(target.value);
      if (Number.isInteger(val) && val >= 1024 && val <= 65535) {
        updateFn({ songifyPort: val });
      }
    }
  });

  sidebar.addEventListener("input", (event) => {
    const state = getState();
    const target = event.target;

    const inputMap = {
      "ctrl-clientId": "clientId",
      "ctrl-lastfmUsername": "lastfmUsername",
      "ctrl-lastfmApiKey": "lastfmApiKey",
      "ctrl-twitchChannel": "twitchChannel",
      "ctrl-twitchToken": "twitchToken",
    };
    for (const [id, key] of Object.entries(inputMap)) {
      if (target.id === id) {
        handleDebouncedInput(id, key, updateFn);
        return;
      }
    }

    if (target.id === "ctrl-anim-bg-speed") {
      const val = Number(target.value);
      const label = document.getElementById("ctrl-anim-bg-speed-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Speed (${val}s)`;
      }
      handleRangeDebounce(animBgSpeedTimer, () => {
        if (Number.isFinite(val)) {
          updateFn({ animBgSpeed: val });
        }
      }, 250);
      return;
    }

    if (target.id === "ctrl-art-backdrop-blur") {
      const val = Number(target.value);
      const label = document.getElementById("ctrl-art-backdrop-blur-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Backdrop blur (${val}px)`;
      }
      handleRangeDebounce(artBackdropBlurTimer, () => {
        if (Number.isFinite(val)) {
          updateFn({ artBackdropBlur: val });
        }
      }, 250);
      return;
    }

    if (target.id === "ctrl-enter-duration") {
      const val = Number(target.value);
      const label = document.getElementById("ctrl-enter-duration-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Duration (${val}ms)`;
      }
      handleRangeDebounce(transitionEnterDurTimer, () => {
        if (Number.isFinite(val)) {
          updateFn({ enterDuration: val });
        }
      }, 200);
      return;
    }

    if (target.id === "ctrl-exit-duration") {
      const val = Number(target.value);
      const label = document.getElementById("ctrl-exit-duration-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Duration (${val}ms)`;
      }
      handleRangeDebounce(transitionExitDurTimer, () => {
        if (Number.isFinite(val)) {
          updateFn({ exitDuration: val });
        }
      }, 200);
      return;
    }

    if (target.id === "ctrl-exit-delay") {
      const val = Number(target.value);
      const label = document.getElementById("ctrl-exit-delay-label");
      if (label && Number.isFinite(val)) {
        label.textContent = `Pause delay (${val}ms)`;
      }
      handleRangeDebounce(transitionExitDelayTimer, () => {
        if (Number.isFinite(val)) {
          updateFn({ exitDelay: val });
        }
      }, 200);
      return;
    }

    if (target.matches("[data-cmd-slider]")) {
      const cmd = target.dataset.cmdSlider;
      const key = target.dataset.cmdKey;
      if (!cmd || !key || !state.commands[cmd]) {
        return;
      }
      const val = Number(target.value);
      const label = document.getElementById(`val-cmd-${cmd}-${key}`);
      if (label) {
        const unit = key === "cooldown" ? "s" : "";
        let note = "";
        if (key === "cooldown" && val === 0) {
          note = ' <span class="cfg-val-note">none</span>';
        } else if (key === "sessionLimit" && val === 0) {
          note = ' <span class="cfg-val-note">unlimited</span>';
        }
        label.innerHTML = `${val}${unit}${note}`;
      }
      handleRangeDebounce(twitchCmdSliderTimer, () => {
        state.commands[cmd][key] = val;
        savePlatformState(state, {});
      }, 300);
      return;
    }

    if (target.matches("[data-cmd-role-limit]")) {
      const cmd = target.dataset.cmdRoleLimit;
      const role = target.dataset.role;
      if (!cmd || !role || !state.commands[cmd]) {
        return;
      }
      const val = Number(target.value);
      const label = document.getElementById(`val-cmd-${cmd}-${role}`);
      if (label) {
        label.innerHTML =
          val === 0 ? `0 <span class="cfg-val-note">∞</span>` : String(val);
      }
      handleRangeDebounce(twitchCmdSliderTimer, () => {
        state.commands[cmd].roleLimits[role] = val;
        savePlatformState(state, {});
      }, 300);
    }
  });
}
