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
        updatedAt: Number(current.progressUpdatedAt) || Date.now(),
      }
    : null;
  const next = applyProgressSnapshot(clock, incoming, Date.now());
  return {
    ...incoming,
    progressMs: next.progressMs,
    durationMs: Number(incoming.durationMs) || next.durationMs,
    progressUpdatedAt: next.updatedAt,
  };
}

/**
 * Continuously paints estimated progress with requestAnimationFrame.
 * Inject schedule/cancel/now for tests.
 * Prefer syncProgressFill for visual bars (OBS throttles rAF).
 */
export function createProgressLoop({
  getClock,
  paint,
  shouldPause,
  now = () => Date.now(),
  schedule = (cb) => requestAnimationFrame(cb),
  cancel = (id) => cancelAnimationFrame(id),
} = {}) {
  let handle = null;
  let active = false;

  function frame() {
    handle = null;
    if (!active) {
      return;
    }
    if (shouldPause?.()) {
      handle = schedule(frame);
      return;
    }
    const clock = getClock?.();
    paint?.(estimatedProgressMs(clock, now()), clock);
    if (clock && clock.isPlaying !== false && Number(clock.durationMs) > 0) {
      handle = schedule(frame);
    } else {
      active = false;
    }
  }

  return {
    start() {
      active = true;
      if (handle == null) {
        handle = schedule(frame);
      }
    },
    stop() {
      active = false;
      if (handle != null) {
        cancel(handle);
        handle = null;
      }
    },
  };
}

/**
 * Glide a progress fill with CSS over remaining duration.
 * Uses transform (not width) so OBS can composite smoothly when rAF is throttled.
 * Skips restart when an in-flight glide is still accurate.
 */
export function syncProgressFill(fill, clock, now = Date.now()) {
  if (!fill?.style) {
    return;
  }
  const duration = Math.max(0, Number(clock?.durationMs) || 0);
  fill.style.transformOrigin = "left center";
  if (!duration) {
    fill.style.transition = "none";
    fill.style.transform = "scaleX(0)";
    if (fill.dataset) {
      fill.dataset.nwProgressSig = "";
      fill.dataset.nwProgressRatio = "0";
      fill.dataset.nwProgressAt = String(now);
    }
    return;
  }

  const progress = estimatedProgressMs(clock, now);
  const ratio = Math.min(1, Math.max(0, progress / duration));
  const remaining = Math.max(0, duration - progress);
  const playing = clock?.isPlaying !== false;
  const sig = `${clock?.trackId || ""}|${playing ? 1 : 0}|${duration}`;

  if (fill.dataset && playing) {
    const prevSig = fill.dataset.nwProgressSig || "";
    const prevRatio = Number(fill.dataset.nwProgressRatio || "0");
    const prevAt = Number(fill.dataset.nwProgressAt || "0");
    if (prevSig === sig && Number.isFinite(prevRatio) && Number.isFinite(prevAt)) {
      const expected = Math.min(1, prevRatio + Math.max(0, now - prevAt) / duration);
      if (Math.abs(expected - ratio) < 0.005) {
        return;
      }
    }
  }

  if (fill.dataset) {
    fill.dataset.nwProgressSig = sig;
    fill.dataset.nwProgressRatio = String(ratio);
    fill.dataset.nwProgressAt = String(now);
  }

  fill.style.transition = "none";
  fill.style.transform = `scaleX(${ratio})`;
  if (typeof fill.offsetWidth === "number") {
    void fill.offsetWidth;
  }

  if (playing && remaining > 16) {
    fill.style.transition = `transform ${remaining}ms linear`;
    fill.style.transform = "scaleX(1)";
  }
}
