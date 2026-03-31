export const PRESETS = [
  {
    name: "classic",
    label: "Classic",
    config: {
      layout: "record",
      theme: "spotify",
      vinyl: false,
      moodSync: true,
      showProgress: true,
      showBpm: false,
    },
  },
  {
    name: "vinyl3d",
    label: "3D Vinyl",
    config: {
      layout: "record",
      theme: "spotify",
      vinyl: true,
      moodSync: true,
      showProgress: true,
      showBpm: true,
    },
  },
  {
    name: "minimal",
    label: "Minimal",
    config: {
      layout: "bar",
      theme: "minimal",
      vinyl: false,
      moodSync: false,
      showProgress: false,
      showBpm: false,
    },
  },
  {
    name: "neon",
    label: "Neon",
    config: {
      layout: "card",
      theme: "neon",
      vinyl: false,
      moodSync: true,
      showProgress: true,
      showBpm: true,
    },
  },
  {
    name: "lofi",
    label: "Lo-Fi",
    config: {
      layout: "record",
      theme: "lofi",
      vinyl: false,
      moodSync: true,
      showProgress: true,
      showBpm: false,
    },
  },
  {
    name: "ticker",
    label: "Ticker",
    config: {
      layout: "ticker",
      theme: "dark",
      vinyl: false,
      moodSync: false,
      showProgress: false,
      showBpm: false,
    },
  },
];

/** Applies a preset by delegating to the shared update function. */
export function applyPreset(preset, state, updateFn) {
  updateFn(preset.config);
}
