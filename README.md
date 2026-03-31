# Nowify

**The ultimate music overlay for streamers**

![OBS Browser Source](https://img.shields.io/badge/OBS-Browser%20Source-302E31?logo=obsstudio&logoColor=white)
![Hosting: GitHub Pages](https://img.shields.io/badge/Hosting-GitHub%20Pages-222222?logo=githubpages&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Backend-Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=white)

## What is nowify?

Nowify is a real-time music overlay for OBS, Streamlabs, and StreamElements powered by Spotify playback data. You can run the core overlay directly in the browser with no server required. It is open source, free to use, and designed for streamers who want polished music visuals fast.

## Features

- **Music**
  - Spotify integration for now playing, playback state, and queue actions
  - Apple Music and Last.fm modules included in the project structure
  - BPM and mood signal support via Spotify audio features
- **Overlays**
  - Five layouts: `record`, `card`, `bar`, `ticker`, `compact`
  - Five themes: `spotify`, `dark`, `minimal`, `neon`, `lofi`
  - Optional 3D vinyl, beat-sync pulse, and mood-based color shifting
- **Interactive**
  - Chat song requests with `!sr`
  - Viewer interaction hooks for voting and engagement flows
  - Playback controls via `!skip` and `!prev`
- **Stats**
  - Session tracking and local recap history
  - Banger detection from chat/vote spikes
  - Mood chart, top tracks, and JSON export
- **Platform**
  - Works in OBS, Streamlabs, and StreamElements browser sources
  - Twitch IRC + EventSub support
  - YouTube alert relay support via worker endpoints

## Quick start

1. **Set up Spotify app credentials**  
   Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. **Open the Configurator**  
   Go to [https://kelvinph.github.io/Nowify/config.html](https://kelvinph.github.io/Nowify/config.html).
3. **Paste URL into OBS Browser Source**  
   Use the copied overlay URL with a browser source size of `900x300`.

## Configurator

The Configurator provides a live iframe preview, quick presets, and full control over layouts, themes, and interaction toggles. Every setting is encoded as URL parameters so your overlay is easy to share or reproduce. Use the **Copy URL** button to drop the final link directly into OBS.

## Chat commands

| Command | Description |
|---------|-------------|
| `!sr {song name}` | Add a song to the Spotify queue |
| `!skip` | Skip to next track |
| `!prev` | Go to previous track |
| `!queue` | Show current queue info |

## URL parameters

| Param | Values | Default |
|-------|--------|---------|
| `layout` | `record`, `card`, `bar`, `ticker`, `compact` | `record` |
| `theme` | `spotify`, `dark`, `minimal`, `neon`, `lofi` | `spotify` |
| `vinyl` | `1` / `0` | `0` |
| `moodSync` | `1` / `0` | `1` |
| `showProgress` | `1` / `0` | `1` |
| `showBpm` | `1` / `0` | `0` |
| `transparent` | `1` / `0` | `0` |
| `twitchChannel` | channel name | — |
| `twitchToken` | OAuth token | — |

## Stats dashboard

After your stream, open [`/stats.html`](./stats.html) to review summary cards, banger moments, mood distribution, and top tracks. Session data is stored locally and can be exported to JSON anytime.

## Privacy & security

- No server is required for core overlay features
- OAuth 2.0 PKCE flow is used, with tokens stored locally in OBS/browser storage
- Spotify access is limited to currently playing, playback state, and recently played scopes used by the app
- Fully open source for transparent review of data handling

## Self-hosting & contributing

Fork this repository and enable GitHub Pages from `main` to self-host quickly. Pull requests are welcome for fixes, features, and UI improvements. For worker setup and production deployment details, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Acknowledgements

- Spotify Web API
- Three.js
- Chart.js
- OBS Studio