import { handleCommand } from "../commands/handler.js";

let ircSocket = null;
let eventSubSocket = null;
let ircReconnectTimer = null;
let eventSubReconnectTimer = null;
let ircReconnectAttempts = 0;
let eventSubReconnectAttempts = 0;
let ircLastConfig = null;
let eventSubLastConfig = null;
let eventSubWsUrl = "wss://eventsub.wss.twitch.tv/ws";
let registeredCallbacks = {};

/** Registers a callback for a Twitch event type. */
export function on(eventType, callback) {
  if (!registeredCallbacks[eventType]) {
    registeredCallbacks[eventType] = [];
  }
  registeredCallbacks[eventType].push(callback);
}

/** Unregisters a specific callback for a Twitch event type. */
export function off(eventType, callback) {
  const callbacks = registeredCallbacks[eventType];
  if (!callbacks) {
    return;
  }
  registeredCallbacks[eventType] = callbacks.filter((fn) => fn !== callback);
}

/** Connects to Twitch IRC chat via WebSocket and starts listeners. */
export function connectIRC({ channel, username, token }) {
  ircLastConfig = { channel, username, token };
  if (!channel || !username || !token) {
    return;
  }

  if (ircReconnectTimer) {
    clearTimeout(ircReconnectTimer);
    ircReconnectTimer = null;
  }
  if (ircSocket) {
    ircSocket.close();
  }

  const normalizedToken = String(token).replace(/^oauth:/i, "");
  const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  ircSocket = ws;

  ws.addEventListener("open", () => {
    ircReconnectAttempts = 0;
    ws.send(`PASS oauth:${normalizedToken}`);
    ws.send(`NICK ${username}`);
    ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
    ws.send(`JOIN #${channel}`);
  });

  ws.addEventListener("message", (event) => {
    const lines = String(event.data).split("\r\n").filter(Boolean);
    lines.forEach((line) => {
      const parsed = parseIRCMessage(line);
      if (!parsed) {
        return;
      }

      if (parsed.command === "PING") {
        ws.send("PONG :tmi.twitch.tv");
        return;
      }

      if (parsed.command === "PRIVMSG") {
        onChatMessage({
          username: parsed.username,
          message: parsed.message,
          tags: parsed.tags,
        });
      }
    });
  });

  ws.addEventListener("error", (error) => {
    console.warn("Nowify: Twitch IRC socket error", error);
  });

  ws.addEventListener("close", () => {
    scheduleIRCReconnect();
  });
}

/** Disconnects Twitch IRC and clears reconnect timers. */
export function disconnectIRC() {
  if (ircReconnectTimer) {
    clearTimeout(ircReconnectTimer);
    ircReconnectTimer = null;
  }
  if (ircSocket) {
    ircSocket.close();
  }
  ircSocket = null;
}

/** Connects to Twitch EventSub WebSocket and manages subscription lifecycle. */
export function connectEventSub({ broadcasterId, token }) {
  eventSubLastConfig = { broadcasterId, token };
  if (!broadcasterId || !token) {
    return;
  }

  if (eventSubReconnectTimer) {
    clearTimeout(eventSubReconnectTimer);
    eventSubReconnectTimer = null;
  }
  if (eventSubSocket) {
    eventSubSocket.close();
  }

  const ws = new WebSocket(eventSubWsUrl);
  eventSubSocket = ws;

  ws.addEventListener("open", () => {
    eventSubReconnectAttempts = 0;
  });

  ws.addEventListener("message", async (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      console.warn("Nowify: Invalid EventSub payload", error);
      return;
    }

    const messageType = payload?.metadata?.message_type;
    if (messageType === "session_welcome") {
      const sessionId = payload?.payload?.session?.id;
      if (sessionId) {
        await subscribeToEvents(
          sessionId,
          eventSubLastConfig.broadcasterId,
          eventSubLastConfig.token
        );
      }
      return;
    }

    if (messageType === "notification") {
      const eventType = payload?.metadata?.subscription_type;
      const eventData = payload?.payload?.event;
      const callbacks = registeredCallbacks[eventType] || [];
      callbacks.forEach((callback) => {
        callback(eventData);
      });
      return;
    }

    if (messageType === "session_reconnect") {
      const reconnectUrl = payload?.payload?.session?.reconnect_url;
      if (reconnectUrl) {
        eventSubWsUrl = reconnectUrl;
        const last = eventSubLastConfig;
        if (eventSubSocket) {
          eventSubSocket.close();
        }
        connectEventSub(last);
      }
      return;
    }

    if (messageType === "session_keepalive") {
      return;
    }
  });

  ws.addEventListener("error", (error) => {
    console.warn("Nowify: Twitch EventSub socket error", error);
  });

  ws.addEventListener("close", () => {
    scheduleEventSubReconnect();
  });
}

/** Disconnects Twitch EventSub and clears reconnect timers. */
export function disconnectEventSub() {
  if (eventSubReconnectTimer) {
    clearTimeout(eventSubReconnectTimer);
    eventSubReconnectTimer = null;
  }
  if (eventSubSocket) {
    eventSubSocket.close();
  }
  eventSubSocket = null;
}

function getBackoffDelay(attemptNumber) {
  const delays = [5000, 10000, 20000];
  return delays[Math.min(attemptNumber - 1, delays.length - 1)] || 30000;
}

function scheduleIRCReconnect() {
  if (!ircLastConfig) {
    return;
  }
  if (ircReconnectTimer) {
    clearTimeout(ircReconnectTimer);
  }
  ircReconnectAttempts += 1;
  const delay = Math.min(getBackoffDelay(ircReconnectAttempts), 30000);
  ircReconnectTimer = setTimeout(() => {
    connectIRC(ircLastConfig);
  }, delay);
}

function scheduleEventSubReconnect() {
  if (!eventSubLastConfig) {
    return;
  }
  if (eventSubReconnectTimer) {
    clearTimeout(eventSubReconnectTimer);
  }
  eventSubReconnectAttempts += 1;
  const delay = Math.min(getBackoffDelay(eventSubReconnectAttempts), 30000);
  eventSubReconnectTimer = setTimeout(() => {
    connectEventSub(eventSubLastConfig);
  }, delay);
}

async function subscribeToEvents(sessionId, broadcasterId, token) {
  const clientId = localStorage.getItem("nowify_client_id");
  const normalizedToken = String(token).replace(/^oauth:/i, "");
  const endpoint = "https://api.twitch.tv/helix/eventsub/subscriptions";
  const commonHeaders = {
    Authorization: `Bearer ${normalizedToken}`,
    "Client-Id": clientId || "",
    "Content-Type": "application/json",
  };
  const transport = { method: "websocket", session_id: sessionId };
  const subscriptions = [
    {
      type: "channel.follow",
      version: "2",
      condition: {
        broadcaster_user_id: broadcasterId,
        moderator_user_id: broadcasterId,
      },
    },
    {
      type: "channel.subscribe",
      version: "1",
      condition: {
        broadcaster_user_id: broadcasterId,
      },
    },
    {
      type: "channel.raid",
      version: "1",
      condition: {
        to_broadcaster_user_id: broadcasterId,
      },
    },
  ];

  for (const sub of subscriptions) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        type: sub.type,
        version: sub.version,
        condition: sub.condition,
        transport,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.warn(
        `Nowify: EventSub subscription failed (${sub.type}) ${response.status}: ${bodyText}`
      );
    }
  }
}

function parseTags(rawTags) {
  const tags = {};
  if (!rawTags) {
    return tags;
  }
  rawTags.split(";").forEach((pair) => {
    const [key, value = ""] = pair.split("=");
    tags[key] = value;
  });
  return tags;
}

function parseIRCMessage(raw) {
  if (!raw) {
    return null;
  }

  if (raw.startsWith("PING")) {
    return { command: "PING", channel: null, username: null, message: null, tags: {} };
  }

  const match = raw.match(
    /^(?:@([^ ]+)\s+)?:(\w+)!.*?\s+([A-Z]+)\s+#?([^ :]+)?\s*:?([\s\S]*)?$/
  );
  if (!match) {
    return null;
  }

  const [, rawTags, username, command, channel, message] = match;
  return {
    command,
    channel: channel ? channel.replace(/^#/, "") : null,
    username: username || null,
    message: message || "",
    tags: parseTags(rawTags),
  };
}

function onChatMessage({ username, message, tags }) {
  const callbacks = registeredCallbacks["chat.message"] || [];
  callbacks.forEach((callback) => {
    callback({ username, message, tags });
  });
  handleCommand({ username, message, tags });
}
