// graphs/g2/g2.js — Graph 2 (Global Quality Shift)
// VIZ 2: Global Quality Shift (Beeswarm Bubble Chart)
// ══════════════════════════════════════════════════════════
let activeRegionFilter = "All";
let activeContinentFilter = "All";
let minPubFilter = 0;
let minHIndexFilter = 0;
let minRdFilter = 0;
let minGdpFilter = 0;
let selectedCountryTrail = null;
let barChartMode = "grouped";
let yAxisScaleMode = "linear";
let activeSortParameter = "Default";

/** Continent for filters only — never invent H/GDP/GERD. */
const G2_REGION_TO_CONTINENT = {
  "Northern America": "Americas",
  "Latin America": "Americas",
  "Western Europe": "Europe",
  "Eastern Europe": "Europe",
  "Asiatic Region": "Asia",
  "Middle East": "Asia",
  "Africa": "Africa",
  "Pacific Region": "Oceania",
  "Africa/Middle East": "Africa"
};

/**
 * Alias groups for G2 publisher-country names ↔ G1 VIZ1 Country_Name / ISO3.
 * Prefer ISO3 when known; otherwise normalize + aliases. Never invent metrics.
 */
const G2_ALIAS_GROUPS = [
  ["United States", "United States of America", "USA", "US", "U.S.", "U.S.A."],
  ["United Kingdom", "United Kingdom of Great Britain and Northern Ireland", "UK", "Great Britain", "Britain"],
  ["Russia", "Russian Federation"],
  ["South Korea", "Korea, Republic of", "Republic of Korea", "Korea, Rep.", "Korea Rep.", "Korea (Republic of)"],
  ["North Korea", "Korea, Democratic People's Republic of", "Korea, Dem. People's Rep.", "Democratic People's Republic of Korea"],
  ["Iran", "Iran, Islamic Republic of", "Islamic Republic of Iran", "Iran, Islamic Rep."],
  ["Czech Republic", "Czechia"],
  // Taiwan often absent from World Bank / VIZ1 — aliases kept; join fails closed if no G1 row
  ["Taiwan", "Taiwan, Province of China", "Taiwan, China", "Chinese Taipei"],
  ["Hong Kong", "Hong Kong SAR, China", "Hong Kong, China"],
  ["Macao", "Macao SAR, China", "Macau", "Macao, China"],
  ["Venezuela", "Venezuela, Bolivarian Republic of", "Venezuela, RB", "Bolivarian Republic of Venezuela"],
  ["Turkey", "Türkiye", "Turkiye"],
  ["Egypt", "Egypt, Arab Rep.", "Arab Republic of Egypt"],
  ["Syria", "Syrian Arab Republic"],
  ["Vietnam", "Viet Nam"],
  ["Laos", "Lao People's Democratic Republic", "Lao PDR"],
  ["Bolivia", "Bolivia, Plurinational State of", "Bolivia (Plurinational State of)"],
  ["Tanzania", "Tanzania, United Republic of", "United Republic of Tanzania"],
  ["Moldova", "Moldova, Republic of", "Republic of Moldova"],
  ["Palestine", "Palestine, State of", "State of Palestine", "West Bank and Gaza"],
  ["Congo", "Congo, Republic of", "Republic of the Congo", "Congo, Rep."],
  ["Democratic Republic of the Congo", "Congo, Democratic Republic of the", "Congo, Dem. Rep.", "DR Congo", "DRC"],
  ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
  ["Brunei", "Brunei Darussalam"],
  ["Cape Verde", "Cabo Verde"],
  ["Swaziland", "Eswatini"],
  ["Macedonia", "North Macedonia", "Macedonia, the former Yugoslav Republic of"],
  ["Slovakia", "Slovak Republic"],
  ["Kyrgyzstan", "Kyrgyz Republic"],
  ["Micronesia", "Micronesia, Federated States of", "Federated States of Micronesia"],
  ["Saint Kitts and Nevis", "St. Kitts and Nevis"],
  ["Saint Lucia", "St. Lucia"],
  ["Saint Vincent and the Grenadines", "St. Vincent and the Grenadines"],
  ["United Arab Emirates", "UAE"],
  ["Bosnia and Herzegovina", "Bosnia & Herzegovina"],
  ["Gambia", "The Gambia", "Gambia, The"],
  ["Bahamas", "The Bahamas", "Bahamas, The"],
  ["Netherlands", "The Netherlands"],
  ["Puerto Rico", "Puerto Rico (US)"],
  ["China", "People's Republic of China", "PRC"]
];

/** Explicit ISO3 pins for common G2 names (beats ambiguous string contains). */
const G2_NAME_TO_ISO3 = {
  "United States": "USA",
  "United Kingdom": "GBR",
  "Russia": "RUS",
  "Russian Federation": "RUS",
  "South Korea": "KOR",
  "Iran": "IRN",
  "Czech Republic": "CZE",
  "Hong Kong": "HKG",
  "Venezuela": "VEN",
  "Turkey": "TUR",
  "Egypt": "EGY",
  "Vietnam": "VNM",
  "Slovakia": "SVK",
  "Kyrgyzstan": "KGZ",
  "Macedonia": "MKD",
  "Palestine": "PSE",
  "Brunei": "BRN",
  "China": "CHN",
  "India": "IND",
  "Japan": "JPN",
  "Germany": "DEU",
  "France": "FRA",
  "Brazil": "BRA",
  "Canada": "CAN",
  "Australia": "AUS",
  "Mexico": "MEX",
  "Indonesia": "IDN",
  "Nigeria": "NGA",
  "Saudi Arabia": "SAU",
  "Poland": "POL"
};

/** Normalize country names for G1↔G2 join (case, punctuation, diacritics). */
function g2NormName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Build one-time indexes from VIZ1 (ISO3 + normalized names + alias expansion). */
let _g2Viz1Index = null;
function g2GetViz1Index() {
  if (_g2Viz1Index) return _g2Viz1Index;
  const byCode = new Map();
  const byNorm = new Map();
  const rowsByCode = new Map();

  if (typeof VIZ1_DATA !== "undefined" && Array.isArray(VIZ1_DATA)) {
    for (const d of VIZ1_DATA) {
      const code = String(d.Country_Code || "").toUpperCase();
      if (!code) continue;
      if (!byCode.has(code)) byCode.set(code, d.Country_Name);
      const n = g2NormName(d.Country_Name);
      if (!byNorm.has(n)) byNorm.set(n, code);
      if (!rowsByCode.has(code)) rowsByCode.set(code, []);
      rowsByCode.get(code).push(d);
    }
  }

  // Expand alias groups onto ISO3 when any member already resolves
  const aliasNormToCode = new Map();
  for (const group of G2_ALIAS_GROUPS) {
    let code = null;
    for (const name of group) {
      const pinned = G2_NAME_TO_ISO3[name];
      if (pinned && byCode.has(pinned)) {
        code = pinned;
        break;
      }
      const hit = byNorm.get(g2NormName(name));
      if (hit) {
        code = hit;
        break;
      }
    }
    if (!code) continue;
    for (const name of group) {
      aliasNormToCode.set(g2NormName(name), code);
    }
  }
  for (const [name, code] of Object.entries(G2_NAME_TO_ISO3)) {
    if (byCode.has(code)) aliasNormToCode.set(g2NormName(name), code);
  }

  _g2Viz1Index = { byCode, byNorm, rowsByCode, aliasNormToCode };
  return _g2Viz1Index;
}

/** Resolve G2 country label → VIZ1 ISO3, or null if no G1 country exists. */
function g2ResolveIso3(countryName) {
  const idx = g2GetViz1Index();
  const raw = String(countryName || "").trim();
  if (!raw) return null;

  const pinned = G2_NAME_TO_ISO3[raw];
  if (pinned && idx.byCode.has(pinned)) return pinned;

  const n = g2NormName(raw);
  if (idx.aliasNormToCode.has(n)) return idx.aliasNormToCode.get(n);
  if (idx.byNorm.has(n)) return idx.byNorm.get(n);

  // Soft contains for long official names (length-gated to limit false positives)
  if (n.length >= 4) {
    for (const [g1Norm, code] of idx.byNorm) {
      if (g1Norm === n) return code;
      if (g1Norm.includes(n) || n.includes(g1Norm)) {
        const shorter = g1Norm.length < n.length ? g1Norm : n;
        const longer = g1Norm.length < n.length ? n : g1Norm;
        if (shorter.length >= 6 || longer.startsWith(shorter) || longer.endsWith(shorter)) {
          return code;
        }
      }
    }
  }
  return null;
}

/** Join H / GDP / GERD from locked G1 river (VIZ1_DATA). Never invent growth. */
const getCountryMetrics = (countryName, year, q1Count, q4Count, totalCount, regionHint) => {
  const region = regionHint || null;
  const continent = (region && G2_REGION_TO_CONTINENT[region]) || "Unknown";

  let h = null;
  let gdp = null;
  let rd = null;
  let joinedFrom = null;
  let hFromYear = null;
  let gdpFromYear = null;
  let rdFromYear = null;
  let rdLocf = false;

  const iso3 = g2ResolveIso3(countryName);
  if (iso3) {
    const idx = g2GetViz1Index();
    const candidates = idx.rowsByCode.get(iso3) || [];
    const y = Number(year);
    const exact = candidates.find((d) => Number(d.Year) === y) || null;
    // H / GDP: exact year row, else nearest prior VIZ1 row (whole-row prior carry;
    // fail closed — no invented growth). Track which year supplied each field.
    // GERD: exact-year value from VIZ1 (pool applies LOCF ffill). If still null,
    // LOCF from last prior non-null GERD in VIZ1 (same policy as pool).
    let row = exact;
    if (!row && candidates.length) {
      const prior = candidates
        .filter((d) => Number(d.Year) <= y)
        .sort((a, b) => Number(b.Year) - Number(a.Year));
      row = prior[0] || null;
    }

    if (row) {
      h = row.H_Index != null && row.H_Index !== "" ? Number(row.H_Index) : null;
      gdp = row.GDP_Per_Capita_PPP != null && row.GDP_Per_Capita_PPP !== "" ? Number(row.GDP_Per_Capita_PPP) : null;
      if (h != null && !Number.isNaN(h)) hFromYear = Number(row.Year);
      if (gdp != null && !Number.isNaN(gdp)) gdpFromYear = Number(row.Year);
      joinedFrom = `VIZ1:${row.Country_Code}:${row.Year}`;
    }

    const gerdCandidates = candidates
      .filter((d) => Number(d.Year) <= y)
      .sort((a, b) => Number(b.Year) - Number(a.Year));
    const gerdRow = gerdCandidates.find(
      (d) => d.GERD_Percent_GDP != null && d.GERD_Percent_GDP !== ""
    ) || null;
    if (gerdRow) {
      rd = Number(gerdRow.GERD_Percent_GDP);
      rdFromYear = Number(gerdRow.Year);
      rdLocf = rdFromYear !== y;
      if (joinedFrom == null) joinedFrom = `VIZ1:${gerdRow.Country_Code}:${gerdRow.Year}`;
    }
  }

  return {
    continent,
    rd: rd == null || Number.isNaN(rd) ? null : rd,
    gdp: gdp == null || Number.isNaN(gdp) ? null : gdp,
    h: h == null || Number.isNaN(h) ? null : h,
    // G2 “publications” = publisher-country journal docs (distinct from G1 WB/SCImago)
    publications: totalCount,
    joinedFrom,
    iso3: iso3 || null,
    hFromYear,
    gdpFromYear,
    rdFromYear,
    rdLocf,
    metricsMissing: h == null && gdp == null && rd == null
  };
};

// Expose join helpers for smoke tests / console debugging (no invented metrics)
if (typeof window !== "undefined") {
  window.getCountryMetrics = getCountryMetrics;
  window.g2ResolveIso3 = g2ResolveIso3;
}

function renderViz2(body) {
  body.innerHTML = "";

  const getContinentColor = continent => {
    // Okabe-Ito poles — avoid red/green pairs
    const map = {
      "Asia": OKABE.vermillion,
      "Europe": OKABE.blue,
      "Americas": OKABE.green,
      "Africa": OKABE.orange,
      "Oceania": OKABE.purple
    };
    return map[continent] || OKABE.grey;
  };

  const allBubbleData = DATA.getRidgelineData() || {};
  const year = Math.max(1999, Math.min(2024, APP.year || 2024));
  const yearData = allBubbleData[year] || [];

  const countryMaxTotal = {};
  Object.values(allBubbleData).flat().forEach(c => {
    if (c.country && c.total) {
      countryMaxTotal[c.country] = Math.max(countryMaxTotal[c.country] || 0, c.total);
    }
  });

  const countriesList = Array.from(new Set(
    Object.values(allBubbleData).flat().map(c => c.country)
  )).filter(name => (countryMaxTotal[name] || 0) >= 1000).sort();

  const getTier = ratio => {
    // Display tiers use uncapped river ratio; Elite threshold stays 2.0
    if (ratio >= 2.0) return "Elite";
    if (ratio >= 1.0) return "Balanced";
    return "Q4-Dominant";
  };

  const tierColors = {
    "Elite": OKABE_ITO.blue,
    "Balanced": OKABE_ITO.muted,
    "Q4-Dominant": OKABE_ITO.orange
  };

  // Binary contrast: Q1 blue ↔ Q4 orange (Okabe-Ito)
  const chartColors = {
    "q1": OKABE_ITO.blue,
    "q4": OKABE_ITO.orange
  };

  const regionColors = {
    "Northern America": OKABE.sky,
    "Western Europe": OKABE.purple,
    "Asiatic Region": OKABE.green,
    "Latin America": OKABE.orange,
    "Eastern Europe": OKABE.blue,
    "Middle East": OKABE.yellow,
    "Africa": OKABE.vermillion,
    "Africa/Middle East": OKABE.orange,
    "Pacific Region": OKABE.purple
  };
  const getRegionColor = r => regionColors[r] || OKABE.grey;

  // Create grid container
  const container = document.createElement("div");
  container.className = "viz2-dashboard-container";
  container.style.width = "100%";
  container.style.height = "100%";

  // Map metric profiles to raw year entries
  const countryToRegionMap = {};
  yearData.forEach(c => {
    if (c.country && c.region) {
      countryToRegionMap[c.country] = c.region;
    }
  });

  // CSS Styles
  // Styles: graphs/g2/g2.css (loaded from index.html)


  // Compute metric profiles for all countries (H/GDP/GERD from G1 river join)
  const yearDataWithMetrics = yearData.map(c => {
    const metrics = getCountryMetrics(c.country, year, c.q1, c.q4, c.total, c.region);
    return {
      ...c,
      metrics: metrics
    };
  });

  // Continent filters list setup
  const continents = ["All", "Americas", "Europe", "Asia", "Africa", "Oceania"];

  // Sidebar card HTML skeleton
  const sidebar = document.createElement("div");
  sidebar.className = "viz2-sidebar-card";
  
  let sidebarHtml = `
    <div>
      <div class="project-badge" style="display: inline-block; margin-bottom: 0.35rem; font-size: 0.7rem;">Dashboard Module 02</div>
      <h3 style="font-size: 1.15rem; font-weight: 800; background: linear-gradient(135deg, #0e7490 0%, #0072B2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Global Quality Shift</h3>
    </div>

    <!-- Country Highlight Dropdown -->
    <div class="viz2-select-wrapper">
      <label>Highlight Country Profile</label>
      <select id="country-select-dropdown" class="ctrl-select" style="width: 100%;">
        <option value="">-- Highlight Country --</option>
        ${countriesList.map(c => {
          const region = countryToRegionMap[c];
          const label = region ? `${c} (${region})` : c;
          return `<option value="${c}" ${selectedCountryTrail === c ? "selected" : ""}>${label}</option>`;
        }).join("")}
      </select>
    </div>
  `;

  // Render Country metrics block (Publications, H-Index, R&D Spend, GDP/Capita) matching screenshot
  if (selectedCountryTrail) {
    const selectedMetrics = yearDataWithMetrics.find(c => c.country === selectedCountryTrail);
    if (selectedMetrics) {
      const q1 = selectedMetrics.q1 || 0;
      const q4 = selectedMetrics.q4 || 0;
      const qTotal = q1 + q4;
      const q1Pct = qTotal > 0 ? (q1 / qTotal) * 100 : 0;
      const q4Pct = qTotal > 0 ? (q4 / qTotal) * 100 : 0;
      
      sidebarHtml += `
        <!-- Country Profile Details Card (Screenshot Style + Bar Graph) -->
        <div class="viz2-country-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-weight: 800; font-size: 1.05rem; color: #0f172a;">${selectedCountryTrail}</span>
            <span style="font-size: 0.68rem; font-weight: 700; background: rgba(14,116,144,0.10); color: #0e7490; border: 1px solid rgba(14,116,144,0.28); border-radius: 9999px; padding: 0.15rem 0.5rem;">${selectedMetrics.metrics.continent}</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 0.25rem;">
            <!-- Publisher-country journal docs (not G1 WB/SCImago country articles) -->
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.8rem; color: #475569; flex: 1;" title="Publisher-country journal documents (Q1+Q4 path total)">Publisher journal docs:</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">${selectedMetrics.metrics.publications.toLocaleString()}</span>
              </div>
              <div style="width: 100%; height: 5px; background: rgba(15,23,42,0.08); border-radius: 3px; overflow: hidden; border: 1px solid rgba(15,23,42,0.04);">
                <div style="width: ${Math.min(100, (selectedMetrics.metrics.publications / 200000) * 100)}%; height: 100%; background: linear-gradient(90deg, #0e7490, #0072B2); border-radius: 3px;"></div>
              </div>
            </div>

            <!-- H-Index from G1 OpenAlex cohort H (yearly); SCImago stock is audit-only -->
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.8rem; color: #475569; flex: 1;" title="OpenAlex calendar-year cohort H (pubs in year Y). Not SCImago stock. See docs/G1_CUSTOM_YEARLY_H.md">OpenAlex cohort H (year Y):</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">${selectedMetrics.metrics.h != null ? Math.round(selectedMetrics.metrics.h).toLocaleString() : "—"}</span>
              </div>
              <div style="width: 100%; height: 5px; background: rgba(15,23,42,0.08); border-radius: 3px; overflow: hidden; border: 1px solid rgba(15,23,42,0.04);">
                <div style="width: ${Math.min(100, ((selectedMetrics.metrics.h || 0) / 1600) * 100)}%; height: 100%; background: linear-gradient(90deg, #D55E00, #CC79A7); border-radius: 3px;"></div>
              </div>
            </div>

            <!-- R&D Spend from G1 / World Bank join -->
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.8rem; color: #475569; flex: 1;" title="Same G1 hierarchical GERD river (WB base; OECD hole-fill if overlap-ok). Missing later years use LOCF ffill from last known GERD (tagged LOCF in pool).">R&D Spend (GERD):</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">${selectedMetrics.metrics.rd != null ? selectedMetrics.metrics.rd.toFixed(2) + "%" : "—"}</span>
              </div>
              <div style="width: 100%; height: 5px; background: rgba(15,23,42,0.08); border-radius: 3px; overflow: hidden; border: 1px solid rgba(15,23,42,0.04);">
                <div style="width: ${Math.min(100, ((selectedMetrics.metrics.rd || 0) / 5.0) * 100)}%; height: 100%; background: linear-gradient(90deg, #009E73, #0e7490); border-radius: 3px;"></div>
              </div>
            </div>

            <!-- GDP/Capita from G1 / World Bank join -->
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.8rem; color: #475569; flex: 1;" title="World Bank GDP per capita PPP (same river as G1)">GDP/Capita (PPP):</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">${selectedMetrics.metrics.gdp != null ? "$" + Math.round(selectedMetrics.metrics.gdp).toLocaleString() : "—"}</span>
              </div>
              <div style="width: 100%; height: 5px; background: rgba(15,23,42,0.08); border-radius: 3px; overflow: hidden; border: 1px solid rgba(15,23,42,0.04);">
                <div style="width: ${Math.min(100, ((selectedMetrics.metrics.gdp || 0) / 80000) * 100)}%; height: 100%; background: linear-gradient(90deg, #E69F00, #F0E442); border-radius: 3px;"></div>
              </div>
            </div>
          </div>
          
          <!-- Stacked Bar Graph: Quality Share (Q1 vs Q4) -->
          <div style="margin-top: 0.45rem; border-top: 1px dashed rgba(15,23,42,0.10); padding-top: 0.55rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #475569; margin-bottom: 5px;">
              <span>Quality Split (Q1 vs Q4)</span>
              <span style="font-weight:700;"><span style="color:#0072B2;">Q1: ${q1Pct.toFixed(0)}%</span> | <span style="color:#E69F00;">Q4: ${q4Pct.toFixed(0)}%</span></span>
            </div>
            <div style="width: 100%; height: 12px; background: rgba(15,23,42,0.08); border-radius: 4px; display: flex; overflow: hidden; border: 1px solid rgba(15,23,42,0.06);">
              <div style="width: ${q1Pct}%; background: #0072B2; height: 100%; box-shadow: inset 0 0 4px rgba(0,0,0,0.3);" title="Q1 Journals: ${q1.toLocaleString()}"></div>
              <div style="width: ${q4Pct}%; background: #E69F00; height: 100%; box-shadow: inset 0 0 4px rgba(0,0,0,0.3);" title="Q4 Journals: ${q4.toLocaleString()}"></div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Render Continent Filter and Slider Panel
  sidebarHtml += `
    <!-- Continent Select Filter -->
    <div class="viz2-select-wrapper" style="margin-top: 0.2rem;">
      <label>Filter By Continent</label>
      <select id="continent-select" class="ctrl-select" style="width: 100%;">
        ${continents.map(c => `<option value="${c}" ${activeContinentFilter === c ? "selected" : ""}>${c === "All" ? "All Continents" : c}</option>`).join("")}
      </select>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 0.68rem; line-height: 1.2;">
        <span style="display: flex; align-items: center; gap: 3px; color: ${OKABE.vermillion}; font-weight: 700;"><span style="display:inline-block; width:6px; height:6px; background:${OKABE.vermillion}; border-radius:50%;"></span>Asia</span>
        <span style="display: flex; align-items: center; gap: 3px; color: ${OKABE.blue}; font-weight: 700;"><span style="display:inline-block; width:6px; height:6px; background:${OKABE.blue}; border-radius:50%;"></span>Europe</span>
        <span style="display: flex; align-items: center; gap: 3px; color: ${OKABE.green}; font-weight: 700;"><span style="display:inline-block; width:6px; height:6px; background:${OKABE.green}; border-radius:50%;"></span>Americas</span>
        <span style="display: flex; align-items: center; gap: 3px; color: ${OKABE.orange}; font-weight: 700;"><span style="display:inline-block; width:6px; height:6px; background:${OKABE.orange}; border-radius:50%;"></span>Africa</span>
        <span style="display: flex; align-items: center; gap: 3px; color: ${OKABE.purple}; font-weight: 700;"><span style="display:inline-block; width:6px; height:6px; background:${OKABE.purple}; border-radius:50%;"></span>Oceania</span>
      </div>
    </div>

    <!-- Sort and Top Rank selector -->
    <div class="viz2-select-wrapper" style="margin-top: 0.4rem;">
      <label>Sort & Top Rank (Top 9)</label>
      <select id="sort-rank-select" class="ctrl-select" style="width: 100%;">
        <option value="Default" ${activeSortParameter === "Default" ? "selected" : ""}>Default (Whitelist / All)</option>
        <option value="publications" ${activeSortParameter === "publications" ? "selected" : ""}>Publisher journal docs</option>
        <option value="h" ${activeSortParameter === "h" ? "selected" : ""}>OpenAlex cohort H (year Y)</option>
        <option value="rd" ${activeSortParameter === "rd" ? "selected" : ""}>R&D Spend (% GDP, WB)</option>
        <option value="gdp" ${activeSortParameter === "gdp" ? "selected" : ""}>GDP per Capita (PPP, WB)</option>
        <option value="ratio" ${activeSortParameter === "ratio" ? "selected" : ""}>Q1 / Q4 Quality Ratio</option>
      </select>
    </div>

    <!-- Factor Filter Sliders -->
    <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.2rem;">
      <div>
        <button id="btn-reset-filters" class="viz2-reset-btn">Reset All</button>
        <div class="viz2-section-title">Filter By Factors</div>
      </div>
      
      <!-- Min Pubs -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: #475569;">
          <span>Min Publications</span>
          <span id="lbl-min-pub" style="font-weight: 700; color: #0072B2;">${minPubFilter >= 1000 ? (minPubFilter / 1000).toFixed(0) + "k" : minPubFilter}</span>
        </div>
        <input type="range" id="slide-min-pub" class="ctrl-range" style="width: 100%;" min="0" max="200000" step="5000" value="${minPubFilter}">
      </div>

      <!-- Min H Index -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: #475569;">
          <span>Min H-Index</span>
          <span id="lbl-min-h" style="font-weight: 700; color: #0072B2;">${minHIndexFilter}</span>
        </div>
        <input type="range" id="slide-min-h" class="ctrl-range" style="width: 100%;" min="0" max="1600" step="25" value="${minHIndexFilter}">
      </div>

      <!-- Min R&D Spend -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: #475569;">
          <span>Min R&D Spend (% GDP)</span>
          <span id="lbl-min-rd" style="font-weight: 700; color: #0072B2;">${minRdFilter.toFixed(1)}%</span>
        </div>
        <input type="range" id="slide-min-rd" class="ctrl-range" style="width: 100%;" min="0" max="4.0" step="0.1" value="${minRdFilter}">
      </div>

      <!-- Min GDP/Capita -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: #475569;">
          <span>Min GDP/Capita</span>
          <span id="lbl-min-gdp" style="font-weight: 700; color: #0072B2;">$${minGdpFilter.toLocaleString()}</span>
        </div>
        <input type="range" id="slide-min-gdp" class="ctrl-range" style="width: 100%;" min="0" max="80000" step="2000" value="${minGdpFilter}">
      </div>
    </div>
  `;

  sidebar.innerHTML = sidebarHtml;

  // Calculate Summary Statistics for current year
  const filteredYearData = yearData.filter(c => activeRegionFilter === "All" || c.region === activeRegionFilter);
  let globalQ1 = 0, globalQ4 = 0;
  filteredYearData.forEach(c => {
    globalQ1 += c.q1 || 0;
    globalQ4 += c.q4 || 0;
  });
  const globalRatio = globalQ4 > 0 ? (globalQ1 / globalQ4) : 0;

  // Graph card
  const graphCard = document.createElement("div");
  graphCard.className = "viz2-graph-card";
  graphCard.style.position = "relative";
  graphCard.innerHTML = `
    <!-- Quality Guide anchored in top margin void (margin.top=124) — must not overlap bars -->
    <div id="viz2-quality-guide" class="viz2-quality-guide">
      <div class="viz2-quality-guide__title">
        Quality Guide · Publisher Country
      </div>
      <div class="viz2-quality-guide__body">
        <div class="viz2-quality-guide__keys">
          <div style="display: flex; gap: 5px; align-items: center;">
            <span style="display: inline-block; width: 8px; height: 8px; background: ${chartColors.q1}; border-radius: 1px; flex-shrink: 0;"></span>
            <div><b style="color: ${chartColors.q1};">Q1:</b> Top 25% SJR journals</div>
          </div>
          <div style="display: flex; gap: 5px; align-items: center;">
            <span style="display: inline-block; width: 8px; height: 8px; background: ${chartColors.q4}; border-radius: 1px; flex-shrink: 0;"></span>
            <div><b style="color: ${chartColors.q4};">Q4:</b> Bottom 25% SJR journals</div>
          </div>
        </div>
        <div class="viz2-quality-guide__desc">
          Docs in journals <b style="color:#0f172a;">published in</b> that country (not author affiliation). Ratio = Q1/Q4 (uncapped).
        </div>
      </div>
    </div>
  `;

  // Bottom card for horizontal metrics summary
  const bottomCard = document.createElement("div");
  bottomCard.className = "viz2-bottom-card";

  let metricsHtml = `
    <div class="viz2-stats-grid">
      <div class="viz2-metric-box">
        <span class="viz2-metric-title">${year} State</span>
        <span class="viz2-metric-value" style="color: ${OKABE.orange};">${globalRatio.toFixed(2)}</span>
        <span class="viz2-metric-desc">Publisher-country Q1/Q4 Ratio</span>
      </div>
      <div class="viz2-metric-box">
        <span class="viz2-metric-title">Elite (Q1) Docs</span>
        <span class="viz2-metric-value">${(globalQ1 / 1000).toFixed(0)}k</span>
        <span class="viz2-metric-desc">Q1 journal docs (publisher country)</span>
      </div>
      <div class="viz2-metric-box">
        <span class="viz2-metric-title">Low-tier (Q4) Docs</span>
        <span class="viz2-metric-value">${(globalQ4 / 1000).toFixed(0)}k</span>
        <span class="viz2-metric-desc">Q4 journal docs (publisher country)</span>
      </div>
  `;

  if (selectedCountryTrail) {
    const countryData = yearData.find(c => c.country === selectedCountryTrail);
    if (countryData) {
      metricsHtml += `
        <div class="viz2-metric-box" style="border-left: 1px dashed rgba(15, 23, 42, 0.14); padding-left: 1.5rem;">
          <span class="viz2-metric-title">${selectedCountryTrail} Profile</span>
          <span class="viz2-metric-value" style="color: #0072B2;">${getTier(countryData.ratio).toUpperCase()}</span>
          <span class="viz2-metric-desc">Research Quality Category</span>
        </div>
        <div class="viz2-metric-box">
          <span class="viz2-metric-title">${selectedCountryTrail} Ratio</span>
          <span class="viz2-metric-value">${countryData.ratio.toFixed(2)}</span>
          <span class="viz2-metric-desc">Q1/Q4 Quality Ratio</span>
        </div>
        <div class="viz2-metric-box">
          <span class="viz2-metric-title">${selectedCountryTrail} Docs</span>
          <span class="viz2-metric-value">${(countryData.q1 + countryData.q4).toLocaleString()}</span>
          <span class="viz2-metric-desc">Q1: ${countryData.q1.toLocaleString()} | Q4: ${countryData.q4.toLocaleString()}</span>
        </div>
      `;
    }
  } else {
    let continentRatio = globalRatio;
    let ratioTitle = "Global";
    if (activeContinentFilter !== "All") {
      const contData = yearDataWithMetrics.filter(d => d.metrics.continent === activeContinentFilter);
      let contQ1 = 0, contQ4 = 0;
      contData.forEach(d => { contQ1 += d.q1; contQ4 += d.q4; });
      if (contQ4 > 0) continentRatio = contQ1 / contQ4;
      else if (contQ1 > 0) continentRatio = contQ1;
      ratioTitle = activeContinentFilter;
    }
    
    metricsHtml += `
      <div class="viz2-metric-box" style="border-left: 1px dashed rgba(15, 23, 42, 0.14); padding-left: 1.5rem;">
        <span class="viz2-metric-title">${ratioTitle} Q1/Q4 Avg</span>
        <span class="viz2-metric-value" style="font-size: 1.4rem; color: ${OKABE.orange};">${continentRatio.toFixed(2)}</span>
        <span class="viz2-metric-desc">Average ratio for selected region</span>
      </div>
      <div class="viz2-metric-box">
        <span class="viz2-metric-title">Active Filter</span>
        <span class="viz2-metric-value" style="color: #0e7490; font-size: 1.4rem;">${activeContinentFilter.toUpperCase()}</span>
        <span class="viz2-metric-desc">Continent being visualized</span>
      </div>
    `;
  }

  metricsHtml += `</div>`;
  bottomCard.innerHTML = metricsHtml;

  // Build structure: Top Row (Graph & Sidebar), Bottom Card (Summary)
  const topRow = document.createElement("div");
  topRow.className = "viz2-top-row";
  topRow.appendChild(graphCard);
  topRow.appendChild(sidebar);

  container.appendChild(topRow);
  container.appendChild(bottomCard);
  body.appendChild(container);

  // Apply filters on the database
  let displayData = [...yearDataWithMetrics];

  // Exclude low-data countries (total < 1000)
  if (activeContinentFilter === "All") {
    displayData = displayData.filter(d => d.total >= 1000);
  } else {
    displayData = displayData.filter(d => d.total >= 10);
  }

  // 1. Continent Filter
  if (activeContinentFilter !== "All") {
    displayData = displayData.filter(d => d.metrics.continent === activeContinentFilter);
  }

  // 2. Sliders Filters (missing G1 join → fail closed when slider > 0)
  displayData = displayData.filter(d => {
    const hOk = minHIndexFilter <= 0 || (d.metrics.h != null && d.metrics.h >= minHIndexFilter);
    const rdOk = minRdFilter <= 0 || (d.metrics.rd != null && d.metrics.rd >= minRdFilter);
    const gdpOk = minGdpFilter <= 0 || (d.metrics.gdp != null && d.metrics.gdp >= minGdpFilter);
    return d.metrics.publications >= minPubFilter && hOk && rdOk && gdpOk;
  });

  // 3. Sort & Rank Filter (Top 9)
  if (activeSortParameter !== "Default") {
    displayData.sort((a, b) => {
      let valA = 0, valB = 0;
      if (activeSortParameter === "publications") { valA = a.metrics.publications || 0; valB = b.metrics.publications || 0; }
      else if (activeSortParameter === "h") { valA = a.metrics.h ?? -1; valB = b.metrics.h ?? -1; }
      else if (activeSortParameter === "rd") { valA = a.metrics.rd ?? -1; valB = b.metrics.rd ?? -1; }
      else if (activeSortParameter === "gdp") { valA = a.metrics.gdp ?? -1; valB = b.metrics.gdp ?? -1; }
      else if (activeSortParameter === "ratio") { valA = a.ratio; valB = b.ratio; }
      return valB - valA;
    });
    displayData = displayData.slice(0, 9);
  } else {
    // Keep the default graph Same As It Was (whitelist of 10 countries) if no filters are active
    const hasActiveSliders = minPubFilter > 0 || minHIndexFilter > 0 || minRdFilter > 0 || minGdpFilter > 0;
    if (activeContinentFilter === "All" && !hasActiveSliders) {
      const whitelistDefault = [
        "China", "India", "Japan", "United States", "France", 
        "Germany", "Ireland", "Netherlands", "Switzerland", "United Kingdom"
      ];
      displayData = displayData.filter(d => whitelistDefault.includes(d.country));
    } else if (activeContinentFilter !== "All" && !hasActiveSliders) {
      // Smart selection for a specific continent: 7-9 interesting countries
      // 1. Sort by total volume and take top 4
      const byVolume = [...displayData].sort((a, b) => b.total - a.total).slice(0, 4);
      // 2. Sort by ratio and take top 2 and bottom 2
      const byRatio = [...displayData].sort((a, b) => b.ratio - a.ratio);
      const topRatio = byRatio.slice(0, 3); // Take 3 just in case of overlap
      const bottomRatio = byRatio.slice(Math.max(0, byRatio.length - 2)); // Bottom 2
      
      const selectedSet = new Set([...byVolume.map(d=>d.country), ...topRatio.map(d=>d.country), ...bottomRatio.map(d=>d.country)]);
      
      // Filter down to the selected set (should naturally result in 7-9 countries depending on overlap)
      displayData = displayData.filter(d => selectedSet.has(d.country));
    }
  }

  // Ensure selected country is in the displayData list if matching filters
  if (selectedCountryTrail) {
    const isIncluded = displayData.some(d => d.country === selectedCountryTrail);
    if (!isIncluded) {
      const selectedObj = yearDataWithMetrics.find(d => d.country === selectedCountryTrail);
      if (selectedObj) {
        // Only include if it satisfies the continent filter
        const matchContinent = activeContinentFilter === "All" || selectedObj.metrics.continent === activeContinentFilter;
        // Only include if it satisfies the factor filters
        const matchFactors = selectedObj.metrics.publications >= minPubFilter &&
                             (minHIndexFilter <= 0 || (selectedObj.metrics.h != null && selectedObj.metrics.h >= minHIndexFilter)) &&
                             (minRdFilter <= 0 || (selectedObj.metrics.rd != null && selectedObj.metrics.rd >= minRdFilter)) &&
                             (minGdpFilter <= 0 || (selectedObj.metrics.gdp != null && selectedObj.metrics.gdp >= minGdpFilter));
        if (matchContinent && matchFactors) {
          displayData.push(selectedObj);
          
          // Re-sort to maintain order if ranking is active
          if (activeSortParameter !== "Default") {
            displayData.sort((a, b) => {
              let valA = 0, valB = 0;
              if (activeSortParameter === "publications") { valA = a.metrics.publications || 0; valB = b.metrics.publications || 0; }
              else if (activeSortParameter === "h") { valA = a.metrics.h ?? -1; valB = b.metrics.h ?? -1; }
              else if (activeSortParameter === "rd") { valA = a.metrics.rd ?? -1; valB = b.metrics.rd ?? -1; }
              else if (activeSortParameter === "gdp") { valA = a.metrics.gdp ?? -1; valB = b.metrics.gdp ?? -1; }
              else if (activeSortParameter === "ratio") { valA = a.ratio; valB = b.ratio; }
              return valB - valA;
            });
          }
        }
      }
    }
  }

  // Sort display data for final rendering
  if (activeSortParameter === "Default") {
    displayData.sort((a, b) => {
      if (a.region !== b.region) {
        return a.region.localeCompare(b.region);
      }
      return a.country.localeCompare(b.country);
    });
  }

  // SVG Setup
  const W = graphCard.offsetWidth || 850;
  const H = graphCard.offsetHeight || 550;
  
  const svg = d3.select(graphCard).append("svg")
    .attr("width", W)
    .attr("height", H)
    .style("overflow", "visible")
    .style("background", "#ffffff");

  // Chart paper plane (clean white — avoids muddy slate bleed-through)
  svg.append("rect")
    .attr("width", W)
    .attr("height", H)
    .attr("fill", "#ffffff")
    .attr("pointer-events", "none");

  // Reserved top void for Quality Guide (wider ~3-line desc) — bars never enter this band
  const margin = { top: 124, right: 30, bottom: 90, left: 65 };
  const innerWidth = W - margin.left - margin.right;
  const innerHeight = H - margin.top - margin.bottom;

  const chartG = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Max value calculator for Y-axis
  const yMaxVal = barChartMode === "grouped" 
    ? d3.max(displayData, d => Math.max(d.q1, d.q4)) || 10000 
    : d3.max(displayData, d => d.q1 + d.q4) || 10000;

  const useLog = (typeof yAxisScaleMode !== "undefined" && yAxisScaleMode === "logarithmic");
  const yScale = useLog
    ? d3.scaleLog().domain([Math.max(1, yMaxVal * 0.001), Math.max(10, yMaxVal * 1.05)]).range([innerHeight, 0]).clamp(true)
    : d3.scaleLinear().domain([0, yMaxVal * 1.05]).range([innerHeight, 0]);
  const yVal = (v) => useLog ? Math.max(1, v || 0) : (v || 0);

  // Y Axis & Grid lines
  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickSize(-innerWidth)
    .tickFormat(d => d >= 1000 ? `${(d / 1000).toFixed(0)}k` : d);

  const yAxisG = chartG.append("g")
    .attr("class", "y-axis")
    .call(yAxis);

  yAxisG.select(".domain").remove();
  yAxisG.selectAll(".tick line")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-dasharray", "3,3");
  yAxisG.selectAll(".tick text")
    .attr("fill", "#334155")
    .attr("font-size", "10px")
    .attr("font-weight", "600")
    .attr("dx", "-4px");

  // X Axis
  const xScale = d3.scaleBand()
    .domain(displayData.map(d => d.country))
    .range([0, innerWidth])
    .padding(0.25);

  const xAxis = d3.axisBottom(xScale);

  const xAxisG = chartG.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis);

  xAxisG.select(".domain").attr("stroke", "#cbd5e1");
  xAxisG.selectAll(".tick line").attr("stroke", "#cbd5e1");

  // Rotate country names to fit — continent colors stay categorical, readable on white
  xAxisG.selectAll(".tick text")
    .style("fill", d => {
      const item = displayData.find(x => x.country === d);
      return item ? getContinentColor(item.metrics.continent) : "#334155";
    })
    .attr("font-size", "9px")
    .attr("font-weight", "700")
    .style("text-anchor", "end")
    .attr("dx", "-8px")
    .attr("dy", "4px")
    .attr("transform", "rotate(-40)");

  // Draw bars group
  const countryGroups = chartG.selectAll(".country-bar-group")
    .data(displayData)
    .enter().append("g")
      .attr("class", "country-bar-group")
      .attr("transform", d => `translate(${xScale(d.country)}, 0)`)
      .style("cursor", "pointer")
      .style("transition", "opacity 0.2s ease");

  if (barChartMode === "grouped") {
    const xSubScale = d3.scaleBand()
      .domain(["q1", "q4"])
      .range([0, xScale.bandwidth()])
      .padding(0.08);

    // Q1 bars (elite - cyan)
    countryGroups.append("rect")
      .attr("class", "bar-q1")
      .attr("x", xSubScale("q1"))
      .attr("y", d => yScale(yVal(d.q1)))
      .attr("width", xSubScale.bandwidth())
      .attr("height", d => innerHeight - yScale(yVal(d.q1)))
      .attr("fill", chartColors.q1)
      .attr("fill-opacity", 0.8)
      .attr("rx", 2)
      .attr("stroke", chartColors.q1)
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3);

    // Q4 bars (low-tier - rose-red)
    countryGroups.append("rect")
      .attr("class", "bar-q4")
      .attr("x", xSubScale("q4"))
      .attr("y", d => yScale(yVal(d.q4)))
      .attr("width", xSubScale.bandwidth())
      .attr("height", d => innerHeight - yScale(yVal(d.q4)))
      .attr("fill", chartColors.q4)
      .attr("fill-opacity", 0.8)
      .attr("rx", 2)
      .attr("stroke", chartColors.q4)
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3);

    // Selection outline around the grouped bars
    countryGroups.filter(d => d.country === selectedCountryTrail)
      .append("rect")
        .attr("class", "bar-selection-outline")
        .attr("x", -3)
        .attr("y", d => Math.min(yScale(yVal(d.q1)), yScale(yVal(d.q4))) - 3)
        .attr("width", xScale.bandwidth() + 6)
        .attr("height", d => innerHeight - Math.min(yScale(yVal(d.q1)), yScale(yVal(d.q4))) + 6)
        .attr("fill", "none")
        .attr("stroke", "#0e7490")
        .attr("stroke-width", 2)
        .attr("rx", 5)
        .style("filter", "drop-shadow(0 1px 3px rgba(14,116,144,0.35))");

  } else {
    // Stacked mode
    // Bottom: Q4 (Okabe orange)
    countryGroups.append("rect")
      .attr("class", "bar-q4")
      .attr("x", 0)
      .attr("y", d => yScale(yVal(d.q4)))
      .attr("width", xScale.bandwidth())
      .attr("height", d => innerHeight - yScale(yVal(d.q4)))
      .attr("fill", chartColors.q4)
      .attr("fill-opacity", 0.8)
      .attr("stroke", chartColors.q4)
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3);

    // Top: Q1 (cyan)
    countryGroups.append("rect")
      .attr("class", "bar-q1")
      .attr("x", 0)
      .attr("y", d => yScale(yVal(d.q4 + d.q1)))
      .attr("width", xScale.bandwidth())
      .attr("height", d => yScale(yVal(d.q4)) - yScale(yVal(d.q4 + d.q1)))
      .attr("fill", chartColors.q1)
      .attr("fill-opacity", 0.9)
      .attr("stroke", chartColors.q1)
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3);

    // Selection outline around the stacked bars
    countryGroups.filter(d => d.country === selectedCountryTrail)
      .append("rect")
        .attr("class", "bar-selection-outline")
        .attr("x", -3)
        .attr("y", d => yScale(yVal(d.q1 + d.q4)) - 3)
        .attr("width", xScale.bandwidth() + 6)
        .attr("height", d => innerHeight - yScale(yVal(d.q1 + d.q4)) + 6)
        .attr("fill", "none")
        .attr("stroke", "#0e7490")
        .attr("stroke-width", 2)
        .attr("rx", 5)
        .style("filter", "drop-shadow(0 1px 3px rgba(14,116,144,0.35))");
  }

  // Hover Interactions
  countryGroups
    .on("mouseenter", function(e, d) {
      // Dim other bars
      countryGroups.style("opacity", s => s.country === d.country ? 1.0 : 0.25);

      // Tooltip HTML content with macroeconomic factors
      showTip(e, `
        <div style="font-weight:700; font-size:13px; border-bottom:1px solid rgba(15,23,42,0.12); padding-bottom:4px; margin-bottom:4px; color:#0f172a;">${d.country}</div>
        <div style="font-size:11px; color:#475569; margin-bottom: 3px;">Region: <span style="color:${getRegionColor(d.region)}; font-weight:600;">${d.region}</span></div>
        <div style="font-size:11px; margin-bottom: 3px;">Continent: <span style="color:${getContinentColor(d.metrics.continent)}; font-weight:600;">${d.metrics.continent}</span></div>
        <div style="font-size:11px; margin-top:2px;">Q1 Journals (Elite): <span style="color:${chartColors.q1}; font-weight:700;">${d.q1.toLocaleString()}</span></div>
        <div style="font-size:11px;">Q4 Journals (Low-tier): <span style="color:${chartColors.q4}; font-weight:700;">${d.q4.toLocaleString()}</span></div>
        <div style="font-size:11px; margin-bottom: 2px;">Q1/Q4 Ratio (uncapped): <span style="color:${OKABE.orange}; font-weight:bold;">${d.ratio.toFixed(3)}</span></div>
        <div style="font-size:10px; color:#475569; margin-bottom:4px;">Publisher country · not author affiliation</div>
        <div style="font-size:11px; margin-top:4px; border-top:1px dashed rgba(15,23,42,0.12); padding-top:4px; color: #334155;">
          <div>Publisher journal docs: <b>${d.metrics.publications.toLocaleString()}</b></div>
          <div>OpenAlex cohort H (pubs in year Y): <b>${d.metrics.h != null ? Math.round(d.metrics.h).toLocaleString() : "—"}</b></div>
          <div title="G1 hierarchical GERD with LOCF ffill when later years missing.">R&D (GERD): <b>${d.metrics.rd != null ? d.metrics.rd.toFixed(2) + "%" : "—"}</b></div>
          <div>GDP PPP (WB): <b>${d.metrics.gdp != null ? "$" + Math.round(d.metrics.gdp).toLocaleString() : "—"}</b></div>
        </div>
      `);
    })
    .on("mousemove", moveTip)
    .on("mouseleave", function() {
      // Restore bars opacities
      countryGroups.style("opacity", 1.0);
      hideTip();
    })
    .on("click", function(e, d) {
      selectedCountryTrail = (selectedCountryTrail === d.country) ? null : d.country;
      renderViz(2);
    });

  // Bind Sidebar Event Listeners
  // 1. Country Selection Dropdown
  const sidebarCSelect = container.querySelector("#country-select-dropdown");
  if (sidebarCSelect) {
    sidebarCSelect.onchange = () => {
      selectedCountryTrail = sidebarCSelect.value || null;
      renderViz(2);
    };
  }

  // Clear country from profile card if present
  const clearCountryBtn = container.querySelector("#btn-clear-country");
  if (clearCountryBtn) {
    clearCountryBtn.onclick = () => {
      selectedCountryTrail = null;
      renderViz(2);
    };
  }

  // 2. Continent Select
  const contSel = container.querySelector("#continent-select");
  if (contSel) {
    contSel.onchange = () => {
      activeContinentFilter = contSel.value;
      renderViz(2);
    };
  }

  // 2b. Sort & Rank Select
  const sortRankSel = container.querySelector("#sort-rank-select");
  if (sortRankSel) {
    sortRankSel.onchange = () => {
      activeSortParameter = sortRankSel.value;
      renderViz(2);
    };
  }

  // 3. Reset All Button
  const resetBtn = container.querySelector("#btn-reset-filters");
  if (resetBtn) {
    resetBtn.onclick = () => {
      activeContinentFilter = "All";
      activeSortParameter = "Default";
      minPubFilter = 0;
      minHIndexFilter = 0;
      minRdFilter = 0;
      minGdpFilter = 0;
      renderViz(2);
    };
  }

  // 4. Sliders Event Hooks
  const setupSlider = (sliderId, labelId, filterSetter, formatter) => {
    const slider = container.querySelector(`#${sliderId}`);
    const label = container.querySelector(`#${labelId}`);
    if (slider && label) {
      slider.oninput = () => {
        const val = +slider.value;
        label.textContent = formatter(val);
        filterSetter(val);
      };
      slider.onchange = () => {
        renderViz(2);
      };
    }
  };

  setupSlider("slide-min-pub", "lbl-min-pub", val => minPubFilter = val, val => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val);
  setupSlider("slide-min-h", "lbl-min-h", val => minHIndexFilter = val, val => val);
  setupSlider("slide-min-rd", "lbl-min-rd", val => minRdFilter = val, val => `${val.toFixed(1)}%`);
  setupSlider("slide-min-gdp", "lbl-min-gdp", val => minGdpFilter = val, val => `$${val.toLocaleString()}`);

  // Nav: Esc clears country highlight (select → details → clear/back)
  const onViz2Keydown = (e) => {
    if (e.key !== "Escape") return;
    if (!selectedCountryTrail) return;
    selectedCountryTrail = null;
    hideTip();
    renderViz(2);
  };
  document.addEventListener("keydown", onViz2Keydown);
  if (APP.cleanupFns) {
    APP.cleanupFns.push(() => document.removeEventListener("keydown", onViz2Keydown));
  }
}

