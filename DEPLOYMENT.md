# Deployment guide

## GitHub pages (frontend)

1. Fork this repository.
2. Go to **Settings → Pages**.
3. Set **Source** to **Deploy from branch**, then select `main` and `/ (root)`.
4. Your overlay URL:
   - `https://{username}.github.io/Nowify/overlay.html`
5. Your configurator URL:
   - `https://{username}.github.io/Nowify/config.html`

## Cloudflare workers setup

### 1) Install Wrangler

```bash
npm install -g wrangler
```

### 2) Authenticate

```bash
wrangler login
```

### 3) Create KV namespaces

```bash
wrangler kv:namespace create "HISTORY"
wrangler kv:namespace create "THEMES"
```

Copy the namespace IDs from the output and add them to `wrangler.toml`.

### 4) Set Apple Music secrets (optional)

Only required if you plan to use Apple Music support.

```bash
wrangler secret put APPLE_TEAM_ID
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_PRIVATE_KEY
```

### 5) Update `wrangler.toml`

Set `ALLOWED_ORIGIN` to your GitHub Pages URL, for example:

```toml
ALLOWED_ORIGIN = "https://{username}.github.io"
```

### 6) Deploy workers

```bash
wrangler deploy
```

### 7) Update worker base URL in app

After deploy, copy the Worker URL from Wrangler output and set it in:

```js
// src/stats/session.js
const WORKER_BASE_URL = "https://your-worker.workers.dev";
```

## Spotify app setup (detailed)

1. Go to [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Create an app and enable Web API usage.
3. Open **Edit settings** and add this redirect URI:
   - `https://{username}.github.io/Nowify/overlay.html`
4. Copy the Client ID and paste it into the Nowify Configurator.

## Twitch integration setup

1. Generate an OAuth token at [https://twitchtokengenerator.com](https://twitchtokengenerator.com).  
   Required scope: `chat:read`
2. Find your broadcaster user ID at [https://twitchapps.com/tmi](https://twitchapps.com/tmi).
3. Add these URL parameters in your overlay URL:
   - `twitchChannel={your channel name}`
   - `twitchToken={your oauth token}`

## YouTube alerts setup

1. Deploy your Cloudflare Worker (see step 6 above).
2. Register your webhook with YouTube PubSubHubbub using a POST request to:
   - `https://pubsubhubbub.appspot.com/subscribe`
3. Include:
   - `hub.callback=https://your-worker.workers.dev/youtube/webhook`
   - `hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id={YOUR_CHANNEL_ID}`
   - `hub.mode=subscribe`
4. The overlay receives live notifications from your worker over SSE.

## Updating

```bash
git pull origin main
wrangler deploy
```

GitHub Pages auto-deploys when changes are pushed to `main`.
