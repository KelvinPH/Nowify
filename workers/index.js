const sseClients = new Set();

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env?.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function errorResponse(message, status = 400, env) {
  return jsonResponse({ error: message }, status, env);
}

function toBase64Url(input) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return toBase64Url(binary);
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (path === "/apple-token") return handleAppleToken(request, env);
    if (path === "/history") return handleHistory(request, env, url);
    if (path === "/theme") return handleTheme(request, env, url);
    if (path === "/themes/featured") return handleFeaturedThemes(request, env);
    if (path === "/presets") return handlePresets(request, env);
    if (path === "/youtube/events") return handleYouTubeEvents(request, env);
    if (path === "/youtube/webhook") return handleYouTubeWebhook(request, env, url);
    if (path === "/proxy") return handleProxy(request, env, url);

    return errorResponse("Not found", 404, env);
  },
};

async function handleAppleToken(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Method not allowed", 405, env);
  }
  if (!env?.APPLE_TEAM_ID || !env?.APPLE_KEY_ID || !env?.APPLE_PRIVATE_KEY) {
    return errorResponse("Apple Music not configured", 503, env);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: env.APPLE_KEY_ID };
  const payload = { iss: env.APPLE_TEAM_ID, iat: now, exp: now + 60 * 60 * 24 * 180 };
  const headerB64 = toBase64Url(JSON.stringify(header));
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pem = env.APPLE_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = bytesToBase64Url(new Uint8Array(signature));
  return jsonResponse({ token: `${headerB64}.${payloadB64}.${sigB64}` }, 200, env);
}

async function handleHistory(request, env, url) {
  const streamerId = url.searchParams.get("streamerId");
  if (!streamerId) return errorResponse("streamerId required", 400, env);

  if (request.method === "GET") {
    const raw = await env.HISTORY.get(`history:${streamerId}`);
    if (!raw) return jsonResponse({ history: [] }, 200, env);
    return jsonResponse({ history: JSON.parse(raw) }, 200, env);
  }

  if (request.method === "POST") {
    const entry = await request.json();
    if (!entry.trackId || !entry.playedAt) {
      return errorResponse("trackId and playedAt required", 400, env);
    }
    const raw = await env.HISTORY.get(`history:${streamerId}`);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    const trimmed = history.slice(0, 500);
    await env.HISTORY.put(`history:${streamerId}`, JSON.stringify(trimmed), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
    return jsonResponse({ ok: true, count: trimmed.length }, 200, env);
  }

  if (request.method === "DELETE") {
    await env.HISTORY.delete(`history:${streamerId}`);
    return jsonResponse({ ok: true }, 200, env);
  }

  return errorResponse("Method not allowed", 405, env);
}

async function handleTheme(request, env, url) {
  if (request.method === "GET") {
    const code = url.searchParams.get("code");
    if (!code) return errorResponse("code required", 400, env);
    const raw = await env.THEMES.get(`theme:${code}`);
    if (!raw) return errorResponse("Theme not found", 404, env);
    return jsonResponse(JSON.parse(raw), 200, env);
  }

  if (request.method === "POST") {
    const body = await request.json();
    if (!body.name || !body.config) {
      return errorResponse("name and config required", 400, env);
    }
    const code = generateCode();
    const theme = {
      code,
      name: body.name,
      author: body.author || "anonymous",
      config: body.config,
      createdAt: new Date().toISOString(),
    };
    await env.THEMES.put(`theme:${code}`, JSON.stringify(theme), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    return jsonResponse({ ok: true, code }, 200, env);
  }

  return errorResponse("Method not allowed", 405, env);
}

async function handleFeaturedThemes(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Method not allowed", 405, env);
  }
  return jsonResponse(
    {
      themes: [
        {
          name: "classic",
          label: "Classic Vinyl",
          config: {
            layout: "record",
            theme: "spotify",
            vinyl: false,
            moodSync: true,
            showProgress: true,
            showBpm: false,
            transparent: false,
          },
        },
        {
          name: "vinyl3d",
          label: "3D Vinyl Pro",
          config: {
            layout: "record",
            theme: "spotify",
            vinyl: true,
            moodSync: true,
            showProgress: true,
            showBpm: true,
            transparent: false,
          },
        },
        {
          name: "minimal-dark",
          label: "Minimal Dark",
          config: {
            layout: "bar",
            theme: "minimal",
            vinyl: false,
            moodSync: false,
            showProgress: false,
            showBpm: false,
            transparent: true,
          },
        },
        {
          name: "neon-card",
          label: "Neon Card",
          config: {
            layout: "card",
            theme: "neon",
            vinyl: false,
            moodSync: true,
            showProgress: true,
            showBpm: true,
            transparent: false,
          },
        },
        {
          name: "lofi-vibes",
          label: "Lo-Fi Vibes",
          config: {
            layout: "record",
            theme: "lofi",
            vinyl: false,
            moodSync: true,
            showProgress: true,
            showBpm: false,
            transparent: false,
          },
        },
      ],
    },
    200,
    env
  );
}

async function handlePresets(request, env) {
  if (request.method === "POST") {
    const body = await request.json();
    if (!body?.name || !body?.customState) {
      return errorResponse("name and customState required", 400, env);
    }
    if (!env?.THEMES) {
      return errorResponse("Preset storage unavailable", 503, env);
    }
    const id = generateCode();
    const preset = {
      id,
      name: String(body.name).slice(0, 80),
      author: String(body.author || "anonymous").slice(0, 40),
      customState: body.customState,
      createdAt: new Date().toISOString(),
    };
    await env.THEMES.put(`publicPreset:${id}`, JSON.stringify(preset), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    return jsonResponse({ ok: true, id }, 200, env);
  }

  if (request.method !== "GET") {
    return errorResponse("Method not allowed", 405, env);
  }

  const builtinPresets = [
    {
      name: "classic",
      label: "Classic Vinyl",
      description: "The original SpotiStream look, refined",
      config: {
        layout: "record",
        theme: "spotify",
        vinyl: false,
        moodSync: true,
        showProgress: true,
        showBpm: false,
        transparent: false,
      },
    },
    {
      name: "vinyl3d",
      label: "3D Vinyl Pro",
      description: "Spinning 3D disc with mood lighting",
      config: {
        layout: "record",
        theme: "spotify",
        vinyl: true,
        moodSync: true,
        showProgress: true,
        showBpm: true,
        transparent: false,
      },
    },
    {
      name: "minimal-dark",
      label: "Minimal Dark",
      description: "Clean bar overlay for competitive streams",
      config: {
        layout: "bar",
        theme: "minimal",
        vinyl: false,
        moodSync: false,
        showProgress: false,
        showBpm: false,
        transparent: true,
      },
    },
    {
      name: "neon-card",
      label: "Neon Card",
      description: "Bold neon colours with BPM pulse",
      config: {
        layout: "card",
        theme: "neon",
        vinyl: false,
        moodSync: true,
        showProgress: true,
        showBpm: true,
        transparent: false,
      },
    },
    {
      name: "lofi-vibes",
      label: "Lo-Fi Vibes",
      description: "Warm tones for chill study streams",
      config: {
        layout: "record",
        theme: "lofi",
        vinyl: false,
        moodSync: true,
        showProgress: true,
        showBpm: false,
        transparent: false,
      },
    },
  ];

  const publicPresets = [];
  if (env?.THEMES) {
    const listed = await env.THEMES.list({ prefix: "publicPreset:", limit: 100 });
    for (const key of listed.keys || []) {
      const raw = await env.THEMES.get(key.name);
      if (!raw) continue;
      try {
        publicPresets.push(JSON.parse(raw));
      } catch (_error) {
        // ignore invalid entries
      }
    }
  }

  return jsonResponse({ presets: [...publicPresets, ...builtinPresets] }, 200, env);
}

async function handleYouTubeEvents(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Method not allowed", 405, env);
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  sseClients.add(writer);
  await writer.write(encoder.encode(": connected\n\n"));

  const heartbeat = setInterval(async () => {
    try {
      await writer.write(encoder.encode(": ping\n\n"));
    } catch (_error) {
      sseClients.delete(writer);
      clearInterval(heartbeat);
    }
  }, 25000);

  const cleanup = () => {
    sseClients.delete(writer);
    clearInterval(heartbeat);
    try {
      writer.close();
    } catch (_error) {
      // no-op
    }
  };
  if (request.signal) {
    request.signal.addEventListener("abort", cleanup, { once: true });
  }

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders(env),
    },
  });
}

async function handleYouTubeWebhook(request, env, url) {
  if (request.method === "GET") {
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) return new Response(challenge, { status: 200 });
    return errorResponse("Missing hub.challenge", 400, env);
  }

  if (request.method === "POST") {
    const body = await request.text();
    const titles = [...body.matchAll(/<title>([^<]+)<\/title>/g)];
    const title = titles[1]?.[1] || "Unknown";
    const channel = titles[0]?.[1] || "Unknown";
    const payload = {
      type: "youtube.live",
      title,
      channel,
      timestamp: new Date().toISOString(),
    };

    const message = `data: ${JSON.stringify(payload)}\n\n`;
    const encoded = new TextEncoder().encode(message);
    const dead = [];

    for (const writer of sseClients) {
      try {
        await writer.write(encoded);
      } catch (_error) {
        dead.push(writer);
      }
    }
    dead.forEach((w) => sseClients.delete(w));

    return jsonResponse({ ok: true, delivered: sseClients.size }, 200, env);
  }

  return errorResponse("Method not allowed", 405, env);
}

async function handleProxy(request, env, url) {
  if (request.method !== "GET") {
    return errorResponse("Method not allowed", 405, env);
  }

  const target = url.searchParams.get("url");
  if (!target) return errorResponse("url param required", 400, env);
  if (!target.startsWith("https://")) {
    return errorResponse("Only https URLs allowed", 400, env);
  }

  const allowed = ["ws.audioscrobbler.com", "musicbrainz.org"];
  const targetHost = new URL(target).hostname;
  if (!allowed.includes(targetHost)) {
    return errorResponse("Domain not allowed", 403, env);
  }

  const upstream = await fetch(target);
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      ...corsHeaders(env),
    },
  });
}
