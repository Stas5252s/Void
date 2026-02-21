/**
 * loader.js — Cinematic loader
 * Draws particle ring + starfield on 2D canvas while Three.js warms up.
 * Calls window.LOADER_READY() when scene signals it's compiled.
 */
const Loader = (() => {
  const el = document.getElementById("loader");
  const fill = document.getElementById("loader-fill");
  const num = document.getElementById("loader-n");
  const lc = document.getElementById("lc");
  const ctx = lc.getContext("2d");

  let W = (lc.width = window.innerWidth);
  let H = (lc.height = window.innerHeight);
  window.addEventListener("resize", () => {
    W = lc.width = window.innerWidth;
    H = lc.height = window.innerHeight;
  });

  // Particle ring
  const RING = Array.from({ length: 140 }, (_, i) => ({
    angle: (i / 140) * Math.PI * 2,
    r: 100 + (Math.random() - 0.5) * 50,
    spd: 0.003 + (Math.random() - 0.5) * 0.0015,
    size: Math.random() * 1.6 + 0.4,
    op: Math.random() * 0.55 + 0.2,
    trail: [],
  }));

  // Stars
  const STARS = Array.from({ length: 320 }, () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    r: Math.random() * 1.1 + 0.2,
    op: Math.random() * 0.35 + 0.05,
    tw: Math.random() * Math.PI * 2,
    ts: Math.random() * 0.035 + 0.008,
  }));

  let t = 0,
    prog = 0,
    ready = false,
    done = false,
    raf;

  window.LOADER_READY = () => {
    ready = true;
  };

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2,
      cy = H / 2;

    // Stars
    STARS.forEach((s) => {
      s.tw += s.ts;
      const a = s.op * (0.5 + Math.sin(s.tw) * 0.5);
      ctx.beginPath();
      ctx.arc(cx + s.x * W * 0.55, cy + s.y * H * 0.55, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,200,185,${a})`;
      ctx.fill();
    });

    // Outer halo
    const g2 = ctx.createRadialGradient(cx, cy, 70, cx, cy, 170);
    g2.addColorStop(0, "rgba(201,165,90,0)");
    g2.addColorStop(0.5, "rgba(201,165,90,0.035)");
    g2.addColorStop(1, "rgba(201,165,90,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 170, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();

    // Ring particles + trails
    RING.forEach((p) => {
      p.angle += p.spd;
      const px = cx + Math.cos(p.angle) * p.r,
        py = cy + Math.sin(p.angle) * p.r;
      p.trail.push({ x: px, y: py });
      if (p.trail.length > 14) p.trail.shift();
      for (let j = 1; j < p.trail.length; j++) {
        const ta = (j / p.trail.length) * p.op * 0.45;
        ctx.beginPath();
        ctx.moveTo(p.trail[j - 1].x, p.trail[j - 1].y);
        ctx.lineTo(p.trail[j].x, p.trail[j].y);
        ctx.strokeStyle = `rgba(201,165,90,${ta})`;
        ctx.lineWidth = p.size * 0.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(215,185,120,${p.op})`;
      ctx.fill();
    });

    // Pulse dot
    const pulse = Math.sin(t * 2.8) * 0.5 + 0.5;
    const dr = 3 + pulse * 5;
    const gd = ctx.createRadialGradient(cx, cy, 0, cx, cy, dr * 3.5);
    gd.addColorStop(0, `rgba(201,165,90,${0.85 + pulse * 0.15})`);
    gd.addColorStop(1, "rgba(201,165,90,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, dr * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = gd;
    ctx.fill();
    t += 0.016;
  }

  function step() {
    draw();
    if (!done) {
      // Organic speed: fast→slow→burst
      const spd =
        prog < 35
          ? 1.6
          : prog < 65
          ? 0.85
          : prog < 88
          ? 0.3
          : ready
          ? 2.2
          : 0.06;
      prog = Math.min(prog + spd * (Math.random() * 0.5 + 0.75), 100);
      fill.style.width = prog + "%";
      num.textContent = Math.floor(prog) + "%";
      if (prog >= 100 && ready) {
        done = true;
        setTimeout(() => {
          el.classList.add("out");
          setTimeout(() => el.remove(), 1500);
        }, 350);
      }
    }
    raf = requestAnimationFrame(step);
    if (done && !el.isConnected) cancelAnimationFrame(raf);
  }
  step();
})();
