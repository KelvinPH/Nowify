let wizardStep = 1;
let chosenSource = null;
let wizardOnComplete = null;

const SETUP_COMPLETE_KEY = "nowify_setup_complete";

function removeWizardOverlay() {
  const el = document.getElementById("cfg-wizard");
  if (el) el.remove();
}

function getRedirectUri() {
  return (
    window.location.origin +
    window.location.pathname.replace("config.html", "") +
    "overlay.html"
  );
}

function markSetupComplete() {
  localStorage.setItem(SETUP_COMPLETE_KEY, "1");
}

function isSetupComplete() {
  return localStorage.getItem(SETUP_COMPLETE_KEY) === "1";
}

function getWizardOverlayRoot() {
  let root = document.getElementById("cfg-wizard");
  if (root) return root;

  root = document.createElement("div");
  root.id = "cfg-wizard";
  document.body.appendChild(root);
  return root;
}

function wizardStepDisplay() {
  if (wizardStep === 25) return 2;
  if (wizardStep === 3) return 3;
  return wizardStep;
}

function escAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function renderShell() {
  const root = getWizardOverlayRoot();
  const stepLabel = wizardStepDisplay();
  root.innerHTML = `
    <div class="wiz-container">
      <div class="wiz-top">
        <div class="wiz-wordmark">
          <img src="assets/logo/logo.png" alt="Nowify" class="wiz-wordmark-img" />
        </div>
        <div class="wiz-step-text">Step ${stepLabel} of 3</div>
      </div>
      <div class="wiz-body" id="wiz-body"></div>
    </div>
  `;
}

function renderStep1() {
  const body = document.getElementById("wiz-body");
  if (!body) return;

  body.innerHTML = `
    <div class="wiz-step-inner">
      <div class="wiz-tagline">Your stream, your music, your style.</div>
      <div class="wiz-sources">
        <div class="wiz-source-featured-wrap">
          <button type="button" class="wiz-source-featured wiz-source-featured--songify" data-source="songify">
            <div class="wiz-source-featured-left">
              <div class="wiz-source-icon wiz-source-icon--featured">
                <img src="assets/icons/songify.png" alt="" class="wiz-source-logo" />
              </div>
              <div class="wiz-source-featured-copy">
                <div class="wiz-source-name wiz-source-name--featured">Songify</div>
                <div class="wiz-source-desc wiz-source-desc--featured">
                  Connect via Songify's local WebSocket.
                  No API key. Works with Spotify, YouTube Music,
                  Tidal and more.
                </div>
              </div>
            </div>
            <div class="wiz-source-tags wiz-source-tags--featured">
              <span class="wiz-tag wiz-tag-green">No API key</span>
              <span class="wiz-tag">Windows only</span>
            </div>
          </button>
          <div class="wiz-source-featured-links" aria-label="Songify links">
            <span class="wiz-source-featured-links-label">find Songify</span>
            <div class="wiz-source-featured-links-icons">
              <a
                href="https://songify.rocks/"
                target="_blank"
                rel="noopener noreferrer"
                class="wiz-featured-external-link"
                title="songify.rocks"
                aria-label="Songify website"
              >
                <i class="fa-solid fa-globe" aria-hidden="true"></i>
              </a>
              <a
                href="https://discord.com/invite/H8nd4T4"
                target="_blank"
                rel="noopener noreferrer"
                class="wiz-featured-external-link"
                title="Discord"
                aria-label="Songify Discord"
              >
                <i class="fa-brands fa-discord" aria-hidden="true"></i>
              </a>
              <a
                href="https://github.com/songify-rocks/Songify"
                target="_blank"
                rel="noopener noreferrer"
                class="wiz-featured-external-link"
                title="GitHub"
                aria-label="Songify on GitHub"
              >
                <i class="fa-brands fa-github" aria-hidden="true"></i>
              </a>
            </div>
          </div>
        </div>
        <div class="wiz-source-row">
          <button type="button" class="wiz-source-small" data-source="spotify">
            <div class="wiz-source-icon">
              <img src="assets/icons/spotify.png" alt="" class="wiz-source-logo" />
            </div>
            <div class="wiz-source-small-main">
              <div class="wiz-source-name">Spotify</div>
              <div class="wiz-source-desc">Direct API. Full BPM and mood sync.</div>
            </div>
            <div class="wiz-source-tags">
              <span class="wiz-tag">Premium required</span>
            </div>
          </button>
          <button type="button" class="wiz-source-small" data-source="lastfm">
            <div class="wiz-source-icon">
              <img src="assets/icons/lastfm.png" alt="" class="wiz-source-logo" />
            </div>
            <div class="wiz-source-small-main">
              <div class="wiz-source-name">Last.fm</div>
              <div class="wiz-source-desc">Scrobble-based. Works with any service.</div>
            </div>
            <div class="wiz-source-tags">
              <span class="wiz-tag wiz-tag-green">Free</span>
            </div>
          </button>
        </div>
      </div>
      <p class="wiz-footnote">You can switch sources at any time in the Configurator.</p>
    </div>
  `;

  body.querySelectorAll("[data-source]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      chosenSource = btn.getAttribute("data-source");
      wizardStep = 2;
      renderWizard();
    });
  });
}

function renderStep2() {
  const body = document.getElementById("wiz-body");
  if (!body) return;

  const redirectUri = getRedirectUri();

  if (chosenSource === "spotify") {
    body.innerHTML = `
      <div class="wiz-step-inner">
        <h1 class="wiz-title">Set up Spotify</h1>
        <div class="wiz-steps-list">
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">1</span>
            <div>
              <div class="wiz-instruction-title">Create a Developer app</div>
              <div class="wiz-instruction-body">
                <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" class="wiz-link">developer.spotify.com/dashboard</a>
                Create app, select Web API only.
              </div>
            </div>
          </div>
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">2</span>
            <div>
              <div class="wiz-instruction-title">Add redirect URI</div>
              <div class="wiz-instruction-body">
                In app settings, add exactly:
                <div class="wiz-code-block" id="wiz-redirect-uri">${redirectUri}</div>
                Click Add then Save.
              </div>
            </div>
          </div>
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">3</span>
            <div>
              <div class="wiz-instruction-title">Paste your Client ID</div>
              <div class="wiz-instruction-body">
                <input type="text" id="wiz-client-id" class="wiz-input" placeholder="e.g. fe21f43388ce430082cb8f563bde3a9a" />
              </div>
            </div>
          </div>
        </div>
        <div class="wiz-notice">
          Requires Spotify Premium to create a Developer app.
          Free account? Go back and use Songify or Last.fm.
        </div>
        <div class="wiz-actions">
          <button type="button" class="wiz-btn wiz-btn-ghost" id="wiz-back">Back</button>
          <button type="button" class="wiz-btn wiz-btn-primary" id="wiz-spotify-done">Continue</button>
        </div>
      </div>
    `;

    document.getElementById("wiz-back")?.addEventListener("click", function () {
      wizardStep = 1;
      renderWizard();
    });
    document.getElementById("wiz-spotify-done")?.addEventListener("click", function () {
      const input = document.getElementById("wiz-client-id");
      const clientId = (input?.value || "").trim();
      if (!clientId) return;
      localStorage.setItem("nowify_client_id", clientId);
      wizardStep = 25;
      renderWizard();
    });
    return;
  }

  if (chosenSource === "lastfm") {
    body.innerHTML = `
      <div class="wiz-step-inner">
        <h1 class="wiz-title">Set up Last.fm</h1>
        <div class="wiz-steps-list">
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">1</span>
            <div>
              <div class="wiz-instruction-title">Create a Last.fm account</div>
              <div class="wiz-instruction-body">
                <a href="https://www.last.fm/join" target="_blank" rel="noopener noreferrer" class="wiz-link">last.fm/join</a>
              </div>
            </div>
          </div>
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">2</span>
            <div>
              <div class="wiz-instruction-title">Connect your music service</div>
              <div class="wiz-instruction-body">
                <a href="https://www.last.fm/settings/applications" target="_blank" rel="noopener noreferrer" class="wiz-link">last.fm/settings/applications</a>
                Click Connect next to your service.
                <div class="wiz-service-list">
                  <span>Spotify, Tidal, Apple Music and YouTube Music all work via scrobbling.</span>
                </div>
              </div>
            </div>
          </div>
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">3</span>
            <div>
              <div class="wiz-instruction-title">Get an API key</div>
              <div class="wiz-instruction-body">
                <a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener noreferrer" class="wiz-link">last.fm/api/account/create</a>
                Any app name. Copy the API key shown.
                <input type="text" id="wiz-lastfm-apikey" class="wiz-input" placeholder="Last.fm API key" />
              </div>
            </div>
          </div>
          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">4</span>
            <div>
              <div class="wiz-instruction-title">Enter your username</div>
              <div class="wiz-instruction-body">
                <input type="text" id="wiz-lastfm-username" class="wiz-input" placeholder="Last.fm username" />
              </div>
            </div>
          </div>
        </div>
        <div class="wiz-notice wiz-notice-info">
          BPM display and mood sync are not available with Last.fm.
        </div>
        <div class="wiz-actions">
          <button type="button" class="wiz-btn wiz-btn-ghost" id="wiz-back">Back</button>
          <button type="button" class="wiz-btn wiz-btn-primary" id="wiz-lastfm-done">Continue</button>
        </div>
      </div>
    `;

    document.getElementById("wiz-back")?.addEventListener("click", function () {
      wizardStep = 1;
      renderWizard();
    });
    document.getElementById("wiz-lastfm-done")?.addEventListener("click", function () {
      const usernameInput = document.getElementById("wiz-lastfm-username");
      const apiKeyInput = document.getElementById("wiz-lastfm-apikey");
      const apiKey = (apiKeyInput?.value || "").trim();
      const username = (usernameInput?.value || "").trim();
      if (!username || !apiKey) return;
      localStorage.setItem("nowify_lastfm", JSON.stringify({ username, apiKey }));
      wizardStep = 25;
      renderWizard();
    });
    return;
  }

  body.innerHTML = `
    <div class="wiz-step-inner">
      <h1 class="wiz-title">Set up Songify</h1>
      <div class="wiz-steps-list">
        <div class="wiz-instruction-step">
          <span class="wiz-instruction-num">1</span>
          <div>
            <div class="wiz-instruction-title">Download Songify</div>
            <div class="wiz-instruction-body">
              <a href="https://github.com/songify-rocks/Songify/releases" target="_blank" rel="noopener noreferrer" class="wiz-link">github.com/songify-rocks/Songify/releases</a>
              Download Songify.zip, extract, run Songify.exe.
            </div>
          </div>
        </div>
        <div class="wiz-instruction-step">
          <span class="wiz-instruction-num">2</span>
          <div>
            <div class="wiz-instruction-title">Enable the web server</div>
            <div class="wiz-instruction-body">
              File &gt; Settings &gt; Web Server. Enable it. Note your port (default: 4002).
            </div>
          </div>
        </div>
        <div class="wiz-instruction-step">
          <span class="wiz-instruction-num">3</span>
          <div>
            <div class="wiz-instruction-title">Enter your port</div>
            <div class="wiz-instruction-body">
              <input type="number" id="wiz-songify-port" class="wiz-input" value="4002" min="1024" max="65535" />
              <div id="wiz-songify-error" class="wiz-input-error"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="wiz-notice wiz-notice-info">
        Nowify reads from Songify's WebSocket.
        BPM display and mood sync are not available with this source.
      </div>
      <div class="wiz-actions">
        <button type="button" class="wiz-btn wiz-btn-ghost" id="wiz-back">Back</button>
        <button type="button" class="wiz-btn wiz-btn-primary" id="wiz-songify-done">Continue</button>
      </div>
    </div>
  `;

  document.getElementById("wiz-back")?.addEventListener("click", function () {
    wizardStep = 1;
    renderWizard();
  });
  document.getElementById("wiz-songify-done")?.addEventListener("click", function () {
    const input = document.getElementById("wiz-songify-port");
    const errorEl = document.getElementById("wiz-songify-error");
    const parsedPort = Number((input?.value || "").trim());
    if (!Number.isInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
      if (errorEl) errorEl.textContent = "Port must be 1024–65535.";
      return;
    }
    if (errorEl) errorEl.textContent = "";
    localStorage.setItem("nowify_songify", JSON.stringify({ port: parsedPort }));
    wizardStep = 3;
    renderWizard();
  });
}

function renderStepTwitch() {
  const body = document.getElementById("wiz-body");
  if (!body) return;

  const savedTwitch = localStorage.getItem("nowify_twitch");
  let seedChannel = "";
  let seedToken = "";
  if (savedTwitch) {
    try {
      const parsed = JSON.parse(savedTwitch);
      seedChannel = parsed.channel || "";
      seedToken = parsed.token || "";
    } catch (_error) {}
  }

  body.innerHTML = `
    <div class="wiz-step-inner">
      <h1 class="wiz-title">Twitch chat commands</h1>
      <div class="wiz-steps-list">
        <div class="wiz-instruction-step">
          <span class="wiz-instruction-num">1</span>
          <div>
            <div class="wiz-instruction-title">Channel name</div>
            <div class="wiz-instruction-body">
              <input type="text" id="wiz-twitch-channel" class="wiz-input" placeholder="your_twitch_channel" value="${escAttr(seedChannel)}" />
            </div>
          </div>
        </div>
        <div class="wiz-instruction-step">
          <span class="wiz-instruction-num">2</span>
          <div>
            <div class="wiz-instruction-title">Get a token</div>
            <div class="wiz-instruction-body">
              <a href="https://twitchapps.com/tmi/" target="_blank" rel="noopener noreferrer" class="wiz-link">twitchapps.com/tmi/</a>
              Log in, copy the token (starts with oauth:).
              <input type="password" id="wiz-twitch-token" class="wiz-input" placeholder="oauth:your_token_here" value="${escAttr(seedToken)}" />
              <div id="wiz-twitch-inline" class="wiz-input-error"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="wiz-commands-grid">
        <div class="wiz-command-item"><code>!sr</code><span>Request a song</span></div>
        <div class="wiz-command-item"><code>!skip</code><span>Skip track</span></div>
        <div class="wiz-command-item"><code>!prev</code><span>Previous track</span></div>
        <div class="wiz-command-item"><code>!queue</code><span>Show queue</span></div>
      </div>
      <div class="wiz-notice">
        !sr requires Spotify Premium.
        !skip and !prev work with Songify too.
      </div>
      <div class="wiz-actions">
        <button type="button" class="wiz-btn wiz-btn-ghost" id="wiz-twitch-skip">Skip for now</button>
        <button type="button" class="wiz-btn wiz-btn-primary" id="wiz-twitch-done">Save and continue</button>
      </div>
    </div>
  `;

  document.getElementById("wiz-twitch-skip")?.addEventListener("click", function () {
    localStorage.removeItem("nowify_twitch");
    wizardStep = 3;
    renderWizard();
  });

  document.getElementById("wiz-twitch-done")?.addEventListener("click", function () {
    const channelInput = document.getElementById("wiz-twitch-channel");
    const tokenInput = document.getElementById("wiz-twitch-token");
    const inlineEl = document.getElementById("wiz-twitch-inline");
    const channel = (channelInput?.value || "").trim();
    const token = (tokenInput?.value || "").trim();

    if (token && !channel) {
      if (inlineEl) inlineEl.textContent = "Enter your channel name.";
      return;
    }

    if (channel || token) {
      localStorage.setItem("nowify_twitch", JSON.stringify({ channel, token }));
      if (!token && inlineEl) inlineEl.textContent = "Token required for chat commands.";
    } else {
      localStorage.removeItem("nowify_twitch");
      if (inlineEl) inlineEl.textContent = "";
    }

    wizardStep = 3;
    window.setTimeout(function () {
      renderWizard();
    }, !token && channel ? 600 : 0);
  });
}

function renderStep3() {
  const body = document.getElementById("wiz-body");
  if (!body) return;

  const sub =
    chosenSource === "songify"
      ? "Start playing music in Songify and open the Configurator to design your overlay."
      : "Open the Configurator to design your overlay.";

  body.innerHTML = `
    <div class="wiz-done">
      <div class="wiz-done-check">✓</div>
      <div class="wiz-done-title">You are ready.</div>
      <div class="wiz-done-sub">${sub}</div>
      <button type="button" class="wiz-btn wiz-btn-primary" id="wiz-finish">Open Configurator</button>
    </div>
  `;

  document.getElementById("wiz-finish")?.addEventListener("click", function () {
    markSetupComplete();
    removeWizardOverlay();
    if (typeof wizardOnComplete === "function") {
      localStorage.setItem("nowify_source", chosenSource);
      wizardOnComplete(chosenSource);
    }
  });
}

function renderWizard() {
  renderShell();
  if (wizardStep === 1) renderStep1();
  if (wizardStep === 2) renderStep2();
  if (wizardStep === 25) renderStepTwitch();
  if (wizardStep === 3) renderStep3();
}

function initWizard(onComplete) {
  wizardOnComplete = onComplete;
  wizardStep = 1;
  chosenSource = null;
  renderWizard();
}

function showWizard(onComplete) {
  wizardOnComplete = onComplete;
  wizardStep = 1;
  chosenSource = null;
  renderWizard();
}

export { initWizard, showWizard, isSetupComplete, markSetupComplete };
