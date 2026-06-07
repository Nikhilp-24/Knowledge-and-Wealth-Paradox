/**
 * River → Pool → Tap pipeline map
 * Facts from dashboard/docs RIVER_* + EXPLAINER_FINDINGS_AND_CHANGES.md
 */
(function () {
  "use strict";

  const W = 1280;
  const H = 860;
  const NODE_W = 168;
  const NODE_H = 52;
  const NODE_HALF = NODE_W / 2;

  /** @typedef {{ id: string, label: string, sub?: string, kind: string, x: number, y: number, metrics?: string[], graphs?: string[], blocked?: boolean, special?: string }} Node */

  /** Layout columns: rivers | process | pools | taps */
  const nodes = /** @type {Node[]} */ ([
    // —— Rivers ——
    { id: "wb", label: "World Bank", sub: "GDP · GERD · articles", kind: "river", x: 110, y: 110, metrics: ["gdp", "gerd", "g1pubs"], graphs: ["g1", "g2"] },
    { id: "oecd", label: "OECD MSTI", sub: "GERD % GDP (gated)", kind: "river", x: 110, y: 205, metrics: ["gerd"], graphs: ["g1", "g2"] },
    { id: "uis", label: "UNESCO UIS", sub: "GERD ≡ WB on overlap", kind: "river", x: 110, y: 300, metrics: ["gerd"], graphs: ["g1"] },
    { id: "scimago_c", label: "SCImago Country", sub: "H-index · Documents", kind: "river", x: 110, y: 395, metrics: ["hindex", "g1pubs"], graphs: ["g1", "g2"] },
    { id: "scimago_j", label: "SCImago Journal", sub: "Publisher Q1/Q4 docs", kind: "river", x: 110, y: 490, metrics: ["g2pubs"], graphs: ["g2"] },
    { id: "openalex", label: "OpenAlex", sub: "Topics · cites · institutes", kind: "river", x: 110, y: 585, metrics: ["g3topics", "g4cites", "g5india"], graphs: ["g3", "g4", "g5"] },
    { id: "nirf", label: "NIRF", sub: "Ranks · funding · patents", kind: "river", x: 110, y: 680, metrics: ["g5india"], graphs: ["g5"] },

    // —— Process / gates ——
    { id: "ready", label: "READY_FOR_TEAM", sub: "Clean handoff CSVs", kind: "process", x: 360, y: 230, metrics: ["hindex", "gdp", "gerd", "g1pubs", "g2pubs", "g3topics", "g4cites"], graphs: ["g1", "g2", "g3", "g4"] },
    { id: "gerd_gate", label: "GERD overlap gate", sub: "0.05 pp · no Frankenstein", kind: "process", x: 360, y: 120, metrics: ["gerd"], graphs: ["g1", "g2"] },
    { id: "india_gap", label: "India GERD gap", sub: "WB ends 2020 → missing", kind: "gap", x: 360, y: 350, metrics: ["gerd"], graphs: ["g1", "g2"], special: "india-gerd" },
    { id: "quarantine", label: "Quarantine", sub: "Stub H · yearless Q%", kind: "blocked", x: 360, y: 470, metrics: ["hindex"], graphs: [], blocked: true },
    { id: "invent_removed", label: "Inventing removed", sub: "G2 baseMetrics · data.js stubs", kind: "blocked", x: 360, y: 580, metrics: ["hindex", "gdp", "gerd"], graphs: ["g2"], blocked: true },
    { id: "rebuild", label: "Pool rebuild", sub: "_river_to_pool_rebuild.py", kind: "process", x: 600, y: 280, metrics: ["hindex", "gdp", "gerd", "g1pubs", "g2pubs", "g3topics", "g4cites"], graphs: ["g1", "g2", "g3", "g4"] },
    { id: "g5_process", label: "India network build", sub: "edges · NIRF map · GeoJSON", kind: "process", x: 600, y: 640, metrics: ["g5india"], graphs: ["g5"] },

    // —— Optional India GERD solutions (dashed) ——
    { id: "opt_dst", label: "DST (optional)", sub: "External India series", kind: "optional", x: 520, y: 420, metrics: ["gerd"], graphs: ["g1"], special: "india-gerd" },
    { id: "opt_annotate", label: "Annotate last-known", sub: "Show 2020 + footnote", kind: "optional", x: 520, y: 500, metrics: ["gerd"], graphs: ["g1"], special: "india-gerd" },
    { id: "opt_missing", label: "Leave missing —", sub: "Chosen: honest null", kind: "chosen", x: 520, y: 580, metrics: ["gerd"], graphs: ["g1", "g2"], special: "india-gerd" },

    // —— Pools ——
    { id: "pool_viz1", label: "viz1_data.js", sub: "VIZ1_DATA", kind: "pool", x: 850, y: 150, metrics: ["hindex", "gdp", "gerd", "g1pubs"], graphs: ["g1", "g2"] },
    { id: "pool_ridge", label: "ridgeline_data.js", sub: "REAL_RIDGELINE_DATA", kind: "pool", x: 850, y: 280, metrics: ["g2pubs"], graphs: ["g2"] },
    { id: "pool_viz3", label: "viz3_data.js", sub: "CSV_DATA topics", kind: "pool", x: 850, y: 410, metrics: ["g3topics"], graphs: ["g3"] },
    { id: "pool_viz4", label: "viz4_data.js", sub: "VIZ4_BY_YEAR", kind: "pool", x: 850, y: 530, metrics: ["g4cites"], graphs: ["g4"] },
    { id: "pool_india", label: "india_network/*.json", sub: "+ india_network_data.js", kind: "pool", x: 850, y: 680, metrics: ["g5india"], graphs: ["g5"] },

    // —— Taps ——
    { id: "tap_g1", label: "G1 Peer clusters", sub: "UMAP bubbles", kind: "tap", x: 1120, y: 130, metrics: ["hindex", "gdp", "gerd", "g1pubs"], graphs: ["g1"] },
    { id: "tap_g2", label: "G2 Quality mix", sub: "Q1/Q4 bars + sidebar", kind: "tap", x: 1120, y: 265, metrics: ["g2pubs", "hindex", "gdp", "gerd"], graphs: ["g2"] },
    { id: "tap_g3", label: "G3 Topic frontiers", sub: "Concept works", kind: "tap", x: 1120, y: 400, metrics: ["g3topics"], graphs: ["g3"] },
    { id: "tap_g4", label: "G4 Collab premium", sub: "Cites/paper gap", kind: "tap", x: 1120, y: 530, metrics: ["g4cites"], graphs: ["g4"] },
    { id: "tap_g5", label: "G5 India network", sub: "Map + NIRF footnotes", kind: "tap", x: 1120, y: 680, metrics: ["g5india"], graphs: ["g5"] },
  ]);

  /**
   * Edges: source → target
   * style: live | blocked | dashed | chosen
   */
  const links = [
    // WB / OECD / UIS → GERD gate
    { s: "wb", t: "gerd_gate", metrics: ["gerd", "gdp", "g1pubs"], graphs: ["g1", "g2"], style: "live" },
    { s: "oecd", t: "gerd_gate", metrics: ["gerd"], graphs: ["g1", "g2"], style: "live" },
    { s: "uis", t: "gerd_gate", metrics: ["gerd"], graphs: ["g1"], style: "live" },
    { s: "wb", t: "ready", metrics: ["gdp", "g1pubs"], graphs: ["g1", "g2"], style: "live" },
    { s: "scimago_c", t: "ready", metrics: ["hindex", "g1pubs"], graphs: ["g1", "g2"], style: "live" },
    { s: "scimago_j", t: "ready", metrics: ["g2pubs"], graphs: ["g2"], style: "live" },
    { s: "openalex", t: "ready", metrics: ["g3topics", "g4cites"], graphs: ["g3", "g4"], style: "live" },
    { s: "gerd_gate", t: "ready", metrics: ["gerd"], graphs: ["g1", "g2"], style: "live" },
    { s: "gerd_gate", t: "india_gap", metrics: ["gerd"], graphs: ["g1", "g2"], style: "dashed" },

    // Blocked channels (do not drink)
    { s: "quarantine", t: "rebuild", metrics: ["hindex"], graphs: [], style: "blocked" },
    { s: "invent_removed", t: "tap_g2", metrics: ["hindex", "gdp", "gerd"], graphs: ["g2"], style: "blocked" },

    // India GERD options
    { s: "india_gap", t: "opt_dst", metrics: ["gerd"], graphs: ["g1"], style: "dashed" },
    { s: "india_gap", t: "opt_annotate", metrics: ["gerd"], graphs: ["g1"], style: "dashed" },
    { s: "india_gap", t: "opt_missing", metrics: ["gerd"], graphs: ["g1", "g2"], style: "chosen" },
    { s: "opt_missing", t: "rebuild", metrics: ["gerd"], graphs: ["g1", "g2"], style: "chosen" },
    { s: "opt_dst", t: "rebuild", metrics: ["gerd"], graphs: ["g1"], style: "dashed" },
    { s: "opt_annotate", t: "rebuild", metrics: ["gerd"], graphs: ["g1"], style: "dashed" },

    // Ready → rebuild → pools
    { s: "ready", t: "rebuild", metrics: ["hindex", "gdp", "gerd", "g1pubs", "g2pubs", "g3topics", "g4cites"], graphs: ["g1", "g2", "g3", "g4"], style: "live" },
    { s: "rebuild", t: "pool_viz1", metrics: ["hindex", "gdp", "gerd", "g1pubs"], graphs: ["g1", "g2"], style: "live" },
    { s: "rebuild", t: "pool_ridge", metrics: ["g2pubs"], graphs: ["g2"], style: "live" },
    { s: "rebuild", t: "pool_viz3", metrics: ["g3topics"], graphs: ["g3"], style: "live" },
    { s: "rebuild", t: "pool_viz4", metrics: ["g4cites"], graphs: ["g4"], style: "live" },

    // G5 path
    { s: "openalex", t: "g5_process", metrics: ["g5india"], graphs: ["g5"], style: "live" },
    { s: "nirf", t: "g5_process", metrics: ["g5india"], graphs: ["g5"], style: "live" },
    { s: "g5_process", t: "pool_india", metrics: ["g5india"], graphs: ["g5"], style: "live" },

    // Pools → taps
    { s: "pool_viz1", t: "tap_g1", metrics: ["hindex", "gdp", "gerd", "g1pubs"], graphs: ["g1"], style: "live" },
    { s: "pool_viz1", t: "tap_g2", metrics: ["hindex", "gdp", "gerd"], graphs: ["g2"], style: "live" },
    { s: "pool_ridge", t: "tap_g2", metrics: ["g2pubs"], graphs: ["g2"], style: "live" },
    { s: "pool_viz3", t: "tap_g3", metrics: ["g3topics"], graphs: ["g3"], style: "live" },
    { s: "pool_viz4", t: "tap_g4", metrics: ["g4cites"], graphs: ["g4"], style: "live" },
    { s: "pool_india", t: "tap_g5", metrics: ["g5india"], graphs: ["g5"], style: "live" },
  ];

  const metrics = [
    { id: "hindex", label: "H-index", short: "H" },
    { id: "gerd", label: "GERD % GDP", short: "GERD" },
    { id: "gdp", label: "GDP PPP", short: "GDP" },
    { id: "g1pubs", label: "G1 pubs (WB/SCImago)", short: "G1 pubs" },
    { id: "g2pubs", label: "G2 Q1/Q4 pubs", short: "G2 Q1/Q4" },
    { id: "g3topics", label: "G3 topics", short: "G3" },
    { id: "g4cites", label: "G4 cites/paper", short: "G4" },
    { id: "g5india", label: "G5 India", short: "G5" },
  ];

  const graphs = [
    { id: "g1", label: "G1", title: "Peer clusters" },
    { id: "g2", label: "G2", title: "Quality mix" },
    { id: "g3", label: "G3", title: "Topics" },
    { id: "g4", label: "G4", title: "Collab premium" },
    { id: "g5", label: "G5", title: "India network" },
  ];

  const notesByMetric = {
    overview: {
      title: "Pipeline overview",
      sub: "One owner per metric. Fix the river, then rebuild the pool, then trust the tap.",
      notes: [
        { t: "River", b: "Raw vault + READY_FOR_TEAM CSVs. Never invent values in the tap.", c: "ok" },
        { t: "Pool", b: "Thin browser packs: viz1 / ridgeline / viz3 / viz4 / india_network JSON.", c: "ok" },
        { t: "Tap", b: "G1–G5 charts + labels. Must drink locked owners — no baseMetrics fiction.", c: "ok" },
        { t: "Blocked channels", b: "Stub H quarantine, neutralized data.js stubs, removed G2 inventing — shown as red hatched paths.", c: "warn" },
        { t: "India GERD", b: "WB stops 2020. UIS adds nothing; OECD has no India. Click GERD to see gap + options.", c: "gap" },
      ],
      india: false,
    },
    hindex: {
      title: "Country H-index",
      sub: "Owner: SCImago Country Rank → g1_features_panel / scimago_country_rank_1996_2024.",
      notes: [
        { t: "Live numbers", b: "USA 2022 H = 3388 · India = 1001 (Country Rank cumulative).", c: "ok" },
        { t: "G1 + G2 sidebar", b: "Same river. G2 joins exact-year H from VIZ1_DATA (not invented).", c: "ok" },
        { t: "Quarantine", b: "Stub USA H=53 in sjr_country_metrics — blocked. Do not drink.", c: "warn" },
        { t: "Forbidden", b: "master H_Index_STUB_* · G2 hardcoded baseMetrics (removed).", c: "warn" },
      ],
      india: false,
    },
    gerd: {
      title: "GERD % of GDP",
      sub: "Gated hierarchy: WB base; OECD fills true holes only if country overlap ≤0.05 pp; UIS ≡ WB; no everlasting ffill.",
      notes: [
        { t: "Overlap gate", b: "WB↔UIS match 100%. WB↔OECD ~96% — conflict countries never Frankenstein-stitched.", c: "ok" },
        { t: "USA sample", b: "2022–23 WB; 2024 can be OECD when eligible hole-fill.", c: "ok" },
        { t: "India 2021–2024", b: "Missing. Old pool forward-filled 0.64558% — that was fake. Now show —.", c: "gap" },
        { t: "G2 sidebar", b: "Exact-year join from VIZ1 (no prior-year GERD carry).", c: "ok" },
      ],
      india: true,
    },
    gdp: {
      title: "GDP per capita (PPP)",
      sub: "Owner: World Bank NY.GDP.PCAP.PP.CD in g1_features_panel.",
      notes: [
        { t: "Live", b: "USA 2022 ≈ 77 861 · India ≈ 9 207 via G1 panel.", c: "ok" },
        { t: "G2", b: "Sidebar joins same WB values from VIZ1 — inventing ×1.025^y removed.", c: "ok" },
        { t: "Forbidden", b: "data.js fake GDP growth; G2 invented growth.", c: "warn" },
      ],
      india: false,
    },
    g1pubs: {
      title: "G1 publication size",
      sub: "WB scientific articles, else SCImago Documents. Never OpenAlex for bubble size.",
      notes: [
        { t: "Why", b: "OpenAlex country totals are ~3× larger → fake cliffs if mixed into size.", c: "ok" },
        { t: "Honest name", b: "Country journal articles · documents (author-country).", c: "ok" },
        { t: "Not the same as G2", b: "G2 counts publisher-country journal docs — different river.", c: "gap" },
      ],
      india: false,
    },
    g2pubs: {
      title: "G2 Q1 / Q4 publications",
      sub: "Owner: q1_q4_country_year.csv — publisher Country, not author country.",
      notes: [
        { t: "Pool", b: "ridgeline_data.js from journalrank aggregate.", c: "ok" },
        { t: "USA 2022", b: "q1/q4 ratio ≈ 14.90 (publisher-country docs).", c: "ok" },
        { t: "Stub Q%", b: "Yearless master Q1_Percent quarantined — wrong unit for G2.", c: "warn" },
      ],
      india: false,
    },
    g3topics: {
      title: "G3 topic works",
      sub: "OpenAlex concepts. AI = Machine learning C119857082 · Quantum C58053490.",
      notes: [
        { t: "Pool filter", b: "Mega-AI C154945302 stays in river CSV but must not be primary in pool.", c: "ok" },
        { t: "Forbidden", b: "ASJC 2500 as Quantum; mega-AI as default AI & ML.", c: "warn" },
        { t: "USA / India 2022 AI", b: "41 530 / 25 155 works (locked ML concept).", c: "ok" },
      ],
      india: false,
    },
    g4cites: {
      title: "G4 collab cites / paper",
      sub: "Owner: collaboration_premium.csv → viz4_data.js (VIZ4_BY_YEAR).",
      notes: [
        { t: "Shows", b: "Domestic vs international mean cites; gap = premium.", c: "ok" },
        { t: "Forbidden", b: "data.js COLLAB_DATA stub (neutralized — returns empty).", c: "warn" },
        { t: "USA 2022", b: "dom 3.93 · intl 12.83 · gain 8.90.", c: "ok" },
      ],
      india: false,
    },
    g5india: {
      title: "G5 India HE network",
      sub: "OpenAlex collab edges + NIRF + static 2019 SCImago Institutions % + GeoJSON.",
      notes: [
        { t: "Pool", b: "dashboard/data/india_network/{year}_*.json — not demo growth.", c: "ok" },
        { t: "Forbidden", b: "DATA.getIndiaNetwork demo inventing (stub empty).", c: "warn" },
        { t: "Works unit", b: "OpenAlex institution stock — not country H / GERD.", c: "ok" },
      ],
      india: false,
    },
  };

  const notesByGraph = {
    g1: {
      title: "G1 — Peer clusters",
      sub: "Drinks viz1_data.js: H, GDP, GERD, WB/SCImago docs → UMAP bubbles.",
      notes: [
        { t: "Rivers", b: "World Bank + SCImago Country (+ gated GERD hierarchy).", c: "ok" },
        { t: "Pool", b: "viz1_data.js from g1_features_panel + hierarchical GERD.", c: "ok" },
        { t: "Rule", b: "Bubble size never uses OpenAlex country totals.", c: "ok" },
      ],
      india: false,
    },
    g2: {
      title: "G2 — Quality mix",
      sub: "Bars from ridgeline (publisher Q1/Q4). Sidebar H/GDP/GERD from VIZ1 join.",
      notes: [
        { t: "Chart river", b: "SCImago journalrank → q1_q4_country_year.csv.", c: "ok" },
        { t: "Sidebar", b: "Same labels as G1 → same VIZ1 river (124/129 matched).", c: "ok" },
        { t: "Blocked", b: "Old baseMetrics inventing path is hatched red — do not revive.", c: "warn" },
      ],
      india: false,
    },
    g3: {
      title: "G3 — Topic frontiers",
      sub: "OpenAlex concept × country × year → viz3_data.js.",
      notes: [
        { t: "River", b: "openalex_topic_country_year.csv + topic_id_map.json.", c: "ok" },
        { t: "IDs locked", b: "AI C119857082 · Quantum C58053490.", c: "ok" },
        { t: "No macro metrics", b: "No country GERD/H/GDP labels on this tap.", c: "ok" },
      ],
      india: false,
    },
    g4: {
      title: "G4 — Collaboration premium",
      sub: "OpenAlex domestic vs intl cites/paper → viz4_data.js.",
      notes: [
        { t: "River", b: "READY_FOR_TEAM/collaboration_premium.csv.", c: "ok" },
        { t: "Tap", b: "Falls back to fake data.js only if pool missing — stub now empty.", c: "ok" },
      ],
      india: false,
    },
    g5: {
      title: "G5 — India network",
      sub: "Processed vault JSON + NIRF footnotes. No country GERD/H on this tap.",
      notes: [
        { t: "Rivers", b: "OpenAlex edges · NIRF · SCImago Institutions 2019 % · outline.", c: "ok" },
        { t: "Pool", b: "india_network year JSON files (live).", c: "ok" },
      ],
      india: false,
    },
  };

  const indiaCallout = {
    body: "World Bank GERD for India last real year ≈ 2020 (0.64558%). UIS matches WB and adds no later years. OECD has no India GERD % rows. Honest UI shows — for 2021–2024.",
    options: [
      { text: "Leave missing (—) — chosen. No everlasting forward-fill.", cls: "chosen" },
      { text: "Annotate last-known (footnote 2020 value) — optional UI path.", cls: "optional" },
      { text: "DST / external India series — optional alternate river (not wired).", cls: "optional" },
    ],
  };

  // —— State ——
  let selection = { type: null, id: null }; // type: metric | graph | node

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  /* Light-mode strokes — semantics: live blue, blocked red, optional orange, gate/rebuild purple */
  const kindColor = {
    river: "#0284c7",
    process: "#7c3aed",
    pool: "#059669",
    tap: "#d97706",
    blocked: "#dc2626",
    gap: "#ea580c",
    optional: "#ea580c",
    chosen: "#059669",
  };

  // —— Chips ——
  const metricChips = d3.select("#metric-chips");
  const graphChips = d3.select("#graph-chips");

  metrics.forEach((m) => {
    metricChips
      .append("button")
      .attr("type", "button")
      .attr("class", "chip")
      .attr("data-metric", m.id)
      .text(m.label)
      .on("click", () => selectMetric(m.id));
  });

  graphs.forEach((g) => {
    graphChips
      .append("button")
      .attr("type", "button")
      .attr("class", "chip graph")
      .attr("data-graph", g.id)
      .text(`${g.label} · ${g.title}`)
      .on("click", () => selectGraph(g.id));
  });

  d3.select("#reset-btn").on("click", resetSelection);

  // —— SVG ——
  const svg = d3
    .select("#pipeline-svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const defs = svg.append("defs");

  // Soft glow
  const glow = defs.append("filter").attr("id", "glow");
  glow.append("feGaussianBlur").attr("stdDeviation", 3.5).attr("result", "coloredBlur");
  const feMerge = glow.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Hatch for blocked — light base so dark labels stay readable
  const hatch = defs
    .append("pattern")
    .attr("id", "blocked-hatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .attr("patternTransform", "rotate(45)");
  hatch.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fee2e2");
  hatch.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 8).attr("stroke", "#dc2626").attr("stroke-width", 2.5);

  // Animated dash for live flow
  const flowGrad = defs
    .append("linearGradient")
    .attr("id", "flow-grad")
    .attr("x1", "0%")
    .attr("x2", "100%");
  flowGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0284c7").attr("stop-opacity", 0.25);
  flowGrad.append("stop").attr("offset", "50%").attr("stop-color", "#0891b2").attr("stop-opacity", 0.95);
  flowGrad.append("stop").attr("offset", "100%").attr("stop-color", "#059669").attr("stop-opacity", 0.4);

  const gRoot = svg.append("g").attr("class", "root");

  // Soft lane bands behind the graph (readable column structure)
  const gLanes = gRoot.append("g").attr("class", "lanes").attr("pointer-events", "none");
  const laneBands = [
    { x: 20, w: 200, fill: "rgba(2,132,199,0.06)" },
    { x: 250, w: 420, fill: "rgba(124,58,237,0.05)" },
    { x: 720, w: 260, fill: "rgba(5,150,105,0.055)" },
    { x: 1020, w: 240, fill: "rgba(217,119,6,0.055)" },
  ];
  laneBands.forEach((lane) => {
    gLanes
      .append("rect")
      .attr("x", lane.x)
      .attr("y", 48)
      .attr("width", lane.w)
      .attr("height", H - 90)
      .attr("rx", 14)
      .attr("fill", lane.fill)
      .attr("stroke", "rgba(26,29,36,0.04)");
  });

  const gLinks = gRoot.append("g").attr("class", "links");
  const gParticles = gRoot.append("g").attr("class", "particles");
  const gNodes = gRoot.append("g").attr("class", "nodes");

  function linkPath(d) {
    const a = nodeById[d.s];
    const b = nodeById[d.t];
    const x0 = a.x + NODE_HALF;
    const y0 = a.y;
    const x1 = b.x - NODE_HALF;
    const y1 = b.y;
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }

  function strokeForStyle(style) {
    if (style === "blocked") return "#dc2626";
    if (style === "dashed") return "#ea580c";
    if (style === "chosen") return "#059669";
    return "#0284c7";
  }

  const linkSel = gLinks
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", (d) => `link-path style-${d.style}`)
    .attr("d", linkPath)
    .attr("stroke", (d) => strokeForStyle(d.style))
    .attr("stroke-width", (d) => (d.style === "blocked" ? 2.6 : 2.4))
    .attr("stroke-opacity", (d) => (d.style === "blocked" ? 0.75 : 0.72))
    .attr("stroke-dasharray", (d) => {
      if (d.style === "dashed") return "7 6";
      if (d.style === "blocked") return "3 4";
      if (d.style === "chosen") return "10 4";
      return "0";
    })
    .attr("marker-end", null);

  // Nodes
  const nodeSel = gNodes
    .selectAll("g.node")
    .data(nodes)
    .join("g")
    .attr("class", (d) => `node node-${d.kind}`)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .attr("data-id", (d) => d.id)
    .on("click", (event, d) => {
      event.stopPropagation();
      selectNode(d.id);
    });

  nodeSel.each(function (d) {
    const g = d3.select(this);
    const w = NODE_W;
    const h = d.sub ? NODE_H : 40;
    const fill =
      d.kind === "blocked"
        ? "url(#blocked-hatch)"
        : d.kind === "gap"
          ? "rgba(234,88,12,0.12)"
          : d.kind === "optional"
            ? "rgba(234,88,12,0.08)"
            : d.kind === "chosen"
              ? "rgba(5,150,105,0.10)"
              : d.kind === "river"
                ? "#e0f2fe"
                : d.kind === "process"
                  ? "#ede9fe"
                  : d.kind === "pool"
                    ? "#d1fae5"
                    : d.kind === "tap"
                      ? "#fef3c7"
                      : "#fafaf7";
    const stroke = kindColor[d.kind] || "#5a6570";

    g.append("rect")
      .attr("class", "node-body node-hit")
      .attr("x", -w / 2)
      .attr("y", -h / 2)
      .attr("width", w)
      .attr("height", h)
      .attr("rx", 11)
      .attr("fill", fill)
      .attr("stroke", stroke)
      .attr("stroke-width", d.kind === "blocked" ? 2 : 2.2)
      .attr("stroke-dasharray", d.kind === "optional" || d.kind === "gap" ? "5 4" : null);

    g.append("text")
      .attr("class", "node-body")
      .attr("text-anchor", "middle")
      .attr("y", d.sub ? -5 : 5)
      .attr("fill", "#1a1d24")
      .attr("font-family", "Outfit, sans-serif")
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .text(d.label);

    if (d.sub) {
      g.append("text")
        .attr("class", "node-body")
        .attr("text-anchor", "middle")
        .attr("y", 14)
        .attr("fill", "#5a6570")
        .attr("font-family", "Plus Jakarta Sans, sans-serif")
        .attr("font-size", 10)
        .text(d.sub);
    }

    if (d.blocked) {
      g.append("text")
        .attr("class", "node-body")
        .attr("x", w / 2 - 10)
        .attr("y", -h / 2 + 14)
        .attr("text-anchor", "end")
        .attr("fill", "#b91c1c")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .text("x");
    }
  });

  // Particles along live links
  const liveLinks = links.filter((l) => l.style === "live");
  const particles = [];
  liveLinks.forEach((link, i) => {
    const count = 2;
    for (let k = 0; k < count; k++) {
      particles.push({
        link,
        t: (i * 0.13 + k * 0.45) % 1,
        speed: 0.0018 + (i % 5) * 0.00025,
      });
    }
  });

  const partSel = gParticles
    .selectAll("circle")
    .data(particles)
    .join("circle")
    .attr("r", 2.4)
    .attr("fill", "#0891b2")
    .attr("opacity", 0.75);

  function pointOnLink(link, t) {
    const a = nodeById[link.s];
    const b = nodeById[link.t];
    const x0 = a.x + NODE_HALF;
    const y0 = a.y;
    const x1 = b.x - NODE_HALF;
    const y1 = b.y;
    const mx = (x0 + x1) / 2;
    // Cubic Bezier
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x1;
    const y = u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1;
    return [x, y];
  }

  function tickParticles() {
    particles.forEach((p) => {
      p.t += p.speed;
      if (p.t > 1) p.t -= 1;
    });
    partSel
      .attr("cx", (d) => pointOnLink(d.link, d.t)[0])
      .attr("cy", (d) => pointOnLink(d.link, d.t)[1])
      .attr("opacity", (d) => {
        if (!selection.type) return 0.55;
        return linkMatches(d.link) ? 0.95 : 0.05;
      });
    requestAnimationFrame(tickParticles);
  }
  requestAnimationFrame(tickParticles);

  // —— Selection logic ——
  function linkMatches(link) {
    if (selection.type === "metric") {
      return (link.metrics || []).includes(selection.id);
    }
    if (selection.type === "graph") {
      return (link.graphs || []).includes(selection.id);
    }
    if (selection.type === "node") {
      const id = selection.id;
      return link.s === id || link.t === id || pathTouchesNode(id).has(link.s + ">" + link.t);
    }
    return true;
  }

  function nodeMatches(node) {
    if (selection.type === "metric") {
      return (node.metrics || []).includes(selection.id);
    }
    if (selection.type === "graph") {
      return (node.graphs || []).includes(selection.id);
    }
    if (selection.type === "node") {
      const set = pathTouchesNode(selection.id);
      return set.has(node.id) || node.id === selection.id;
    }
    return true;
  }

  /** BFS along undirected edges for node click — prefer metric/graph semantics when possible */
  function pathTouchesNode(nodeId) {
    const set = new Set([nodeId]);
    // Include incident links' other ends + one hop along matching styles
    links.forEach((l) => {
      if (l.s === nodeId || l.t === nodeId) {
        set.add(l.s);
        set.add(l.t);
      }
    });
    // Expand: for special india nodes, pull full GERD path
    const n = nodeById[nodeId];
    if (n && n.special === "india-gerd") {
      nodes.forEach((x) => {
        if (x.special === "india-gerd" || (x.metrics || []).includes("gerd")) {
          // keep tighter: only india-gerd tagged + gate + rebuild chain for gerd
        }
      });
      ["wb", "oecd", "uis", "gerd_gate", "india_gap", "opt_dst", "opt_annotate", "opt_missing", "ready", "rebuild", "pool_viz1", "tap_g1", "tap_g2"].forEach((id) => set.add(id));
    }
    return set;
  }

  function applyHighlight() {
    const active = !!selection.type;

    d3.selectAll(".chip").classed("active", false);
    if (selection.type === "metric") {
      d3.select(`.chip[data-metric="${selection.id}"]`).classed("active", true);
    }
    if (selection.type === "graph") {
      d3.select(`.chip[data-graph="${selection.id}"]`).classed("active", true);
    }

    linkSel
      .classed("dimmed", (d) => active && !linkMatches(d))
      .classed("highlight", (d) => active && linkMatches(d))
      .attr("stroke-opacity", (d) => {
        if (!active) return d.style === "blocked" ? 0.72 : 0.7;
        return linkMatches(d) ? (d.style === "blocked" ? 0.9 : 0.98) : 0.08;
      })
      .attr("stroke-width", (d) => {
        if (active && linkMatches(d)) return d.style === "blocked" ? 3 : 3.6;
        return d.style === "blocked" ? 2.6 : 2.4;
      })
      .attr("filter", (d) => (active && linkMatches(d) && d.style !== "blocked" ? "url(#glow)" : null));

    nodeSel
      .classed("dimmed", (d) => active && !nodeMatches(d))
      .classed("highlight", (d) => active && nodeMatches(d))
      .selectAll(".node-body")
      .attr("opacity", (d) => {
        // d is not available on child — use parent
        return null;
      });

    nodeSel.attr("opacity", (d) => {
      if (!active) return 1;
      return nodeMatches(d) ? 1 : 0.28;
    });

    // Animate dash offset on highlighted live links
    linkSel.each(function (d) {
      const el = d3.select(this);
      if (active && linkMatches(d) && d.style === "live") {
        el.attr("stroke-dasharray", "8 10");
      } else if (d.style === "dashed") {
        el.attr("stroke-dasharray", "7 6");
      } else if (d.style === "blocked") {
        el.attr("stroke-dasharray", "3 4");
      } else if (d.style === "chosen") {
        el.attr("stroke-dasharray", "10 4");
      } else if (!active) {
        el.attr("stroke-dasharray", "0");
      } else {
        el.attr("stroke-dasharray", d.style === "live" ? "0" : el.attr("stroke-dasharray"));
      }
    });

    updateNotes();
    updateHint();
  }

  // Dash animation
  let dashOffset = 0;
  function animateDash() {
    dashOffset = (dashOffset + 0.6) % 18;
    linkSel.each(function (d) {
      if (selection.type && linkMatches(d) && (d.style === "live" || d.style === "chosen" || d.style === "dashed")) {
        d3.select(this).attr("stroke-dashoffset", -dashOffset);
      }
    });
    requestAnimationFrame(animateDash);
  }
  requestAnimationFrame(animateDash);

  function updateHint() {
    const el = d3.select("#flow-hint");
    if (!selection.type) {
      el.text("Click a metric or graph chip — or a node on the diagram — to light its path.");
      return;
    }
    if (selection.type === "metric") {
      const m = metrics.find((x) => x.id === selection.id);
      el.text(`Highlighting river → pool → tap for: ${m ? m.label : selection.id}`);
      return;
    }
    if (selection.type === "graph") {
      const g = graphs.find((x) => x.id === selection.id);
      el.text(`Showing which rivers feed ${g ? g.label + " · " + g.title : selection.id}`);
      return;
    }
    const n = nodeById[selection.id];
    el.text(`Focused on node: ${n ? n.label : selection.id}`);
  }

  function updateNotes() {
    let pack = notesByMetric.overview;
    if (selection.type === "metric" && notesByMetric[selection.id]) {
      pack = notesByMetric[selection.id];
    } else if (selection.type === "graph" && notesByGraph[selection.id]) {
      pack = notesByGraph[selection.id];
    } else if (selection.type === "node") {
      const n = nodeById[selection.id];
      if (n && n.special === "india-gerd") {
        pack = notesByMetric.gerd;
      } else if (n && (n.metrics || []).length === 1) {
        pack = notesByMetric[n.metrics[0]] || pack;
      } else if (n && (n.graphs || []).length === 1) {
        pack = notesByGraph[n.graphs[0]] || pack;
      } else {
        pack = {
          title: n ? n.label : "Node",
          sub: n ? n.sub || "" : "",
          notes: [
            { t: "Kind", b: n ? n.kind : "", c: n && n.blocked ? "warn" : "ok" },
            {
              t: "Metrics",
              b: n && n.metrics && n.metrics.length ? n.metrics.join(", ") : "—",
              c: "ok",
            },
            {
              t: "Graphs",
              b: n && n.graphs && n.graphs.length ? n.graphs.join(", ").toUpperCase() : "none / blocked",
              c: n && n.blocked ? "warn" : "ok",
            },
          ],
          india: !!(n && n.special === "india-gerd"),
        };
      }
    }

    d3.select("#notes-title").text(pack.title);
    d3.select("#notes-sub").text(pack.sub);
    const list = d3.select("#notes-list");
    list.selectAll("li").remove();
    pack.notes.forEach((note) => {
      const li = list.append("li").attr("class", note.c || "");
      li.append("strong").text(note.t);
      li.append("span").text(note.b);
    });

    const showIndia = pack.india || (selection.type === "metric" && selection.id === "gerd");
    const callout = d3.select("#india-callout");
    callout.attr("hidden", showIndia ? null : true);
    if (showIndia) {
      d3.select("#india-callout-body").text(indiaCallout.body);
      const ul = d3.select("#india-options");
      ul.selectAll("li").remove();
      indiaCallout.options.forEach((o) => {
        ul.append("li").attr("class", o.cls).text(o.text);
      });
    }
  }

  function selectMetric(id) {
    if (selection.type === "metric" && selection.id === id) {
      resetSelection();
      return;
    }
    selection = { type: "metric", id };
    applyHighlight();
  }

  function selectGraph(id) {
    if (selection.type === "graph" && selection.id === id) {
      resetSelection();
      return;
    }
    selection = { type: "graph", id };
    applyHighlight();
  }

  function selectNode(id) {
    const n = nodeById[id];
    // Prefer metric highlight when node is primarily one metric
    if (n && n.special === "india-gerd") {
      selection = { type: "metric", id: "gerd" };
      applyHighlight();
      return;
    }
    if (selection.type === "node" && selection.id === id) {
      resetSelection();
      return;
    }
    selection = { type: "node", id };
    applyHighlight();
  }

  function resetSelection() {
    selection = { type: null, id: null };
    applyHighlight();
  }

  svg.on("click", () => resetSelection());

  // Init notes
  updateNotes();
  updateHint();
})();
