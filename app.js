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
  1: { title: "High-Dimensional Peer Clustering",             num: "01", credit: "World Bank API · OpenAlex (t-SNE/UMAP Projection)" },
  2: { title: "Global Quality Shift (Q1 vs Q4)",              num: "02", credit: "SCImago SJR · Density Estimates" },
  3: { title: "Top-10 Research Topics",                       num: "03", credit: "OpenAlex (1950-2025)" },
  4: { title: "The Collaboration Premium",                    num: "04", credit: "OpenAlex Citation Networks" },
  5: { title: "India Domestic Higher Education Network",      num: "05", credit: "NIRF India · ROR · SCImago" }
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
  const bubbles = [
    {x:0.3,y:0.3,r:15,col:"rgba(168,85,247,0.7)"},{x:0.4,y:0.25,r:25,col:"rgba(168,85,247,0.7)"},
    {x:0.7,y:0.6,r:20,col:"rgba(34,211,238,0.6)"},{x:0.6,y:0.7,r:18,col:"rgba(34,211,238,0.6)"},
    {x:0.8,y:0.3,r:12,col:"rgba(251,113,133,0.6)"},{x:0.2,y:0.8,r:30,col:"rgba(251,191,36,0.6)"}
  ];
  bubbles.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x*w, b.y*h, b.r, 0, Math.PI*2);
    ctx.fillStyle = b.col; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.stroke();
  });
}

function drawPreview2() {
  const c = document.getElementById("preview-2");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  ctx.fillStyle = "rgba(99,102,241,0.3)";
  ctx.beginPath(); ctx.moveTo(0, h*0.8); ctx.quadraticCurveTo(w*0.3, h*0.2, w*0.6, h*0.8); ctx.lineTo(0, h*0.8); ctx.fill();
  ctx.fillStyle = "rgba(244,63,94,0.3)";
  ctx.beginPath(); ctx.moveTo(w*0.4, h*0.9); ctx.quadraticCurveTo(w*0.7, h*0.3, w, h*0.9); ctx.lineTo(w*0.4, h*0.9); ctx.fill();
}

function drawPreview3() {
  const c = document.getElementById("preview-3");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  const bars = [0.8,0.6,0.5,0.4];
  const colors = ["#6366f1","#22d3ee","#f59e0b","#f43f5e"];
  bars.forEach((bw, i) => {
    const bh = 15, by = 20 + i * 25;
    ctx.fillStyle = colors[i];
    ctx.fillRect(20, by, bw*(w-40), bh);
  });
}

function drawPreview4() {
  const c = document.getElementById("preview-4");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
  for(let i=0; i<4; i++) {
    const y = 30 + i*25;
    const x1 = w*0.2 + Math.random()*w*0.2;
    const x2 = w*0.6 + Math.random()*w*0.2;
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.fillStyle = "#f43f5e"; ctx.beginPath(); ctx.arc(x1, y, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#10b981"; ctx.beginPath(); ctx.arc(x2, y, 4, 0, Math.PI*2); ctx.fill();
  }
}

function drawPreview5() {
  const c = document.getElementById("preview-5");
  const ctx = c.getContext("2d");
  c.width = c.offsetWidth; c.height = c.offsetHeight;
  const w = c.width, h = c.height;
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

  showLoading("Loading visualization...");
  buildControls(id);

  APP.cleanupFns.forEach(fn => fn());
  APP.cleanupFns = [];
  const body = document.getElementById("panel-body");
  body.innerHTML = "";

  panel.classList.add("active");

  await sleep(250);
  hideLoading();
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
};

window.navigateViz = function(dir) {
  const next = APP.activeViz + dir;
  if (next >= 1 && next <= 5) openViz(next);
};

// ─── Build Controls ────────────────────────────────────────
function buildControls(id) {
  const c = document.getElementById("panel-controls");
  c.innerHTML = "";

  if ([1,2,3,5].includes(id)) {
    // Year slider for visualizations that are animated over time
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

  if (id === 4) {
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
    c.append(el("span","ctrl-label","Order By:"), sortSel);
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
    c.append(el("span","ctrl-label","Tier:"), tierSel);
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
// VIZ 1: High-Dimensional Peer Clustering (t-SNE/UMAP Scatter)
// ══════════════════════════════════════════════════════════
function renderViz1(body) {
  const countries = DATA.getCountriesForYear(APP.year)
    .filter(c => APP.region === "All" || c.region === APP.region);

  const W = body.offsetWidth || 900, H = body.offsetHeight || 500;
  const m = { top: 60, right: 150, bottom: 60, left: 60 };

  const svg = d3.select(body).append("svg").attr("width", W).attr("height", H);

  // Use arbitrary t-SNE coordinate scales
  const xSc = d3.scaleLinear().domain([-5, 5]).range([m.left, W - m.right]);
  const ySc = d3.scaleLinear().domain([-5, 5]).range([H - m.bottom, m.top]);

  const rSc = d3.scaleSqrt().domain([0, d3.max(countries, d => d.publications)]).range([5, 45]);

  svg.append("text").attr("x",W/2).attr("y",30).attr("text-anchor","middle").attr("fill","#e2e8f0").attr("font-size","15").attr("font-weight","700")
    .text(`Scientific Peer Group Clusters (${APP.year})`);

  // Bubbles
  svg.selectAll("circle")
    .data(countries, d => d.iso)
    .join("circle")
    .attr("cx", d => xSc(d.x))
    .attr("cy", d => ySc(d.y))
    .attr("r",  d => rSc(d.publications))
    .attr("fill", d => DATA.REGIONS[d.region] + "bb")
    .attr("stroke", d => DATA.REGIONS[d.region])
    .attr("stroke-width", 1.5)
    .on("mouseover", (e, d) => showTip(e, `<strong>${d.name}</strong>Region: ${d.region}<br>Publications: ${d.publications.toLocaleString()}`))
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);

  // Labels
  svg.selectAll(".lbl").data(countries, d => d.iso).join("text")
    .attr("class","lbl")
    .attr("x", d => xSc(d.x))
    .attr("y", d => ySc(d.y) - rSc(d.publications) - 5)
    .attr("text-anchor","middle")
    .attr("fill","#e2e8f0")
    .attr("font-size","11")
    .attr("font-weight","600")
    .text(d => d.name);

  // Legend
  const leg = svg.append("g").attr("transform",`translate(${W-140},${m.top})`);
  let ly = 0;
  Object.entries(DATA.REGIONS).forEach(([r,col]) => {
    leg.append("circle").attr("cx",6).attr("cy",ly+5).attr("r",6).attr("fill",col);
    leg.append("text").attr("x",18).attr("y",ly+9).attr("fill","#94a3b8").attr("font-size","10").text(r);
    ly += 20;
  });
}

// ══════════════════════════════════════════════════════════
// VIZ 2: Global Quality Shift (Ridgeline)
// ══════════════════════════════════════════════════════════
function renderViz2(body) {
  // We'll show all years up to the current APP.year
  const ridgelineData = DATA.getRidgelineData().filter(d => d.year <= APP.year);

  const W = body.offsetWidth || 900, H = body.offsetHeight || 500;
  const m = { top: 80, right: 100, bottom: 50, left: 100 };

  const svg = d3.select(body).append("svg").attr("width",W).attr("height",H);

  svg.append("text").attr("x",W/2).attr("y",30).attr("text-anchor","middle").attr("fill","#e2e8f0").attr("font-size","15").attr("font-weight","700")
    .text(`Global Publication Quality Shifts (Up to ${APP.year})`);

  // X axis: "Quality Proxy Index"
  const xSc = d3.scaleLinear().domain([0, 100]).range([m.left, W-m.right]);
  
  // Y axis for the years
  const yName = d3.scaleBand()
    .domain(ridgelineData.map(d => d.year))
    .range([m.top, H-m.bottom])
    .paddingInner(1);

  // Y axis for the density within a single year row
  // We want the curves to overlap, so the range goes up negatively
  const yDensity = d3.scaleLinear()
    .domain([0, 1.5])
    .range([0, -60]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${H-m.bottom})`)
    .call(d3.axisBottom(xSc).ticks(5).tickFormat(d => d + " pts"))
    .call(g=>g.select(".domain").attr("stroke","#334155"));

  svg.append("g").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(yName).tickSize(0))
    .call(g=>g.select(".domain").remove())
    .selectAll("text").attr("font-size","12").attr("font-weight","bold").attr("fill","#cbd5e1");

  // Area generators
  const areaQ1 = d3.area()
    .x(d => xSc(d.x))
    .y0(0)
    .y1(d => yDensity(d.q1Val))
    .curve(d3.curveBasis);

  const areaQ4 = d3.area()
    .x(d => xSc(d.x))
    .y0(0)
    .y1(d => yDensity(d.q4Val))
    .curve(d3.curveBasis);

  // Groups per year
  const rows = svg.selectAll(".row")
    .data(ridgelineData, d => d.year)
    .join("g")
    .attr("class", "row")
    .attr("transform", d => `translate(0,${yName(d.year)})`);

  // Draw Q4 area (red)
  rows.append("path")
    .attr("fill", "rgba(244,63,94,0.65)")
    .attr("stroke", "#f43f5e")
    .attr("stroke-width", 1.5)
    .attr("d", d => areaQ4(d.points));

  // Draw Q1 area (blue)
  rows.append("path")
    .attr("fill", "rgba(56,189,248,0.65)")
    .attr("stroke", "#38bdf8")
    .attr("stroke-width", 1.5)
    .attr("d", d => areaQ1(d.points));

  // Annotations
  svg.append("text").attr("x",W/2).attr("y",H-10).attr("text-anchor","middle").attr("fill","#94a3b8").attr("font-size","11").text("Research Quality Score Index (Normalized)");
  
  const leg = svg.append("g").attr("transform",`translate(${W-130},${m.top})`);
  leg.append("rect").attr("x",0).attr("y",0).attr("width",12).attr("height",12).attr("fill","rgba(56,189,248,0.65)");
  leg.append("text").attr("x",20).attr("y",10).attr("fill","#94a3b8").attr("font-size","11").text("Q1 (Elite Tier)");
  leg.append("rect").attr("x",0).attr("y",20).attr("width",12).attr("height",12).attr("fill","rgba(244,63,94,0.65)");
  leg.append("text").attr("x",20).attr("y",30).attr("fill","#94a3b8").attr("font-size","11").text("Q4 (Low Tier)");
}

// ══════════════════════════════════════════════════════════
// VIZ 3: Top-10 Research Topics (Bar Chart Race)
// ══════════════════════════════════════════════════════════
function renderViz3(body) {
  const topics = DATA.getTopicsForYear(APP.year);
  const W = body.offsetWidth || 900, H = body.offsetHeight || 500;
  const m = { top: 60, right: 100, bottom: 40, left: 220 };
  
  const svg = d3.select(body).append("svg").attr("width",W).attr("height",H);

  svg.append("text").attr("x",W/2).attr("y",30).attr("text-anchor","middle")
    .attr("fill","#e2e8f0").attr("font-size","15").attr("font-weight","700")
    .text(`Top 10 Research Topics by Volume (${APP.year})`);

  const ySc = d3.scaleBand().domain(topics.map(d=>d.name)).range([m.top, H-m.bottom]).padding(0.25);
  const xSc = d3.scaleLinear().domain([0, d3.max(topics,d=>d.volume)*1.08]).range([m.left, W-m.right]);

  const catColors = {
    "Computer Science":"#6366f1","Biomedical":"#f43f5e","Engineering":"#f59e0b",
    "Physics":"#22d3ee","Chemistry":"#a855f7","Earth Sciences":"#10b981","Multidisciplinary":"#fb923c"
  };

  svg.selectAll("rect").data(topics, d=>d.name).join("rect")
    .attr("y",  d => ySc(d.name))
    .attr("x", m.left)
    .attr("width",  d => xSc(d.volume)-m.left)
    .attr("height", ySc.bandwidth())
    .attr("fill",   d => catColors[d.cat] || "#6366f1")
    .attr("rx", 4)
    .attr("opacity", 0.85)
    .on("mouseover",(e,d) => showTip(e,`<strong>${d.name}</strong>Category: ${d.cat}<br>Publications: ${d.volume.toLocaleString()}`))
    .on("mousemove",moveTip).on("mouseleave",hideTip);

  svg.selectAll(".val-lbl").data(topics, d=>d.name).join("text")
    .attr("class","val-lbl")
    .attr("x", d => xSc(d.volume)+8)
    .attr("y", d => ySc(d.name)+ySc.bandwidth()/2+5)
    .attr("fill","#cbd5e1").attr("font-size","12").attr("font-weight","600")
    .text(d => d3.format(",.0f")(d.volume));

  svg.selectAll(".name-lbl").data(topics, d=>d.name).join("text")
    .attr("class","name-lbl")
    .attr("x", m.left-10).attr("y", d=>ySc(d.name)+ySc.bandwidth()/2+5)
    .attr("text-anchor","end").attr("fill","#e2e8f0").attr("font-size","13").attr("font-weight","bold")
    .text(d => d.name);
}

// ══════════════════════════════════════════════════════════
// VIZ 4: The Collaboration Premium (Dumbbell Plot)
// ══════════════════════════════════════════════════════════
function renderViz4(body) {
  let data = DATA.getCollabData(); // Using static 2024 view to see exact premiums as requested
  if (APP.sort === "gain")          data.sort((a,b)=>b.gain-a.gain);
  else if (APP.sort === "international") data.sort((a,b)=>b.international-a.international);
  else if (APP.sort === "domestic") data.sort((a,b)=>b.domestic-a.domestic);
  else                              data.sort((a,b)=>a.name.localeCompare(b.name));

  const W = body.offsetWidth || 900, H = body.offsetHeight || 500;
  const m = { top: 60, right: 60, bottom: 40, left: 180 };
  const svg = d3.select(body).append("svg").attr("width",W).attr("height",H);

  svg.append("text").attr("x",W/2).attr("y",30).attr("text-anchor","middle")
    .attr("fill","#e2e8f0").attr("font-size","15").attr("font-weight","700")
    .text(`The Collaboration Premium: Citation Gap (Domestic vs International Co-authorship)`);

  const xSc = d3.scaleLinear().domain([0, d3.max(data,d=>d.international)*1.05]).range([m.left, W-m.right]);
  const ySc = d3.scaleBand().domain(data.map(d=>d.name)).range([m.top, H-m.bottom]).padding(0.4);

  svg.append("g").attr("transform",`translate(0,${H-m.bottom})`)
     .call(d3.axisBottom(xSc).ticks(8))
     .call(g => g.select(".domain").attr("stroke","#334155"))
     .call(g => g.selectAll("line").attr("stroke","rgba(255,255,255,0.05)").attr("y2",-(H-m.top-m.bottom)));
     
  svg.append("g").attr("transform",`translate(${m.left},0)`)
     .call(d3.axisLeft(ySc).tickSize(0))
     .call(g => g.select(".domain").remove())
     .selectAll("text").attr("font-size","12").attr("fill","#cbd5e1");

  const cy = d => ySc(d.name)+ySc.bandwidth()/2;

  // Connectors
  svg.selectAll(".con").data(data).join("line").attr("class","con")
    .attr("x1",d=>xSc(d.domestic)).attr("x2",d=>xSc(d.international))
    .attr("y1",cy).attr("y2",cy)
    .attr("stroke","rgba(255,255,255,0.15)").attr("stroke-width",3);

  // Domestic
  svg.selectAll(".dd").data(data).join("circle").attr("class","dd")
    .attr("cx",d=>xSc(d.domestic)).attr("cy",cy).attr("r",7)
    .attr("fill","#f43f5e").attr("stroke","rgba(255,255,255,0.4)").attr("stroke-width",1.5)
    .on("mouseover",(e,d)=>showTip(e,`<strong>${d.name}</strong>Domestic Citations/Paper: ${d.domestic}`))
    .on("mousemove",moveTip).on("mouseleave",hideTip);

  // International
  svg.selectAll(".di").data(data).join("circle").attr("class","di")
    .attr("cx",d=>xSc(d.international)).attr("cy",cy).attr("r",7)
    .attr("fill","#10b981").attr("stroke","rgba(255,255,255,0.4)").attr("stroke-width",1.5)
    .on("mouseover",(e,d)=>showTip(e,`<strong>${d.name}</strong>Int'l Citations/Paper: ${d.international}<br>Gain: +${d.gain}`))
    .on("mousemove",moveTip).on("mouseleave",hideTip);

  // Legend
  const leg = svg.append("g").attr("transform",`translate(${W-200},20)`);
  [["#f43f5e","Domestic Citation Impact"],["#10b981","International Co-authored Impact"]].forEach(([col,lbl],i)=>{
    leg.append("circle").attr("cx",6).attr("cy",i*20+5).attr("r",6).attr("fill",col);
    leg.append("text").attr("x",20).attr("y",i*20+10).attr("fill","#94a3b8").attr("font-size","11").text(lbl);
  });
}

// ══════════════════════════════════════════════════════════
// VIZ 5: India Domestic Higher Education Network (Node-Link Map)
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

  // Scale map
  const proj = d3.geoMercator().fitSize([W-40, H-40], {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [boundary] }
  });

  // Draw outline
  svg.append("path")
    .datum({type: "Polygon", coordinates: [boundary]})
    .attr("d", d3.geoPath().projection(proj))
    .attr("fill", "rgba(255,255,255,0.03)")
    .attr("stroke", "rgba(255,255,255,0.15)")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,4");

  // Edges
  svg.selectAll(".link").data(links).join("line").attr("class","link")
    .attr("x1", d => proj([net.nodes.find(n=>n.id===d.source).lon, net.nodes.find(n=>n.id===d.source).lat])[0])
    .attr("y1", d => proj([net.nodes.find(n=>n.id===d.source).lon, net.nodes.find(n=>n.id===d.source).lat])[1])
    .attr("x2", d => proj([net.nodes.find(n=>n.id===d.target).lon, net.nodes.find(n=>n.id===d.target).lat])[0])
    .attr("y2", d => proj([net.nodes.find(n=>n.id===d.target).lon, net.nodes.find(n=>n.id===d.target).lat])[1])
    .attr("stroke", "rgba(168,85,247,0.3)")
    .attr("stroke-width", d => Math.sqrt(d.weight)/2);

  const rSc = d3.scaleSqrt().domain([0, 10000]).range([3, 25]);
  const tierColors = { "Premier":"#f43f5e", "Central / State":"#22d3ee", "Affiliated / Private":"#f59e0b" };

  // Nodes
  const nodeG = svg.selectAll(".node").data(nodes).join("g").attr("class","node")
    .attr("transform", d => `translate(${proj([d.lon, d.lat])})`)
    .style("cursor","pointer")
    .on("mouseover", (e,d) => {
      d3.select(e.currentTarget).select("circle").attr("stroke-width",3);
      showTip(e, `<strong>${d.name}</strong>Tier: ${d.tier}<br>Publications: ${d.publications.toLocaleString()}<br>Funding: ₹${d.funding}Cr`);
    })
    .on("mousemove", moveTip)
    .on("mouseout", (e,d) => {
      d3.select(e.currentTarget).select("circle").attr("stroke-width",1);
      hideTip();
    })
    .on("click", (e,d) => selectIndiaNode(d, net));

  nodeG.append("circle")
    .attr("r", d => rSc(d.publications))
    .attr("fill", d => tierColors[d.tier] + "dd")
    .attr("stroke", "rgba(255,255,255,0.7)")
    .attr("stroke-width", 1);

  nodeG.append("text")
    .attr("y", d => -rSc(d.publications)-5)
    .attr("text-anchor","middle").attr("fill","#cbd5e1").attr("font-size","10")
    .text(d => d.name.split(" ")[0]);

  // Legend
  const leg = svg.append("g").attr("transform",`translate(20,20)`);
  let ly = 0;
  Object.entries(tierColors).forEach(([t,c]) => {
    leg.append("circle").attr("cx",6).attr("cy",ly+5).attr("r",6).attr("fill",c);
    leg.append("text").attr("x",18).attr("y",ly+9).attr("fill","#94a3b8").attr("font-size","11").text(t);
    ly += 20;
  });
}

function selectIndiaNode(node, net) {
  APP.selectedNode = node;
  const container = document.getElementById("inst-details");
  document.querySelector(".inst-placeholder").style.display = "none";
  
  const connectedLinks = net.links.filter(l => l.source === node.id || l.target === node.id);
  const totalCollabs = d3.sum(connectedLinks, l => l.weight);
  
  container.innerHTML = `
    <h3 style="color:#e2e8f0; margin-bottom:0.5rem; font-size:1.3rem;">${node.name}</h3>
    <div style="color:var(--accent); font-weight:bold; margin-bottom:1.5rem; font-size:0.9rem;">${node.tier}</div>
    
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:1rem; margin-bottom:1rem;">
      <div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Publications (${APP.year})</div>
        <div style="font-size:1.4rem; color:#fff; font-weight:bold;">${node.publications.toLocaleString()}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:var(--text-muted);">Gov Funding</div>
        <div style="font-size:1.4rem; color:#fff; font-weight:bold;">₹${node.funding} <span style="font-size:0.9rem;">Cr</span></div>
      </div>
    </div>
    
    <div style="font-size:0.95rem; margin-bottom:0.5rem; color:#cbd5e1;">Domestic Co-publications: <strong>${totalCollabs}</strong></div>
    
    <ul style="list-style:none; padding:0; font-size:0.85rem; color:#94a3b8;">
      ${connectedLinks.sort((a,b)=>b.weight-a.weight).slice(0,5).map(l => {
        const partnerId = l.source === node.id ? l.target : l.source;
        const partner = net.nodes.find(n=>n.id === partnerId);
        if (!partner) return "";
        return `<li style="padding:4px 0; border-bottom:1px dashed rgba(255,255,255,0.05); display:flex; justify-content:space-between;">
          <span>${partner.name}</span> <span style="color:#22d3ee; font-weight:bold;">${l.weight}</span>
        </li>`;
      }).join("")}
    </ul>
  `;
}

// ─── Play / Animation ──────────────────────────────────────
function toggleAnimation(slider, yearVal, btn) {
  if (!APP.isPlaying) {
    APP.isPlaying = true;
    btn.textContent = "⏸ Pause";
    if (APP.year >= 2025) { APP.year = 2010; }
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
