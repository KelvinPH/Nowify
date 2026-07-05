/** Sample track for configurator preview and demo=1 overlay URLs. */
export function buildDemoTrack() {
  return {
    isPlaying: true,
    trackId: "demo-now-playing",
    title: "Live Forever",
    artist: "Headhunterz",
    album: "Hard With Style",
    albumArt: "https://i.scdn.co/image/ab67616d0000b273e5c0984cba590108b93e45d3",
    durationMs: 210_000,
    progressMs: 90_000,
    trackUrl: "",
  };
}

export function buildDemoNextTrack() {
  return {
    trackId: "demo-next",
    title: "Pull Up",
    artist: "Snavs",
  };
}

export function buildDemoExtras() {
  return {
    bpm: 150,
    energy: 0.85,
    valence: 0.72,
    danceability: 0.68,
    acousticness: 0.02,
  };
}
