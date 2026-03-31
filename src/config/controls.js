const DEFAULT_STATE = {
  layout: "glasscard",
  theme: "obsidian",
  clientId: "",
  showProgress: true,
  showBpm: false,
  transparent: false,
  moodSync: true,
  twitchChannel: "",
  twitchToken: "",
};

const LAYOUT_OPTIONS = {
  glasscard: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  pill: { showProgress: false, showBpm: false, transparent: true, moodSync: true },
  island: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  strip: { showProgress: false, showBpm: false, transparent: true, moodSync: false },
  albumfocus: { showProgress: false, showBpm: true, transparent: true, moodSync: true },
  sidebar: { showProgress: true, showBpm: false, transparent: true, moodSync: true },
  custom: { showProgress: true, showBpm: true, transparent: true, moodSync: true },
};

let state = { ...DEFAULT_STATE };
let inputDebounceTimer = null;
let previousLayout = "glasscard";
const CUSTOM_PRESETS_KEY = "nowify_custom_presets";
const WORKER_BASE_URL = "https://nowify-workers.nowify.workers.dev";

/** Builds the full overlay URL from the current configurator state. */
export function buildOverlayUrl(currentState) {
  const base = `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
  const params = new URLSearchParams();

  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      params.set(key, value ? "1" : "0");
      return;
    }
    params.set(key, String(value));
  });

  return `${base}?${params.toString()}`;
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname.replace("config.html", "")}overlay.html`;
}

function getLayoutHint(layout) {
  const hints = {
    glasscard: "Album art + title/artist with progress. Works anywhere.",
    pill: "Compact pill shape. Great for corners and gaming streams.",
    island: "Square widget with large art. Best for music streams.",
    strip: "Ultra-thin 40px bar. Minimal footprint for any stream.",
    albumfocus: "Art-first, centered. Best when music is the focus.",
    sidebar: "Vertical 72px column. Hugs the side of your stream.",
    custom: "Full visual editor with colour wheel and advanced controls.",
  };
  return hints[layout] || "";
}

function getLayoutFeatureBadges(layout) {
  const opts = LAYOUT_OPTIONS[layout] || {};
  const badges = [];
  if (opts.showProgress) badges.push("progress bar");
  if (opts.showBpm) badges.push("BPM display");
  if (opts.moodSync) badges.push("mood sync");
  if (opts.transparent) badges.push("transparent mode");
  if (!badges.length) return "";
  return `<div class="cfg-feature-badges">
    ${badges.map((b) => `<span class="cfg-feature-badge">${b}</span>`).join("")}
  </div>`;
}

function escCfg(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

/** Renders all sidebar controls and re-attaches listeners. */
function renderSidebar() {
  const sidebar = document.getElementById("cfg-sidebar");
  if (!sidebar) return;
  const scrollTop = sidebar.scrollTop;
  const layoutOptions = ["glasscard", "pill", "island", "strip", "albumfocus", "sidebar", "custom"];
  const themeOptions = ["obsidian", "midnight", "aurora", "forest", "amber", "glass"];

  const toggleRow = (label, key, description = "", visible = true) => {
    if (!visible) return "";
    return `
      <label class="cfg-toggle-row">
        <span class="cfg-toggle-label-wrap">
          <span class="cfg-toggle-label">${label}</span>
          ${description ? `<span class="cfg-toggle-desc">${description}</span>` : ""}
        </span>
        <span class="cfg-toggle">
          <input type="checkbox" data-toggle-key="${key}" ${state[key] ? "checked" : ""} />
          <span class="cfg-toggle-track"></span>
          <span class="cfg-toggle-thumb"></span>
        </span>
      </label>
    `;
  };

  sidebar.innerHTML = `
  <div class="cfg-intro">
    <div class="cfg-intro-step">
      <span class="cfg-step-num">1</span>
      <div>
        <div class="cfg-step-title">Create Spotify app</div>
        <div class="cfg-step-body">
          Go to <a href="https://developer.spotify.com/dashboard" target="_blank" class="cfg-link">developer.spotify.com</a>,
          create an app, add this as redirect URI:
          <div class="cfg-copy-box" id="cfg-redirect-uri">${getRedirectUri()}</div>
        </div>
      </div>
    </div>
    <div class="cfg-intro-step">
      <span class="cfg-step-num">2</span>
      <div>
        <div class="cfg-step-title">Paste your Client ID</div>
        <input id="ctrl-clientId" class="cfg-input" placeholder="e.g. fe21f433..." value="${escCfg(state.clientId)}" />
      </div>
    </div>
    <div class="cfg-intro-step">
      <span class="cfg-step-num">3</span>
      <div>
        <div class="cfg-step-title">Design, then Copy URL → OBS</div>
        <div class="cfg-step-body">Browser Source · 900 × 300 px · right-click → Interact to log in</div>
      </div>
    </div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Layout</div>
    <div class="cfg-layout-grid">
      ${layoutOptions
        .map((opt) =>
          opt === "custom"
            ? `<button class="cfg-layout-btn cfg-layout-btn-custom ${state.layout === "custom" ? "cfg-active" : ""}" data-set-key="layout" data-set-value="custom">
                <div class="cfg-layout-icon cfg-layout-icon-custom"></div><span>Custom</span>
              </button>`
            : `<button class="cfg-layout-btn ${state.layout === opt ? "cfg-active" : ""}" data-set-key="layout" data-set-value="${opt}">
                <div class="cfg-layout-icon cfg-layout-icon-${opt}"></div><span>${opt}</span>
              </button>`
        )
        .join("")}
    </div>
    <div class="cfg-layout-hint">${getLayoutHint(state.layout)}</div>
    <div class="cfg-layout-features">${getLayoutFeatureBadges(state.layout)}</div>
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Theme</div>
    <div class="cfg-theme-grid">
      ${themeOptions
        .map(
          (opt) => `<button class="cfg-theme-btn ${state.theme === opt ? "cfg-active" : ""}" data-set-key="theme" data-set-value="${opt}">
          <div class="cfg-theme-dot cfg-theme-dot-${opt}"></div><span>${opt}</span></button>`
        )
        .join("")}
    </div>
    ${state.moodSync ? `<div class="cfg-mood-warning">Mood sync is on — theme background is overridden by song energy.
      Turn off mood sync to see your selected theme colour.</div>` : ""}
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-label">Options</div>
    ${toggleRow("Progress bar", "showProgress", "Track position indicator", LAYOUT_OPTIONS[state.layout]?.showProgress ?? true)}
    ${toggleRow("Show BPM", "showBpm", "Tempo — albumfocus layout only", LAYOUT_OPTIONS[state.layout]?.showBpm ?? false)}
    ${toggleRow("Transparent background", "transparent", "Remove background — use over gameplay footage", LAYOUT_OPTIONS[state.layout]?.transparent ?? true)}
    ${toggleRow("Mood sync", "moodSync", "Overrides theme background colour with song mood", LAYOUT_OPTIONS[state.layout]?.moodSync ?? true)}
  </div>

  <div class="cfg-divider"></div>

  <div class="cfg-section">
    <div class="cfg-section-header">
      <div class="cfg-section-label">Twitch (optional)</div>
      ${
        state.twitchChannel
          ? `<button class="cfg-disconnect-btn" id="btn-twitch-disconnect">Disconnect</button>`
          : ""
      }
    </div>
    <input id="ctrl-twitchChannel" class="cfg-input cfg-input-sm" placeholder="Channel name" value="${escCfg(state.twitchChannel)}" />
    <input id="ctrl-twitchToken" class="cfg-input cfg-input-sm" type="password" placeholder="OAuth token — twitchtokengenerator.com" value="${escCfg(state.twitchToken)}" />
    <div class="cfg-hint">Enables !sr · !skip · !prev in chat</div>
  </div>
`;

  sidebar.querySelectorAll("[data-set-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-set-key");
      const value = button.getAttribute("data-set-value");
      update({ [key]: value });
    });
  });

  sidebar.querySelectorAll("[data-toggle-key]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.getAttribute("data-toggle-key");
      update({ [key]: input.checked });
    });
  });

  const disconnectBtn = document.getElementById("btn-twitch-disconnect");
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", () => {
      localStorage.removeItem("nowify_twitch");
      update({ twitchChannel: "", twitchToken: "" });
    });
  }

  const bindDebouncedInput = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", () => {
      window.clearTimeout(inputDebounceTimer);
      inputDebounceTimer = window.setTimeout(() => {
        update({ [key]: input.value.trim() });
      }, 600);
    });
  };

  bindDebouncedInput("ctrl-clientId", "clientId");
  bindDebouncedInput("ctrl-twitchChannel", "twitchChannel");
  bindDebouncedInput("ctrl-twitchToken", "twitchToken");
  sidebar.scrollTop = scrollTop;
}

function checkCustomMode() {
  const isCustom = state.layout === "custom";
  const body = document.getElementById("cfg-body");
  const normalSidebar = document.getElementById("cfg-sidebar");
  if (!body || !normalSidebar) return;
  let customContainer = document.getElementById("cfg-custom-editor");

  if (isCustom) {
    normalSidebar.style.display = "none";
    if (!customContainer) {
      customContainer = document.createElement("div");
      customContainer.id = "cfg-custom-editor";
      body.insertBefore(customContainer, body.firstChild);
    }
    customContainer.style.display = "flex";
    customContainer.style.flex = "0 0 320px";
    customContainer.style.width = "320px";
    import("./custom-editor.js").then(({ initCustomEditor }) => {
      initCustomEditor(customContainer, previousLayout, (customState) => {
        updateCustomPreview(customState);
      });
    });
    ensureCustomHeaderButtons(true);
  } else {
    normalSidebar.style.display = "";
    if (customContainer) {
      customContainer.style.display = "none";
      customContainer.style.flex = "";
      customContainer.style.width = "";
    }
    previousLayout = state.layout;
    ensureCustomHeaderButtons(false);
  }
}

function getCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveCustomPresetWithPrompt() {
  import("./custom-editor.js").then(({ loadCustomState }) => {
    const presetName = window.prompt("Name your custom preset:");
    if (!presetName || !presetName.trim()) return;
    const customState = loadCustomState();
    if (!customState) return;
    const name = presetName.trim();
    const current = getCustomPresets();
    const filtered = current.filter((item) => item?.name !== name);
    filtered.push({
      name,
      customState,
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(filtered));
  });
}

async function publishCustomPresetWithPrompt() {
  const presetName = window.prompt("Name for public preset:");
  if (!presetName || !presetName.trim()) return;
  const authorName = window.prompt("Author name (optional):") || "anonymous";
  const name = presetName.trim();

  const { loadCustomState } = await import("./custom-editor.js");
  const customState = loadCustomState();
  if (!customState) return;

  const res = await fetch(`${WORKER_BASE_URL}/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      author: authorName.trim() || "anonymous",
      customState,
    }),
  });

  if (!res.ok) {
    console.warn("Nowify: Failed to publish custom preset", res.status);
    return;
  }
}

function ensureCustomHeaderButtons(isCustom) {
  const actions = document.querySelector(".cfg-header-actions");
  if (!actions) return;
  let exitBtn = document.getElementById("btn-exit-custom");
  let saveBtn = document.getElementById("btn-save-custom-preset");
  let publishBtn = document.getElementById("btn-publish-custom-preset");

  if (isCustom) {
    if (!saveBtn) {
      saveBtn = document.createElement("button");
      saveBtn.id = "btn-save-custom-preset";
      saveBtn.className = "cfg-btn";
      saveBtn.textContent = "Save custom preset";
      saveBtn.addEventListener("click", () => {
        saveCustomPresetWithPrompt();
      });
      actions.prepend(saveBtn);
    }
    if (!publishBtn) {
      publishBtn = document.createElement("button");
      publishBtn.id = "btn-publish-custom-preset";
      publishBtn.className = "cfg-btn";
      publishBtn.textContent = "Publish preset";
      publishBtn.addEventListener("click", () => {
        publishCustomPresetWithPrompt();
      });
      actions.prepend(publishBtn);
    }
    if (!exitBtn) {
      exitBtn = document.createElement("button");
      exitBtn.id = "btn-exit-custom";
      exitBtn.className = "cfg-btn";
      exitBtn.textContent = "Exit custom";
      exitBtn.addEventListener("click", () => {
        update({ layout: previousLayout || "glasscard" });
      });
      actions.prepend(exitBtn);
    }
  } else {
    if (saveBtn) saveBtn.remove();
    if (publishBtn) publishBtn.remove();
    if (exitBtn) exitBtn.remove();
  }
}

function updateCustomPreview(customState) {
  import("./custom-editor.js").then(({ buildCustomUrl }) => {
    const url = buildCustomUrl(state, customState);
    const iframe = document.getElementById("cfg-iframe");
    const urlDisplay = document.getElementById("cfg-url-display");
    if (iframe) iframe.src = url;
    if (urlDisplay) urlDisplay.textContent = url;
  });
}

/** Merges state updates and refreshes preview URL and sidebar UI. */
function update(newState) {
  Object.assign(state, newState);
  if (newState.layout) {
    const relevant = LAYOUT_OPTIONS[newState.layout] || {};
    if (!relevant.showProgress) state.showProgress = false;
    if (!relevant.showBpm) state.showBpm = false;
    if (!relevant.moodSync) state.moodSync = false;
  }
  if (newState.twitchChannel !== undefined || newState.twitchToken !== undefined) {
    localStorage.setItem(
      "nowify_twitch",
      JSON.stringify({
        channel: state.twitchChannel,
        token: state.twitchToken,
      })
    );
  }
  const url = buildOverlayUrl(state);
  const iframe = document.getElementById("cfg-iframe");
  const urlDisplay = document.getElementById("cfg-url-display");
  if (iframe) iframe.src = url;
  if (urlDisplay) urlDisplay.textContent = url;
  renderSidebar();
  checkCustomMode();
}

/** Initializes configurator controls, preview syncing, and header actions. */
export function initConfig() {
  const savedTwitch = localStorage.getItem("nowify_twitch");
  if (savedTwitch) {
    try {
      const parsed = JSON.parse(savedTwitch);
      state.twitchChannel = parsed.channel || "";
      state.twitchToken = parsed.token || "";
    } catch (_error) {}
  }

  renderSidebar();
  checkCustomMode();
  update({});

  const copyButton = document.getElementById("btn-copy");
  const openButton = document.getElementById("btn-open");
  const resetButton = document.getElementById("btn-reset");

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const activeUrl =
        document.getElementById("cfg-url-display")?.textContent || buildOverlayUrl(state);
      await navigator.clipboard.writeText(activeUrl);
      const previousText = copyButton.textContent;
      copyButton.textContent = "Copied!";
      window.setTimeout(() => {
        copyButton.textContent = previousText;
      }, 1000);
    });
  }

  if (openButton) {
    openButton.addEventListener("click", () => {
      const activeUrl =
        document.getElementById("cfg-url-display")?.textContent || buildOverlayUrl(state);
      window.open(activeUrl, "_blank");
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      state = { ...DEFAULT_STATE };
      update({});
    });
  }
}
