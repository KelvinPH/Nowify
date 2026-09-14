/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SNAPSHOT_LAG_MS,
  applyProgressSnapshot,
  createProgressLoop,
  estimatedProgressMs,
  mergeLiveProgress,
  syncProgressFill,
} from "./progress-clock.js";

describe("estimatedProgressMs", () => {
  it("advances with wall clock while playing", () => {
    const clock = {
      progressMs: 10_000,
      durationMs: 180_000,
      isPlaying: true,
      updatedAt: 1_000,
    };
    assert.equal(estimatedProgressMs(clock, 1_400), 10_400);
  });

  it("does not advance while paused", () => {
    const clock = {
      progressMs: 10_000,
      durationMs: 180_000,
      isPlaying: false,
      updatedAt: 1_000,
    };
    assert.equal(estimatedProgressMs(clock, 1_400), 10_000);
  });

  it("clamps to duration", () => {
    const clock = {
      progressMs: 179_800,
      durationMs: 180_000,
      isPlaying: true,
      updatedAt: 0,
    };
    assert.equal(estimatedProgressMs(clock, 1_000), 180_000);
  });
});

describe("applyProgressSnapshot", () => {
  const playing = {
    trackId: "song-1",
    progressMs: 30_000,
    durationMs: 180_000,
    isPlaying: true,
    updatedAt: 0,
  };

  it("ignores a lagging snapshot so the bar does not jump backward", () => {
    const now = 2_000;
    const next = applyProgressSnapshot(
      playing,
      { ...playing, progressMs: 30_200 },
      now
    );
    assert.equal(next.progressMs, 32_000);
    assert.equal(next.updatedAt, now);
  });

  it("applies a backward seek larger than snapshot lag", () => {
    const now = 2_000;
    const next = applyProgressSnapshot(
      playing,
      { ...playing, progressMs: 5_000 },
      now
    );
    assert.equal(next.progressMs, 5_000);
    assert.ok(now - playing.updatedAt + (playing.progressMs - 5_000) > SNAPSHOT_LAG_MS);
  });

  it("applies a forward seek", () => {
    const next = applyProgressSnapshot(
      playing,
      { ...playing, progressMs: 90_000 },
      500
    );
    assert.equal(next.progressMs, 90_000);
  });

  it("resets when the track changes", () => {
    const next = applyProgressSnapshot(
      playing,
      { trackId: "song-2", progressMs: 1_000, durationMs: 200_000, isPlaying: true },
      8_000
    );
    assert.equal(next.trackId, "song-2");
    assert.equal(next.progressMs, 1_000);
  });

  it("uses the snapshot position when paused", () => {
    const next = applyProgressSnapshot(
      playing,
      { ...playing, progressMs: 30_100, isPlaying: false },
      2_000
    );
    assert.equal(next.progressMs, 30_100);
    assert.equal(next.isPlaying, false);
  });

  it("stays monotonic across lagging polls while the local clock runs", () => {
    let clock = applyProgressSnapshot(
      null,
      { trackId: "song-1", progressMs: 30_000, durationMs: 180_000, isPlaying: true },
      0
    );
    let last = estimatedProgressMs(clock, 0);
    for (let now = 100; now <= 6_000; now += 100) {
      if (now % 3_000 === 0) {
        clock = applyProgressSnapshot(
          clock,
          {
            trackId: "song-1",
            progressMs: 30_000 + now - 800,
            durationMs: 180_000,
            isPlaying: true,
          },
          now
        );
      }
      const value = estimatedProgressMs(clock, now);
      assert.ok(value >= last, `progress went backward at ${now}ms: ${value} < ${last}`);
      last = value;
    }
  });
});

describe("mergeLiveProgress", () => {
  it("keeps timer progress when a poll is slightly behind", () => {
    const current = {
      trackId: "song-1",
      title: "A",
      artist: "B",
      progressMs: 12_400,
      durationMs: 180_000,
      isPlaying: true,
    };
    const incoming = {
      ...current,
      progressMs: 11_000,
    };
    const merged = mergeLiveProgress(current, incoming);
    assert.equal(merged.progressMs, 12_400);
    assert.equal(merged.title, "A");
  });

  it("takes incoming progress on a new track", () => {
    const current = {
      trackId: "song-1",
      progressMs: 12_400,
      durationMs: 180_000,
      isPlaying: true,
    };
    const incoming = {
      trackId: "song-2",
      progressMs: 250,
      durationMs: 200_000,
      isPlaying: true,
    };
    assert.equal(mergeLiveProgress(current, incoming).progressMs, 250);
  });
});

describe("createProgressLoop", () => {
  it("paints every scheduled frame while playing and stops when paused", () => {
    const paints = [];
    let clock = {
      trackId: "song-1",
      progressMs: 1_000,
      durationMs: 10_000,
      isPlaying: true,
      updatedAt: 0,
    };
    let now = 0;
    const queued = [];
    const loop = createProgressLoop({
      getClock: () => clock,
      paint: (progressMs) => paints.push(progressMs),
      now: () => now,
      schedule: (cb) => {
        queued.push(cb);
        return queued.length;
      },
      cancel: () => {},
    });

    loop.start();
    assert.equal(queued.length, 1);
    now = 200;
    queued.shift()();
    assert.equal(paints.at(-1), 1_200);
    assert.equal(queued.length, 1);

    clock = { ...clock, isPlaying: false, progressMs: 1_200, updatedAt: now };
    now = 400;
    queued.shift()();
    assert.equal(paints.at(-1), 1_200);
    assert.equal(queued.length, 0);
  });
});

describe("syncProgressFill", () => {
  it("starts a linear CSS glide from the current ratio to full", () => {
    const style = { transition: "", transform: "", transformOrigin: "" };
    const fill = { style, offsetWidth: 120, dataset: {} };
    syncProgressFill(
      fill,
      {
        trackId: "song-1",
        progressMs: 30_000,
        durationMs: 180_000,
        isPlaying: true,
        updatedAt: 1_000,
      },
      1_000
    );
    assert.equal(style.transition, "transform 150000ms linear");
    assert.equal(style.transform, "scaleX(1)");
  });

  it("holds a fixed scale while paused", () => {
    const style = { transition: "", transform: "", transformOrigin: "" };
    const fill = { style, offsetWidth: 120, dataset: {} };
    syncProgressFill(
      fill,
      {
        trackId: "song-1",
        progressMs: 45_000,
        durationMs: 180_000,
        isPlaying: false,
        updatedAt: 0,
      },
      5_000
    );
    assert.equal(style.transition, "none");
    assert.equal(style.transform, "scaleX(0.25)");
  });

  it("does not restart a glide that is still on track", () => {
    const style = { transition: "", transform: "", transformOrigin: "" };
    const fill = { style, offsetWidth: 120, dataset: {} };
    const clock = {
      trackId: "song-1",
      progressMs: 30_000,
      durationMs: 180_000,
      isPlaying: true,
      updatedAt: 0,
    };
    syncProgressFill(fill, clock, 0);
    style.transition = "keep-me";
    style.transform = "keep-me";
    syncProgressFill(fill, { ...clock, progressMs: 30_500, updatedAt: 500 }, 500);
    assert.equal(style.transition, "keep-me");
    assert.equal(style.transform, "keep-me");
  });
});
