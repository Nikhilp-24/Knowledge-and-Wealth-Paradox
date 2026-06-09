/* Minimal design-variant mockups — Module 2 & 5 (sample data only) */
(function () {
  const BG = "#0f172a";
  const Q1 = "#0072B2";
  const Q4 = "#D55E00";
  const PREMIER = "#0072B2";
  const STATE = "#E69F00";
  const MUTED = "#64748b";

  const M2_YEARS = [1996, 2005, 2010, 2015, 2020, 2024];

  /** Synthetic Q1 share KDE-ish curves (unimodal → bimodal story) */
  function m2Curve(year, x) {
    const t = (year - 1996) / 28;
    const mu1 = 0.55 - t * 0.15;
    const mu2 = 0.85 + t * 0.25;
    const s1 = 0.12 + t * 0.08;
    const s2 = 0.1 + t * 0.05;
    const w1 = 1 - t * 0.35;
    const w2 = 0.15 + t * 0.85;
    const g = (mu, sig) => Math.exp(-0.5 * ((x - mu) / sig) ** 2);
    return w1 * g(mu1, s1) + w2 * g(mu2, s2);
  }

  function clear(el) {
    el.innerHTML = "";
  }

  function badge(el, text, rec) {
    const b = document.createElement("span");
    b.className = rec ? "chip chip-rec" : "chip";
    b.textContent = text;
    el.appendChild(b);
  }

  function svgRoot(el, w, h) {
    return d3.select(el).append("svg").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
  }

  /* ---------- Module 2 renders ---------- */
  function renderM2Classic(el) {
    const w = 320,
      h = 200,
      pad = { l: 36, r: 8, t: 8, b: 20 };
    const svg = svgRoot(el, w, h);
    const xs = d3.range(0, 1.01, 0.02);
    const rowH = (h - pad.t - pad.b) / M2_YEARS.length;
    M2_YEARS.forEach((yr, i) => {
      const y0 = pad.t + i * rowH + rowH * 0.15;
      const y1 = pad.t + (i + 1) * rowH - rowH * 0.15;
      const x = d3.scaleLinear().domain([0, 1]).range([pad.l, w - pad.r]);
      const area = d3
        .area()
        .x((d) => x(d))
        .y0(y1)
        .y1((d) => y0 + (y1 - y0) * (1 - m2Curve(yr, d) * 0.9))
        .curve(d3.curveBasis);
      svg.append("path").attr("d", area(xs)).attr("fill", Q1).attr("opacity", 0.55);
      svg
        .append("text")
        .attr("x", 4)
        .attr("y", (y0 + y1) / 2)
        .attr("fill", "#94a3b8")
        .attr("font-size", 9)
        .text(yr);
    });
  }

  function renderM2Bimodal(el) {
    renderM2Classic(el);
    const svg = d3.select(el).select("svg");
    svg
      .append("text")
      .attr("x", 80)
      .attr("y", 28)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 8)
      .text("Parity");
    svg
      .append("text")
      .attr("x", 120)
      .attr("y", 95)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 8)
      .text("Breakaway");
    svg
      .append("text")
      .attr("x", 200)
      .attr("y", 175)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 8)
      .text("Q4 Flood");
  }

  function renderM2Stream(el) {
    const w = 320,
      h = 200,
      pad = 16;
    const data = M2_YEARS.map((yr) => ({
      year: yr,
      q1: 0.22 + ((yr - 1996) / 28) * 0.08,
      q2: 0.28,
      q3: 0.22,
      q4: 0.28 - ((yr - 1996) / 28) * 0.05 + ((yr - 2010) / 14) * 0.12,
    }));
    const svg = svgRoot(el, w, h);
    const x = d3.scalePoint().domain(M2_YEARS).range([pad, w - pad]);
    const y = d3.scaleLinear().domain([0, 1]).range([h - pad, pad]);
    const stack = d3.stack().keys(["q1", "q2", "q3", "q4"])(data);
    const colors = [Q1, "#56B4E9", "#E69F00", Q4];
    stack.forEach((layer, i) => {
      svg
        .append("path")
        .attr(
          "d",
          d3
            .area()
            .x((d) => x(d.data.year))
            .y0((d) => y(d[0]))
            .y1((d) => y(d[1]))
        (layer)
        )
        .attr("fill", colors[i])
        .attr("opacity", 0.75);
    });
  }

  function renderM2Multiples(el) {
    const countries = ["USA", "CHN", "IND"];
    const wrap = document.createElement("div");
    wrap.className = "mini-row";
    countries.forEach((c) => {
      const cell = document.createElement("div");
      cell.className = "mini-cell";
      cell.innerHTML = `<div class="mini-label">${c}</div>`;
      wrap.appendChild(cell);
      const w = 95,
        h = 70;
      const svg = d3.select(cell).append("svg").attr("width", w).attr("height", h);
      const xs = d3.range(0, 1.01, 0.05);
      const x = d3.scaleLinear().domain([0, 1]).range([4, w - 4]);
      const base = c === "CHN" ? 2012 : 1996;
      const line = d3
        .line()
        .x((d) => x(d))
        .y((d) => 60 - m2Curve(base + (d * 28) / 2, d) * 45)
        .curve(d3.curveBasis);
      svg.append("path").attr("d", line(xs)).attr("fill", "none").attr("stroke", Q1).attr("stroke-width", 1.5);
    });
    el.appendChild(wrap);
  }

  function renderM2Dumbbell(el) {
    const w = 320,
      h = 200,
      pad = { l: 70, r: 16, t: 16, b: 16 };
    const rows = [
      { n: "USA", a: 0.48, b: 0.52 },
      { n: "CHN", a: 0.35, b: 0.58 },
      { n: "IND", a: 0.4, b: 0.45 },
    ];
    const svg = svgRoot(el, w, h);
    const x = d3.scaleLinear().domain([0.3, 0.65]).range([pad.l, w - pad.r]);
    const y = d3
      .scaleBand()
      .domain(rows.map((r) => r.n))
      .range([pad.t, h - pad.b])
      .padding(0.35);
    rows.forEach((r) => {
      const cy = y(r.n) + y.bandwidth() / 2;
      svg
        .append("line")
        .attr("x1", x(r.a))
        .attr("x2", x(r.b))
        .attr("y1", cy)
        .attr("y2", cy)
        .attr("stroke", MUTED)
        .attr("stroke-width", 2);
      svg.append("circle").attr("cx", x(r.a)).attr("cy", cy).attr("r", 4).attr("fill", Q1);
      svg.append("circle").attr("cx", x(r.b)).attr("cy", cy).attr("r", 4).attr("fill", Q4);
      svg
        .append("text")
        .attr("x", 4)
        .attr("y", cy + 3)
        .attr("fill", "#cbd5e1")
        .attr("font-size", 10)
        .text(r.n);
    });
    svg
      .append("text")
      .attr("x", pad.l)
      .attr("y", 12)
      .attr("fill", "#94a3b8")
      .attr("font-size", 8)
      .text("1996 Q1→Q4          2024 Q1→Q4");
  }

  function renderM2Heatmap(el) {
    const tiers = ["Q1", "Q2", "Q3", "Q4"];
    const years = [1996, 2010, 2024];
    const vals = [
      [0.22, 0.24, 0.26],
      [0.28, 0.27, 0.24],
      [0.26, 0.25, 0.22],
      [0.24, 0.24, 0.28],
    ];
    const w = 320,
      h = 200,
      pad = { l: 28, t: 20, r: 8, b: 8 };
    const svg = svgRoot(el, w, h);
    const x = d3.scaleBand().domain(years).range([pad.l, w - pad.r]).padding(0.08);
    const y = d3.scaleBand().domain(tiers).range([pad.t, h - pad.b]).padding(0.08);
    const c = d3.scaleSequential(d3.interpolateBlues).domain([0.18, 0.32]);
    tiers.forEach((t, i) => {
      years.forEach((yr, j) => {
        svg
          .append("rect")
          .attr("x", x(yr))
          .attr("y", y(t))
          .attr("width", x.bandwidth())
          .attr("height", y.bandwidth())
          .attr("fill", c(vals[i][j]));
      });
    });
  }

  function renderM2Violin(el) {
    const regions = ["EU", "Asia", "S.Asia"];
    const wrap = document.createElement("div");
    wrap.className = "mini-row";
    regions.forEach((r, idx) => {
      const cell = document.createElement("div");
      cell.className = "mini-cell";
      cell.innerHTML = `<div class="mini-label">${r}</div>`;
      wrap.appendChild(cell);
      const w = 95,
        h = 70;
      const svg = d3.select(cell).append("svg").attr("width", w).attr("height", h);
      const xs = d3.range(0.2, 0.8, 0.02);
      const x = d3.scaleLinear().domain([0.2, 0.8]).range([8, w - 8]);
      const cy = 38;
      const amp = 12 + idx * 4;
      const path = d3
        .line()
        .x((d) => x(d))
        .y((d) => cy - Math.sin((d - 0.5) * 8) * amp * (0.4 + idx * 0.15))
        .curve(d3.curveBasis);
      svg.append("path").attr("d", path(xs)).attr("fill", Q1).attr("opacity", 0.35).attr("stroke", Q1);
    });
    el.appendChild(wrap);
  }

  function renderM2Integrity(el) {
    const box = document.createElement("div");
    box.className = "footnote-box";
    box.innerHTML =
      "<strong>Data integrity</strong><br>SCImago Q1/Q4 proxy · sample years only<br>Synthetic demo slice";
    el.appendChild(box);
    const mini = document.createElement("div");
    mini.style.height = "90px";
    el.appendChild(mini);
    renderM2Classic(mini);
    d3.select(mini).select("svg").attr("height", 90);
  }

  /* ---------- Module 5 map helpers ---------- */
  let m5Sample = null;

  function projectIndia(nodes, w, h, pad = 12) {
    const lats = nodes.map((n) => n.lat);
    const lons = nodes.map((n) => n.lon);
    const x = d3.scaleLinear().domain([d3.min(lons) - 1, d3.max(lons) + 1]).range([pad, w - pad]);
    const y = d3.scaleLinear().domain([d3.min(lats) - 1, d3.max(lats) + 1]).range([h - pad, pad]);
    return nodes.map((n) => ({ ...n, px: x(n.lon), py: y(n.lat) }));
  }

  function drawM5Map(el, opts = {}) {
    const {
      w = 320,
      h = 200,
      focusId = null,
      showCorridors = false,
      showSearch = false,
      showFootnote = false,
      showDumbbell = false,
      showYear = null,
      splitTier = false,
      onNodeClick = null,
    } = opts;
    clear(el);
    if (showSearch) {
      const s = document.createElement("input");
      s.className = "mock-search";
      s.placeholder = "Search university…";
      el.appendChild(s);
    }
    if (showFootnote) {
      const f = document.createElement("div");
      f.className = "footnote-box";
      f.innerHTML = "~120 institutions · NIRF gaps noted · SCImago 2019 static";
      el.appendChild(f);
    }
    const canvasWrap = document.createElement("div");
    canvasWrap.className = splitTier ? "split-map" : "map-wrap";
    el.appendChild(canvasWrap);

    function oneMap(parent, tierFilter) {
      const nodes = projectIndia(
        m5Sample.nodes.filter((n) => !tierFilter || n.tier === tierFilter),
        w,
        splitTier ? w / 2 - 8 : w,
        showDumbbell || showFootnote ? 120 : h
      );
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const edges = m5Sample.edges.filter((e) => nodeById.has(e.source) && nodeById.has(e.target));
      const svg = d3
        .select(parent)
        .append("svg")
        .attr("width", splitTier ? w / 2 - 8 : w)
        .attr("height", showDumbbell || showFootnote ? 120 : h);
      if (showCorridors) {
        svg
          .append("rect")
          .attr("x", 40)
          .attr("y", 30)
          .attr("width", 80)
          .attr("height", 50)
          .attr("fill", "#475569")
          .attr("opacity", 0.2);
        svg
          .append("text")
          .attr("x", 44)
          .attr("y", 44)
          .attr("fill", "#94a3b8")
          .attr("font-size", 8)
          .text("NCR");
      }
      const ego = new Set();
      if (focusId) {
        ego.add(focusId);
        edges.forEach((e) => {
          if (e.source === focusId) ego.add(e.target);
          if (e.target === focusId) ego.add(e.source);
        });
      }
      edges.forEach((e) => {
        const a = nodeById.get(e.source);
        const b = nodeById.get(e.target);
        if (!a || !b) return;
        const inEgo = !focusId || (ego.has(e.source) && ego.has(e.target));
        svg
          .append("line")
          .attr("x1", a.px)
          .attr("y1", a.py)
          .attr("x2", b.px)
          .attr("y2", b.py)
          .attr("stroke", MUTED)
          .attr("stroke-width", inEgo ? 2 : 0.6)
          .attr("opacity", inEgo ? 0.85 : 0.1);
      });
      nodes.forEach((n) => {
        const dim = focusId && focusId !== n.id && !ego.has(n.id);
        const g = svg.append("g").style("cursor", onNodeClick ? "pointer" : "default");
        g.append("circle")
          .attr("cx", n.px)
          .attr("cy", n.py)
          .attr("r", n.is_hub ? 5 : 3.5)
          .attr("fill", n.tier === "premier" ? PREMIER : STATE)
          .attr("opacity", dim ? 0.25 : 0.95)
          .attr("stroke", focusId === n.id ? "#fff" : "none")
          .attr("stroke-width", 2);
        if (n.is_hub && !dim) {
          g.append("text")
            .attr("x", n.px + 6)
            .attr("y", n.py + 3)
            .attr("fill", "#cbd5e1")
            .attr("font-size", 7)
            .text(n.city || n.name.split(" ").slice(-1)[0]);
        }
        if (onNodeClick) g.on("click", () => onNodeClick(n.id));
      });
    }

    if (splitTier) {
      const left = document.createElement("div");
      const right = document.createElement("div");
      left.innerHTML = '<div class="mini-label">Premier</div>';
      right.innerHTML = '<div class="mini-label">State</div>';
      canvasWrap.appendChild(left);
      canvasWrap.appendChild(right);
      oneMap(left, "premier");
      oneMap(right, "state_affiliated");
    } else {
      oneMap(canvasWrap, null);
    }

    if (showYear != null) {
      const yr = document.createElement("div");
      yr.className = "year-hero";
      yr.textContent = `Year: ${showYear}`;
      el.appendChild(yr);
    }
    if (showDumbbell) {
      const db = document.createElement("div");
      db.className = "dumbbell-strip";
      db.innerHTML =
        '<span class="dot-p">●</span> Premier avg <span class="dot-s">●</span> State avg <em style="color:#94a3b8">(NIRF n=116)</em>';
      el.appendChild(db);
    }
    const strip = document.createElement("div");
    strip.className = "tier-strip";
    strip.textContent = "Premier · 60 inst · State · 60 inst · tier avgs only on map";
    if (!splitTier && !showFootnote) el.appendChild(strip);
  }

  const M2_RENDERERS = {
    "m2-01": renderM2Classic,
    "m2-02": renderM2Bimodal,
    "m2-03": renderM2Stream,
    "m2-04": renderM2Multiples,
    "m2-05": renderM2Dumbbell,
    "m2-06": renderM2Heatmap,
    "m2-07": renderM2Violin,
    "m2-08": renderM2Integrity,
  };

  function initM5Interactive03(el) {
    let focus = null;
    function redraw() {
      clear(el);
      drawM5Map(el, {
        focusId: focus,
        onNodeClick: (id) => {
          focus = focus === id ? null : id;
          redraw();
        },
      });
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = focus ? "Focus+context: ego network highlighted (click again to reset)" : "Click a node — M5-03 Focus Fisheye";
      el.appendChild(hint);
    }
    redraw();
  }

  async function loadM5Sample() {
    try {
      const res = await fetch("data/india_network/2024_overview.json");
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      const hubs = data.nodes.filter((n) => n.is_hub).slice(0, 14);
      const ids = new Set(hubs.map((n) => n.id));
      const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).slice(0, 25);
      m5Sample = { nodes: hubs, edges };
    } catch (err) {
      console.warn("M5 sample fetch failed, using embedded fallback", err);
      m5Sample = {
        nodes: [
          { id: "a", name: "IISc Bengaluru", tier: "premier", is_hub: true, lat: 13.02, lon: 77.57, city: "Bengaluru" },
          { id: "b", name: "IIT Bombay", tier: "premier", is_hub: true, lat: 19.13, lon: 72.92, city: "Mumbai" },
          { id: "c", name: "AIIMS Delhi", tier: "premier", is_hub: true, lat: 28.57, lon: 77.21, city: "Delhi" },
          { id: "d", name: "DU", tier: "premier", is_hub: true, lat: 28.68, lon: 77.21, city: "Delhi" },
          { id: "e", name: "BHU", tier: "premier", is_hub: true, lat: 25.27, lon: 82.99, city: "Varanasi" },
          { id: "f", name: "Anna Univ", tier: "state_affiliated", is_hub: true, lat: 13.01, lon: 80.23, city: "Chennai" },
          { id: "g", name: "Calcutta Univ", tier: "state_affiliated", is_hub: true, lat: 22.58, lon: 88.36, city: "Kolkata" },
        ],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
          { source: "c", target: "d" },
          { source: "d", target: "e" },
          { source: "a", target: "f" },
          { source: "f", target: "g" },
        ],
      };
    }
  }

  function initM2Cards() {
    document.querySelectorAll("[data-m2]").forEach((card) => {
      const id = card.dataset.m2;
      const plot = card.querySelector(".plot");
      if (M2_RENDERERS[id]) M2_RENDERERS[id](plot);
    });
  }

  function initM5Cards() {
    document.querySelectorAll("[data-m5]").forEach((card) => {
      const id = card.dataset.m5;
      const plot = card.querySelector(".plot");
      if (id === "m5-03") {
        initM5Interactive03(plot);
        return;
      }
      const opts = {
        "m5-01": {},
        "m5-02": { splitTier: true },
        "m5-04": { showCorridors: true },
        "m5-05": { showDumbbell: true },
        "m5-06": { showSearch: true },
        "m5-07": { showYear: 2020 },
        "m5-08": { showFootnote: true },
      }[id];
      drawM5Map(plot, opts || {});
    });
  }

  async function boot() {
    if (typeof d3 === "undefined") {
      console.error("D3 failed to load — charts will not render.");
      return;
    }
    initM2Cards();
    await loadM5Sample();
    initM5Cards();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
