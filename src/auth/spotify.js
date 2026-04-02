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
const PKCE_VERIFIER_KEY = "nowify_code_verifier";
const PKCE_STATE_KEY = "nowify_auth_state";
const REDIRECT_URI_KEY = "nowify_redirect_uri";

export class NoTokenError extends Error {
  constructor() {
    super("No refresh token available");
    this.name = "NoTokenError";
  }
}

function base64UrlEncode(array) {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join("");
}

function cleanUrl() {
  window.history.replaceState({}, "", window.location.pathname);
}

export async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    console.warn("[Spotify] Auth denied:", error);
    cleanUrl();
    return false;
  }

  if (!code) return false;

  const storedState = localStorage.getItem(PKCE_STATE_KEY);
  if (state !== storedState) {
    console.warn("[Spotify] State mismatch - possible CSRF");
    cleanUrl();
    return false;
  }

  const codeVerifier = localStorage.getItem(PKCE_VERIFIER_KEY);
  const clientId = localStorage.getItem("nowify_client_id");
  const redirectUri = localStorage.getItem(REDIRECT_URI_KEY);

  if (!codeVerifier) {
    console.warn("[Spotify] Missing code verifier");
    cleanUrl();
    return false;
  }
  if (!clientId) {
    console.warn("[Spotify] Missing client ID");
    cleanUrl();
    return false;
  }
  if (!redirectUri) {
    console.warn("[Spotify] Missing redirect URI");
    cleanUrl();
    return false;
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn(
        "[Spotify] Token exchange failed:",
        data?.error,
        data?.error_description
      );
      cleanUrl();
      return false;
    }

    localStorage.setItem("nowify_access_token", data.access_token);
    localStorage.setItem("nowify_refresh_token", data.refresh_token);
    localStorage.setItem(
      "nowify_token_expiry",
      String(Date.now() + data.expires_in * 1000)
    );

    localStorage.removeItem(PKCE_VERIFIER_KEY);
    localStorage.removeItem(PKCE_STATE_KEY);
    localStorage.removeItem(REDIRECT_URI_KEY);

    const cleanParams = new URLSearchParams({ clientId });
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${cleanParams.toString()}`
    );

    console.warn("[Spotify] Auth successful");
    return true;
  } catch (err) {
    console.warn("[Spotify] Token exchange error:", err);
    cleanUrl();
    return false;
  }
}

/** Initializes Spotify auth by handling callback or starting refresh polling. */
export async function init() {
  const handled = await handleAuthCallback();
  if (handled) return;
  if (getAccessToken()) startRefreshLoop(refreshToken);
}

/** Starts the Spotify PKCE OAuth redirect flow. */
export async function initiateAuth(clientId) {
  if (!clientId) {
    console.warn("[Spotify] initiateAuth: no clientId");
    return;
  }

  localStorage.setItem("nowify_client_id", clientId);
  saveClientId(clientId);

  const codeVerifier = generateCodeVerifier();
  localStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  const challenge = await generateCodeChallenge(codeVerifier);
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  localStorage.setItem(REDIRECT_URI_KEY, redirectUri);
  const state = generateRandomString(16);
  localStorage.setItem(PKCE_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
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

export const login = initiateAuth;

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
