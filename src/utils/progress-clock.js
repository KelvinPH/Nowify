/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

/** Snapshots this far behind local time are lag, not a seek. */
export const SNAPSHOT_LAG_MS = 4000;

function clampProgress(ms, durationMs) {
  const progress = Math.max(0, Number(ms) || 0);
  const duration = Math.max(0, Number(durationMs) || 0);
  return duration > 0 ? Math.min(duration, progress) : progress;
}

export function estimatedProgressMs(clock, now = Date.now()) {
  const base = clampProgress(clock?.progressMs, clock?.durationMs);
  if (!clock || clock.isPlaying === false) {
    return base;
  }
  const origin = Number(clock.updatedAt);
  const elapsed = Number.isFinite(origin) ? Math.max(0, now - origin) : 0;
  return clampProgress(base + elapsed, clock.durationMs);
}

export function applyProgressSnapshot(clock, snapshot, now = Date.now()) {
  const incoming = {
    trackId: snapshot?.trackId ? String(snapshot.trackId) : "",
    progressMs: clampProgress(snapshot?.progressMs, snapshot?.durationMs),
    durationMs: Math.max(0, Number(snapshot?.durationMs) || 0),
    isPlaying: snapshot?.isPlaying !== false,
    updatedAt: now,
  };

  if (!clock) {
    return incoming;
  }

  if (incoming.trackId && clock.trackId && incoming.trackId !== String(clock.trackId)) {
    return incoming;
  }

  if (incoming.isPlaying === false) {
    return incoming;
  }

  const estimated = estimatedProgressMs(clock, now);
  const behindBy = estimated - incoming.progressMs;
  if (behindBy > 0 && behindBy <= SNAPSHOT_LAG_MS) {
    return {
      trackId: incoming.trackId || String(clock.trackId || ""),
      progressMs: estimated,
      durationMs: incoming.durationMs || clock.durationMs,
      isPlaying: true,
      updatedAt: now,
    };
  }

  return incoming;
}

/** Merge a source snapshot into a layout that already stores live progressMs. */
export function mergeLiveProgress(current, incoming) {
  if (!incoming) {
    return current;
  }
  const clock = current
    ? {
        trackId: current.trackId || "",
        progressMs: Number(current.progressMs) || 0,
        durationMs: Number(current.durationMs) || 0,
        isPlaying: current.isPlaying !== false,
        updatedAt: Date.now(),
      }
    : null;
  const next = applyProgressSnapshot(clock, incoming, Date.now());
  return {
    ...incoming,
    progressMs: next.progressMs,
    durationMs: Number(incoming.durationMs) || next.durationMs,
  };
}
