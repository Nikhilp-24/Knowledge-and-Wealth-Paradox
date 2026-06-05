// ============================================================
// Module 5 — India Domestic HE Network (Leaflet)
// Right detail panel · center-left focus · India-only basemap
// ============================================================

const INDIA = (() => {
  // Instant revert: set false → old solid indigo regional-cluster fill
  // (or restore dashboard/india_network.js.bak-pre-region-blend).
  const VIZ5_REGION_BLEND = true;
  const CLUSTER_FILL_LEGACY = "rgba(99,102,241,0.35)";
  const CLUSTER_STROKE_LEGACY = "#56B4E9";

  const BASE = "data/india_network/";
  const TIER_LABELS = {
    premier: "Premier",
    state_affiliated: "State & Affiliated",
  };
  const TIER_COLORS = {
    premier: "#0072B2",
    state_affiliated: "#E69F00",
  };
  const INDIA_BOUNDS = L.latLngBounds([6.4, 68.0], [37.8, 97.8]);
  const FOCUS_X_RATIO = 0.36; // center-left of map pane (panel is on the right)
  const FOCUS_Y_RATIO = 0.48;
  const HIT_RADIUS_MULT = 2.5;
  const MIN_HIT_PX = 14;
  const TRIAD_MAP_TOP_K = 5;
  const TRIAD_PANEL_TOP_K = 12;
  const ANIM_MS = 520;
  const CLUSTER_MAX_ZOOM = 7;
  const CLUSTER_PIXEL_DIST = 34;

  function parseHexColor(hex) {
    if (!hex || typeof hex !== "string") return null;
    const h = hex.replace("#", "").trim();
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    if (h.length !== 6) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function mixHexColors(hexA, hexB, weightA) {
    const a = parseHexColor(hexA);
    const b = parseHexColor(hexB);
    if (!a || !b) return hexA || hexB || "#64748b";
    const t = Math.max(0, Math.min(1, weightA));
    const r = Math.round(a.r * t + b.r * (1 - t));
    const g = Math.round(a.g * t + b.g * (1 - t));
    const bch = Math.round(a.b * t + b.b * (1 - t));
    return (
      "#" +
      [r, g, bch]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  /** Weighted Premier/State fill for a regional (screen) cluster of institutions. */
  function regionClusterStyle(nodes) {
    if (!VIZ5_REGION_BLEND) {
      return {
        fillColor: CLUSTER_FILL_LEGACY,
        color: CLUSTER_STROKE_LEGACY,
        premier: 0,
        state: 0,
        premierFrac: null,
      };
    }
    let premier = 0;
    let state = 0;
    (nodes || []).forEach((n) => {
      if (n.tier === "premier") premier += 1;
      else if (n.tier === "state_affiliated") state += 1;
    });
    const total = premier + state;
    if (total === 0) {
      return {
        fillColor: "#64748b",
        color: "#94a3b8",
        premier: 0,
        state: 0,
        premierFrac: null,
      };
    }
    const premierFrac = premier / total;
    const fillColor = mixHexColors(
      TIER_COLORS.premier,
      TIER_COLORS.state_affiliated,
      premierFrac
    );
    return {
      fillColor,
      color: mixHexColors(fillColor, "#0f172a", 0.75),
      premier,
      state,
      premierFrac,
    };
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  function parseEdgeKey(key) {
    const parts = key.split("|");
    return { kind: parts[0] || "star", id1: parts[1], id2: parts[2] };
  }

  const cache = {
    overview: null,
    full: null,
    outline: null,
    manifest: null,
    byYear: {},
    loadPromise: null,
  };

  function fetchJson(url) {
    const filename = url.replace(BASE, '');
    if (INDIA_NETWORK_DATA[filename]) {
        return Promise.resolve(INDIA_NETWORK_DATA[filename]);
    }
    return Promise.reject(new Error(`Failed to load ${url}`));
  }

  function loadYearPayload(year) {
    const key = String(year);
    if (cache.byYear[key]) return Promise.resolve(cache.byYear[key]);
    const filename = `${key}_full.json`;
    if (INDIA_NETWORK_DATA[filename]) {
        cache.byYear[key] = INDIA_NETWORK_DATA[filename];
        return Promise.resolve(cache.byYear[key]);
    }
    console.warn(`India network: missing payload for year ${year}`);
    return Promise.reject(new Error(`No payload for year ${year}`));
  }

  function availableYears() {
    if (cache.manifest?.available_years?.length) {
      return cache.manifest.available_years.map(Number);
    }
    return [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  }

  function isValidCoord(node) {
    return (
      node &&
      Number.isFinite(node.lat) &&
      Number.isFinite(node.lon) &&
      node.lat >= 6 &&
      node.lat <= 38 &&
      node.lon >= 68 &&
      node.lon <= 98
    );
  }

  function tierLabel(tier) {
    return TIER_LABELS[tier] || tier;
  }

  function nirfRankLabel(node) {
    const cat = node && node.nirf_ranking_category;
    return cat ? `NIRF rank (${cat})` : "NIRF rank";
  }

  function nirfStatusNote(node) {
    if (node.nirf_rank != null) return "";
    if (node.nirf_match_status === "blocked") {
      return `<p class="india-data-note">NIRF ID blocked — another institute holds the nearest matching ID (see pipeline loser report).</p>`;
    }
    if (node.nirf_match_status === "unranked" || node.nirf_rank == null) {
      return `<p class="india-data-note">Not ranked in NIRF 2024 — no official NIRF metadata.</p>`;
    }
    return "";
  }

  function fundingDuplicateNote(node) {
    if (node.funding_duplicate_cluster === "bhu_campus_family") {
      return `<p class="india-data-note">Funding amount shared with BHU campus entities — same NIRF Overall submission (IR-O-U-0500).</p>`;
    }
    if (node.funding_duplicate_cluster === "coincidental_rounding") {
      return `<p class="india-data-note">Funding amount coincidentally matches another institute after rounding (distinct NIRF PDF rows).</p>`;
    }
    return "";
  }

  function fundingStaticNote(net) {
    // Replaced by separate line in metricYearMismatchNote
    return "";
  }

  function metricYearMismatchNote(node, net) {
    const sliceYear =
      net.meta?.year && net.meta.year !== "all" ? Number(net.meta.year) : null;
    if (!sliceYear) return "";
    let html = "";
    if (node.patent_year_mismatch) {
      html += `<p class="india-data-note">Patent calendar year (${node.patent_calendar_year || "—"}) differs from collaboration year ${sliceYear}.</p>`;
    }
    if (node.funding_year_mismatch || (net.meta?.funding_academic_year_mapped && !net.meta.funding_academic_year_mapped.includes(String(sliceYear)))) {
      const fundYear = node.funding_academic_year || net.meta?.funding_academic_year_mapped || "—";
      html += `<p class="india-data-note">Funding data from another year (${fundYear}) is being used.</p>`;
    }
    return html;
  }

  function ensureLoaded() {
    if (cache.overview && cache.full) return Promise.resolve(cache);
    if (!cache.loadPromise) {
      cache.overview = INDIA_NETWORK_DATA["2024_overview.json"];
      cache.full = INDIA_NETWORK_DATA["2024_full.json"];
      cache.manifest = INDIA_NETWORK_DATA["manifest.json"] || null;
      cache.outline = INDIA_NETWORK_DATA["india_outline.geojson"] || null;
      if (cache.full?.year && cache.full.year !== "all") {
        cache.byYear[String(cache.full.year)] = cache.full;
      }
      cache.loadPromise = Promise.resolve(cache);
    }
    return cache.loadPromise;
  }

  function projectLinear(lat, lon, width, height, pad = 20) {
    const minLat = 6.5;
    const maxLat = 37.5;
    const minLon = 68.0;
    const maxLon = 97.5;
    return {
      x: pad + ((lon - minLon) / (maxLon - minLon)) * (width - 2 * pad),
      y: pad + ((maxLat - lat) / (maxLat - minLat)) * (height - 2 * pad),
    };
  }

  function filterNetwork(payload, tierFilter) {
    const nodes = payload.nodes.filter(isValidCoord);
    const filteredNodes =
      tierFilter === "All" ? nodes : nodes.filter((n) => n.tier === tierFilter);
    const ids = new Set(filteredNodes.map((n) => n.id));
    const edges = (payload.edges || []).filter(
      (e) => ids.has(e.source) && ids.has(e.target)
    );
    const nodeById = new Map(filteredNodes.map((n) => [n.id, n]));
    const hubIds = new Set(filteredNodes.filter((n) => n.is_hub).map((n) => n.id));
    return { nodes: filteredNodes, edges, nodeById, hubIds, meta: payload, triads: payload.triads || {} };
  }

  function partnerSet(nodeId, edges) {
    const set = new Set();
    edges.forEach((e) => {
      if (e.source === nodeId) set.add(e.target);
      if (e.target === nodeId) set.add(e.source);
    });
    return set;
  }

  function focusGraph(selectedId, edges, triads, opts = {}) {
    const { showTriadsOnMap = false, highlightPartnerId = null, triadTopK = TRIAD_MAP_TOP_K } = opts;
    const partners = partnerSet(selectedId, edges);
    const starEdges = edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => ({ ...e, kind: "star" }));

    const triadRows = triadPartnerRows(selectedId, edges, triads);
    let triadEdges = [];
    if (showTriadsOnMap) {
      let rows = triadRows;
      if (highlightPartnerId) {
        rows = rows.filter((r) => r.a === highlightPartnerId || r.b === highlightPartnerId);
      }
      triadEdges = rows.slice(0, triadTopK).map((r) => ({
        source: r.a,
        target: r.b,
        weight: r.weight,
        kind: "triad",
      }));
    }

    const visibleIds = new Set([selectedId, ...partners]);
    return { visibleIds, starEdges, triadEdges, triadRows };
  }

  function triadPartnerRows(focusId, edges, triads) {
    const partners = partnerSet(focusId, edges);
    return (triads[focusId] || [])
      .filter(([a, b]) => partners.has(a) && partners.has(b))
      .sort((x, y) => y[2] - x[2])
      .map(([a, b, w]) => ({ a, b, weight: w }));
  }

  function markerRadius(node) {
    const works = node.total_works || 0;
    if (node.is_hub) return Math.min(14, Math.max(7, 5 + Math.sqrt(works) * 0.015));
    return Math.min(9, Math.max(4, 3 + Math.sqrt(works) * 0.008));
  }

  function hitRadius(node) {
    return Math.max(MIN_HIT_PX, markerRadius(node) * HIT_RADIUS_MULT);
  }

  function edgeStrokeWeight(weight) {
    const w = Math.max(1, Number(weight) || 1);
    return Math.min(4, 1 + Math.log2(w));
  }

  /** Overview hub mesh: 3 discrete bins only (visible at country zoom). */
  function overviewEdgeWeight(weight) {
    const w = Number(weight) || 0;
    if (w >= 50) return 3;
    if (w >= 15) return 2;
    return 1.2;
  }

  function focusEdgeStyle(kind) {
    if (kind === "triad") {
      return { color: "#E69F00", weight: 2, opacity: 0.9, dashArray: "6 4" };
    }
    return { color: "#94a3b8", weight: 2.5, opacity: 0.92, dashArray: null };
  }

  function collabStats(node, net) {
    const links = net.edges.filter((e) => e.source === node.id || e.target === node.id);
    const collabTotal = links.reduce((s, l) => s + (l.weight || 0), 0);
    return { links, collabTotal };
  }

  function focusInstitutionOnMap(map, lat, lon, mapStageEl) {
    const zoom = Math.max(map.getZoom(), 6);
    map.flyTo([lat, lon], zoom, { duration: 0.65 });
    map.once("moveend", function alignFocus() {
      map.off("moveend", alignFocus);
      const pt = map.latLngToContainerPoint([lat, lon]);
      const mapW = mapStageEl.clientWidth || map.getSize().x;
      const targetX = mapW * FOCUS_X_RATIO;
      const targetY = map.getSize().y * FOCUS_Y_RATIO;
      map.panBy([pt.x - targetX, pt.y - targetY], { animate: true, duration: 0.4 });
    });
  }

  function buildDefaultPanelHtml(net) {
    const summaries = net.meta.tier_summary || [];
    const tierLines = summaries
      .map(
        (t) =>
          `<div class="india-tier-chip"><span class="dot" style="background:${TIER_COLORS[t.tier] || "#94a3b8"}"></span>` +
          `<strong>${tierLabel(t.tier)}</strong> · ${t.institution_count} inst · avg works ${Math.round(t.mean_total_works || 0).toLocaleString()}` +
          (t.mean_research_funding_cr != null ? ` · avg fund ₹${t.mean_research_funding_cr} Cr` : "") +
          `</div>`
      )
      .join("");

    const footnote =
      "Map shows ~120 research-active institutions. ~40k affiliated colleges are represented in tier averages only. " +
      (net.meta.quality_note ? net.meta.quality_note : "");

    return `
      <h4>India Domestic HE Network</h4>
      <p class="india-panel-intro">Overview mode: hub-to-hub domestic co-publication links. Click or hover a node (generous hit area) for details. Pan and scroll to explore.</p>
      <div class="india-tier-strip india-tier-strip-panel">${tierLines}</div>
      <div class="india-lecture-callouts">
        <p><strong>Encoding</strong> — position = geography; ${
          VIZ5_REGION_BLEND
            ? "individual node color = tier (Premier / State); zoomed-out regional circles: badge = # institutions, fill = Premier/State mix (not area ∝ count)"
            : "color = tier (2 levels)"
        }; node size ∝ √(publications).</p>
        <p><strong>Focus + context</strong> — click an institution: star edges to direct partners on the map; triad++ pairs (3-institution papers) in the sidebar; optional toolbar toggle for top links on map.</p>
        <p><strong>Data note</strong> — ${net.meta.year && net.meta.year !== "all" ? `Showing co-publications for ${net.meta.year}.` : "All-years rollup."} OpenAlex cache complete for 120 institutions; NIRF funding/patents from official PDFs where available.</p>
      </div>
      <p class="india-footnote india-footnote-panel">${footnote}</p>
      <div class="india-hover-preview" id="india-hover-preview" hidden></div>
    `;
  }

  function buildDetailPanelHtml(node, net, tab, locked, ui = {}) {
    const { highlightPartnerId = null, showTriadsOnMap = false } = ui;
    const { links, collabTotal } = collabStats(node, net);
    const col = TIER_COLORS[node.tier] || "#0072B2";
    const lockLabel = locked ? "" : `<p class="india-preview-badge">Preview — click map node to lock</p>`;

    const tabs = `
      <div class="india-sidebar-tabs">
        <button type="button" class="india-tab ${tab === "publications" ? "active" : ""}" data-tab="publications">Publications</button>
        <button type="button" class="india-tab ${tab === "funding" ? "active" : ""}" data-tab="funding">Funding</button>
      </div>`;

    const zeroNote =
      collabTotal === 0
        ? `<p class="india-data-note">No domestic co-publication edges in this year slice for this institution (weight threshold ≥ 2).</p>`
        : "";

    if (tab === "funding") {
      const fundCr = node.research_funding_cr;
      const expCr = node.total_expenditure_cr;
      const projects = node.sponsored_projects;
      const fundYear = node.funding_academic_year || "—";
      const tierFund = (net.meta.tier_summary || []).find((t) => t.tier === node.tier);
      const tierAvg = tierFund?.mean_research_funding_cr;
      const fundStatus = node.funding_status || (fundCr != null ? "reported" : "unavailable");
      const patentStatus = node.patent_status || (node.patents_published != null ? "reported" : "unavailable");

      let fundingBlock = "";
      if (fundStatus === "unranked") {
        fundingBlock = `<p class="india-data-note">Not ranked in NIRF 2024 — no official funding submission available.</p>`;
      } else if (fundStatus === "unavailable" && fundCr == null) {
        fundingBlock = `<p class="india-data-note">Ranked in NIRF 2024 but sponsored-research amount not found in scraped PDFs.</p>`;
      } else {
        fundingBlock = `
        <div class="inst-stat-row"><span>Sponsored research received</span><strong>${fundCr != null ? "₹" + fundCr.toFixed(1) + " Cr" : "—"}</strong></div>
        <div class="inst-stat-row"><span>NIRF academic year</span><strong>${fundYear}</strong></div>
        <div class="inst-stat-row"><span>Sponsored projects (count)</span><strong>${projects != null ? projects : "—"}</strong></div>
        <div class="inst-stat-row"><span>Total expenditure</span><strong>${expCr != null ? "₹" + expCr.toFixed(1) + " Cr" : "—"}</strong></div>`;
      }
      const dupNote = fundingDuplicateNote(node);

      let patentBlock = "";
      if (patentStatus === "unranked" || patentStatus === "unavailable" || node.patents_published == null) {
        patentBlock = `<p class="india-data-note">Number of years for which patent data is available: 0</p>`;
      } else if (patentStatus === "duplicate_resolved") {
        patentBlock = `<p class="india-data-note">Patent counts withheld — duplicate source row resolved (see pipeline audit).</p>`;
      } else {
        const totalPatents = (node.patents_published || 0) + (node.patents_granted || 0);
        patentBlock = `
        <div class="inst-stat-row"><span>Total patents published & granted (${node.patent_calendar_year || "—"})</span><strong>${totalPatents}</strong></div>`;
      }

      return `
        ${lockLabel}
        <button type="button" class="india-panel-close" aria-label="Clear selection">×</button>
        <h3 class="inst-name">${node.name}</h3>
        <span class="inst-tier" style="background:${col}33;color:${col}">${tierLabel(node.tier)}</span>
        ${tabs}
        ${fundingBlock}
        ${dupNote}
        <div class="inst-stat-row"><span>${nirfRankLabel(node)}</span><strong>${node.nirf_rank != null ? "#" + node.nirf_rank : "—"}</strong></div>
        ${nirfStatusNote(node)}
        ${patentBlock}
        ${tierAvg != null ? `<p class="india-funding-note">${tierLabel(node.tier)} tier avg sponsored research: <strong>₹${tierAvg.toFixed(1)} Cr</strong> (institutions with NIRF submissions only).</p>` : ""}
        ${metricYearMismatchNote(node, net)}
        ${fundingStaticNote(net)}
        <p class="india-funding-note">Source: official NIRF PDFs on nirfindia.org (free). Not all HEIs file detailed returns.</p>
      `;
    }

    const triadRows = triadPartnerRows(node.id, net.edges, net.triads || {});
    const triadCount = triadRows.length;
    const focusNote = locked
      ? `<p class="india-focus-note">Map shows <strong>direct domestic co-publication partners</strong> (solid lines). ` +
        `Triad++ = papers that include this institution and both partners — listed below; ` +
        `${showTriadsOnMap ? `top ${TRIAD_MAP_TOP_K} shown on map (dashed).` : "use toolbar to show top links on map."}` +
        `</p>`
      : "";

    const triadTable =
      locked && triadCount > 0
        ? `<div class="india-triad-block">
        <h4 class="india-triad-title">Triad++ partner pairs <span class="india-triad-sub">3-institution papers</span></h4>
        <ul class="india-triad-list">
          ${triadRows
            .slice(0, TRIAD_PANEL_TOP_K)
            .map((r) => {
              const pa = net.nodeById.get(r.a);
              const pb = net.nodeById.get(r.b);
              if (!pa || !pb) return "";
              const active =
                highlightPartnerId && (r.a === highlightPartnerId || r.b === highlightPartnerId)
                  ? " is-active"
                  : "";
              return `<li class="india-triad-row${active}">
                <button type="button" class="india-triad-hit" data-partner-a="${r.a}" data-partner-b="${r.b}">
                  <span>${pa.city || pa.name.split(" ").slice(-1)[0]} ↔ ${pb.city || pb.name.split(" ").slice(-1)[0]}</span>
                  <strong>${r.weight}</strong>
                </button>
              </li>`;
            })
            .join("")}
        </ul>
        ${triadCount > TRIAD_PANEL_TOP_K ? `<p class="india-data-note">+ ${triadCount - TRIAD_PANEL_TOP_K} more pairs (panel cap)</p>` : ""}
      </div>`
        : locked
          ? `<p class="india-data-note">No triad++ pairs among direct partners in this year slice.</p>`
          : "";

    return `
      ${lockLabel}
      <button type="button" class="india-panel-close" aria-label="Clear selection">×</button>
      <h3 class="inst-name">${node.name}</h3>
      <span class="inst-tier" style="background:${col}33;color:${col}">${tierLabel(node.tier)}</span>
      ${tabs}
      ${focusNote}
      <div class="inst-stat-row"><span>${nirfRankLabel(node)}</span><strong>${node.nirf_rank != null ? "#" + node.nirf_rank : "—"}</strong></div>
      ${nirfStatusNote(node)}
      <div class="inst-stat-row"><span>OpenAlex works (2015–24)</span><strong>${(node.total_works || 0).toLocaleString()}</strong></div>
      <div class="inst-stat-row"><span>SCImago impact (${node.scimago_year || "—"})</span><strong>${node.scimago_pct != null ? node.scimago_pct + "%" : "—"}</strong></div>
      <div class="inst-stat-row"><span>Domestic co-pubs (year slice)</span><strong>${collabTotal || "—"}</strong></div>
      ${zeroNote}
      <h4 class="india-partner-title">Direct partners <span class="india-triad-sub">co-publication count</span></h4>
      <ul class="india-partner-list">
        ${links
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .slice(0, 10)
          .map((l) => {
            const pid = l.source === node.id ? l.target : l.source;
            const partner = net.nodeById.get(pid);
            if (!partner) return "";
            const active = highlightPartnerId === pid ? " is-active" : "";
            return `<li class="india-partner-row${active}"><button type="button" class="india-partner-hit" data-partner-id="${pid}"><span>${partner.name}</span><strong>${l.weight || 0}</strong></button></li>`;
          })
          .join("") || "<li class='india-search-empty'>No domestic co-publication partners in this year slice</li>"}
      </ul>
      ${triadTable}
    `;
  }

  function drawCardPreview(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ensureLoaded()
      .then(() => {
        const ctx = canvas.getContext("2d");
        canvas.width = canvas.offsetWidth || 400;
        canvas.height = canvas.offsetHeight || 220;
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, w, h);
        const hubs = cache.overview.nodes.filter((n) => n.is_hub && isValidCoord(n));
        const hubIds = new Set(hubs.map((n) => n.id));
        const hubEdges = (cache.overview.edges || []).filter(
          (e) => hubIds.has(e.source) && hubIds.has(e.target)
        );
        const byId = new Map(hubs.map((n) => [n.id, n]));
        hubs.forEach((n) => {
          const p = projectLinear(n.lat, n.lon, w, h);
          n._px = p.x;
          n._py = p.y;
        });
        hubEdges.forEach((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return;
          ctx.beginPath();
          ctx.moveTo(s._px, s._py);
          ctx.lineTo(t._px, t._py);
          ctx.strokeStyle = "rgba(204,121,167,0.45)";
          ctx.lineWidth = edgeStrokeWeight(e.weight);
          ctx.stroke();
        });
        hubs.forEach((n) => {
          ctx.beginPath();
          ctx.arc(n._px, n._py, 5, 0, Math.PI * 2);
          ctx.fillStyle = TIER_COLORS[n.tier] || "#0072B2";
          ctx.fill();
        });
      })
      .catch(() => {});
  }

  function render(body, options) {
    const {
      tierFilter = "All",
      selectedNodeId = null,
      displayYear = null,
      onSelect,
      onYearChange,
    } = options;
    let activeYear = displayYear;
    let net = filterNetwork(cache.full, tierFilter);

    body.innerHTML = "";
    body.classList.add("india-fullbleed");

    const layout = document.createElement("div");
    layout.className = "india-map-layout";

    const mapStage = document.createElement("div");
    mapStage.className = "india-map-stage";

    const mapEl = document.createElement("div");
    mapEl.className = "india-leaflet-map";

    const searchWrap = document.createElement("div");
    searchWrap.className = "india-map-search";
    searchWrap.innerHTML = `
      <input type="search" class="india-search-input" placeholder="Search university…" autocomplete="off" />
      <div class="india-search-results" hidden></div>
    `;

    const toolbar = document.createElement("div");
    toolbar.className = "india-map-toolbar";
    toolbar.innerHTML = `
      <button type="button" class="india-tool-btn" data-action="reset" title="Reset view">⌂ India</button>
      <button type="button" class="india-tool-btn india-tool-triads" data-action="toggle-triads" title="Show top triad++ links on map" hidden>Triad++ map</button>
    `;

    const mapLegend = document.createElement("div");
    mapLegend.className = "india-map-legend";
    mapLegend.innerHTML = `
      <span class="india-leg-region-blend" ${VIZ5_REGION_BLEND ? "" : "hidden"}>
        <i class="india-leg-count-badge" aria-hidden="true">n</i>
        Badge = # institutions
      </span>
      <span class="india-leg-region-blend" ${VIZ5_REGION_BLEND ? "" : "hidden"}>
        <i class="india-leg-blend-swatch" aria-hidden="true"></i>
        Fill = Premier / State mix
      </span>
      <span class="india-leg-tier-premier"><i class="india-leg-dot" style="background:${TIER_COLORS.premier}"></i> Premier</span>
      <span class="india-leg-tier-state"><i class="india-leg-dot" style="background:${TIER_COLORS.state_affiliated}"></i> State &amp; Affiliated</span>
      <span class="india-leg-star" hidden><i></i> Direct partner</span>
      <span class="india-leg-triad" hidden><i></i> Triad++ (top ${TRIAD_MAP_TOP_K})</span>
    `;

    const clusterPicker = document.createElement("div");
    clusterPicker.className = "india-cluster-picker";
    clusterPicker.hidden = true;
    L.DomEvent.disableClickPropagation(clusterPicker);
    L.DomEvent.disableScrollPropagation(clusterPicker);

    const sidePanel = document.createElement("aside");
    sidePanel.className = "india-detail-panel";
    sidePanel.innerHTML = buildDefaultPanelHtml(net);

    mapStage.append(mapEl, searchWrap, toolbar, mapLegend, clusterPicker);
    layout.append(mapStage, sidePanel);
    body.appendChild(layout);

    const map = L.map(mapEl, {
      zoomControl: false,
      minZoom: 4,
      maxZoom: 14,
      maxBounds: INDIA_BOUNDS.pad(0.05),
      maxBoundsViscosity: 0.85,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    if (cache.outline) {
      L.geoJSON(cache.outline, {
        interactive: false,
        style: {
          color: "#64748b",
          weight: 1.2,
          fillColor: "#334155",
          fillOpacity: 0.08,
        },
      }).addTo(map);
    }

    const edgeLayer = L.layerGroup().addTo(map);
    const markerLayer = L.layerGroup().addTo(map);
    const hitLayer = L.layerGroup().addTo(map);
    const labelLayer = L.layerGroup().addTo(map);

    let selectedId = selectedNodeId;
    let hoverId = null;
    let panelTab = "publications";
    let locked = false;
    let showTriadsOnMap = false;
    let highlightPartnerId = null;

    function panelUi() {
      return { highlightPartnerId, showTriadsOnMap };
    }

    function updateMapChrome() {
      const triadBtn = toolbar.querySelector('[data-action="toggle-triads"]');
      if (triadBtn) {
        triadBtn.hidden = !selectedId;
        triadBtn.classList.toggle("is-on", showTriadsOnMap);
        triadBtn.textContent = showTriadsOnMap ? `Triad++ map (${TRIAD_MAP_TOP_K})` : "Triad++ map";
      }
      const blendLegs = mapLegend.querySelectorAll(".india-leg-region-blend");
      const tierP = mapLegend.querySelector(".india-leg-tier-premier");
      const tierS = mapLegend.querySelector(".india-leg-tier-state");
      const starLeg = mapLegend.querySelector(".india-leg-star");
      const triadLeg = mapLegend.querySelector(".india-leg-triad");
      mapLegend.hidden = false;
      blendLegs.forEach((el) => {
        el.hidden = !VIZ5_REGION_BLEND || Boolean(selectedId);
      });
      if (tierP) tierP.hidden = Boolean(selectedId);
      if (tierS) tierS.hidden = Boolean(selectedId);
      if (starLeg) starLeg.hidden = !selectedId;
      if (triadLeg) {
        triadLeg.hidden = !selectedId || !showTriadsOnMap;
      }
    }

    function visibleGraph() {
      if (selectedId) {
        const fg = focusGraph(selectedId, net.edges, net.triads || {}, {
          showTriadsOnMap,
          highlightPartnerId,
        });
        return {
          nodes: net.nodes.filter((n) => fg.visibleIds.has(n.id)),
          starEdges: fg.starEdges,
          triadEdges: fg.triadEdges,
          focusMode: true,
        };
      }
      return {
        nodes: net.nodes,
        starEdges: null,
        triadEdges: null,
        hubEdges: net.edges.filter(
          (e) => net.hubIds.has(e.source) && net.hubIds.has(e.target)
        ),
        focusMode: false,
      };
    }

    function wirePanel(node, isLocked) {
      sidePanel.querySelector(".india-panel-close")?.addEventListener("click", clearSelection);
      sidePanel.querySelectorAll(".india-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          panelTab = btn.dataset.tab;
          sidePanel.innerHTML = buildDetailPanelHtml(node, net, panelTab, isLocked, panelUi());
          wirePanel(node, isLocked);
        });
      });
      sidePanel.querySelectorAll(".india-partner-hit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const pid = btn.dataset.partnerId;
          highlightPartnerId = highlightPartnerId === pid ? null : pid;
          sidePanel.innerHTML = buildDetailPanelHtml(node, net, panelTab, isLocked, panelUi());
          wirePanel(node, isLocked);
          drawNetwork(true);
          updateMapChrome();
        });
      });
      sidePanel.querySelectorAll(".india-triad-hit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const a = btn.dataset.partnerA;
          const b = btn.dataset.partnerB;
          const next = highlightPartnerId === a ? b : a;
          highlightPartnerId = highlightPartnerId === next ? null : next;
          if (!showTriadsOnMap) showTriadsOnMap = true;
          sidePanel.innerHTML = buildDetailPanelHtml(node, net, panelTab, isLocked, panelUi());
          wirePanel(node, isLocked);
          drawNetwork(true);
          updateMapChrome();
        });
      });
    }

    function showDefaultPanel() {
      sidePanel.innerHTML = buildDefaultPanelHtml(net);
      updateMapChrome();
    }

    function showHoverPanel(node) {
      if (locked) return;
      sidePanel.innerHTML = buildDetailPanelHtml(node, net, panelTab, false, panelUi());
      wirePanel(node, false);
    }

    function showLockedPanel(node) {
      sidePanel.innerHTML = buildDetailPanelHtml(node, net, panelTab, true, panelUi());
      wirePanel(node, true);
      updateMapChrome();
    }

    const markerMeta = new Map();
    let lastEdgeKeys = new Set();
    let animToken = 0;
    let clusterMode = false;
    let clusteredNodeIds = new Set();

    function edgeKey(e) {
      const a = e.source < e.target ? e.source : e.target;
      const b = e.source < e.target ? e.target : e.source;
      return `${e.kind || "hub"}|${a}|${b}`;
    }

    function edgePathLatLngs(a, b) {
      // Bind polylines to institution lat/lon (same as hub/star edges). Pixel-space
      // offsets converted via containerPointToLatLng drift tens of km when zoomed out.
      return [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ];
    }

    function polylineStyle(style) {
      return {
        color: style.color || "#64748b",
        weight: style.weight ?? 2,
        opacity: style.opacity ?? 0.9,
        dashArray: style.dashArray ?? null,
      };
    }

    function addEdgeLine(a, b, style, kind = "star") {
      const line = L.polyline(edgePathLatLngs(a, b, kind), polylineStyle(style));
      line.addTo(edgeLayer);
      return line;
    }

    function animateEdgeWorm(anchorNode, farNode, style, retract, kind = "star") {
      return new Promise((resolve) => {
        const coords = edgePathLatLngs(anchorNode, farNode, kind);
        const [anchor, far] = coords;
        const initial = retract ? [anchor, far] : [anchor, anchor];
        const partial = L.polyline(initial, polylineStyle(style)).addTo(edgeLayer);
        const t0 = performance.now();

        const frame = (now) => {
          const t = Math.min(1, (now - t0) / ANIM_MS);
          const e = easeInOutCubic(t);
          const [a, b] = edgePathLatLngs(anchorNode, farNode, kind);
          if (retract) {
            const lat = b[0] + (a[0] - b[0]) * e;
            const lng = b[1] + (a[1] - b[1]) * e;
            partial.setLatLngs([a, [lat, lng]]);
          } else {
            const lat = a[0] + (b[0] - a[0]) * e;
            const lng = a[1] + (b[1] - a[1]) * e;
            partial.setLatLngs([a, [lat, lng]]);
          }
          if (t >= 1) {
            edgeLayer.removeLayer(partial);
            if (!retract) addEdgeLine(anchorNode, farNode, style, kind);
            resolve();
          } else {
            requestAnimationFrame(frame);
          }
        };
        requestAnimationFrame(frame);
      });
    }

    function collectFocusEdges(graph) {
      return [...(graph.starEdges || []), ...(showTriadsOnMap ? graph.triadEdges || [] : [])];
    }

    async function animateYearTransition(prevKeys, prevNet, nextGraph) {
      if (!selectedId) return;
      const focus = net.nodeById.get(selectedId);
      if (!focus) return;

      const nextEdges = collectFocusEdges(nextGraph);
      const nextKeys = new Set(nextEdges.map(edgeKey));
      const added = nextEdges.filter((e) => !prevKeys.has(edgeKey(e)));
      const removed = [...prevKeys].filter((k) => !nextKeys.has(k));
      const token = ++animToken;

      const removalAnims = removed.map(async (key) => {
        if (token !== animToken) return;
        const { kind, id1, id2 } = parseEdgeKey(key);
        const edgeKind = kind === "triad" ? "triad" : "star";
        const style = focusEdgeStyle(edgeKind);
        if (kind === "triad") {
          const a = prevNet.nodeById.get(id1) || net.nodeById.get(id1);
          const b = prevNet.nodeById.get(id2) || net.nodeById.get(id2);
          if (!a || !b) return;
          await animateEdgeWorm(a, b, style, true, "triad");
        } else {
          const partnerId = id1 === selectedId ? id2 : id1;
          const partner = prevNet.nodeById.get(partnerId) || net.nodeById.get(partnerId);
          if (!partner) return;
          await animateEdgeWorm(focus, partner, style, true, "star");
        }
      });

      const additionAnims = added.map(async (e) => {
        if (token !== animToken) return;
        const style = focusEdgeStyle(e.kind);
        if (e.kind === "triad") {
          const a = net.nodeById.get(e.source);
          const b = net.nodeById.get(e.target);
          if (!a || !b) return;
          await animateEdgeWorm(a, b, style, false, "triad");
        } else {
          const other = net.nodeById.get(e.source === selectedId ? e.target : e.source);
          if (!other) return;
          await animateEdgeWorm(focus, other, style, false, "star");
        }
      });

      await Promise.all([...removalAnims, ...additionAnims]);

      if (token !== animToken) return;
      lastEdgeKeys = nextKeys;
    }

    function computeScreenClusters(nodes) {
      const items = nodes.map((n) => ({
        node: n,
        pt: map.latLngToContainerPoint([n.lat, n.lon]),
        r: markerRadius(n),
      }));
      const used = new Set();
      const clusters = [];
      for (let i = 0; i < items.length; i++) {
        if (used.has(i)) continue;
        const group = [items[i]];
        used.add(i);
        for (let j = i + 1; j < items.length; j++) {
          if (used.has(j)) continue;
          const d = Math.hypot(items[i].pt.x - items[j].pt.x, items[i].pt.y - items[j].pt.y);
          if (d < CLUSTER_PIXEL_DIST + items[i].r) {
            group.push(items[j]);
            used.add(j);
          }
        }
        if (group.length > 1) clusters.push(group);
      }
      return clusters;
    }

    function placeClusterPicker(anchorPt) {
      const pad = 8;
      const bottomReserve = 56; // legend / zoom / credit strip
      const stageW = mapStage.clientWidth;
      const stageH = mapStage.clientHeight;
      const availAbove = Math.max(0, anchorPt.y - pad);
      const availBelow = Math.max(0, stageH - bottomReserve - anchorPt.y - pad);
      const preferAbove = availAbove >= availBelow && availAbove >= 160;
      const room = preferAbove ? availAbove : availBelow;
      const maxPanelH = Math.min(320, Math.max(140, room || Math.max(availAbove, availBelow, 140)));

      clusterPicker.style.maxHeight = `${maxPanelH}px`;
      clusterPicker.hidden = false;

      const list = clusterPicker.querySelector(".india-cluster-picker-list");
      if (list) {
        const head = clusterPicker.querySelector(".india-cluster-picker-head");
        const headH = head ? head.offsetHeight : 72;
        list.style.maxHeight = `${Math.max(80, maxPanelH - headH - 4)}px`;
      }

      const pw = clusterPicker.offsetWidth || 240;
      const ph = Math.min(clusterPicker.offsetHeight || maxPanelH, maxPanelH);

      let left = anchorPt.x - pw / 2;
      let top;
      if (preferAbove && anchorPt.y - ph - 10 >= pad) {
        top = anchorPt.y - ph - 10;
      } else if (anchorPt.y + 10 + ph <= stageH - bottomReserve) {
        top = anchorPt.y + 10;
      } else {
        // Fully clamp inside map stage (above credit / legend strip)
        top = Math.max(pad, Math.min(anchorPt.y - ph / 2, stageH - bottomReserve - ph));
      }

      if (left + pw > stageW - pad) left = stageW - pw - pad;
      if (left < pad) left = pad;

      clusterPicker.style.left = `${Math.round(left)}px`;
      clusterPicker.style.top = `${Math.round(top)}px`;
    }

    function showClusterPicker(clusterNodes, latlng) {
      const sorted = [...clusterNodes].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, {
          sensitivity: "base",
        })
      );

      const renderList = (filterText) => {
        const q = String(filterText || "")
          .trim()
          .toLowerCase();
        const filtered = q
          ? sorted.filter(
              (n) =>
                String(n.name || "")
                  .toLowerCase()
                  .includes(q) ||
                String(n.city || "")
                  .toLowerCase()
                  .includes(q)
            )
          : sorted;
        const listEl = clusterPicker.querySelector(".india-cluster-picker-list");
        if (!listEl) return;
        if (!filtered.length) {
          listEl.innerHTML = `<li class="india-cluster-picker-empty">No matches</li>`;
          return;
        }
        listEl.innerHTML = filtered
          .map(
            (n) =>
              `<li><button type="button" data-id="${n.id}">${n.name}<span>${n.city || ""}</span></button></li>`
          )
          .join("");
        listEl.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", (evt) => {
            L.DomEvent.stopPropagation(evt);
            const node = net.nodeById.get(btn.dataset.id);
            if (node) selectNode(node);
            clusterPicker.hidden = true;
          });
        });
      };

      clusterPicker.innerHTML = `
        <div class="india-cluster-picker-head">
          <div class="india-cluster-picker-title">Select institution · ${sorted.length}</div>
          <input type="search" class="india-cluster-picker-search" placeholder="Search college…" autocomplete="off" />
        </div>
        <ul class="india-cluster-picker-list"></ul>`;

      renderList("");

      const searchInput = clusterPicker.querySelector(".india-cluster-picker-search");
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          renderList(searchInput.value);
          placeClusterPicker(map.latLngToContainerPoint(latlng));
        });
        searchInput.addEventListener("keydown", (evt) => {
          L.DomEvent.stopPropagation(evt);
          if (evt.key === "Escape") {
            clusterPicker.hidden = true;
          }
        });
        // Focus after placement so layout is stable
        requestAnimationFrame(() => searchInput.focus());
      }

      const pt = map.latLngToContainerPoint(latlng);
      placeClusterPicker(pt);
    }

    function regionClusterStrokeWeight(count) {
      // Subtle secondary channel — never dominate geography
      return Math.min(3.25, 1.35 + Math.log1p(Math.max(0, count)) * 0.45);
    }

    function drawEdgesFromList(edges) {
      edges.forEach((e) => {
        const a = net.nodeById.get(e.source);
        const b = net.nodeById.get(e.target);
        if (!a || !b) return;
        const kind = e.kind === "triad" ? "triad" : e.kind === "star" ? "star" : "hub";
        if (kind === "hub") {
          const line = L.polyline(
            [
              [a.lat, a.lon],
              [b.lat, b.lon],
            ],
            {
              color: "#64748b",
              weight: overviewEdgeWeight(e.weight),
              opacity: 0.55,
            }
          );
          line.addTo(edgeLayer);
          return;
        }
        const style = focusEdgeStyle(kind);
        addEdgeLine(a, b, style, kind);
      });
    }

    function drawNetwork(fullRedraw = true, edgeOverride = null) {
      if (fullRedraw) {
        edgeLayer.clearLayers();
        markerLayer.clearLayers();
        hitLayer.clearLayers();
        labelLayer.clearLayers();
        markerMeta.clear();
      }

      const graph = visibleGraph();
      const { nodes: visNodes, focusMode } = graph;
      clusterMode = map.getZoom() <= CLUSTER_MAX_ZOOM;
      clusteredNodeIds = new Set();

      if (fullRedraw) {
        let edgesToDraw;
        if (edgeOverride !== null) {
          edgesToDraw = edgeOverride;
        } else if (focusMode) {
          edgesToDraw = collectFocusEdges(graph);
        } else {
          edgesToDraw = graph.hubEdges || [];
        }
        drawEdgesFromList(edgesToDraw);
        if (edgeOverride === null) {
          lastEdgeKeys = new Set(edgesToDraw.map(edgeKey));
        }

        const clusters = clusterMode ? computeScreenClusters(visNodes) : [];
        clusters.forEach((group) => group.forEach((g) => clusteredNodeIds.add(g.node.id)));

        clusters.forEach((group) => {
          const nodes = group.map((g) => g.node);
          const count = nodes.length;
          const lat =
            nodes.reduce((s, n) => s + n.lat, 0) / nodes.length;
          const lon =
            nodes.reduce((s, n) => s + n.lon, 0) / nodes.length;
          const maxR = Math.max(...group.map((g) => g.r));
          const clusterStyle = regionClusterStyle(nodes);
          const strokeW = regionClusterStrokeWeight(count);
          // Radius stays geography-friendly (hit target), NOT ∝ college count
          const clusterHit = L.circleMarker([lat, lon], {
            radius: Math.max(MIN_HIT_PX, maxR + 6),
            fillColor: clusterStyle.fillColor,
            color: clusterStyle.color,
            weight: strokeW,
            fillOpacity: VIZ5_REGION_BLEND ? 0.82 : 0.55,
            interactive: true,
          });
          const mixNote =
            VIZ5_REGION_BLEND && clusterStyle.premierFrac != null
              ? `<br><span class="india-cluster-mix">${clusterStyle.premier} Premier · ${clusterStyle.state} State` +
                ` (${Math.round(clusterStyle.premierFrac * 100)}% / ${Math.round((1 - clusterStyle.premierFrac) * 100)}%)</span>`
              : "";
          const label = `${count} institution${count === 1 ? "" : "s"}`;
          clusterHit.bindTooltip(
            `<div class="india-cluster-tip"><strong>${label}</strong>${mixNote}<br>${nodes
              .map((n) => n.name)
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
              .join("<br>")}</div>`,
            { direction: "top", sticky: true, className: "india-leaflet-tip india-cluster-hover-tip" }
          );
          clusterHit.on("click", (evt) => {
            L.DomEvent.stopPropagation(evt);
            showClusterPicker(nodes, [lat, lon]);
          });
          clusterHit.addTo(hitLayer);

          L.marker([lat, lon], {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "india-region-count",
              html: `<span class="india-region-count-badge" title="${count} institutions">${count}</span>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
          }).addTo(labelLayer);
        });

        visNodes.forEach((node) => {
          if (clusterMode && clusteredNodeIds.has(node.id)) return;

          const r = markerRadius(node);
          const col = TIER_COLORS[node.tier] || node.color || "#0072B2";
          const isSelected = node.id === selectedId;

          const vis = L.circleMarker([node.lat, node.lon], {
            radius: r,
            fillColor: col,
            color: isSelected ? "#ffffff" : "rgba(255,255,255,0.65)",
            weight: isSelected ? 3 : 1.5,
            fillOpacity: 0.9,
            opacity: 1,
            interactive: false,
          }).addTo(markerLayer);
          markerMeta.set(node.id, { layer: vis, node });

          if (node.is_hub || isSelected) {
            L.marker([node.lat, node.lon], {
              interactive: false,
              icon: L.divIcon({
                className: "india-hub-label",
                html: `<span>${node.city || node.name.split(" ").slice(-1)[0]}</span>`,
                iconSize: [0, 0],
                iconAnchor: [-8, r + 6],
              }),
            }).addTo(labelLayer);
          }

          const hit = L.circleMarker([node.lat, node.lon], {
            radius: hitRadius(node),
            fillOpacity: 0,
            opacity: 0,
            stroke: false,
            interactive: true,
            bubblingMouseEvents: false,
          });

          if (selectedId) {
            hit.bindTooltip(node.name, {
              direction: "top",
              offset: [0, -Math.max(8, r)],
              className: "india-leaflet-tip india-node-hover-tip",
            });
          }

          hit.on("mouseover", () => {
            hoverId = node.id;
            if (!locked) showHoverPanel(node);
            applyHighlight();
          });

          hit.on("mouseout", () => {
            if (hoverId === node.id) hoverId = null;
            if (!locked) showDefaultPanel();
            applyHighlight();
          });

          hit.on("click", (evt) => {
            L.DomEvent.stopPropagation(evt);
            clusterPicker.hidden = true;
            selectNode(node);
          });

          hit.addTo(hitLayer);
        });
      }

      applyHighlight();
    }

    function applyHighlight() {
      markerMeta.forEach(({ layer, node }, nodeId) => {
        const r = markerRadius(node);
        const isSelected = nodeId === selectedId;
        const isHover = nodeId === hoverId && !locked;
        layer.setRadius(isSelected ? r + 2 : r);
        layer.setStyle({
          color: isSelected || isHover ? "#ffffff" : "rgba(255,255,255,0.65)",
          weight: isSelected ? 3 : isHover ? 2 : 1.5,
          fillOpacity: 0.9,
          opacity: 1,
        });
      });
    }

    function selectNode(node) {
      const already = selectedId === node.id;
      locked = true;
      selectedId = node.id;
      panelTab = "publications";
      if (!already) {
        highlightPartnerId = null;
      }
      drawNetwork(true);
      showLockedPanel(node);
      if (!already) {
        focusInstitutionOnMap(map, node.lat, node.lon, mapStage);
      }
      if (onSelect) onSelect(node, net);
    }

    function clearSelection() {
      locked = false;
      selectedId = null;
      hoverId = null;
      panelTab = "publications";
      showTriadsOnMap = false;
      highlightPartnerId = null;
      clusterPicker.hidden = true;
      showDefaultPanel();
      drawNetwork(true);
      if (onSelect) onSelect(null, net);
    }

    map.on("click", () => {
      clusterPicker.hidden = true;
      if (locked) clearSelection();
    });

    map.on("zoomend", () => {
      drawNetwork(true);
    });

    toolbar.querySelector('[data-action="toggle-triads"]')?.addEventListener("click", () => {
      if (!selectedId) return;
      showTriadsOnMap = !showTriadsOnMap;
      drawNetwork(true);
      updateMapChrome();
      const node = net.nodeById.get(selectedId);
      if (node && locked) showLockedPanel(node);
    });

    const searchInput = searchWrap.querySelector(".india-search-input");
    const searchResults = searchWrap.querySelector(".india-search-results");

    drawNetwork(true);

    if (selectedId) {
      const node = net.nodeById.get(selectedId);
      if (node) {
        locked = true;
        showLockedPanel(node);
        requestAnimationFrame(() => focusInstitutionOnMap(map, node.lat, node.lon, mapStage));
      }
    } else {
      showDefaultPanel();
    }

    function runSearch(q) {
      const query = q.trim().toLowerCase();
      if (!query) {
        searchResults.hidden = true;
        return;
      }
      const hits = net.nodes
        .filter(
          (n) =>
            n.name.toLowerCase().includes(query) ||
            (n.city && n.city.toLowerCase().includes(query))
        )
        .slice(0, 8);
      if (!hits.length) {
        searchResults.innerHTML = `<div class="india-search-empty">No match</div>`;
        searchResults.hidden = false;
        return;
      }
      searchResults.innerHTML = hits
        .map(
          (n) =>
            `<button type="button" class="india-search-hit" data-id="${n.id}">${n.name}<span>${n.city || ""}</span></button>`
        )
        .join("");
      searchResults.hidden = false;
      searchResults.querySelectorAll(".india-search-hit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const node = net.nodeById.get(btn.dataset.id);
          if (node) {
            selectNode(node);
            searchInput.value = node.name;
            searchResults.hidden = true;
          }
        });
      });
    }

    searchInput.addEventListener("input", () => runSearch(searchInput.value));
    toolbar.querySelector('[data-action="reset"]').addEventListener("click", () => {
      clearSelection();
      map.fitBounds(INDIA_BOUNDS, { padding: [28, 28], animate: true });
    });

    function fitIndia(keepView = false) {
      map.invalidateSize();
      if (!keepView && !selectedId) {
        map.fitBounds(INDIA_BOUNDS, { padding: [28, 28] });
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(() => fitIndia(false)));

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fitIndia(true)) : null;
    ro?.observe(mapStage);

    function destroy() {
      ro?.disconnect();
      body.classList.remove("india-fullbleed");
      map.remove();
    }

    function getPayloadForView() {
      if (activeYear && cache.byYear[String(activeYear)]) {
        return cache.byYear[String(activeYear)];
      }
      return cache.full;
    }

    return {
      destroy,
      setTier(newTier) {
        const prev = selectedId;
        net = filterNetwork(getPayloadForView(), newTier);
        if (prev && !net.nodeById.has(prev)) {
          locked = false;
          selectedId = null;
          showDefaultPanel();
        } else if (prev) {
          showLockedPanel(net.nodeById.get(prev));
        }
        drawNetwork(true);
      },
      setYear(year) {
        const y = Number(year);
        if (!Number.isFinite(y)) return Promise.resolve();
        const prevNet = net;
        const prevKeys = new Set(lastEdgeKeys);
        const prevSelected = selectedId;
        return loadYearPayload(y).then(async (payload) => {
          activeYear = y;
          cache.byYear[String(y)] = payload;
          const prev = selectedId;
          net = filterNetwork(payload, tierFilter);
          if (prev && !net.nodeById.has(prev)) {
            locked = false;
            selectedId = null;
            showDefaultPanel();
            drawNetwork(true);
          } else if (prev) {
            selectedId = prev;
            showLockedPanel(net.nodeById.get(prev));
            const nextGraph = visibleGraph();
            const nextEdges = collectFocusEdges(nextGraph);
            const nextKeys = new Set(nextEdges.map(edgeKey));
            const stableEdges = nextEdges.filter((e) => prevKeys.has(edgeKey(e)));

            if (prevSelected && prevSelected === selectedId) {
              drawNetwork(true, stableEdges);
              await animateYearTransition(prevKeys, prevNet, nextGraph);
            } else {
              drawNetwork(true);
            }
            lastEdgeKeys = nextKeys;
          } else {
            showDefaultPanel();
            drawNetwork(true);
          }
          if (onYearChange) onYearChange(y);
        });
      },
      getYear() {
        return activeYear;
      },
      resize() {
        fitIndia(true);
      },
    };
  }

  return {
    ensureLoaded,
    isReady: () => Boolean(cache.overview),
    availableYears,
    drawCardPreview,
    render,
    TIER_LABELS,
    TIER_COLORS,
  };
})();
