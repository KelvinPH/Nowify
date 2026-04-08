function renderLanding() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0c0f;color:#f3f4f7;font-family:-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif;">
      <section style="width:min(720px,100%);background:#101216;border:0.5px solid rgba(255,255,255,0.14);border-radius:14px;padding:28px;">
        <img src="assets/logo/logo.png" alt="Nowify" style="height:34px;width:auto;display:block;margin-bottom:14px;" />
        <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);margin-bottom:18px;">
          Real-time music overlays for OBS, Streamlabs, and StreamElements.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="config.html" style="background:#d2d7e0;color:#0b0d10;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;">Open Configurator</a>
          <a href="overlay.html" style="background:#171a20;color:#f3f4f7;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;border:0.5px solid rgba(255,255,255,0.14);">Open Overlay</a>
          <a href="stats.html" style="background:#171a20;color:#f3f4f7;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;border:0.5px solid rgba(255,255,255,0.14);">Open Stats</a>
          <a href="https://github.com/KelvinPH/Nowify" target="_blank" rel="noopener noreferrer" style="background:#171a20;color:#f3f4f7;text-decoration:none;padding:10px 14px;border-radius:10px;font-size:13px;border:0.5px solid rgba(255,255,255,0.14);">GitHub</a>
        </div>
      </section>
    </main>
  `;
}

export function init() {
  if (window.location.pathname.endsWith("overlay.html")) {
    import("./overlay/renderer.js").then(({ init }) => init());
    return;
  }
  renderLanding();
}

init();
