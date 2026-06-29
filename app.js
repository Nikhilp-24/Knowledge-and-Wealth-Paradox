// ============================================================
// CS661 Group 10 — App Logic
// Gallery → Fullscreen Interactive Panel System
// ============================================================

// ─── Global State ──────────────────────────────────────────
const APP = {
  activeViz: null,
  year: 2015,
  region: "All",
  tier: "All",
  pppMode: false,          // Viz 2: toggle nominal vs PPP
  quadrant: "All",         // Viz 3: selected quadrant
  sort: "gain",            // Viz 4 dumbbell sort
  isPlaying: false,
  speed: 900,
  animTimer: null,
  selectedNode: null,      // Viz 5: clicked institution
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
  1: { title: "The Wealth-to-R&D Pipeline",               num: "01", credit: "World Bank API · UNESCO UIS GERD Indicators" },
  2: { title: "The Economic Reality Check (Nominal vs PPP)", num: "02", credit: "World Bank API · IMF PPP Conversion Factors" },
  3: { title: "Efficiency Anomalies & Systemic Exceptions", num: "03", credit: "SCImago Journal & Country Rank · World Bank API" },
  4: { title: "Publish-or-Perish Paradox & Research Topics",num: "04", credit: "SCImago SJR · SCOPUS Field-Level Data" },
  5: { title: "India's Deep-Dive: Structural Asymmetry",   num: "05", credit: "NIRF India · THE Rankings · World Bank API" }
};

// ─── Preview Canvas Drawings ───────────────────────────────
window.addEventListener("load", () => {
  drawPreview1(); drawPreview2(); drawPreview3(); drawPreview4(); drawPreview5();
  spawnParticles();
});

function drawPreview1() {
  const c = document.getElementById("preview-1");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  // Mini world-map-like choropleth preview (abstract)
  const rects = [
    {x:0.05,y:0.2,w:0.22,h:0.25,alpha:0.45},{x:0.30,y:0.15,w:0.35,h:0.30,alpha:0.65},
    {x:0.68,y:0.18,w:0.14,h:0.22,alpha:0.55},{x:0.05,y:0.55,w:0.38,h:0.30,alpha:0.30},
    {x:0.47,y:0.52,w:0.25,h:0.28,alpha:0.70},{x:0.75,y:0.50,w:0.18,h:0.25,alpha:0.50}
  ];
  rects.forEach(r => {
    const grd = ctx.createLinearGradient(r.x*w, 0, (r.x+r.w)*w, 0);
    grd.addColorStop(0, `rgba(99,102,241,${r.alpha})`);
    grd.addColorStop(1, `rgba(168,85,247,${r.alpha*0.6})`);
    ctx.fillStyle = grd;
    ctx.fillRect(r.x*w+2, r.y*h+2, r.w*w-4, r.h*h-4);
  });
}

function drawPreview2() {
  const c = document.getElementById("preview-2");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  const bubbles = [
    {x:0.18,y:0.35,r:30,col:"rgba(168,85,247,0.7)"},{x:0.50,y:0.25,r:50,col:"rgba(99,102,241,0.7)"},
    {x:0.75,y:0.45,r:22,col:"rgba(34,211,238,0.6)"},{x:0.35,y:0.65,r:38,col:"rgba(251,191,36,0.6)"},
    {x:0.65,y:0.68,r:18,col:"rgba(251,113,133,0.6)"},{x:0.85,y:0.25,r:14,col:"rgba(52,211,153,0.6)"}
  ];
  bubbles.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x*w, b.y*h, b.r, 0, Math.PI*2);
    ctx.fillStyle = b.col; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.stroke();
  });
}

function drawPreview3() {
  const c = document.getElementById("preview-3");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  // Draw quadrant lines
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(w/2,0); ctx.lineTo(w/2,h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke();
  ctx.setLineDash([]);
  // Scatter points in quadrants
  const pts = [
    {x:0.72,y:0.22,r:6,col:"rgba(52,211,153,0.9)"},{x:0.80,y:0.30,r:4,col:"rgba(52,211,153,0.8)"},
    {x:0.20,y:0.75,r:5,col:"rgba(239,68,68,0.9)"},  {x:0.30,y:0.68,r:4,col:"rgba(239,68,68,0.8)"},
    {x:0.55,y:0.50,r:3,col:"rgba(99,102,241,0.7)"},{x:0.60,y:0.45,r:4,col:"rgba(99,102,241,0.7)"},
    {x:0.15,y:0.30,r:3,col:"rgba(251,191,36,0.7)"},{x:0.80,y:0.70,r:3,col:"rgba(251,191,36,0.7)"}
  ];
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x*w, p.y*h, p.r, 0, Math.PI*2);
    ctx.fillStyle = p.col; ctx.fill();
  });
}

function drawPreview4() {
  const c = document.getElementById("preview-4");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  const bars = [0.9,0.75,0.65,0.55,0.48,0.42,0.37,0.30];
  const colors = ["#6366f1","#7c3aed","#8b5cf6","#a78bfa","#4f46e5","#818cf8","#6d28d9","#c4b5fd"];
  bars.forEach((bw, i) => {
    const bh = 20, by = 15 + i * 25;
    const grd = ctx.createLinearGradient(0, 0, bw*w*0.85, 0);
    grd.addColorStop(0, colors[i]); grd.addColorStop(1, colors[i]+"55");
    ctx.fillStyle = grd;
    ctx.fillRect(20, by, bw*(w-40), bh);
  });
}

function drawPreview5() {
  const c = document.getElementById("preview-5");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  // Indian subcontinent outline (rough)
  const outline = [
    [0.38,0.05],[0.55,0.03],[0.72,0.15],[0.78,0.28],[0.65,0.55],
    [0.55,0.75],[0.48,0.92],[0.42,0.75],[0.30,0.55],[0.22,0.35],[0.28,0.15],[0.38,0.05]
  ];
  ctx.beginPath();
  outline.forEach(([px,py], i) => i===0 ? ctx.moveTo(px*w, py*h) : ctx.lineTo(px*w, py*h));
  ctx.closePath();
  ctx.fillStyle = "rgba(245,158,11,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(245,158,11,0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3,3]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Nodes
  const nodes = [
    {px:0.45,py:0.32,r:6,col:"#34d399"},{px:0.40,py:0.20,r:5,col:"#34d399"},
    {px:0.48,py:0.50,r:7,col:"#60a5fa"},{px:0.55,py:0.40,r:4,col:"#60a5fa"},
    {px:0.50,py:0.72,r:5,col:"#fbbf24"},{px:0.42,py:0.60,r:4,col:"#fbbf24"}
  ];
  // Lines between nodes
  ctx.strokeStyle = "rgba(168,85,247,0.3)";
  ctx.lineWidth = 1;
  for(let i=0;i<nodes.length-1;i++) {
    ctx.beginPath();
    ctx.moveTo(nodes[i].px*w, nodes[i].py*h);
    ctx.lineTo(nodes[i+1].px*w, nodes[i+1].py*h);
    ctx.stroke();
  }
  nodes.forEach(n => {
    ctx.beginPath(); ctx.arc(n.px*w, n.py*h, n.r, 0, Math.PI*2);
    ctx.fillStyle = n.col; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.stroke();
  });
}

// ─── Particle Background ───────────────────────────────────
function spawnParticles() {
  const container = document.getElementById("hero-particles");
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = 2 + Math.random() * 4;
    const col = ["#6366f1","#a855f7","#22d3ee","#34d399"][Math.floor(Math.random()*4)];
    Object.assign(p.style, {
      width: size + "px", height: size + "px",
      left: (Math.random() * 100) + "%",
      background: col,
      animationDuration: (8 + Math.random() * 14) + "s",
      animationDelay: (Math.random() * 12) + "s"
    });
    container.appendChild(p);
  }
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

  // Show loading briefly while building controls + rendering
  showLoading("Loading visualization...");

  // Build controls for this viz
  buildControls(id);

  // Clear previous body & cleanup
  APP.cleanupFns.forEach(fn => fn());
  APP.cleanupFns = [];
  const body = document.getElementById("panel-body");
  body.innerHTML = "";

  // Show panel immediately
  panel.classList.add("active");

  // Wait for panel to be visible and have dimensions, then render
  await sleep(250);
  hideLoading();
  renderViz(id);

  // Nav buttons
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
};

window.navigateViz = function(dir) {
  const next = APP.activeViz + dir;
  if (next >= 1 && next <= 5) openViz(next);
};

// ─── Build Controls ────────────────────────────────────────
function buildControls(id) {
  const c = document.getElementById("panel-controls");
  c.innerHTML = "";

  if ([1,2,3].includes(id)) {
    // Year slider
    const wrap = el("div","year-slider-wrap");
    const yLabel = el("span","ctrl-label","Year:");
    const slider = document.createElement("input");
    slider.type = "range"; slider.className = "ctrl-range";
    slider.min = 2010; slider.max = 2025; slider.value = APP.year;
    const yearVal = el("span","year-val", APP.year);
    slider.oninput = () => { APP.year = +slider.value; yearVal.textContent = APP.year; renderViz(APP.activeViz); };
    wrap.append(yLabel, slider, yearVal);

    const playBtn = el("button","ctrl-btn","▶ Play");
    playBtn.id = "play-btn";
    playBtn.onclick = () => toggleAnimation(slider, yearVal, playBtn);

    const divider = el("div","ctrl-divider");
    c.append(wrap, playBtn, divider);
  }

  if (id === 1) {
    const regSel = document.createElement("select");
    regSel.className = "ctrl-select";
    regSel.innerHTML = `<option value="All">All Regions</option>` +
      Object.keys(DATA.REGIONS).map(r => `<option value="${r}">${r}</option>`).join("");
    regSel.value = APP.region;
    regSel.onchange = () => { APP.region = regSel.value; renderViz(1); };
    c.append(el("span","ctrl-label","Region:"), regSel);
  }

  if (id === 2) {
    const toggle = el("div","toggle-group");
    const nomBtn = el("button","toggle-opt" + (!APP.pppMode ? " on":""), "Nominal GDP");
    const pppBtn = el("button","toggle-opt" + (APP.pppMode  ? " on":""), "PPP Adjusted");
    nomBtn.onclick = () => { APP.pppMode = false; nomBtn.classList.add("on"); pppBtn.classList.remove("on"); renderViz(2); };
    pppBtn.onclick = () => { APP.pppMode = true;  pppBtn.classList.add("on"); nomBtn.classList.remove("on"); renderViz(2); };
    toggle.append(nomBtn, pppBtn);
    c.append(el("span","ctrl-label","X-Axis:"), toggle);
  }

  if (id === 3) {
    const qSel = document.createElement("select");
    qSel.className = "ctrl-select";
    qSel.innerHTML = `
      <option value="All">All Quadrants</option>
      <option value="stars">Stars (High spend, High quality)</option>
      <option value="efficient">Efficient (Low spend, High quality)</option>
      <option value="overinvested">Over-invested (High spend, Low quality)</option>
      <option value="laggards">Laggards (Low spend, Low quality)</option>
    `;
    qSel.onchange = () => { APP.quadrant = qSel.value; renderViz(3); };
    c.append(el("span","ctrl-label","Highlight:"), qSel);
  }

  if (id === 4) {
    const yLabel = el("span","ctrl-label","Year:");
    const slider = document.createElement("input");
    slider.type = "range"; slider.className = "ctrl-range";
    slider.min = 2010; slider.max = 2025; slider.value = APP.year;
    const yearVal = el("span","year-val", APP.year);
    slider.oninput = () => { APP.year = +slider.value; yearVal.textContent = APP.year; renderViz(4); };

    const playBtn = el("button","ctrl-btn","▶ Play");
    playBtn.id = "play-btn";
    playBtn.onclick = () => toggleAnimation(slider, yearVal, playBtn);

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

    c.append(el("div","year-slider-wrap", [yLabel, slider, yearVal]), playBtn, el("div","ctrl-divider"), sortSel);
  }

  if (id === 5) {
    const tierSel = document.createElement("select");
    tierSel.className = "ctrl-select";
    tierSel.innerHTML = `
      <option value="All">All Tiers</option>
      <option value="Premier">Premier (IITs, IISc)</option>
      <option value="Central / State">Central / State</option>
      <option value="Affiliated / Private">Affiliated / Private</option>
    `;
    tierSel.value = APP.tier;
    tierSel.onchange = () => { APP.tier = tierSel.value; renderViz(5); };

    const yLabel = el("span","ctrl-label","Year:");
    const slider = document.createElement("input");
    slider.type = "range"; slider.className = "ctrl-range";
    slider.min = 2010; slider.max = 2025; slider.value = APP.year;
    const yearVal = el("span","year-val", APP.year);
    slider.oninput = () => { APP.year = +slider.value; yearVal.textContent = APP.year; renderViz(5); };

    c.append(el("span","ctrl-label","Tier:"), tierSel, el("div","ctrl-divider"), yLabel, slider, yearVal);
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
// VIZ 1: Choropleth World Map + R&D Sector Bar
// ══════════════════════════════════════════════════════════
function renderViz1(body) {
  const layout = div("split-layout");
  const mapPane = div("split-pane");
  const barPane = div("split-pane");
  layout.append(mapPane, barPane);
  body.appendChild(layout);

  const countries = DATA.getCountriesForYear(APP.year)
    .filter(c => APP.region === "All" || c.region === APP.region);

  // ── Left: t-SNE Cluster (proxy for choropleth since we have no topo-json) ──
  const W1 = mapPane.offsetWidth || 600, H = body.offsetHeight || 500;
  const m = { top: 40, right: 20, bottom: 50, left: 50 };

  const svg1 = d3.select(mapPane).append("svg").attr("width", W1).attr("height", H);

  const xSc = d3.scaleLinear()
    .domain(d3.extent(countries, d => d.gdp)).nice()
    .range([m.left, W1 - m.right]);

  const ySc = d3.scaleLinear()
    .domain(d3.extent(countries, d => d.rdPct)).nice()
    .range([H - m.bottom, m.top]);

  const rSc = d3.scaleSqrt()
    .domain([0, d3.max(countries, d => d.publications)])
    .range([5, 32]);

  // Grid
  svg1.append("g").call(g => g
    .attr("transform", `translate(0,${H-m.bottom})`)
    .call(d3.axisBottom(xSc).tickSize(-(H-m.top-m.bottom)).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke","rgba(255,255,255,0.05)").attr("stroke-dasharray","2,2")));

  svg1.append("g").call(g => g
    .attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(ySc).tickSize(-(W1-m.left-m.right)).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke","rgba(255,255,255,0.05)").attr("stroke-dasharray","2,2")));

  // Axes
  svg1.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(xSc).ticks(5).tickFormat(d=>d3.format("$.2s")(d*1e9)+""));
  svg1.append("g").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(ySc).ticks(5).tickFormat(d=>d+"%"));

  // Labels
  svg1.append("text").attr("x",W1/2).attr("y",H-8).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text(`GDP (${APP.year}, USD Billion)`);
  svg1.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",15).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text("R&D % of GDP");
  svg1.append("text").attr("x",W1/2).attr("y",22).attr("text-anchor","middle").attr("fill","#e2e8f0").attr("font-size","13").attr("font-weight","700").text(`R&D Investment vs. National Wealth (${APP.year})`);

  // Bubbles
  svg1.selectAll("circle")
    .data(countries)
    .join("circle")
    .attr("cx", d => xSc(d.gdp))
    .attr("cy", d => ySc(d.rdPct))
    .attr("r",  d => rSc(d.publications))
    .attr("fill", d => DATA.REGIONS[d.region] + "bb")
    .attr("stroke", d => DATA.REGIONS[d.region])
    .attr("stroke-width", 1.5)
    .on("mouseover", (e, d) => showTip(e, `<strong>${d.name}</strong>GDP: $${d.gdp.toLocaleString()}B<br>R&D: ${d.rdPct}% of GDP<br>Publications: ${d.publications.toLocaleString()}<br>h-index: ${d.hIndex}`))
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip)
    .on("click", (e, d) => renderSectorBars(barPane, d, body.offsetHeight || 500));

  // Country labels for smaller set
  if (countries.length <= 8) {
    svg1.selectAll(".lbl").data(countries).join("text")
      .attr("class","lbl")
      .attr("x", d => xSc(d.gdp))
      .attr("y", d => ySc(d.rdPct) - rSc(d.publications) - 4)
      .attr("text-anchor","middle")
      .attr("fill","#e2e8f0")
      .attr("font-size","9")
      .text(d => d.name);
  }

  // Legend
  const leg = svg1.append("g").attr("transform",`translate(${W1-140},${m.top})`);
  let ly = 0;
  Object.entries(DATA.REGIONS).forEach(([r,col]) => {
    leg.append("circle").attr("cx",6).attr("cy",ly+5).attr("r",5).attr("fill",col);
    leg.append("text").attr("x",15).attr("y",ly+9).attr("fill","#94a3b8").attr("font-size","9").text(r);
    ly += 18;
  });

  // ── Right: Sector bar (default: top country) ──
  const topCountry = countries.reduce((a,b) => b.publications > a.publications ? b : a, countries[0]);
  renderSectorBars(barPane, topCountry, body.offsetHeight || 500);
}

function renderSectorBars(pane, country, H) {
  d3.select(pane).selectAll("*").remove();
  const W = pane.offsetWidth || 300;
  const m = { top: 55, right: 30, bottom: 50, left: 100 };
  const svg = d3.select(pane).append("svg").attr("width",W).attr("height",H);

  svg.append("text").attr("x",W/2).attr("y",25).attr("text-anchor","middle")
    .attr("fill","#e2e8f0").attr("font-size","13").attr("font-weight","700")
    .text(`R&D Sector Breakdown — ${country.name}`);
  svg.append("text").attr("x",W/2).attr("y",42).attr("text-anchor","middle")
    .attr("fill","#94a3b8").attr("font-size","10")
    .text(`Total R&D: $${(country.rdAbs).toLocaleString()}B (${country.rdPct}% of GDP)`);

  const sectors = [
    { label: "Business Enterprise", val: country.sectors.business, col: "#6366f1" },
    { label: "Higher Education",    val: country.sectors.higher,   col: "#22d3ee" },
    { label: "Government Labs",     val: country.sectors.gov,      col: "#a855f7" },
    { label: "Other",               val: country.sectors.other,    col: "#34d399" }
  ];

  const xSc = d3.scaleLinear().domain([0,1]).range([m.left, W-m.right]);
  const ySc = d3.scaleBand().domain(sectors.map(s=>s.label)).range([m.top, H-m.bottom]).padding(0.35);

  svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(xSc).tickFormat(d3.format(".0%")).ticks(4));
  svg.append("g").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(ySc));

  svg.selectAll("rect").data(sectors).join("rect")
    .attr("y",  d => ySc(d.label))
    .attr("x", xSc(0))
    .attr("width",  d => xSc(d.val) - xSc(0))
    .attr("height", ySc.bandwidth())
    .attr("fill", d => d.col)
    .attr("rx", 4)
    .attr("opacity", 0.85);

  svg.selectAll(".pct-lbl").data(sectors).join("text")
    .attr("class","pct-lbl")
    .attr("x", d => xSc(d.val) + 6)
    .attr("y", d => ySc(d.label) + ySc.bandwidth()/2 + 4)
    .attr("fill","#e2e8f0")
    .attr("font-size","11")
    .attr("font-weight","600")
    .text(d => d3.format(".0%")(d.val));
}

// ══════════════════════════════════════════════════════════
// VIZ 2: Bubble Chart — Nominal vs PPP Toggle
// ══════════════════════════════════════════════════════════
function renderViz2(body) {
  const countries = DATA.getCountriesForYear(APP.year);
  const W = body.offsetWidth || 900, H = body.offsetHeight || 500;
  const m = { top: 50, right: 40, bottom: 60, left: 80 };

  const svg = d3.select(body).append("svg").attr("width",W).attr("height",H);

  const xField = APP.pppMode ? "ppp" : "gdp";
  const xLabel = APP.pppMode ? "PPP-Adjusted Per Capita Income (USD)" : "Nominal GDP (USD Billion)";

  const xSc = d3.scaleLinear()
    .domain(d3.extent(countries, d => d[xField])).nice()
    .range([m.left, W-m.right]);

  const ySc = d3.scaleLinear()
    .domain([0, d3.max(countries, d => d.citPerDoc) * 1.15]).nice()
    .range([H-m.bottom, m.top]);

  const rSc = d3.scaleSqrt()
    .domain([0, d3.max(countries, d => d.publications)])
    .range([4, 36]);

  // Grid
  svg.append("g").attr("transform",`translate(0,${H-m.bottom})`)
    .call(d3.axisBottom(xSc).tickSize(-(H-m.top-m.bottom)).tickFormat(""))
    .call(g=>g.select(".domain").remove())
    .call(g=>g.selectAll("line").attr("stroke","rgba(255,255,255,0.05)").attr("stroke-dasharray","2,3"));

  svg.append("g").attr("transform",`translate(${m.left},0)`)
    .call(d3.axisLeft(ySc).tickSize(-(W-m.left-m.right)).tickFormat(""))
    .call(g=>g.select(".domain").remove())
    .call(g=>g.selectAll("line").attr("stroke","rgba(255,255,255,0.05)").attr("stroke-dasharray","2,3"));

  svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(xSc).ticks(6).tickFormat(d=>APP.pppMode?d3.format("$,.0f")(d):d3.format("$.2s")(d*1e9)));
  svg.append("g").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(ySc).ticks(6));

  svg.append("text").attr("x",W/2).attr("y",H-12).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text(xLabel);
  svg.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",20).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text("Citations per Document");
  svg.append("text").attr("x",W/2).attr("y",28).attr("text-anchor","middle").attr("fill","#e2e8f0").attr("font-size","14").attr("font-weight","700")
    .text(`Scientific Efficacy vs. ${APP.pppMode?"PPP-Adjusted Purchasing Power":"Nominal Economic Size"} (${APP.year})`);

  svg.selectAll("circle").data(countries).join("circle")
    .attr("cx", d => xSc(d[xField]))
    .attr("cy", d => ySc(d.citPerDoc))
    .attr("r",  d => rSc(d.publications))
    .attr("fill", d => DATA.REGIONS[d.region] + "99")
    .attr("stroke", d => DATA.REGIONS[d.region])
    .attr("stroke-width", 1.5)
    .on("mouseover",(e,d) => showTip(e, `<strong>${d.name}</strong>${APP.pppMode?"PPP":"GDP"}: $${d[xField].toLocaleString()}<br>Citations/Paper: ${d.citPerDoc}<br>Publications: ${d.publications.toLocaleString()}<br>R&D: ${d.rdPct}% GDP`))
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);

  // Labels on bubbles for key countries
  const labeled = ["United States","China","India","Switzerland","Russia","Brazil","South Korea"];
  svg.selectAll(".blbl").data(countries.filter(c=>labeled.includes(c.name))).join("text")
    .attr("class","blbl")
    .attr("x", d => xSc(d[xField]))
    .attr("y", d => ySc(d.citPerDoc) - rSc(d.publications) - 5)
    .attr("text-anchor","middle")
    .attr("fill","#e2e8f0")
    .attr("font-size","10")
    .attr("font-weight","600")
    .text(d => d.name);
}

// ══════════════════════════════════════════════════════════
// VIZ 3: 4-Quadrant Efficiency Scatter
// ══════════════════════════════════════════════════════════
function renderViz3(body) {
  const countries = DATA.getEfficiencyData(APP.year);
  const W = body.offsetWidth || 900, H = body.offsetHeight || 500;
  const m = { top: 55, right: 40, bottom: 60, left: 80 };

  const svg = d3.select(body).append("svg").attr("width",W).attr("height",H);

  const xSc = d3.scaleLinear()
    .domain(d3.extent(countries, d => d.rdAbs)).nice()
    .range([m.left, W-m.right]);

  const ySc = d3.scaleLinear()
    .domain([0, d3.max(countries, d => d.citPerDoc)*1.15]).nice()
    .range([H-m.bottom, m.top]);

  const xMid = d3.mean(countries, d => d.rdAbs);
  const yMid = d3.mean(countries, d => d.citPerDoc);

  // Quadrant fills
  const quadColors = [
    { x1:xSc(0), x2:xSc(xMid), y1:ySc(yMid), y2:ySc(d3.min(countries,d=>d.citPerDoc)), col:"rgba(239,68,68,0.05)",  label:"Over-Invested Underperformers" },
    { x1:xSc(xMid), x2:xSc(d3.max(countries,d=>d.rdAbs)*1.05), y1:ySc(yMid), y2:ySc(d3.min(countries,d=>d.citPerDoc)), col:"rgba(99,102,241,0.05)", label:"Stars (High $$, High Quality)" },
    { x1:xSc(0), x2:xSc(xMid), y1:m.top, y2:ySc(yMid), col:"rgba(52,211,153,0.07)", label:"Efficiency Champions" },
    { x1:xSc(xMid), x2:xSc(d3.max(countries,d=>d.rdAbs)*1.05), y1:m.top, y2:ySc(yMid), col:"rgba(251,191,36,0.05)", label:"Established Leaders" }
  ];

  quadColors.forEach(q => {
    svg.append("rect")
      .attr("x",q.x1).attr("y",q.y1)
      .attr("width",q.x2-q.x1).attr("height",q.y2-q.y1)
      .attr("fill",q.col);
  });

  // Quadrant dividers
  svg.append("line").attr("x1",xSc(xMid)).attr("x2",xSc(xMid)).attr("y1",m.top).attr("y2",H-m.bottom)
    .attr("stroke","rgba(255,255,255,0.15)").attr("stroke-dasharray","5,3");
  svg.append("line").attr("x1",m.left).attr("x2",W-m.right).attr("y1",ySc(yMid)).attr("y2",ySc(yMid))
    .attr("stroke","rgba(255,255,255,0.15)").attr("stroke-dasharray","5,3");

  // Grid
  svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(xSc).ticks(5).tickFormat(d=>d3.format("$.2s")(d*1e9)));
  svg.append("g").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(ySc).ticks(5));

  svg.append("text").attr("x",W/2).attr("y",H-10).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text(`R&D Absolute Spend (${APP.year}, USD Billion)`);
  svg.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",20).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text("Citations per Document");
  svg.append("text").attr("x",W/2).attr("y",28).attr("text-anchor","middle").attr("fill","#e2e8f0").attr("font-size","13").attr("font-weight","700")
    .text(`Research Efficiency: Investment vs. Citation Impact (${APP.year})`);

  // Quadrant labels
  svg.append("text").attr("x",xSc(0)+8).attr("y",ySc(yMid)+18).attr("fill","rgba(52,211,153,0.7)").attr("font-size","9").attr("font-weight","700").text("← EFFICIENCY CHAMPIONS");
  svg.append("text").attr("x",xSc(xMid)+8).attr("y",ySc(yMid)+18).attr("fill","rgba(99,102,241,0.7)").attr("font-size","9").attr("font-weight","700").text("ESTABLISHED LEADERS →");
  svg.append("text").attr("x",xSc(0)+8).attr("y",m.top+16).attr("fill","rgba(251,191,36,0.7)").attr("font-size","9").attr("font-weight","700").text("FRUGAL INNOVATORS ↑");
  svg.append("text").attr("x",xSc(xMid)+8).attr("y",H-m.bottom-8).attr("fill","rgba(239,68,68,0.7)").attr("font-size","9").attr("font-weight","700").text("OVER-INVESTED ↓");

  // Scatter dots
  const rSc = d3.scaleSqrt().domain([0, d3.max(countries,d=>d.publications)]).range([5,20]);

  const filterFn = (d) => {
    if (APP.quadrant === "All") return true;
    const hiSpend = d.rdAbs > xMid, hiQual = d.citPerDoc > yMid;
    if (APP.quadrant === "stars") return hiSpend && hiQual;
    if (APP.quadrant === "efficient") return !hiSpend && hiQual;
    if (APP.quadrant === "overinvested") return hiSpend && !hiQual;
    if (APP.quadrant === "laggards") return !hiSpend && !hiQual;
    return true;
  };

  svg.selectAll("circle").data(countries).join("circle")
    .attr("cx", d => xSc(d.rdAbs))
    .attr("cy", d => ySc(d.citPerDoc))
    .attr("r",  d => rSc(d.publications))
    .attr("fill", d => filterFn(d) ? DATA.REGIONS[d.region]+"cc" : "rgba(255,255,255,0.05)")
    .attr("stroke", d => filterFn(d) ? DATA.REGIONS[d.region] : "rgba(255,255,255,0.05)")
    .attr("stroke-width", 1.5)
    .on("mouseover",(e,d) => showTip(e, `<strong>${d.name}</strong>R&D Spend: $${d.rdAbs.toLocaleString()}B<br>Cit/Doc: ${d.citPerDoc}<br>Publications: ${d.publications.toLocaleString()}`))
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);

  // Labels for filtered countries
  svg.selectAll(".sc-lbl").data(countries.filter(filterFn)).join("text")
    .attr("class","sc-lbl")
    .attr("x", d => xSc(d.rdAbs))
    .attr("y", d => ySc(d.citPerDoc) - rSc(d.publications) - 4)
    .attr("text-anchor","middle").attr("fill","#e2e8f0").attr("font-size","9").attr("font-weight","600")
    .text(d => d.name);
}

// ══════════════════════════════════════════════════════════
// VIZ 4: Bar Chart Race (Topics) + Dumbbell (Collaboration)
// ══════════════════════════════════════════════════════════
function renderViz4(body) {
  const layout = div("split-layout");
  const racePane = div("split-pane");
  const dumbbellPane = div("split-pane");
  layout.append(racePane, dumbbellPane);
  body.appendChild(layout);
  renderBarRace(racePane);
  renderDumbbell(dumbbellPane);
}

function renderBarRace(pane) {
  const topics = DATA.getTopicsForYear(APP.year);
  const W = pane.offsetWidth || 440, H = pane.parentElement.offsetHeight || 500;
  const m = { top: 45, right: 90, bottom: 30, left: 170 };
  d3.select(pane).selectAll("*").remove();
  const svg = d3.select(pane).append("svg").attr("width",W).attr("height",H);

  svg.append("text").attr("x",W/2).attr("y",24).attr("text-anchor","middle")
    .attr("fill","#e2e8f0").attr("font-size","12").attr("font-weight","700")
    .text(`Top Research Topics — Publications (${APP.year})`);

  const ySc = d3.scaleBand().domain(topics.map(d=>d.name)).range([m.top, H-m.bottom]).padding(0.25);
  const xSc = d3.scaleLinear().domain([0, d3.max(topics,d=>d.volume)*1.08]).range([m.left, W-m.right]);

  const catColors = {
    "Computer Science":"#6366f1","Biomedical":"#f43f5e","Engineering":"#f59e0b",
    "Physics":"#22d3ee","Chemistry":"#a855f7","Earth Sciences":"#10b981","Multidisciplinary":"#fb923c"
  };

  svg.selectAll("rect").data(topics,d=>d.name).join("rect")
    .attr("y",  d => ySc(d.name))
    .attr("x", m.left)
    .attr("width",  d => xSc(d.volume)-m.left)
    .attr("height", ySc.bandwidth())
    .attr("fill",   d => catColors[d.cat] || "#6366f1")
    .attr("rx", 4)
    .attr("opacity", 0.85)
    .on("mouseover",(e,d) => showTip(e,`<strong>${d.name}</strong>Category: ${d.cat}<br>Publications: ${d.volume.toLocaleString()}`))
    .on("mousemove",moveTip).on("mouseleave",hideTip);

  svg.selectAll(".blbl").data(topics,d=>d.name).join("text")
    .attr("class","blbl")
    .attr("x", d => xSc(d.volume)+5)
    .attr("y", d => ySc(d.name)+ySc.bandwidth()/2+4)
    .attr("fill","#94a3b8").attr("font-size","9").attr("font-weight","600")
    .text(d => d3.format(",.0f")(d.volume));

  svg.selectAll(".tlbl").data(topics,d=>d.name).join("text")
    .attr("class","tlbl")
    .attr("x", m.left-6).attr("y", d=>ySc(d.name)+ySc.bandwidth()/2+4)
    .attr("text-anchor","end").attr("fill","#e2e8f0").attr("font-size","9")
    .text(d => d.name.length>20?d.name.slice(0,18)+"…":d.name);
}

function renderDumbbell(pane) {
  let data = DATA.getCollabData(APP.year);
  if (APP.sort === "gain")          data.sort((a,b)=>b.gain-a.gain);
  else if (APP.sort === "international") data.sort((a,b)=>b.international-a.international);
  else if (APP.sort === "domestic") data.sort((a,b)=>b.domestic-a.domestic);
  else                              data.sort((a,b)=>a.name.localeCompare(b.name));

  const W = pane.offsetWidth || 440, H = pane.parentElement.offsetHeight || 500;
  const m = { top: 45, right: 50, bottom: 30, left: 130 };
  d3.select(pane).selectAll("*").remove();
  const svg = d3.select(pane).append("svg").attr("width",W).attr("height",H);

  svg.append("text").attr("x",W/2).attr("y",24).attr("text-anchor","middle")
    .attr("fill","#e2e8f0").attr("font-size","12").attr("font-weight","700")
    .text(`Collaboration Premium — Citation Rate (${APP.year})`);

  const xSc = d3.scaleLinear().domain([0, d3.max(data,d=>d.international)*1.05]).range([m.left, W-m.right]);
  const ySc = d3.scaleBand().domain(data.map(d=>d.name)).range([m.top, H-m.bottom]).padding(0.4);

  svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(xSc).ticks(5));
  svg.append("g").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(ySc));

  const cy = d => ySc(d.name)+ySc.bandwidth()/2;

  // Connectors
  svg.selectAll(".con").data(data).join("line").attr("class","con")
    .attr("x1",d=>xSc(d.domestic)).attr("x2",d=>xSc(d.international))
    .attr("y1",cy).attr("y2",cy)
    .attr("stroke","rgba(255,255,255,0.12)").attr("stroke-width",2);

  // Domestic
  svg.selectAll(".dd").data(data).join("circle").attr("class","dd")
    .attr("cx",d=>xSc(d.domestic)).attr("cy",cy).attr("r",5)
    .attr("fill","#f43f5e").attr("stroke","rgba(255,255,255,0.4)").attr("stroke-width",1)
    .on("mouseover",(e,d)=>showTip(e,`<strong>${d.name}</strong>Domestic cit/doc: ${d.domestic}`))
    .on("mousemove",moveTip).on("mouseleave",hideTip);

  // International
  svg.selectAll(".di").data(data).join("circle").attr("class","di")
    .attr("cx",d=>xSc(d.international)).attr("cy",cy).attr("r",5)
    .attr("fill","#10b981").attr("stroke","rgba(255,255,255,0.4)").attr("stroke-width",1)
    .on("mouseover",(e,d)=>showTip(e,`<strong>${d.name}</strong>Int'l cit/doc: ${d.international}<br>Gain: +${d.gain}`))
    .on("mousemove",moveTip).on("mouseleave",hideTip);

  // Legend
  const leg = svg.append("g").attr("transform",`translate(${W-130},${m.top})`);
  [["#f43f5e","Domestic"],["#10b981","International"]].forEach(([col,lbl],i)=>{
    leg.append("circle").attr("cx",6).attr("cy",i*18+5).attr("r",5).attr("fill",col);
    leg.append("text").attr("x",15).attr("y",i*18+9).attr("fill","#94a3b8").attr("font-size","9").text(lbl);
  });
}

// ══════════════════════════════════════════════════════════
// VIZ 5: India Geo Network Map + Sidebar
// ══════════════════════════════════════════════════════════
function renderViz5(body) {
  const layout = div("india-layout");
  const mapPane = div("india-map-pane");
  const sidePane = div("india-sidebar");
  sidePane.innerHTML = `
    <h4>Institution Details</h4>
    <p class="inst-placeholder">Click any node on the map to view details and collaboration links</p>
    <div class="inst-details" id="inst-details"></div>
  `;
  layout.append(mapPane, sidePane);
  body.appendChild(layout);

  const net = DATA.getIndiaNetwork(APP.year);
  const tierFilter = APP.tier;

  const nodes = net.nodes.filter(n => tierFilter === "All" || n.tier === tierFilter);
  const nodeIds = new Set(nodes.map(n => n.id));
  const links  = net.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

  const W = mapPane.offsetWidth || 550, H = body.offsetHeight || 500;
  const svg = d3.select(mapPane).append("svg").attr("width",W).attr("height",H);

  // India boundary path (simplified polygon)
  const boundary = [
    [68.1,23.7],[73.5,34.5],[77.5,37.0],[80.3,30.5],[88.5,27.5],
    [97.4,28.2],[91.8,22.0],[88.0,21.6],[80.2,12.5],[77.4,8.1],
    [73.5,15.5],[72.8,20.0],[68.1,23.7]
  ];

  const proj = d3.geoMercator()
    .center([82, 22])
    .scale(W * 1.25)
    .translate([W/2, H/2]);

  const pathGen = d3.line().x(d=>proj(d)[0]).y(d=>proj(d)[1]).curve(d3.curveBasisClosed);

  // Draw India silhouette
  svg.append("path").datum(boundary)
    .attr("d", pathGen)
    .attr("fill","rgba(245,158,11,0.04)")
    .attr("stroke","rgba(245,158,11,0.25)")
    .attr("stroke-width",1.5)
    .attr("stroke-dasharray","4,4");

  svg.append("text").attr("x",W/2).attr("y",22).attr("text-anchor","middle")
    .attr("fill","#e2e8f0").attr("font-size","12").attr("font-weight","700")
    .text(`India's Higher Education Research Network (${APP.year})`);

  const wSc = d3.scaleLinear().domain([0, d3.max(links,l=>l.weight)||1]).range([1,6]);
  const rSc = d3.scaleSqrt().domain([0, d3.max(nodes,n=>n.publications)||1]).range([5,20]);

  const tierCol = { "Premier":"#34d399", "Central / State":"#60a5fa", "Affiliated / Private":"#fbbf24" };

  // Links
  svg.selectAll(".link").data(links).join("line").attr("class","link")
    .attr("x1",d=>{const n=nodes.find(n=>n.id===d.source); return n?proj([n.lon,n.lat])[0]:0;})
    .attr("y1",d=>{const n=nodes.find(n=>n.id===d.source); return n?proj([n.lon,n.lat])[1]:0;})
    .attr("x2",d=>{const n=nodes.find(n=>n.id===d.target); return n?proj([n.lon,n.lat])[0]:0;})
    .attr("y2",d=>{const n=nodes.find(n=>n.id===d.target); return n?proj([n.lon,n.lat])[1]:0;})
    .attr("stroke","rgba(168,85,247,0.3)")
    .attr("stroke-width",d=>wSc(d.weight));

  // Nodes
  svg.selectAll(".node").data(nodes,d=>d.id).join("circle").attr("class","node")
    .attr("cx",d=>proj([d.lon,d.lat])[0])
    .attr("cy",d=>proj([d.lon,d.lat])[1])
    .attr("r",  d=>rSc(d.publications))
    .attr("fill",d=>tierCol[d.tier]||"#94a3b8")
    .attr("stroke",d=> APP.selectedNode && APP.selectedNode.id===d.id ? "#ffffff" : "rgba(255,255,255,0.3)")
    .attr("stroke-width",d=> APP.selectedNode && APP.selectedNode.id===d.id ? 2.5 : 1)
    .attr("opacity",0.9)
    .style("cursor","pointer")
    .on("mouseover",(e,d)=>showTip(e,`<strong>${d.name}</strong>${d.tier}<br>Publications: ${d.publications.toLocaleString()}<br>Funding: ₹${d.funding}Cr`))
    .on("mousemove",moveTip).on("mouseleave",hideTip)
    .on("click",(e,d)=>{ APP.selectedNode=d; showInstDetails(d, links, nodes, sidePane); renderViz5Detail(mapPane, svg, nodes, links, proj, rSc, wSc, tierCol); });

  // Legend
  const leg = svg.append("g").attr("transform",`translate(12,40)`);
  Object.entries(tierCol).forEach(([t,col],i)=>{
    leg.append("circle").attr("cx",6).attr("cy",i*18+5).attr("r",5).attr("fill",col);
    leg.append("text").attr("x",15).attr("y",i*18+9).attr("fill","#94a3b8").attr("font-size","9").text(t);
  });
}

function renderViz5Detail(pane, svg, nodes, links, proj, rSc, wSc, tierCol) {
  svg.selectAll(".node")
    .attr("stroke",d=> APP.selectedNode && APP.selectedNode.id===d.id ? "#ffffff" : "rgba(255,255,255,0.3)")
    .attr("stroke-width",d=> APP.selectedNode && APP.selectedNode.id===d.id ? 2.5 : 1);
}

function showInstDetails(node, links, allNodes, sidePane) {
  const placeholder = sidePane.querySelector(".inst-placeholder");
  const details = sidePane.querySelector(".inst-details");
  if (placeholder) placeholder.style.display = "none";
  details.classList.add("shown");

  const conns = links.filter(l=>l.source===node.id||l.target===node.id);
  const tierClass = { "Premier":"tier-premier","Central / State":"tier-central","Affiliated / Private":"tier-private" }[node.tier]||"tier-central";

  details.innerHTML = `
    <div class="inst-name">${node.name}</div>
    <span class="inst-tier ${tierClass}">${node.tier}</span>
    <div class="inst-stats">
      <div class="stat-box"><span class="s-label">Publications (${APP.year})</span><span class="s-val">${node.publications.toLocaleString()}</span></div>
      <div class="stat-box"><span class="s-label">Annual Budget</span><span class="s-val">₹${node.funding} Cr</span></div>
    </div>
    <div class="collab-section">
      <h5>Active Collaborations (${conns.length})</h5>
      ${conns.length === 0 ? '<p class="inst-placeholder">No active links in current tier filter</p>' :
        conns.map(c => {
          const partner = allNodes.find(n=>n.id===(c.source===node.id?c.target:c.source));
          return partner ? `<div class="collab-row"><span class="c-name">${partner.name}</span><span class="c-count">${c.weight} papers</span></div>` : "";
        }).join("")
      }
    </div>
  `;
}

// ─── Animation helpers ────────────────────────────────────
function toggleAnimation(slider, yearVal, btn) {
  APP.isPlaying = !APP.isPlaying;
  if (APP.isPlaying) {
    btn.textContent = "⏸ Pause";
    APP.animTimer = setInterval(() => {
      APP.year = APP.year >= 2025 ? 2010 : APP.year + 1;
      slider.value = APP.year;
      yearVal.textContent = APP.year;
      renderViz(APP.activeViz);
    }, APP.speed);
    APP.cleanupFns.push(() => stopAnimation());
  } else {
    btn.textContent = "▶ Play";
    stopAnimation();
  }
}

function stopAnimation() {
  APP.isPlaying = false;
  if (APP.animTimer) { clearInterval(APP.animTimer); APP.animTimer = null; }
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
  if (APP.activeViz) renderViz(APP.activeViz);
});
