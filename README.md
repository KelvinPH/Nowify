# Nowify

**A real-time music overlay for streamers**

![OBS Browser Source](https://img.shields.io/badge/OBS-Browser%20Source-302E31?logo=obsstudio&logoColor=white)
![Hosting: GitHub Pages](https://img.shields.io/badge/Hosting-GitHub%20Pages-222222?logo=githubpages&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Backend-Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=white)

## What is Nowify?

Nowify is a browser-based music overlay for **OBS**, **Streamlabs**, and similar tools. It shows what you are playing with layouts and themes you control from a visual configurator—no desktop app required for the overlay itself.

**Supported sources**

| Source | How it works |
|--------|----------------|
| **Spotify** | OAuth + Web API for now playing, progress, optional BPM, next-track hints, and mood-driven styling |
| **Last.fm** | Username + API key; scrobble-based now playing |
| **Songify** | Local bridge via WebSocket—see **[Songify](https://github.com/songify-rocks/Songify)** for the desktop app and **[docs/songify-integration.md](./docs/songify-integration.md)** for setup |

The overlay runs as a normal web page; settings are stored in the URL (and local storage where needed) so you can copy one link into a Browser Source and go.

## Project history

Nowify is the successor to **SpotiStream**, rebuilt for clearer structure, easier maintenance, and a better configurator.

- Original project: [SpotiStream](https://github.com/KelvinPH/SpotiStream)
- More from KelvinPH: [GitHub](https://github.com/KelvinPH?tab=repositories)

## Features

### Core

- **Multiple sources** — Spotify (full API), Last.fm, or Songify (any player Songify supports on Windows)
- **Layouts** — `glasscard`, `pill`, `island`, `strip`, `albumfocus`, `sidebar`, and **`custom`** with a full visual editor (typography, art, colours, content order, borders, gradients)
- **Preset “unique” layouts** — Stylised themes such as **vinyl**, **terminal**, **cassette**, **Game Boy**, **HUD**, **sticky note**, and **Spotify-style card** (each with layout-specific options in the configurator)
- **Themes** — `obsidian`, `midnight`, `aurora`, `forest`, `amber`, `glass` (where applicable)
- **Configurator** — Live preview, collapsible sections, copyable URLs, wizard for first-time setup, **Presets** (save / community via Cloudflare Worker)

### Playback and visibility

- **Playback transitions** — Configurable **entrance** and **exit** animations when play state changes (fade, zoom, slides, blur, pop, shrink, or none). Adjustable durations and a **pause delay** before exit (default ~2.5s) so short gaps between tracks do not flicker. When nothing is playing, the overlay can stay **fully hidden** (no frozen frame for OBS).
- **Progress and time** — Progress bar, optional time remaining, play-state dot, next-track line (Spotify; **always refresh** vs **per song** modes)

### Visual polish

- **Mood sync** (Spotify) — Colours influenced by track audio features when enabled
- **Animated background** — Optional moving gradient behind the card (`aurora`, `flow`, `pulse`, `breathe`), speed and custom colours
- **Album art backdrop** — Blurred cover behind the card (default and custom layouts)
- **Songify Canvas** — Optional canvas-style art when using Songify and the track provides a URL

### Twitch and chat

- **Chat commands** — Song requests, skip, previous, queue text, optional volume command; per-role limits and cooldowns (beta; configurable in the sidebar)
- **EventSub / IRC** — Wiring for live events alongside playback (see configurator Twitch section)

### Other pages

- **Queue overlay** — Separate **`queue.html`** Browser Source: themed list of upcoming tracks (queue / requests / both), demo mode for preview, own style tab in the configurator
- **Stats** — `stats.html`: local session history, mood views, export (browser-only storage unless you export)

## Coming soon

- **Deeper Songify + queue workflows** — Ongoing collaboration with **[Songify](https://github.com/songify-rocks/Songify)** for richer request/queue behaviour and desktop-side features. The **queue overlay** already ships for listing tracks; follow Songify and this repo for what is next.

## Quick start

1. Open the **[Configurator](https://kelvinph.github.io/Nowify/config.html)** (or your self-hosted `config.html`).
2. Complete setup (source, Spotify Client ID, Last.fm keys, or Songify port as needed).
3. Use **Copy URL** and paste the link into an OBS **Browser** source (e.g. start around **900×300** for the default card; size per layout).

Self-hosted or local: serve the repo over `http://localhost` (or HTTPS) so OAuth and Browser Source behaviour match what you use in OBS.

## Screenshots

<p align="center">
  <img src="./assets/screenshots/nowify_ss_01.png" alt="Nowify Screenshot 1" width="440" />
  <img src="./assets/screenshots/nowify_ss_02.png" alt="Nowify Screenshot 2" width="440" />
</p>
<p align="center">
  <img src="./assets/screenshots/nowify_ss_03.png" alt="Nowify Screenshot 3" width="440" />
</p>

## Configurator

The configurator drives the **main overlay** and **queue overlay** URLs: layout, theme, source, toggles, transitions, visuals, Twitch commands, and custom `c_*` fields. Highlights:

- **Source** — Spotify, Last.fm, or Songify (port)
- **Layout / theme** — Standard cards, unique presets, or **Custom** (dedicated editor with tabs: Container, Typography, Art, Content, **Transitions**, Colours)
- **Transitions** — Entrance/exit animation style, durations, pause delay (also in the Custom editor **Transitions** tab)
- **Visuals** — Mood sync, animated background, art backdrop, Songify canvas (where supported)
- **Queue designer** — Opens styling for **`queue.html`** (separate copy URL from the header when in queue mode)

Use **Presets** for saved or community custom layouts, **Add to OBS** for sizing tips, and **Reset** to clear local configurator state where applicable.

## Queue overlay

The **queue** page is a second Browser Source for a scrollable list (positions, art, titles, requesters, etc.). Configure it from the configurator via the queue / “open queue config” flow; it uses its own URL (`queue.html?…`) independent of the main now-playing overlay.

## Chat commands

| Command | Description |
|---------|-------------|
| `!sr {song name}` | Request a song (Spotify queue) |
| `!skip` | Skip to next track |
| `!prev` | Previous track |
| `!queue` | Queue info |
| `!vol` | Volume (optional; off by default—enable in Twitch command settings) |

Exact behaviour, roles, limits, and cooldowns are adjusted in the configurator **Twitch** section.

## URL parameters (overview)

The configurator builds the query string for you. Common **main overlay** parameters:

| Param | Example values | Notes |
|-------|----------------|--------|
| `layout` | `glasscard`, `pill`, `island`, `strip`, `albumfocus`, `sidebar`, `custom`, plus presets `vinyl`, `terminal`, `cassette`, `gameboy`, `hud`, `stickynote`, `spotifycard` | Unique presets use their own layout id |
| `theme` | `obsidian`, `midnight`, `aurora`, `forest`, `amber`, `glass` | Not all themes apply to every unique layout |
| `source` | `spotify`, `lastfm`, `songify` | Drives how metadata is fetched |
| `moodSync` | `1` / `0` | Spotify; ties accents to audio features when on |
| `showProgress`, `showBpm`, `showAlbum`, `showPlayState`, `showNextTrack`, `showTimeLeft`, `transparent`, … | `1` / `0`; some depend on layout |
| `nextTrackMode` | `always`, `perSong` | Spotify next-line refresh behaviour |
| `animBgEnabled`, `animBgStyle`, `animBgSpeed`, `animBgColorMode`, `animBgColor1`, `animBgColor2` | Animated background |
| `artBackdropEnabled`, `artBackdropBlur` | Blurred art behind the card |
| `canvasEnabled` | `1` / `0` | Songify canvas-style art |
| `enterAnim`, `exitAnim` | `fade`, `zoom`, `slide_up`, `slide_down`, `blur`, `pop`, `shrink`, `none` | Playback transitions |
| `enterDuration`, `exitDuration`, `exitDelay` | milliseconds | Exit delay `0` = immediate hide after pause |
| `twitchChannel`, `twitchToken`, `twitchUsername` | strings | Twitch integration |
| `lastfmUsername`, `lastfmApiKey` | strings | Last.fm source |
| `songifyPort` | e.g. `4002` | Songify WebSocket port |
| Custom layout | `c_*` params | Set when `layout=custom` (card geometry, colours, content, etc.) |

**Queue overlay** uses its own parameter set (`queue.html`); the configurator’s queue mode serialises those for you (`maxItems`, `showArt`, `blurStrength`, …).

## Stats dashboard

Open [`stats.html`](./stats.html) after sessions for summaries, mood distribution, highlights, and export. Data stays in the browser unless you export it.

## Privacy & security

- Core overlay use does not require your own server
- Spotify uses OAuth 2.0 PKCE; tokens stay in browser / OBS storage as designed
- Spotify access is scoped to what the app needs for now playing and related features
- Source is open for review

## Acknowledgements

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- **[Songify](https://github.com/songify-rocks/Songify)** — desktop companion and WebSocket bridge; ongoing collaboration for queue and playback features
- Three.js  
- Chart.js  
- [OBS Studio](https://obsproject.com/)
