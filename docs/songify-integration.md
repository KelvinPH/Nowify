# Nowify + Songify Integration

Nowify can use [Songify](https://github.com/songify-rocks/Songify)
as a music source instead of connecting directly to Spotify.
This means no Spotify API key is needed, and it works with
Spotify free accounts, YouTube Music, Tidal, and any other
player Songify supports.

---

## How it works

Songify runs on your Windows PC and connects to your music player.
It exposes a local WebSocket server that broadcasts the currently
playing track in real time.

Nowify, running inside OBS as a Browser Source, connects to that
WebSocket and renders the track using all its normal layouts,
themes, and visual features.
Your music player -> Songify -> WebSocket -> OBS Browser Source -> Nowify overlay

---

## Requirements

- Windows (Songify is a Windows-only application)
- [Songify](https://github.com/songify-rocks/Songify/releases)
  installed and running
- Songify web server enabled (File -> Settings -> Web Server)

---

## Supported music services (via Songify)

| Service | How Songify connects |
|---------|---------------------|
| Spotify (free or premium) | Songify's built-in Spotify integration |
| YouTube Music | YouTube Music Desktop app + Songify plugin |
| Tidal | Tidal desktop app (Songify reads automatically) |
| VLC | Songify reads from VLC directly |
| foobar2000 | Via Songify desktop reader |
| Any Chrome/Edge tab | Songify browser reader |

---

## Setup

### Step 1 - Install Songify

Download **Songify.zip** from
[github.com/songify-rocks/Songify/releases](https://github.com/songify-rocks/Songify/releases).
Extract and run **Songify.exe**.

Do not download the source code zip - only Songify.zip.

### Step 2 - Connect your music service in Songify

**Spotify:**
Go to Settings -> Spotify and link your account.
Works with free and premium Spotify accounts.

**YouTube Music:**
Install [YouTube Music Desktop](https://github.com/th-ch/youtube-music).
In that app: Plugins -> API Server -> ensure port is 26538
and authorization is set to No Authorization.
Then in Songify: Settings -> Players -> enable YouTube Music.

**Tidal:**
Open the Tidal desktop app alongside Songify.
Songify detects it automatically.

### Step 3 - Enable Songify web server

In Songify go to **File -> Settings -> Web Server** and
enable the web server. Note the WebSocket port (default: **4002**).

### Step 4 - Set up Nowify

Open the [Nowify Configurator](https://kelvinph.github.io/Nowify/config.html).

If it is your first time: the setup wizard will appear.
Select **Songify** as your music source and enter your port.

If you have already set up Nowify: find the **Music source**
picker at the top of the sidebar and switch to **Songify**.
Enter your port in the field that appears.

### Step 5 - Add to OBS

Click **Copy URL** in the Configurator.
In OBS: Sources -> + -> Browser Source -> paste the URL.
Recommended size: 900 x 300 px.

---

## What works with Songify

| Feature | Available |
|---------|-----------|
| Now playing track | Yes |
| Artist | Yes |
| Album name | No — Songify's API sends cover art sizes (`640x640`), not album titles. Use the Spotify source if you need album names. |
| Album art | Yes |
| Progress bar | Yes (if Songify provides duration) |
| Next track on now-playing overlay | Yes — uses the first item in Songify's queue when **Show next track** is on |
| Queue overlay (`queue.html`) | Yes — separate browser source; configure via **Queue overlay → Configure** |
| All layouts and themes | Yes |
| Glassmorphism effects | Yes |
| Twitch chat commands | Yes (routes to Songify) |
| BPM display | No |
| Beat sync animations | No |
| Mood sync | No |

BPM, beat sync, and mood sync require Spotify audio features
data which is only available when using Nowify's direct
Spotify source.

### Queue overlay (Songify)

1. Set source to **Songify** and enter your port.
2. Open **Queue overlay → Configure** (not the main custom layout editor).
3. On the **Look** tab, turn on **Transparent background** if you want a clear OBS backdrop.
4. Use **Queue / Sizing / Colors** tabs for row fields and styling.
5. Copy the **Queue URL** into a second OBS Browser Source (~400×600).

The queue designer is a tabbed sidebar + live preview — it is not the same as the main overlay's custom visual editor.

---

## Twitch chat commands (via Songify)

When using Songify as a source, Nowify routes chat commands
to Songify's WebSocket instead of Spotify directly.

| Command | Action |
|---------|--------|
| !skip | Skip to next track |
| !sr [song] | Add song to Songify queue |
| !pause | Pause playback |
| !play | Resume playback |

Commands require the Twitch integration to be set up in
Nowify's Configurator (same as normal).

---

## Troubleshooting

**Overlay shows nothing / not connected**

- Make sure Songify is running
- Make sure the web server is enabled in Songify settings
- Check that the port in Nowify matches the port in Songify
- OBS Browser Source uses Chromium which allows
  `ws://localhost` connections - no special settings needed

**Wrong port**

The default port is 4002. If you changed it in Songify,
update the port in the Nowify Configurator sidebar.

**Songify shows a track but Nowify does not update**

Songify may not be broadcasting updates if no track has
changed since connecting. Play or skip a track to trigger
a fresh update.

**BPM / mood sync not working**

These features are not available with the Songify source.
Switch to the direct Spotify source if you need them.

**Album shows as `640x640` (or similar)**

Older Nowify builds mistakenly treated Songify cover dimensions as the album name. Update Nowify — album name still will not appear via Songify (API limitation); the bogus size string is removed.

**Next track blank on the now-playing overlay**

Enable **Show next track** in Content. Songify must be sending queue tracks (same data the queue overlay uses). The dedicated queue overlay can still work even when the now-playing next line was off.

**Can't find transparent background for the queue overlay**

Open **Queue overlay → Configure**, stay on the **Look** tab, and toggle **Transparent background**. Then re-copy the Queue URL into OBS and enable Browser Source transparency if your OBS build offers it.

---

## Technical details

Nowify connects to Songify via a standard browser WebSocket:
ws://localhost:{port}

Songify broadcasts track updates as JSON messages whenever
the playing track changes. Nowify listens for these messages,
normalises the data into its internal track format, and
calls the renderer.

Nowify also sends control commands back to Songify using
Songify's WebSocket command API:

```json
{ "action": "skip" }
{ "action": "queue_add", "data": { "track": "song name", "requester": "viewer" } }
{ "action": "vol_set", "data": { "value": 80 } }
```

Full Songify WebSocket command reference:
[github.com/songify-rocks/Songify/blob/master/WebSockets.md](https://github.com/songify-rocks/Songify/blob/master/WebSockets.md)

---

## Attribution

Songify is built by [Inzaniity](https://github.com/Inzaniity)
and the Songify team. Nowify's Songify integration is
an independent implementation of Songify's public WebSocket API.

If you find Songify useful, consider supporting it:
[ko-fi.com/inzaniity](https://ko-fi.com/inzaniity)

