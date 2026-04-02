import { clearSession } from "./session.js";

let moodChart = null;

/** Initializes stats dashboard rendering and header actions. */
export function init() {
  const raw = localStorage.getItem("nowify_session");
  let tracks = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      tracks = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Nowify: Failed to parse stored stats session", error);
    }
  }

  if (!tracks.length) {
    const app = document.getElementById("stats-app");
    if (app) {
      app.innerHTML = `
        <div class="stats-empty-wrap">
          <div class="stats-surface stats-empty-card">
            <p class="stats-empty">No session data available yet.</p>
            <p class="stats-empty-hint">Play music with the overlay connected, then open this page again.</p>
            <a href="config.html" class="stats-empty-link">Open configurator</a>
          </div>
        </div>
      `;
    }
  } else {
    renderAll(tracks);
  }

  const exportBtn = document.getElementById("btn-export");
  const clearBtn = document.getElementById("btn-clear");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const sessionRaw = localStorage.getItem("nowify_session") || "[]";
      const blob = new Blob([sessionRaw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nowify-session.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const ok = window.confirm("Clear session data?");
      if (!ok) {
        return;
      }
      clearSession();
      window.location.reload();
    });
  }
}

function renderAll(tracks) {
  renderSummaryCards(tracks);
  renderBangerList(tracks);
  renderMoodChart(tracks);
  renderTopTracks(tracks);
}

/** Coerces stored JSON values (e.g. strings) to a finite number, or null. */
function finiteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function renderSummaryCards(tracks) {
  const container = document.getElementById("stats-summary");
  if (!container) {
    return;
  }

  const uniqueTracks = new Set(tracks.map((track) => track.trackId || "")).size;
  const bpmValues = tracks.map((t) => finiteNumber(t.bpm)).filter((v) => v !== null);
  const avgBpm = bpmValues.length
    ? Math.round(bpmValues.reduce((sum, v) => sum + v, 0) / bpmValues.length)
    : null;
  const bangerCount = tracks.filter((track) => track.isBanger === true).length;
  const energyValues = tracks
    .map((track) => finiteNumber(track.energy))
    .filter((value) => value !== null);
  const avgEnergyPct = energyValues.length
    ? Math.round(
        (energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length) * 100
      )
    : null;

  const cards = [
    { label: "Total tracks", value: String(tracks.length) },
    { label: "Unique tracks", value: String(uniqueTracks) },
    {
      label: "Average BPM",
      value: avgBpm !== null ? String(avgBpm) : "—",
      hint:
        "Needs Spotify on the overlay. Last.fm has no BPM. A 403 from Spotify also blocks this.",
    },
    { label: "Banger count", value: String(bangerCount) },
    {
      label: "Average energy",
      value: avgEnergyPct !== null ? `${avgEnergyPct}%` : "—",
      hint: "Same as BPM: from Spotify audio-features while the overlay is open.",
    },
  ];

  container.innerHTML = cards
    .map((card) => {
      const hintBlock =
        card.hint && card.value === "—"
          ? `<div class="stats-metric-hint">${esc(card.hint)}</div>`
          : "";
      return `
      <div class="stats-metric">
        <div class="stats-metric-label">${esc(card.label)}</div>
        <div class="stats-metric-value">${esc(card.value)}</div>
        ${hintBlock}
      </div>
    `;
    })
    .join("");
}

function renderBangerList(tracks) {
  const container = document.getElementById("stats-bangers-body");
  if (!container) {
    return;
  }

  const bangers = tracks.filter((track) => track.isBanger === true);

  if (!bangers.length) {
    container.innerHTML = '<p class="stats-inline-empty">No bangers detected this session.</p>';
    return;
  }

  container.innerHTML = bangers
    .map((track) => {
      const time = formatTime(track.playedAt);
      return `
        <div class="stats-banger-item">
          <img src="${esc(track.albumArt || "")}" class="stats-banger-art" alt="Album art" />
          <div class="stats-banger-info">
            <div class="stats-banger-title">${esc(track.title || "Unknown track")}</div>
            <div class="stats-banger-artist">${esc(track.artist || "Unknown artist")}</div>
          </div>
          <div class="stats-banger-time">${esc(time)}</div>
        </div>
      `;
    })
    .join("");
}

function renderMoodChart(tracks) {
  if (typeof Chart === "undefined") {
    console.warn("Nowify: Chart.js not loaded");
    return;
  }

  const canvas = document.getElementById("mood-chart");
  if (!canvas) {
    return;
  }

  const points = tracks
    .map((track) => {
      const e = finiteNumber(track.energy);
      const v = finiteNumber(track.valence);
      if (e === null || v === null) {
        return null;
      }
      return {
        x: e,
        y: v,
        label: truncate(track.title || "Untitled", 20),
        color: moodColor(e, v),
      };
    })
    .filter(Boolean);

  if (moodChart) {
    moodChart.destroy();
    moodChart = null;
  }

  moodChart = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Track mood",
          data: points,
          pointBackgroundColor: points.map((point) => point.color),
          pointBorderColor: points.map((point) => point.color),
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(22, 24, 30, 0.96)",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          titleColor: "#f3f4f7",
          bodyColor: "rgba(255, 255, 255, 0.72)",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label(context) {
              const label = context.raw?.label || "Track";
              return `${label} (E:${context.raw.x.toFixed(2)} V:${context.raw.y.toFixed(2)})`;
            },
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 1,
          title: {
            display: true,
            text: "Energy",
            color: "rgba(255, 255, 255, 0.45)",
          },
          grid: { color: "rgba(255, 255, 255, 0.06)" },
          ticks: { color: "rgba(255, 255, 255, 0.38)" },
          border: { color: "rgba(255, 255, 255, 0.08)" },
        },
        y: {
          min: 0,
          max: 1,
          title: {
            display: true,
            text: "Valence",
            color: "rgba(255, 255, 255, 0.45)",
          },
          grid: { color: "rgba(255, 255, 255, 0.06)" },
          ticks: { color: "rgba(255, 255, 255, 0.38)" },
          border: { color: "rgba(255, 255, 255, 0.08)" },
        },
      },
    },
  });
}

function renderTopTracks(tracks) {
  const container = document.getElementById("stats-top-body");
  if (!container) {
    return;
  }

  const counts = new Map();
  tracks.forEach((track) => {
    const key = track.trackId || `${track.title}::${track.artist}`;
    if (!counts.has(key)) {
      counts.set(key, { ...track, count: 0 });
    }
    counts.get(key).count += 1;
  });

  const top = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const rows = top
    .map(
      (track, index) => `
      <div class="stats-top-item">
        <span class="stats-top-rank">${index + 1}</span>
        <img src="${esc(track.albumArt || "")}" class="stats-top-art" alt="Album art" />
        <div class="stats-top-info">
          <div class="stats-top-title">${esc(track.title || "Unknown track")}</div>
          <div class="stats-top-artist">${esc(track.artist || "Unknown artist")}</div>
        </div>
        <span class="stats-top-count">${track.count}x</span>
      </div>
    `
    )
    .join("");

  container.innerHTML = rows || '<p class="stats-inline-empty">No tracks available.</p>';
}

function truncate(value, maxLen) {
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, maxLen - 1)}…`;
}

function moodColor(energy, valence) {
  if (energy > 0.7 && valence > 0.7) {
    return "#1DB954";
  }
  if (energy > 0.7 && valence < 0.4) {
    return "#ef5350";
  }
  if (energy < 0.4 && valence > 0.6) {
    return "#64b5f6";
  }
  if (energy < 0.4 && valence < 0.4) {
    return "#9575cd";
  }
  return "#888888";
}

function formatTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
