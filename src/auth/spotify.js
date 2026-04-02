import {
  clearTokens,
  getAccessToken,
  getClientId,
  getRefreshToken,
  isExpired,
  saveClientId,
  saveTokens,
  startRefreshLoop,
} from "./tokens.js";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-recently-played",
];
const PKCE_VERIFIER_KEY = "nowify_pkce_verifier";
const PKCE_STATE_KEY = "nowify_pkce_state";
const APP_BASE_PATH = window.location.pathname.endsWith("/")
  ? window.location.pathname
  : window.location.pathname.slice(0, window.location.pathname.lastIndexOf("/") + 1);
const REDIRECT_URI = `${window.location.origin}${APP_BASE_PATH}overlay.html`;
const PKCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~";

export class NoTokenError extends Error {
  constructor() {
    super("No refresh token available");
    this.name = "NoTokenError";
  }
}

/** Generates a random PKCE code verifier string. */
function generateCodeVerifier() {
  const bytes = new Uint8Array(128);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => PKCE_CHARS[value % PKCE_CHARS.length]).join(
    ""
  );
}

/** Generates a SHA-256 based base64url code challenge. */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Generates a short random OAuth state string. */
function generateState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => PKCE_CHARS[value % PKCE_CHARS.length]).join(
    ""
  );
}

/** Handles Spotify OAuth callback exchange and local token persistence. */
async function handleCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    throw new Error("Spotify callback is missing authorization code.");
  }

  const savedState = sessionStorage.getItem(PKCE_STATE_KEY);
  if (!state || !savedState || state !== savedState) {
    throw new Error("Spotify callback state mismatch. Authorization was rejected.");
  }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing PKCE verifier in session storage.");
  }

  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Missing Spotify client ID. Call login(clientId) first.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Spotify token exchange failed (${response.status}): ${bodyText}`
    );
  }

  const data = await response.json();
  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
  history.replaceState({}, document.title, REDIRECT_URI);
}

/** Initializes Spotify auth by handling callback or starting refresh polling. */
export async function init() {
  const hasCode = new URL(window.location.href).searchParams.has("code");
  if (hasCode) {
    await handleCallback();
    return;
  }

  if (getAccessToken()) {
    startRefreshLoop(refreshToken);
  }
}

/** Starts the Spotify PKCE OAuth redirect flow. */
export async function login(clientId) {
  saveClientId(clientId);

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = authUrl;
      return;
    }
  } catch (_error) {
    // Cross-origin frame access can throw; fall back to current window.
  }
  window.location.href = authUrl;
}

/** Refreshes the Spotify access token using the stored refresh token. */
export async function refreshToken() {
  const existingRefreshToken = getRefreshToken();
  if (!existingRefreshToken) {
    throw new NoTokenError();
  }

  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Missing Spotify client ID. Call login(clientId) first.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: existingRefreshToken,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    clearTokens();
    throw new Error(
      `Spotify token refresh failed (${response.status}): ${bodyText}`
    );
  }

  const data = await response.json();
  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existingRefreshToken,
    expiresIn: data.expires_in,
  });
}

/** Returns a non-expired access token for API requests. */
export async function getValidToken() {
  const accessToken = getAccessToken();
  const refresh = getRefreshToken();
  if (!accessToken && !refresh) {
    throw new NoTokenError();
  }

  if (isExpired()) {
    await refreshToken();
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error("No access token available");
  }

  return token;
}
