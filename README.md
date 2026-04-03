# Nowify

**A real-time music overlay for streamers**

![Nowify Logo](./assets/logo/logo_black.png)

![OBS Browser Source](https://img.shields.io/badge/OBS-Browser%20Source-302E31?logo=obsstudio&logoColor=white)
![Hosting: GitHub Pages](https://img.shields.io/badge/Hosting-GitHub%20Pages-222222?logo=githubpages&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Backend-Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=white)

## What is Nowify?

Nowify is a browser-based music overlay for **OBS**, **Streamlabs**, and similar tools. It shows what you are playing with layouts and themes you control from a visual configurator—no desktop app required for the overlay itself.

**Supported sources**

| Source | How it works |
|--------|----------------|
| **Spotify** | OAuth + Web API for now playing, progress, optional BPM and mood-driven styling |
| **Last.fm** | Username + API key; scrobble-based now playing |
| **Songify** | Local bridge via WebSocket—see **[Songify](https://github.com/songify-rocks/Songify)** for the desktop app and setup |

The overlay runs as a normal web page; settings are stored in the URL (and local storage where needed) so you can copy one link into a Browser Source and go.

## Project history

Nowify is the successor to **SpotiStream**, rebuilt for clearer structure, easier maintenance, and a better configurator.

- Original project: [SpotiStream](https://github.com/KelvinPH/SpotiStream)
- More from KelvinPH: [GitHub](https://github.com/KelvinPH?tab=repositories)

## Features

- **Spotify** — Live track info, progress, play state; optional BPM and mood sync from audio features
- **Layouts** — `glasscard`, `pill`, `island`, `strip`, `albumfocus`, `sidebar`, and **`custom`** with a full visual editor
- **Themes** — `obsidian`, `midnight`, `aurora`, `forest`, `amber`, `glass`
- **Configurator** — Live preview, collapsible sections, copyable overlay URL
- **Custom mode** — Typography, spacing, art, colours, content order, animated background options; save/browse community presets (Cloudflare Worker)
- **Songify** — Connect **[Songify](https://github.com/songify-rocks/Songify)** on your machine for playback-driven metadata and optional **Spotify Canvas**-style art when available ([Songify repo](https://github.com/songify-rocks/Songify))
- **Twitch** — Optional chat commands: `!sr`, `!skip`, `!prev`, `!queue` (with OAuth token)
- **Stats** — Local session history, mood/activity views, JSON export (`stats.html`)

## Coming soon

- **Customizable queue (with Songify)** — We’re working with **[Songify](https://github.com/songify-rocks/Songify)** on richer queue presentation and controls for the overlay. Details and timing will land as the integration matures; follow **Songify** for desktop updates and this repo for overlay-side changes.

## Quick start

1. Open the **[Configurator](https://kelvinph.github.io/Nowify/config.html)** (or your self-hosted `config.html`).
2. Complete setup (source, Spotify Client ID, Last.fm keys, or Songify port as needed).
3. Use **Copy URL** and paste the link into an OBS **Browser** source (e.g. start around **900×300** for the default card layout; adjust per layout).

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

The configurator drives everything through the overlay URL: layout, theme, toggles, credentials (where applicable), and custom layout parameters. Use **Presets** for saved/community layouts, **Custom** for the full editor, and **Add to OBS** for sizing tips.

## Chat commands

| Command | Description |
|---------|-------------|
| `!sr {song name}` | Request a song (Spotify queue) |
| `!skip` | Skip to next track |
| `!prev` | Previous track |
| `!queue` | Queue info |

## URL parameters (overview)

| Param | Example values | Notes |
|-------|----------------|--------|
| `layout` | `glasscard`, `pill`, `island`, `strip`, `albumfocus`, `sidebar`, `custom` | |
| `theme` | `obsidian`, `midnight`, `aurora`, `forest`, `amber`, `glass` | |
| `moodSync` | `1` / `0` | Spotify; ties visuals to track energy when on |
| `showProgress`, `showBpm`, `transparent`, … | `1` / `0` | Layout-dependent |
| `twitchChannel`, `twitchToken` | strings | Optional Twitch integration |
| `lastfmUsername`, `lastfmApiKey` | strings | Last.fm source |
| Custom layout | `c_*` params | Set when `layout=custom` |

The configurator builds the full query string for you.

## Stats dashboard

Open [`stats.html`](./stats.html) after sessions for summaries, mood distribution, highlights, and export. Data stays in the browser unless you export it.

## Privacy & security

- Core overlay use does not require your own server
- Spotify uses OAuth 2.0 PKCE; tokens stay in browser / OBS storage as designed
- Spotify access is scoped to what the app needs for now playing and related features
- Source is open for review

## Self-hosting & contributing

Clone the repository and enable **GitHub Pages** (or any static host) pointing at your branch. See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for Workers and production notes.

Pull requests are welcome for fixes, features, and documentation.

## Acknowledgements

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- **[Songify](https://github.com/songify-rocks/Songify)** — desktop companion and WebSocket bridge; queue-related work continues in collaboration with the Songify project
- Three.js  
- Chart.js  
- [OBS Studio](https://obsproject.com/)
