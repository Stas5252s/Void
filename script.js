/**
 * scroll.js — Scroll tracking + UI choreography
 * Runs in its own RAF loop. Feeds Scene3D.update(global) every frame.
 */
const ScrollCtrl = (() => {
  /* ── Elements ──────────────────────────────────────────────────── */
  const acts = document.querySelectorAll(".act");
  const hudFill = document.getElementById("hud-prog");
  const hudNum = document.getElementById("hud-act-num");
  const hudName = document.getElementById("hud-act-name");
  const hudBot = document.getElementById("hud-bot");

  const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  const NAMES = [
    "Genesis",
    "Expansion",
    "Pulse",
    "Fracture",
    "Warp",
    "Collapse",
    "Rebirth",
    "Infinite",
  ];

  /* ── Cursor ────────────────────────────────────────────────────── */
  const cur = document.createElement("div");
  cur.id = "cur";
  document.body.appendChild(cur);
  let cx = W() / 2,
    cy = H() / 2,
    scx = cx,
    scy = cy;
  function W() {
    return window.innerWidth;
  }
  function H() {
    return window.innerHeight;
  }
  document.addEventListener(
    "mousemove",
    (e) => {
      cx = e.clientX;
      cy = e.clientY;
    },
    { passive: true }
  );
  (function curLoop() {
    scx += (cx - scx) * 0.1;
    scy += (cy - scy) * 0.1;
    cur.style.transform = `translate(${scx - 3}px,${scy - 3}px)`;
    requestAnimationFrame(curLoop);
  })();

  /* ── Smooth scroll ─────────────────────────────────────────────── */
  let sm = 0,
    lastAct = -1;

  /* ── HUD flip ──────────────────────────────────────────────────── */
  function flipHud(i) {
    if (i === lastAct) return;
    lastAct = i;
    // Slide old out
    hudNum.style.cssText =
      "opacity:0;transform:translateY(-7px);transition:none";
    hudName.style.cssText =
      "opacity:0;transform:translateY(-5px);transition:none";
    setTimeout(() => {
      hudNum.textContent = ROMANS[i] || "";
      hudName.textContent = NAMES[i] || "";
      const tr =
        "opacity .55s cubic-bezier(.16,1,.3,1),transform .55s cubic-bezier(.16,1,.3,1)";
      hudNum.style.cssText = `opacity:1;transform:translateY(0);transition:${tr}`;
      hudName.style.cssText = `opacity:1;transform:translateY(0);transition:${tr};transition-delay:.06s`;
    }, 220);
  }

  /* ── Text reveals ──────────────────────────────────────────────── */
  function revealTexts() {
    const wh = window.innerHeight;
    acts.forEach((act) => {
      const r = act.getBoundingClientRect();
      const block = act.querySelector(".txt");
      if (!block) return;
      const inView = r.top < wh * 0.62 && r.bottom > wh * 0.28;
      block.classList.toggle("in", inView);
    });
  }

  /* ── Main tick ─────────────────────────────────────────────────── */
  function tick() {
    sm += (window.scrollY - sm) * 0.065; // silky smooth
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const g = Math.min(sm / docH, 1);

    // Progress bar height (vertical left bar)
    hudFill.style.height = g * 100 + "%";

    // Scroll hint
    if (sm > 80) hudBot.classList.add("gone");
    else hudBot.classList.remove("gone");

    // Which act is dominant
    const actF = g * 8,
      actI = Math.min(Math.floor(actF), 7);
    flipHud(actI);
    revealTexts();

    Scene3D.update(g);
    requestAnimationFrame(tick);
  }

  // Bootstrap
  hudNum.textContent = ROMANS[0];
  hudName.textContent = NAMES[0];
  hudNum.style.opacity = hudName.style.opacity = "1";
  tick();
})();
