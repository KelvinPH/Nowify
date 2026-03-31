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
      app.innerHTML = '<p class="st-empty">No session data available yet.</p>';
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

function renderSummaryCards(tracks) {
  const container = document.getElementById("stats-summary");
  if (!container) {
    return;
  }

  const uniqueTracks = new Set(tracks.map((track) => track.trackId || "")).size;
  const bpmValues = tracks.map((t) => t.bpm).filter((v) => typeof v === "number");
  const avgBpm = bpmValues.length
    ? Math.round(bpmValues.reduce((sum, v) => sum + v, 0) / bpmValues.length)
    : 0;
  const bangerCount = tracks.filter((track) => track.isBanger === true).length;
  const energyValues = tracks
    .map((track) => track.energy)
    .filter((value) => typeof value === "number");
  const avgEnergyPct = energyValues.length
    ? Math.round(
        (energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length) * 100
      )
    : 0;

  const cards = [
    { label: "Total tracks", value: String(tracks.length) },
    { label: "Unique tracks", value: String(uniqueTracks) },
    { label: "Average BPM", value: String(avgBpm) },
    { label: "Banger count", value: String(bangerCount) },
    { label: "Average energy", value: `${avgEnergyPct}%` },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
      <div class="st-card">
        <div class="st-card-label">${esc(card.label)}</div>
        <div class="st-card-value">${esc(card.value)}</div>
      </div>
    `
    )
    .join("");
}

function renderBangerList(tracks) {
  const container = document.getElementById("stats-bangers");
  if (!container) {
    return;
  }

  const title = '<h2 class="st-section-title">Banger moments</h2>';
  const bangers = tracks.filter((track) => track.isBanger === true);

  if (!bangers.length) {
    container.innerHTML = `${title}<p class="st-empty">No bangers detected this session.</p>`;
    return;
  }

  const listHtml = bangers
    .map((track) => {
      const time = formatTime(track.playedAt);
      return `
        <div class="st-banger-item">
          <img src="${esc(track.albumArt || "")}" class="st-banger-art" alt="Album art" />
          <div class="st-banger-info">
            <div class="st-banger-title">${esc(track.title || "Unknown track")}</div>
            <div class="st-banger-artist">${esc(track.artist || "Unknown artist")}</div>
          </div>
          <div class="st-banger-time">${esc(time)}</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `${title}${listHtml}`;
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
    .filter(
      (track) => typeof track.energy === "number" && typeof track.valence === "number"
    )
    .map((track) => ({
      x: track.energy,
      y: track.valence,
      label: truncate(track.title || "Untitled", 20),
      color: moodColor(track.energy, track.valence),
    }));

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
          callbacks: {
            label(context) {
              const label = context.raw?.label || "Track";
              return `${label} (E:${context.raw.x.toFixed(2)} V:${context.raw.y.toFixed(2)})`;
            },
          },
        },
      },
      scales: {
        x: { min: 0, max: 1, title: { display: true, text: "Energy" } },
        y: { min: 0, max: 1, title: { display: true, text: "Valence" } },
      },
    },
  });
}

function renderTopTracks(tracks) {
  const container = document.getElementById("stats-top");
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

  const title = '<h2 class="st-section-title">Top tracks</h2>';
  const rows = top
    .map(
      (track, index) => `
      <div class="st-top-item">
        <span class="st-top-rank">${index + 1}</span>
        <img src="${esc(track.albumArt || "")}" class="st-top-art" alt="Album art" />
        <div class="st-top-info">
          <div class="st-top-title">${esc(track.title || "Unknown track")}</div>
          <div class="st-top-artist">${esc(track.artist || "Unknown artist")}</div>
        </div>
        <span class="st-top-count">${track.count}x</span>
      </div>
    `
    )
    .join("");

  container.innerHTML = `${title}${rows || '<p class="st-empty">No tracks available.</p>'}`;
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
