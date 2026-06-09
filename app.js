// app.js — shared orchestrator / landing / routing (thin)
// Graph renderers live in graphs/gN/gN.js

// Okabe-Ito shared palette (used by G2/G4 controls chrome)
const OKABE_ITO = {
  blue: '#0072B2',
  orange: '#E69F00',
  sky: '#56B4E9',
  vermillion: '#D55E00',
  purple: '#CC79A7',
  green: '#009E73',
  yellow: '#F0E442',
  black: '#000000',
  muted: '#94a3b8',
  grey: '#999999'
};
const OKABE = OKABE_ITO;

// CS661 Group 10 — App Logic
// Gallery → Fullscreen Interactive Panel System
// ============================================================

// ─── Global State ──────────────────────────────────────────
const APP = {
  activeViz: null,
  year: 2015,
  region: "All",
  tier: "All",
  sort: "gain",            // Viz 4 dumbbell sort
  isPlaying: false,
  speed: 1200,
  indiaController: null,
  animTimer: null,
  selectedNode: null,      // Viz 5: clicked institution
  selectedCollab: null,    // Viz 4: pinned country/region row
  cleanupFns: []           // functions to call when closing viz
};

// ─── Tooltip ───────────────────────────────────────────────
const tip = document.createElement("div");
tip.className = "d3-tooltip";
document.body.appendChild(tip);

function showTip(evt, html) {
  tip.innerHTML = html;
  tip.classList.add("visible");
  moveTip(evt);
}
function moveTip(evt) {
  const x = evt.clientX, y = evt.clientY;
  const W = window.innerWidth, H = window.innerHeight;
  tip.style.left = (x + 14 < W - 280 ? x + 14 : x - 270) + "px";
  tip.style.top  = (y + 14 < H - 160 ? y + 14 : y - 140) + "px";
}
function hideTip() { tip.classList.remove("visible"); }

// ─── VIZ META ──────────────────────────────────────────────
const VIZ_META = {
  1: { title: "High-Dimensional Peer Clustering",             num: "01", credit: "World Bank (GDP, GERD, journal articles) · OpenAlex cohort H (pubs in year Y) · SCImago Documents fallback · UMAP — not SCImago stock H" },
  2: { title: "Global Quality Shift (Q1 vs Q4)",              num: "02", credit: "SCImago Journal Rank · Q1/Q4 by journal publisher country (uncapped ratio)" },
  3: { title: "Top Research topics",                          num: "03", credit: "OpenAlex concept-tagged works (retrospective taxonomy) · shared 1974 window · AI = Machine learning C119857082 · Quantum = C58053490 — see docs/G3_HISTORICAL_HONESTY.md" },
  4: { title: "The Collaboration Premium",                    num: "04", credit: "OpenAlex · domestic vs international cites · dumbbell · 73 countries × 2010–2024" },
  5: { title: "India Domestic Higher Education Network",      num: "05", credit: "NIRF India · ROR · SCImago" }
};

// ─── Preview Canvas Drawings ───────────────────────────────
// Landing card-previews are inline SVG from friend zip (verbatim).
window.addEventListener("load", () => {
  // Keep landing G4 country count in sync with live pool meta
  const g4CountEl = document.getElementById("g4-country-count");
  if (g4CountEl && typeof VIZ4_META !== "undefined" && VIZ4_META.n_countries) {
    g4CountEl.textContent = String(VIZ4_META.n_countries);
  }
  // No canvas thumb drawing — friend zip uses inline SVG + card-overlay.
});

function drawPreview1() {}
function drawPreview2() {}
function drawPreview3() {}
function drawPreview4() {}
function drawPreview5() {}

// ─── Particle Background ───────────────────────────────────
function spawnParticles() {
  // fig1: static dotted world-map watermark only (CSS on #hero-particles)
}

// ─── Open / Close Viz Panel ────────────────────────────────
window.openViz = async function(id) {
  APP.activeViz = id;
  APP.selectedNode = null;

  const panel = document.getElementById("viz-panel");
  const meta = VIZ_META[id];

  document.getElementById("panel-num").textContent  = meta.num;
  document.getElementById("panel-title").textContent = meta.title;
  document.getElementById("data-credit").textContent = "Data: " + meta.credit;

  showLoading("Loading visualization...");
  buildControls(id);

  APP.cleanupFns.forEach(fn => fn());
  APP.cleanupFns = [];
  const body = document.getElementById("panel-body");
  body.innerHTML = "";

  panel.classList.add("active");
  panel.dataset.viz = String(id);

  await sleep(250);
  if (id === 5) {
    try {
      await INDIA.ensureLoaded();
    } catch (err) {
      console.error("India network load failed:", err);
    }
  }
  if (id !== 1) {
    hideLoading();
  }
  renderViz(id);

  document.getElementById("prev-btn").disabled = (id === 1);
  document.getElementById("next-btn").disabled = (id === 5);
};

window.closeViz = function() {
  stopAnimation();
  APP.cleanupFns.forEach(fn => fn());
  APP.cleanupFns = [];
  APP.activeViz = null;
  APP.selectedNode = null;

  const panel = document.getElementById("viz-panel");
  panel.classList.remove("active");
  delete panel.dataset.viz;
};

window.navigateViz = function(dir) {
  const next = APP.activeViz + dir;
  if (next >= 1 && next <= 5) openViz(next);
};

// ─── Build Controls ────────────────────────────────────────
function buildControls(id) {
  const c = document.getElementById("panel-controls");
  c.innerHTML = "";



  if (id === 2) {
    const wrap = el("div", "year-slider-wrap");
    const yLabel = el("span", "ctrl-label", "Year:");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "ctrl-range";
    slider.min = 1999;
    slider.max = 2024;
    slider.value = APP.year >= 1999 && APP.year <= 2024 ? APP.year : 2024;
    APP.year = +slider.value;
    const yearVal = el("span", "year-val", APP.year);
    slider.oninput = () => {
      APP.year = +slider.value;
      yearVal.textContent = APP.year;
      renderViz(2);
    };
    wrap.append(yLabel, slider, yearVal);

    const playBtn = el("button", "ctrl-btn", "▶ Play");
    playBtn.id = "play-btn";
    playBtn.onclick = () => toggleAnimation(slider, yearVal, playBtn, 1999, 2024);

    // Speed buttons: 0.5x / 1x / 2x (interval = base / multiplier)
    // 1x base = 1200ms → 0.5x = 2400ms, 2x = 600ms
    const SPEED_OPTIONS = [
      { label: "0.5x", ms: 2400 },
      { label: "1x", ms: 1200 },
      { label: "2x", ms: 600 },
    ];
    if (![2400, 1200, 600].includes(APP.speed)) APP.speed = 1200;

    const speedBtns = SPEED_OPTIONS.map(({ label, ms }) => {
      const btn = el("button", "ctrl-btn" + (APP.speed === ms ? "" : " secondary"), label);
      btn.style.minWidth = "38px";
      btn.style.fontWeight = "800";
      // Uniform number style for all speeds (no per-speed cyan tint)
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.dataset.speedMs = String(ms);
      btn.onclick = () => {
        APP.speed = ms;
        speedBtns.forEach((b) => {
          const active = +b.dataset.speedMs === APP.speed;
          b.className = "ctrl-btn" + (active ? "" : " secondary");
          b.style.color = "";
          b.style.borderColor = "";
        });
      };
      return btn;
    });

    // Grouped / Stacked toggle switch matching system style
    const toggleWrap = el("div", "toggle-group");
    const optGrouped = el("button", "toggle-opt" + (barChartMode === "grouped" ? " on" : ""), "Grouped");
    const optStacked = el("button", "toggle-opt" + (barChartMode === "stacked" ? " on" : ""), "Stacked");
    optGrouped.onclick = () => { barChartMode = "grouped"; optGrouped.classList.add("on"); optStacked.classList.remove("on"); renderViz(2); };
    optStacked.onclick = () => { barChartMode = "stacked"; optStacked.classList.add("on"); optGrouped.classList.remove("on"); renderViz(2); };
    toggleWrap.append(optGrouped, optStacked);

    const divider1 = el("div", "ctrl-divider");

    const scaleWrap = el("div", "toggle-group");
    const optLinear = el("button", "toggle-opt" + (yAxisScaleMode === "linear" ? " on" : ""), "Linear");
    const optLog = el("button", "toggle-opt" + (yAxisScaleMode === "logarithmic" ? " on" : ""), "Logarithmic");
    optLinear.onclick = () => { yAxisScaleMode = "linear"; optLinear.classList.add("on"); optLog.classList.remove("on"); renderViz(2); };
    optLog.onclick = () => { yAxisScaleMode = "logarithmic"; optLog.classList.add("on"); optLinear.classList.remove("on"); renderViz(2); };
    scaleWrap.append(optLinear, optLog);

    const divider2 = el("div", "ctrl-divider");

    c.append(wrap, playBtn, ...speedBtns, divider1, toggleWrap, divider2, scaleWrap);
  }

  if (id === 4) {
    const yMin = (typeof VIZ4_META !== "undefined" && VIZ4_META.year_min) ? VIZ4_META.year_min : 2010;
    const yMax = (typeof VIZ4_META !== "undefined" && VIZ4_META.year_max) ? VIZ4_META.year_max : 2024;
    if (!(APP.year >= yMin && APP.year <= yMax)) APP.year = yMax;

    const wrap = el("div", "year-slider-wrap");
    const yLabel = el("span", "ctrl-label", "Year:");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "ctrl-range";
    slider.min = yMin;
    slider.max = yMax;
    slider.value = APP.year;
    const yearVal = el("span", "year-val", APP.year);
    slider.oninput = () => {
      APP.year = +slider.value;
      yearVal.textContent = APP.year;
      renderViz(4);
    };
    wrap.append(yLabel, slider, yearVal);

    const playBtn = el("button", "ctrl-btn", "▶ Play");
    playBtn.id = "play-btn";
    playBtn.onclick = () => toggleAnimation(slider, yearVal, playBtn, yMin, yMax);

    const sortSel = document.createElement("select");
    sortSel.className = "ctrl-select";
    sortSel.innerHTML = `
      <option value="gain">Sort: Citation Gain</option>
      <option value="international">Sort: Int'l Rate</option>
      <option value="domestic">Sort: Domestic Rate</option>
      <option value="name">Sort: Name</option>
    `;
    sortSel.value = APP.sort;
    sortSel.onchange = () => { APP.sort = sortSel.value; renderViz(4); };

    const regionSel = document.createElement("select");
    regionSel.id = "viz4-region-select";
    regionSel.className = "ctrl-select";
    regionSel.innerHTML = `
      <option value="All">All Regions</option>
      <option value="North America">North America</option>
      <option value="Europe">Europe</option>
      <option value="East Asia & Pacific">East Asia & Pacific</option>
      <option value="South Asia">South Asia</option>
      <option value="Latin America">Latin America</option>
      <option value="Middle East & Africa">Middle East & Africa</option>
      <option value="Oceania">Oceania</option>
    `;
    regionSel.value = APP.region || "All";
    regionSel.onchange = () => { APP.region = regionSel.value; renderViz(4); };

    const backBtn = el("button", "ctrl-btn", "← Regions");
    backBtn.title = "Clear region drill-down";
    backBtn.onclick = () => {
      APP.region = "All";
      APP.selectedCollab = null;
      regionSel.value = "All";
      renderViz(4);
    };

    c.append(
      wrap, playBtn,
      el("div", "ctrl-divider"),
      el("span","ctrl-label","Region:"), regionSel, backBtn,
      el("div", "ctrl-divider"),
      el("span","ctrl-label","Order By:"), sortSel
    );
  }

  if (id === 5) {
    const years = INDIA.availableYears ? INDIA.availableYears() : [2015, 2024];
    const yMin = Math.min(...years);
    const yMax = Math.max(...years);
    const wrap = el("div", "year-slider-wrap");
    const yLabel = el("span", "ctrl-label", "Year:");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "ctrl-range";
    slider.min = yMin;
    slider.max = yMax;
    slider.value = APP.year >= yMin && APP.year <= yMax ? APP.year : yMax;
    APP.year = +slider.value;
    const yearVal = el("span", "year-val", APP.year);
    slider.oninput = () => {
      APP.year = +slider.value;
      yearVal.textContent = APP.year;
      if (APP.indiaController?.setYear) {
        APP.indiaController.setYear(APP.year);
      }
    };
    wrap.append(yLabel, slider, yearVal);

    const playBtn = el("button", "ctrl-btn", "▶ Play");
    playBtn.id = "play-btn";
    playBtn.onclick = () => toggleAnimation(slider, yearVal, playBtn, yMin, yMax);

    const divider = el("div", "ctrl-divider");

    const tierSel = document.createElement("select");
    tierSel.className = "ctrl-select";
    tierSel.innerHTML = `
      <option value="All">All Tiers</option>
      <option value="premier">Premier (IITs, IISc, ...)</option>
      <option value="state_affiliated">State & Affiliated</option>
    `;
    tierSel.value = APP.tier;
    tierSel.onchange = () => {
      APP.tier = tierSel.value;
      if (APP.indiaController?.setTier) {
        APP.indiaController.setTier(APP.tier);
      } else {
        renderViz(5);
      }
    };

    c.append(wrap, playBtn, divider, el("span", "ctrl-label", "Tier:"), tierSel);
  }
}

// ─── Render Dispatcher ────────────────────────────────────
function renderViz(id) {
  const body = document.getElementById("panel-body");
  body.innerHTML = "";
  if (id === 1) renderViz1(body);
  if (id === 2) renderViz2(body);
  if (id === 3) renderViz3(body);
  if (id === 4) renderViz4(body);
  if (id === 5) renderViz5(body);
}

// ══════════════════════════════════════════════════════════

function toggleAnimation(slider, yearVal, btn, yearMin, yearMax) {
  const yMin = yearMin ?? 2010;
  const yMax = yearMax ?? 2025;
  if (!APP.isPlaying) {
    APP.isPlaying = true;
    btn.textContent = "⏸ Pause";

    const runStep = async () => {
      if (!APP.isPlaying) return;
      if (APP.year >= yMax) {
        stopAnimation();
        return;
      }
      APP.year += 1;
      slider.value = APP.year;
      yearVal.textContent = APP.year;
      if (APP.activeViz === 5 && APP.indiaController?.setYear) {
        await APP.indiaController.setYear(APP.year);
      } else {
        renderViz(APP.activeViz);
      }
      if (APP.isPlaying && APP.year < yMax) {
        APP.animTimer = setTimeout(runStep, APP.speed);
      } else if (APP.year >= yMax) {
        stopAnimation();
      }
    };

    if (APP.year >= yMax) {
      APP.year = yMin - 1;
    }
    APP.animTimer = setTimeout(runStep, 100);
    APP.cleanupFns.push(() => stopAnimation());
  } else {
    btn.textContent = "▶ Play";
    stopAnimation();
  }
}

function stopAnimation() {
  APP.isPlaying = false;
  if (APP.animTimer) { clearTimeout(APP.animTimer); APP.animTimer = null; }
  const btn = document.getElementById("play-btn");
  if (btn) btn.textContent = "▶ Play";
}

// ─── Utility helpers ──────────────────────────────────────
function el(tag, cls, content) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (typeof content === "string" || typeof content === "number") e.textContent = String(content);
  else if (Array.isArray(content)) content.forEach(c => e.appendChild(c));
  return e;
}

function div(cls) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showLoading(msg) {
  document.getElementById("loading-text").textContent = msg;
  document.getElementById("loading-screen").classList.add("active");
}
function hideLoading() {
  document.getElementById("loading-screen").classList.remove("active");
}

window.addEventListener("resize", () => {
  if (APP.activeViz === 5 && APP.indiaController?.resize) {
    APP.indiaController.resize();
    return;
  }
  if (APP.activeViz) renderViz(APP.activeViz);
});
