const REFRESH_MARGIN_MS = 60 * 1000;
const REFRESH_POLL_MS = 30 * 1000;

export const KEYS = {
  ACCESS_TOKEN: "nowify_access_token",
  REFRESH_TOKEN: "nowify_refresh_token",
  EXPIRY: "nowify_token_expiry",
  CLIENT_ID: "nowify_client_id",
};

/** Stores access, refresh, and calculated expiry timestamp. */
export function saveTokens({ accessToken, refreshToken, expiresIn }) {
  localStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(KEYS.EXPIRY, String(Date.now() + expiresIn * 1000));
}

/** Returns the persisted Spotify access token or null. */
export function getAccessToken() {
  return localStorage.getItem(KEYS.ACCESS_TOKEN);
}

/** Returns the persisted Spotify refresh token or null. */
export function getRefreshToken() {
  return localStorage.getItem(KEYS.REFRESH_TOKEN);
}

/** Returns true when token is missing, invalid, or near expiry. */
export function isExpired() {
  const expiryRaw = localStorage.getItem(KEYS.EXPIRY);
  if (!expiryRaw) {
    return true;
  }

  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry)) {
    return true;
  }

  return Date.now() >= expiry - REFRESH_MARGIN_MS;
}

/** Persists the user-provided Spotify client ID. */
export function saveClientId(clientId) {
  localStorage.setItem(KEYS.CLIENT_ID, clientId);
}

/** Returns the persisted Spotify client ID or null. */
export function getClientId() {
  return localStorage.getItem(KEYS.CLIENT_ID);
}

/** Clears all token and client ID state from localStorage. */
export function clearTokens() {
  localStorage.removeItem(KEYS.ACCESS_TOKEN);
  localStorage.removeItem(KEYS.REFRESH_TOKEN);
  localStorage.removeItem(KEYS.EXPIRY);
  localStorage.removeItem(KEYS.CLIENT_ID);
}

/** Starts a 30-second poll that refreshes only when expiry is near. */
export function startRefreshLoop(refreshFn) {
  if (isExpired()) {
    refreshFn();
  }

  return window.setInterval(() => {
    if (isExpired()) {
      refreshFn();
    }
  }, REFRESH_POLL_MS);
}
