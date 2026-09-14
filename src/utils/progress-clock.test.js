/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SNAPSHOT_LAG_MS,
  applyProgressSnapshot,
  estimatedProgressMs,
  mergeLiveProgress,
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
