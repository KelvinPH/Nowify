let wizardStep = 1; // 1=source, 2=setup, 3=done
let chosenSource = null; // 'spotify' | 'lastfm'
let wizardOnComplete = null;

const SETUP_COMPLETE_KEY = "nowify_setup_complete";

function isSetupOverlayOpen() {
  return Boolean(document.getElementById("cfg-wizard"));
}

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

function renderShell() {
  const root = getWizardOverlayRoot();
  root.innerHTML = `
    <div class="wiz-panel">
      <div class="wiz-header">
        <div class="wiz-logo">Nowify</div>
        <div class="wiz-step-indicator">
          <span class="wiz-step ${wizardStep >= 1 ? "wiz-step-active" : ""}">1</span>
          <span class="wiz-step-line"></span>
          <span class="wiz-step ${wizardStep >= 2 ? "wiz-step-active" : ""}">2</span>
          <span class="wiz-step-line"></span>
          <span class="wiz-step ${wizardStep >= 3 ? "wiz-step-active" : ""}">3</span>
        </div>
      </div>
      <div class="wiz-body" id="wiz-body"></div>
    </div>
  `;
}

function renderStep1() {
  const body = document.getElementById("wiz-body");
  if (!body) return;

  body.innerHTML = `
    <div class="wiz-step-content">
      <h1 class="wiz-title">Welcome to Nowify</h1>
      <p class="wiz-subtitle">
        The music overlay for your stream. Let's get you set up.
        First, which music service do you use?
      </p>

      <div class="wiz-source-grid">
        <button class="wiz-source-card" data-source="spotify" type="button">
          <div class="wiz-source-icon wiz-source-spotify">S</div>
          <div class="wiz-source-name">Spotify</div>
          <div class="wiz-source-desc">
            Best experience. Real-time BPM, mood sync, beat animations.
            Requires Spotify Premium to create a Developer app.
          </div>
          <div class="wiz-source-tags">
            <span class="wiz-tag wiz-tag-green">Full features</span>
            <span class="wiz-tag">Premium required for setup</span>
          </div>
        </button>

        <button class="wiz-source-card" data-source="lastfm" type="button">
          <div class="wiz-source-icon wiz-source-lastfm">lfm</div>
          <div class="wiz-source-name">Last.fm</div>
          <div class="wiz-source-desc">
            Works with free Spotify, Tidal, Apple Music, YouTube Music
            and any service that scrobbles. No Premium needed.
          </div>
          <div class="wiz-source-tags">
            <span class="wiz-tag wiz-tag-green">Free Spotify works</span>
            <span class="wiz-tag wiz-tag-green">Tidal + Apple Music</span>
            <span class="wiz-tag">No BPM or mood sync</span>
          </div>
        </button>
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
      <div class="wiz-step-content">
        <h1 class="wiz-title">Set up Spotify</h1>
        <p class="wiz-subtitle">
          You need a free Spotify Developer account to get a Client ID.
          This takes about 2 minutes.
        </p>

        <div class="wiz-steps-list">

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">1</span>
            <div>
              <div class="wiz-instruction-title">Create a Spotify Developer account</div>
              <div class="wiz-instruction-body">
                Go to
                <a href="https://developer.spotify.com/dashboard" target="_blank" class="wiz-link">
                  developer.spotify.com/dashboard
                </a>
                and log in with your Spotify account.
                Click <strong>Create app</strong>.
              </div>
            </div>
          </div>

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">2</span>
            <div>
              <div class="wiz-instruction-title">Configure your app</div>
              <div class="wiz-instruction-body">
                Name it anything. Under "Which API/SDKs are you planning to use?"
                select <strong>Web API</strong> only. Save.
              </div>
            </div>
          </div>

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">3</span>
            <div>
              <div class="wiz-instruction-title">Add redirect URI</div>
              <div class="wiz-instruction-body">
                In your app settings, find <strong>Redirect URIs</strong>
                and add exactly:
                <div class="wiz-code-block" id="wiz-redirect-uri">${redirectUri}</div>
                Click <strong>Add</strong> then <strong>Save</strong>.
              </div>
            </div>
          </div>

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">4</span>
            <div>
              <div class="wiz-instruction-title">Copy your Client ID</div>
              <div class="wiz-instruction-body">
                Back on your app's dashboard, copy the <strong>Client ID</strong>
                and paste it here:
              </div>
              <input type="text"
                     id="wiz-client-id"
                     class="wiz-input"
                     placeholder="e.g. fe21f43388ce430082cb8f563bde3a9a" />
            </div>
          </div>

        </div>

        <div class="wiz-notice">
          <strong>Note:</strong> Spotify requires a Premium account to
          create Developer apps as of early 2026. If you have a free account,
          go back and use Last.fm instead.
        </div>

        <div class="wiz-actions">
          <button class="wiz-btn wiz-btn-ghost" id="wiz-back" type="button">Back</button>
          <button class="wiz-btn wiz-btn-primary" id="wiz-spotify-done" type="button">
            Continue
          </button>
        </div>
      </div>
    `;

    const backBtn = document.getElementById("wiz-back");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        wizardStep = 1;
        renderWizard();
      });
    }

    const continueBtn = document.getElementById("wiz-spotify-done");
    if (continueBtn) {
      continueBtn.addEventListener("click", function () {
        const input = document.getElementById("wiz-client-id");
        const clientId = (input?.value || "").trim();
        if (!clientId) return;

        localStorage.setItem("nowify_client_id", clientId);
        wizardStep = 3;
        renderWizard();
      });
    }
  } else {
    body.innerHTML = `
      <div class="wiz-step-content">
        <h1 class="wiz-title">Set up Last.fm</h1>
        <p class="wiz-subtitle">
          Last.fm tracks what you play on Spotify, Tidal, Apple Music,
          YouTube Music and more. Here is how to get it working.
        </p>

        <div class="wiz-steps-list">

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">1</span>
            <div>
              <div class="wiz-instruction-title">Create a free Last.fm account</div>
              <div class="wiz-instruction-body">
                Go to
                <a href="https://www.last.fm/join" target="_blank" class="wiz-link">
                  last.fm/join
                </a>
                and sign up. It is completely free.
              </div>
            </div>
          </div>

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">2</span>
            <div>
              <div class="wiz-instruction-title">Connect your music service to Last.fm</div>
              <div class="wiz-instruction-body">
                Go to
                <a href="https://www.last.fm/settings/applications" target="_blank" class="wiz-link">
                  last.fm/settings/applications
                </a>
                and click <strong>Connect</strong> next to your service:
                <ul class="wiz-service-list">
                  <li>
                    <strong>Spotify (free or premium)</strong> —
                    click Connect next to "Spotify Scrobbling".
                    No app download needed.
                  </li>
                  <li>
                    <strong>Tidal</strong> —
                    click Connect next to "TIDAL Scrobbling".
                    Works with desktop, mobile and web player.
                  </li>
                  <li>
                    <strong>Apple Music</strong> —
                    use the
                    <a href="https://apps.apple.com/app/scrobbles-for-last-fm/id1155480234" target="_blank" class="wiz-link">
                      Scrobbles for Last.fm
                    </a>
                    app on iPhone or
                    <a href="https://www.last.fm/about/trackmymusic" target="_blank" class="wiz-link">
                      Last.fm Scrobbler desktop app
                    </a>
                    on Mac.
                  </li>
                  <li>
                    <strong>YouTube Music</strong> —
                    install the free
                    <a href="https://chrome.google.com/webstore/detail/web-scrobbler/hhinaapppaileiechjoiifaancjggfjm" target="_blank" class="wiz-link">
                      Web Scrobbler browser extension
                    </a>
                    (Chrome/Firefox). It auto-detects YouTube Music.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">3</span>
            <div>
              <div class="wiz-instruction-title">Get a Last.fm API key</div>
              <div class="wiz-instruction-body">
                Go to
                <a href="https://www.last.fm/api/account/create" target="_blank" class="wiz-link">
                  last.fm/api/account/create
                </a>.
                Fill in any app name (e.g. "Nowify"), leave other fields blank.
                Copy the <strong>API key</strong> shown after creating.
              </div>
              <input type="text"
                     id="wiz-lastfm-apikey"
                     class="wiz-input"
                     placeholder="Paste your Last.fm API key" />
            </div>
          </div>

          <div class="wiz-instruction-step">
            <span class="wiz-instruction-num">4</span>
            <div>
              <div class="wiz-instruction-title">Enter your Last.fm username</div>
              <div class="wiz-instruction-body">
                This is the username shown on your Last.fm profile.
              </div>
              <input type="text"
                     id="wiz-lastfm-username"
                     class="wiz-input"
                     placeholder="Your Last.fm username" />
            </div>
          </div>

        </div>

        <div class="wiz-notice wiz-notice-info">
          <strong>What works with Last.fm:</strong>
          now playing track, artist, album art, track title.
          <br>
          <strong>What does not work:</strong>
          BPM display, beat-sync animations, mood sync.
          These features require the Spotify API.
        </div>

        <div class="wiz-actions">
          <button class="wiz-btn wiz-btn-ghost" id="wiz-back" type="button">Back</button>
          <button class="wiz-btn wiz-btn-primary" id="wiz-lastfm-done" type="button">
            Continue
          </button>
        </div>
      </div>
    `;

    const backBtn = document.getElementById("wiz-back");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        wizardStep = 1;
        renderWizard();
      });
    }

    const continueBtn = document.getElementById("wiz-lastfm-done");
    if (continueBtn) {
      continueBtn.addEventListener("click", function () {
        const usernameInput = document.getElementById("wiz-lastfm-username");
        const apiKeyInput = document.getElementById("wiz-lastfm-apikey");
        const apiKey = (apiKeyInput?.value || "").trim();
        const username = (usernameInput?.value || "").trim();
        if (!username || !apiKey) return;

        localStorage.setItem(
          "nowify_lastfm",
          JSON.stringify({
            username,
            apiKey,
          })
        );

        wizardStep = 3;
        renderWizard();
      });
    }
  }
}

function renderStep3() {
  const body = document.getElementById("wiz-body");
  if (!body) return;

  const subtitle =
    chosenSource === "spotify"
      ? "Design your overlay in the Configurator, then copy the URL into OBS as a Browser Source."
      : "Design your overlay in the Configurator. Start playing music on your connected service and it will appear in the overlay.";

  body.innerHTML = `
    <div class="wiz-step-content wiz-done">
      <div class="wiz-done-icon">✓</div>
      <h1 class="wiz-title">You are ready</h1>
      <p class="wiz-subtitle">${subtitle}</p>
      <div class="wiz-actions">
        <button class="wiz-btn wiz-btn-primary" id="wiz-finish" type="button">
          Open Configurator
        </button>
      </div>
    </div>
  `;

  const finishBtn = document.getElementById("wiz-finish");
  if (finishBtn) {
    finishBtn.addEventListener("click", function () {
      markSetupComplete();
      removeWizardOverlay();
      if (typeof wizardOnComplete === "function") {
        localStorage.setItem("nowify_source", chosenSource);
        wizardOnComplete(chosenSource);
      }
    });
  }
}

function renderWizard() {
  renderShell();
  if (wizardStep === 1) renderStep1();
  if (wizardStep === 2) renderStep2();
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

