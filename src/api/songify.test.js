/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapSongifyPayload } from "./songify.js";

function envelope(data) {
  return {
    Track: {
      Data: {
        Title: "Test Song",
        Artists: "Test Artist",
        SongId: "abc",
        DurationMs: 180_000,
        IsPlaying: true,
        ...data,
      },
    },
  };
}

describe("mapSongifyPayload progress", () => {
  it("uses Progress milliseconds instead of DurationPercentage", () => {
    const track = mapSongifyPayload(
      envelope({ Progress: 5_000, DurationPercentage: 2 })
    );
    assert.equal(track.progressMs, 5_000);
  });

  it("treats small Progress values as milliseconds, not percent", () => {
    const track = mapSongifyPayload(
      envelope({ Progress: 50, DurationPercentage: 0 })
    );
    assert.equal(track.progressMs, 50);
  });

  it("does not scale Progress below 1000ms as if it were seconds", () => {
    const track = mapSongifyPayload(
      envelope({ Progress: 500, DurationPercentage: 0 })
    );
    assert.equal(track.progressMs, 500);
  });

  it("falls back to DurationPercentage when Progress is missing", () => {
    const track = mapSongifyPayload(envelope({ DurationPercentage: 25 }));
    assert.equal(track.progressMs, 45_000);
  });
});
