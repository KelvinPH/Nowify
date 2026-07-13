/** Copyright (c) 2026 KelvinPH. All rights reserved.
 * https://github.com/KelvinPH/Nowify
 */

import { DEFAULT_OPEN, LAYOUT_CONTENT } from "./constants.js";

export const DEFAULT_STATE = {
  layout: "glasscard",
  theme: "obsidian",
  source: "spotify",
  songifyPort: 4002,
  clientId: "",
  showProgress: true,
  showTimeLeft: false,
  showNextTrack: false,
  cassetteStyle: "classic",
  gameboyArt: false,
  /** Spotify queue label: "always" = every poll; "perSong" = hold last title until track changes */
  nextTrackMode: "always",
  showBpm: false,
  showAlbum: false,
  showPlayState: false,
  /** “Nothing playing” / Last.fm idle text (off by default) */
  showIdleMessage: false,
  transparent: false,
  moodSync: true,
  stackDir: "row",
  artPosition: "left",
  maxCardWidth: 900,
  positionAnchor: "bottom-left",
  positionOffsetX: 40,
  positionOffsetY: 40,
  /** Configurator iframe only — sample track vs live source */
  previewDemo: true,
  twitchChannel: "",
  twitchToken: "",
  lastfmUsername: "",
  lastfmApiKey: "",
  queueSource: "queue",
  queueMaxItems: 5,
  queueShowPosition: true,
  queueShowArt: true,
  queueShowTitle: true,
  queueShowArtist: true,
  queueShowDuration: true,
  queueShowRequester: true,
  queueShowAvatar: true,
  queueShowLiked: true,
  queueHighlightRequests: false,
  queueTransparent: false,
  queueAnimateIn: "slide",
  queueFontSize: 13,
  queueItemRadius: 10,
  queueItemPadding: 10,
  queueItemOpacity: 80,
  queueArtSize: 40,
  queueGap: 6,
  queueDemoPreview: false,
  queueLayout: "glasscard",
  queueArtPosition: "left",
  queueShowAlbum: false,
  queueShowTimeLeft: false,
  queueShowNextTrack: false,
  queueShowPlayState: false,
  queueShowProgress: false,
  queueBlur: 24,
  queueMaxWidth: 480,
  queueCustomColors: false,
  queueColorAccent: "#ffffff",
  queueColorTitle: "#ffffff",
  queueColorMuted: "rgba(255,255,255,0.45)",
  queueColorCard: "rgba(10,10,10,0.85)",
  canvasEnabled: false,
  enterAnim: "fade",
  exitAnim: "fade",
  enterDuration: 400,
  exitDuration: 400,
  exitDelay: 2500,
  commands: {
    sr: {
      enabled: true,
      minRole: "everyone",
      sessionLimit: 0,
      roleLimits: {
        everyone: 3,
        subscriber: 5,
        vip: 10,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 30,
    },
    skip: {
      enabled: true,
      minRole: "moderator",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 0,
    },
    prev: {
      enabled: true,
      minRole: "moderator",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 0,
    },
    queue: {
      enabled: true,
      minRole: "everyone",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 10,
    },
    vol: {
      enabled: false,
      minRole: "moderator",
      sessionLimit: 0,
      roleLimits: {
        everyone: 0,
        subscriber: 0,
        vip: 0,
        moderator: 0,
        broadcaster: 0,
      },
      cooldown: 5,
    },
  },
  animBgEnabled: false,
  animBgStyle: "aurora",
  animBgSpeed: 12,
  animBgColorMode: "mood",
  animBgColor1: "rgba(145,70,255,0.6)",
  animBgColor2: "rgba(30,30,80,0.8)",
  artBackdropEnabled: false,
  artBackdropBlur: 48,
};

/** Seeds custom editor from sidebar state (custom layout). */
export function readAnimBgForEditor() {
  return {
    animBgEnabled: Boolean(state.animBgEnabled),
    animBgColorMode: state.animBgColorMode || "mood",
    animBgColor1: state.animBgColor1,
    animBgColor2: state.animBgColor2,
    animBgStyle: state.animBgStyle || "aurora",
    animBgSpeed: Number(state.animBgSpeed) || 12,
  };
}

/** Songify-only controls mirrored in the custom editor Art tab. */
export function readSongifyArtFlags() {
  return {
    source: state.source,
    canvasEnabled: Boolean(state.canvasEnabled),
  };
}

export function readArtBackdropForEditor() {
  return {
    artBackdropEnabled: Boolean(state.artBackdropEnabled),
    artBackdropBlur: Number(state.artBackdropBlur) || 48,
  };
}

/** Overlay enter/exit animation settings (URL params, not c_* custom layout). */
export function readTransitionsForEditor() {
  const enterDurationRaw = Number(state.enterDuration);
  const exitDurationRaw = Number(state.exitDuration);
  const exitDelayRaw = Number(state.exitDelay);
  return {
    enterAnim: state.enterAnim || "fade",
    exitAnim: state.exitAnim || "fade",
    enterDuration: Number.isFinite(enterDurationRaw) ? enterDurationRaw : 400,
    exitDuration: Number.isFinite(exitDurationRaw) ? exitDurationRaw : 400,
    exitDelay: Number.isFinite(exitDelayRaw) ? exitDelayRaw : 2500,
  };
}

export function isUniqueLayout(layout) {
  return (
    layout === "vinyl" ||
    layout === "terminal" ||
    layout === "cassette" ||
    layout === "gameboy" ||
    layout === "hud" ||
    layout === "stickynote" ||
    layout === "spotifycard"
  );
}

/** Turn off overlay toggles the current layout does not support (sidebar UI hides them but URL/state could still be on). */
export function applyLayoutOverlayConstraints(layout) {
  if (layout === "custom") return;
  const lc = LAYOUT_CONTENT[layout];
  if (!lc) return;
  if (lc.showProgress === false) state.showProgress = false;
  if (lc.showTimeLeft === false) state.showTimeLeft = false;
  if (lc.showNextTrack === false) state.showNextTrack = false;
  if (lc.showBpm === false) state.showBpm = false;
  if (lc.showAlbum === false) state.showAlbum = false;
  if (lc.showPlayState === false) state.showPlayState = false;
}

let openSections = new Set(DEFAULT_OPEN);
let expandedCommands = new Set();
let queueConfigOpen = false;
let queueConfigSidebarTab = "look";

let state = {
  ...DEFAULT_STATE,
  commands: JSON.parse(JSON.stringify(DEFAULT_STATE.commands)),
};
let previousLayout = "glasscard";

export function getState() {
  return state;
}

export function setStatePartial(partial) {
  Object.assign(state, partial);
}

export function resetState() {
  state = {
    ...DEFAULT_STATE,
    commands: JSON.parse(JSON.stringify(DEFAULT_STATE.commands)),
  };
}

export function getPreviousLayout() {
  return previousLayout;
}

export function setPreviousLayout(layout) {
  previousLayout = layout;
}

export function getOpenSections() {
  return openSections;
}

export function getExpandedCommands() {
  return expandedCommands;
}

export function setQueueConfigOpen(open) {
  queueConfigOpen = open;
}

export function isQueueConfigOpen() {
  return queueConfigOpen;
}

export function getQueueConfigSidebarTab() {
  return queueConfigSidebarTab;
}

export function setQueueConfigSidebarTab(tab) {
  queueConfigSidebarTab =
    tab === "queue" || tab === "style" || tab === "colors" || tab === "obs" ? tab : "look";
}
