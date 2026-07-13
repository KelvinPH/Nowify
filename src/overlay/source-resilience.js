/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

/** Multiply normal poll interval to detect stale cached overlay data. */
export const STALENESS_THRESHOLD_MULTIPLIER = 2;

/**
 * When true, stop extrapolating the progress bar after data goes stale.
 * Default false — confirm before enabling on stream overlays.
 */
export const FREEZE_PROGRESS_WHEN_STALE = false;

export const SOURCE_STATUS = {
  LIVE: "live",
  STALE: "stale",
  RECONNECTING: "reconnecting",
};

let lastKnownGood = null;
let connectionStatus = SOURCE_STATUS.RECONNECTING;
let activeSourceName = "spotify";
const statusListeners = new Set();

function notifyStatus() {
  for (const fn of statusListeners) {
    try {
      fn(connectionStatus, activeSourceName);
    } catch (_error) {
      /* ignore */
    }
  }
  if (typeof window !== "undefined" && window.parent !== window) {
    try {
      window.parent.postMessage(
        {
          type: "nowify:source-status",
          status: connectionStatus,
          source: activeSourceName,
          lastSuccessAt: lastKnownGood?.fetchedAt || 0,
        },
        "*"
      );
    } catch (_error) {
      /* ignore */
    }
  }
}

export function setActiveSourceName(name) {
  activeSourceName = name || "spotify";
}

export function getSourceConnectionStatus() {
  return connectionStatus;
}

export function subscribeSourceStatus(listener) {
  statusListeners.add(listener);
  listener(connectionStatus, activeSourceName);
  return () => statusListeners.delete(listener);
}

export function recordSuccessfulFetch(track) {
  if (!track || typeof track !== "object") {
    return;
  }
  lastKnownGood = {
    track: { ...track },
    fetchedAt: Date.now(),
  };
  connectionStatus = SOURCE_STATUS.LIVE;
  notifyStatus();
}

export function getLastKnownGoodTrack() {
  return lastKnownGood?.track ? { ...lastKnownGood.track } : null;
}

export function getLastSuccessfulFetchAt() {
  return lastKnownGood?.fetchedAt || 0;
}

export function markFetchFailed() {
  connectionStatus = lastKnownGood
    ? SOURCE_STATUS.STALE
    : SOURCE_STATUS.RECONNECTING;
  notifyStatus();
}

/** API responded successfully but no track is playing. */
export function markApiReachable() {
  connectionStatus = SOURCE_STATUS.LIVE;
  notifyStatus();
}

export function markReconnecting() {
  connectionStatus = SOURCE_STATUS.RECONNECTING;
  notifyStatus();
}

export function isDataStale(thresholdMs, pollIntervalMs) {
  const at = getLastSuccessfulFetchAt();
  if (!at) {
    return false;
  }
  const threshold =
    thresholdMs ??
    (pollIntervalMs > 0 ? pollIntervalMs * STALENESS_THRESHOLD_MULTIPLIER : 6000);
  return Date.now() - at > threshold;
}

export function shouldFreezeProgress(pollIntervalMs) {
  if (!FREEZE_PROGRESS_WHEN_STALE) {
    return false;
  }
  return isDataStale(undefined, pollIntervalMs);
}

/** Parses Retry-After (seconds or HTTP-date) into milliseconds. */
export function parseRetryAfterMs(headerValue) {
  if (!headerValue) {
    return null;
  }
  const trimmed = String(headerValue).trim();
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/** fetch() with an abort timeout; rejects on network failure or timeout. */
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Schedules polling with exponential backoff on failure.
 * Resets to normalIntervalMs after each successful poll.
 */
export function createPollScheduler({ normalIntervalMs, maxIntervalMs = 60_000, onPoll }) {
  let currentIntervalMs = normalIntervalMs;
  let timer = null;
  let stopped = true;

  function scheduleNext(delayMs) {
    if (stopped) {
      return;
    }
    timer = window.setTimeout(runTick, delayMs);
  }

  async function runTick() {
    if (stopped) {
      return;
    }
    let nextDelay = currentIntervalMs;
    try {
      const result = await onPoll();
      if (result?.stop) {
        stopped = true;
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
        return;
      }
      if (result?.failed) {
        markFetchFailed();
        if (result.retryAfterMs) {
          currentIntervalMs = Math.min(
            Math.max(result.retryAfterMs, normalIntervalMs),
            maxIntervalMs
          );
        } else {
          currentIntervalMs = Math.min(currentIntervalMs * 2, maxIntervalMs);
        }
        nextDelay = currentIntervalMs;
      } else {
        currentIntervalMs = normalIntervalMs;
        nextDelay = normalIntervalMs;
      }
    } catch (error) {
      markFetchFailed();
      if (error?.retryAfterMs) {
        currentIntervalMs = Math.min(
          Math.max(error.retryAfterMs, normalIntervalMs),
          maxIntervalMs
        );
      } else {
        currentIntervalMs = Math.min(currentIntervalMs * 2, maxIntervalMs);
      }
      nextDelay = currentIntervalMs;
      console.warn("[Nowify] Poll scheduler error:", error);
    }
    scheduleNext(nextDelay);
  }

  return {
    start() {
      stopped = false;
      currentIntervalMs = normalIntervalMs;
      markReconnecting();
      if (timer) {
        window.clearTimeout(timer);
      }
      runTick();
    },
    stop() {
      stopped = true;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    },
    getCurrentIntervalMs() {
      return currentIntervalMs;
    },
  };
}
