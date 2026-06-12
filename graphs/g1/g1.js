// graphs/g1/g1.js — Graph 1 (UMAP peer clustering)
// --- VIZ 1 GLOBALS ---
let viz1Year = 2022;
let viz1YearsRange = [1996, 2024];
let viz1IsPlaying = false;
let viz1Speed = 600; // base ms pacing at 1.0x (wait = viz1Speed / multiplier - elapsed)
let viz1SpeedMultiplier = 1.0;
let viz1SelectedRegion = null;
let viz1SearchQuery = '';
let viz1ComparedCountries = [];
let viz1PinnedDetailDismissed = false;
let viz1PinnedDetailCompareKey = '';
let viz1ShowSpecific = false;
let viz1PlayInterval = null; // legacy; play now uses async token loop
let viz1PlayToken = 0;
let viz1IsZoomed = false;
/** User drag-zoom / pan ranges — stored for Reset Zoom UI + defensive restore only (not re-applied every react). */
let viz1UserZoom = null; // { x: [min, max], y: [min, max] } | null
/** Skip plotly_relayout handler while we programmatically set axes (reset / defensive restore). */
let viz1IgnoreRelayout = false;
let viz1EventsBound = false;
// Manual year motion (NOT Plotly layout.transition — that morphs by index → flying USA).
// Fixed rosters + ids keep identity stable; we lerp x/y via rAF + Plotly.react.
let viz1LastPositions = null; // { code: {x,y,size,color,pubs} }
let viz1LastDrawnYear = null;
let viz1Trails = []; // comet segments: {xs,ys,color,width,baseOpacity,life,born}
let viz1MotionRaf = null;
let viz1TrailRaf = null;
let viz1MotionGen = 0;
const VIZ1_LERP_MS = 520;
const VIZ1_TRAIL_LIFE_MS = 1600;
const VIZ1_MOVE_EPS = 0.035; // post-EMA year hops are small; giants still glide+trail
const VIZ1_TRAIL_MIN_SIZE = 9; // marker diameter; tiny bubbles get no/near-zero tails

// fig2 region palette — re-sampled from fig2.png legend swatches
const VIZ1_REGION_COLORS = {
  Africa: '#3c4e60',
  Americas: '#c79d5c',
  Asia: '#609c9c',
  Europe: '#c07e7e',
  Oceania: '#6e7a82'
};
const viz1ColorPalette = [
  VIZ1_REGION_COLORS.Africa,
  VIZ1_REGION_COLORS.Americas,
  VIZ1_REGION_COLORS.Asia,
  VIZ1_REGION_COLORS.Europe,
  VIZ1_REGION_COLORS.Oceania
];

function viz1ColorForRegion(region) {
  return VIZ1_REGION_COLORS[region] || viz1ColorPalette[0] || '#6c7581';
}

function viz1DarkenHex(hex, amount) {
  const h = String(hex || '#6c7581').replace('#', '');
  if (h.length !== 6) return 'rgba(26,29,36,0.55)';
  const n = parseInt(h, 16);
  const r = Math.max(0, ((n >> 16) & 255) - amount);
  const g = Math.max(0, ((n >> 8) & 255) - amount);
  const b = Math.max(0, (n & 255) - amount);
  return `rgb(${r},${g},${b})`;
}

if (typeof VIZ1_DATA !== 'undefined') {
  // Temporal path smoother — UMAP year embeds can still reverse; MA+EMA glides paths.
  // Axis ranges are derived from the SMOOTHED cloud (not the old [-16,40] box) so the
  // plot fills the canvas instead of sitting as a tiny centered cluster.
  const byCode = {};
  VIZ1_DATA.forEach((d) => {
    if (!byCode[d.Country_Code]) byCode[d.Country_Code] = [];
    byCode[d.Country_Code].push(d);
  });
  const emaFactor = 0.18;
  const maWindow = 5;
  const maHalf = Math.floor(maWindow / 2);
  Object.keys(byCode).forEach((code) => {
    const pts = byCode[code].sort((a, b) => a.Year - b.Year);
    const rawX = pts.map((p) => p.x);
    const rawY = pts.map((p) => p.y);
    const maX = rawX.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let j = Math.max(0, i - maHalf); j <= Math.min(pts.length - 1, i + maHalf); j++) {
        s += rawX[j];
        n++;
      }
      return s / n;
    });
    const maY = rawY.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let j = Math.max(0, i - maHalf); j <= Math.min(pts.length - 1, i + maHalf); j++) {
        s += rawY[j];
        n++;
      }
      return s / n;
    });
    let mx = maX[0];
    let my = maY[0];
    pts[0].x = mx;
    pts[0].y = my;
    for (let i = 1; i < pts.length; i++) {
      mx = emaFactor * maX[i] + (1 - emaFactor) * mx;
      my = emaFactor * maY[i] + (1 - emaFactor) * my;
      pts[i].x = mx;
      pts[i].y = my;
    }
  });
}

/** Tight locked axis box from smoothed VIZ1_DATA so the cloud fills the plot area. */
function getViz1AxisRanges() {
  if (typeof VIZ1_DATA === 'undefined' || !VIZ1_DATA.length) {
    return { x: [-1, 1], y: [-1, 1] };
  }
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const d of VIZ1_DATA) {
    if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
    if (d.x < xmin) xmin = d.x;
    if (d.x > xmax) xmax = d.x;
    if (d.y < ymin) ymin = d.y;
    if (d.y > ymax) ymax = d.y;
  }
  const padFrac = 0.06;
  const xPad = Math.max((xmax - xmin) * padFrac, 0.35);
  const yPad = Math.max((ymax - ymin) * padFrac, 0.35);
  return {
    x: [xmin - xPad, xmax + xPad],
    y: [ymin - yPad, ymax + yPad]
  };
}
const VIZ1_AXIS = getViz1AxisRanges();

function getViz1Regions() {
  if (typeof VIZ1_DATA === 'undefined') return [];
  return [...new Set(VIZ1_DATA.map(d => d.Region).filter(Boolean))].sort();
}

// ============================================================

// VIZ 1: High-Dimensional Peer Clustering (t-SNE/UMAP Scatter)
// ══════════════════════════════════════════════════════════
function renderViz1(body) {
  if (typeof VIZ1_DATA !== 'undefined') {
    const allYears = [...new Set(VIZ1_DATA.map(d => d.Year).filter(y => y != null && !isNaN(y)))];
    if (allYears.length > 0) {
      viz1YearsRange = [Math.min(...allYears), Math.max(...allYears)];
      viz1Year = Math.max(...allYears);
    }
  }

  body.innerHTML = `
    <div class="viz1-layout">
      <!-- SIDEBAR -->
      <div class="viz1-sidebar">
        <div class="viz1-sidebar-top">
          <div>
            <h2 class="viz1-title">Scientific Peer Clusters</h2>
            <p class="viz1-desc">Wealth, R&amp;D, publication volume, and quality peers over time.</p>
          </div>

          <div class="viz1-control-group">
            <label>Compare Nations</label>
            <p class="viz1-hint">Click bubbles to select · legend focuses a region (click same again = global) · Esc clears · double-click resets zoom</p>
            <div id="viz1-compare-ui" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
          </div>

          <div class="viz1-control-group">
            <label>Search Countries</label>
            <div class="viz1-search-container">
              <input type="text" id="viz1-search" class="viz1-search-input" list="viz1-country-list" placeholder="India, Japan, USA…" style="flex: 1; min-width: 0; width: auto;">
              <button type="button" id="viz1-search-btn" class="viz1-search-btn">Add</button>
            </div>
            <datalist id="viz1-country-list"></datalist>
          </div>

          <div class="viz1-control-group">
            <label>Timeline <span id="viz1-year-label" style="margin-left: auto; background: rgba(95,153,155,0.14); padding: 2px 6px; border-radius: 4px; color:#456672;">${viz1Year}</span></label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <button id="viz1-play-btn" class="viz1-play-btn">▶ Play</button>
              <input type="range" id="viz1-year-slider" min="${viz1YearsRange[0]}" max="${viz1YearsRange[1]}" value="${viz1Year}" style="flex: 1;">
            </div>
          </div>

          <!-- Speed Controls — exact G3 filter-group / speed-selector pattern -->
          <div class="filter-group">
            <label>Speed</label>
            <div class="speed-selector" id="viz1-speed-selector" role="group" aria-label="Timeline playback speed">
              <button type="button" class="speed-btn" data-speed="0.5">0.5x</button>
              <button type="button" class="speed-btn active" data-speed="1.0">1.0x</button>
              <button type="button" class="speed-btn" data-speed="2.0">2.0x</button>
            </div>
          </div>

          <div class="viz1-control-group">
            <label>Display</label>
            <div class="viz1-sidebar-actions">
              <button id="viz1-specific-btn" class="viz1-specific-btn${viz1ShowSpecific ? ' active' : ''}" type="button">${viz1ShowSpecific ? 'Show All Countries' : 'Show Specific Countries'}</button>
              <button id="viz1-reset-zoom-btn" class="viz1-reset-zoom-btn" type="button" style="display:none;" title="Reset zoom to full view">Reset Zoom</button>
            </div>
          </div>
        </div>

        <div class="viz1-stats-card">
          <div class="viz1-stats-metrics">
            <div class="viz1-stat">
              <b id="viz1-stat-nations">-</b>
              <span>nations</span>
            </div>
            <div class="viz1-stat">
              <b id="viz1-stat-regions">-</b>
              <span>regions</span>
            </div>
            <div class="viz1-stat">
              <b id="viz1-stat-pubs">-</b>
              <span>pubs</span>
            </div>
          </div>
        </div>

        <div class="viz1-visual-guide viz1-visual-guide--sidebar">
          <h4>Visual encodings</h4>
          <div class="viz1-encode-row"><strong>Axes</strong> UMAP (wealth · R&amp;D · volume · OpenAlex cohort H)</div>
          <div class="viz1-encode-row"><strong>Size</strong> Country journal articles (WB → SCImago Docs)</div>
          <div class="viz1-encode-row"><strong>Color</strong> Region</div>
          <div class="viz1-encode-row"><strong>H</strong> OpenAlex cohort H (pubs in year Y) — not SCImago stock</div>
        </div>
      </div>

      <!-- MAIN PLOT AREA — no overlay toolbar (legend stays fully readable) -->
      <div class="viz1-plot">
        <div id="viz1-pinned-detail" class="viz1-pinned-detail" hidden aria-live="polite"></div>
        <div id="viz1-plotly-container" style="width: 100%; height: 100%;"></div>
        <div id="viz1-flag-layer" class="viz1-flag-layer" aria-hidden="true"></div>
      </div>
    </div>
  `;

  viz1EventsBound = false;
  viz1IsZoomed = false;
  viz1UserZoom = null;
  // Populate country autocomplete datalist
  const countryList = document.getElementById('viz1-country-list');
  if (countryList && typeof VIZ1_DATA !== 'undefined') {
    const uniqueCountries = [...new Set(VIZ1_DATA.map(d => d.Country_Name).filter(Boolean))].sort();
    countryList.innerHTML = uniqueCountries.map(name => `<option value="${name}">`).join('');
  }
  
  // Attach Event Listeners
  const slider = document.getElementById('viz1-year-slider');
  const label = document.getElementById('viz1-year-label');
  const playBtn = document.getElementById('viz1-play-btn');
  const search = document.getElementById('viz1-search');
  const searchBtn = document.getElementById('viz1-search-btn');
  const specificBtn = document.getElementById('viz1-specific-btn');
  
  function executeViz1Search() {
    const query = search.value.trim();
    if (!query) return;
    
    const match = VIZ1_DATA.find(d =>
      d.Country_Name && d.Country_Name.toLowerCase() === query.toLowerCase()
    );
    
    if (match && !viz1ComparedCountries.includes(match.Country_Code)) {
      viz1ComparedCountries.push(match.Country_Code);
    } else if (!match) {
      search.style.outline = '2px solid #D55E00';
      search.style.borderRadius = '4px';
      setTimeout(() => {
        search.style.outline = '';
        search.style.borderRadius = '';
      }, 600);
    }
    
    search.value = '';
    viz1SearchQuery = '';
    updateViz1CompareUI();
    drawViz1Plotly();
  }
  
  slider.addEventListener('input', (e) => {
    viz1Year = parseInt(e.target.value, 10);
    label.textContent = viz1Year;
    cancelViz1Motion(true); // snap in-flight lerp; keep trails fading
    drawViz1Plotly({ animate: true });
  });
  
  playBtn.addEventListener('click', () => {
    viz1IsPlaying = !viz1IsPlaying;
    playBtn.innerHTML = viz1IsPlaying ? '⏸ Pause' : '▶ Play';
    
    if (viz1IsPlaying) {
      const token = ++viz1PlayToken;
      (async () => {
        while (viz1IsPlaying && token === viz1PlayToken) {
          viz1Year++;
          if (viz1Year > viz1YearsRange[1]) viz1Year = viz1YearsRange[0];
          slider.value = viz1Year;
          label.textContent = viz1Year;
          const t0 = performance.now();
          await drawViz1Plotly({ animate: true });
          if (!viz1IsPlaying || token !== viz1PlayToken) break;
          // Advance after lerp; pace = base / speedMultiplier (0.5x slower, 2.0x faster)
          const elapsed = performance.now() - t0;
          const pace = viz1Speed / (viz1SpeedMultiplier || 1);
          const wait = Math.max(40, pace - elapsed);
          await new Promise((r) => setTimeout(r, wait));
        }
        if (token === viz1PlayToken) {
          viz1IsPlaying = false;
          playBtn.innerHTML = '▶ Play';
        }
      })();
    } else {
      viz1PlayToken++;
      cancelViz1Motion(true);
      drawViz1Plotly({ animate: false }); // snap to current year after aborting lerp
    }
  });

  // Speed selector — same wiring pattern as G3 (.speed-btn + data-speed)
  const speedSelector = document.getElementById('viz1-speed-selector');
  if (speedSelector) {
    const speedBtns = speedSelector.querySelectorAll('.speed-btn');
    const syncSpeedUi = (btn) => {
      speedBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      viz1SpeedMultiplier = parseFloat(btn.dataset.speed) || 1.0;
    };
    const restore = [...speedBtns].find((b) => parseFloat(b.dataset.speed) === viz1SpeedMultiplier)
      || [...speedBtns].find((b) => b.dataset.speed === '1.0');
    if (restore) syncSpeedUi(restore);
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => syncSpeedUi(btn));
    });
  }
  
  search.addEventListener('input', (e) => {
    viz1SearchQuery = e.target.value;
    drawViz1Plotly();
  });
  
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeViz1Search();
    }
  });
  
  if (searchBtn) {
    searchBtn.addEventListener('click', executeViz1Search);
  }
  
  if (specificBtn) {
    specificBtn.addEventListener('click', () => {
      viz1ShowSpecific = !viz1ShowSpecific;
      specificBtn.textContent = viz1ShowSpecific ? 'Show All Countries' : 'Show Specific Countries';
      if (viz1ShowSpecific) {
        specificBtn.classList.add('active');
        // Drop compare picks that are now hidden so ghost selections cannot linger
        const before = viz1ComparedCountries.length;
        viz1ComparedCountries = viz1ComparedCountries.filter((c) => VIZ1_SPECIFIC_COUNTRIES.includes(c));
        if (viz1ComparedCountries.length !== before) updateViz1CompareUI();
      } else {
        specificBtn.classList.remove('active');
      }
      drawViz1Plotly({ animate: false });
    });
  }

  const resetZoomBtn = document.getElementById('viz1-reset-zoom-btn');
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener('click', () => resetViz1Zoom());
  }

  const onViz1Keydown = (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('viz-panel') && !document.getElementById('viz-panel').classList.contains('active')) return;
    if (APP.activeViz !== 1) return;
    let changed = false;
    if (viz1ComparedCountries.length) {
      viz1ComparedCountries = [];
      updateViz1CompareUI();
      changed = true;
    }
    if (viz1IsZoomed) {
      resetViz1Zoom();
      changed = true;
    }
    if (changed) drawViz1Plotly({ animate: false });
  };
  document.addEventListener('keydown', onViz1Keydown);
  APP.cleanupFns.push(() => {
    document.removeEventListener('keydown', onViz1Keydown);
    viz1IsPlaying = false;
    viz1PlayToken++;
    if (typeof viz1PlayInterval !== 'undefined' && viz1PlayInterval) clearInterval(viz1PlayInterval);
    cancelViz1Motion(false);
    clearViz1Trails();
    clearViz1FlagOverlay();
    if (viz1FlagResizeObs) {
      try { viz1FlagResizeObs.disconnect(); } catch (e) {}
      viz1FlagResizeObs = null;
    }
    viz1LastPositions = null;
    viz1LastDrawnYear = null;
    viz1EventsBound = false;
    viz1IsZoomed = false;
    viz1UserZoom = null;
    viz1IgnoreRelayout = false;
    const plotContainer = document.getElementById('viz1-plotly-container');
    if (plotContainer && typeof Plotly !== 'undefined') {
      try { Plotly.purge(plotContainer); } catch (e) {}
    }
  });
  
  buildControls(1); // Clears the global top bar
  drawViz1Plotly();
  updateViz1CompareUI();
  hideLoading();
}

function updateViz1ZoomButton() {
  const btn = document.getElementById('viz1-reset-zoom-btn');
  if (btn) btn.style.display = viz1IsZoomed ? 'flex' : 'none';
  const sidebar = document.querySelector('.viz1-sidebar');
  if (sidebar) sidebar.classList.toggle('viz1-sidebar--zoomed', !!viz1IsZoomed);
}

function rangesDiffer(a, b, eps = 1e-6) {
  if (!a || !b || a.length < 2 || b.length < 2) return false;
  return Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps;
}

function clearViz1UserZoom() {
  viz1UserZoom = null;
  viz1IsZoomed = false;
  updateViz1ZoomButton();
}

/** True when the plot already has a Plotly layout (subsequent year/lerp redraws). */
function viz1PlotHasLayout(container) {
  return !!(container && container.layout && container.layout.xaxis);
}

/** Live axis ranges from Plotly (prefer _fullLayout — authoritative after UI zoom). */
function getViz1LiveAxisRanges(container) {
  if (!container) return null;
  const full = container._fullLayout;
  const lay = container.layout;
  const x =
    (full && full.xaxis && full.xaxis.range) ||
    (lay && lay.xaxis && lay.xaxis.range) ||
    null;
  const y =
    (full && full.yaxis && full.yaxis.range) ||
    (lay && lay.yaxis && lay.yaxis.range) ||
    null;
  if (!x || !y || x.length < 2 || y.length < 2) return null;
  return { x: [x[0], x[1]], y: [y[0], y[1]] };
}

/**
 * Layout for Plotly.react — critical for zoom stability:
 * - First draw: fresh layout with locked VIZ1_AXIS ranges.
 * - Later redraws (year/lerp/trails): REUSE container.layout object so Plotly
 *   never rewrites axis ranges. Stable uirevision + same layout ref = no camera thrash.
 * Do NOT re-inject viz1UserZoom every frame (that caused the increased glitch).
 */
function getViz1ReactLayout(container, opts = {}) {
  if (opts.forceFullAxes) {
    const layout = getViz1Layout();
    layout.xaxis.range = VIZ1_AXIS.x.slice();
    layout.yaxis.range = VIZ1_AXIS.y.slice();
    layout.xaxis.autorange = false;
    layout.yaxis.autorange = false;
    return layout;
  }
  if (viz1PlotHasLayout(container)) {
    // Reuse the live layout object — data-only react path.
    container.layout.uirevision = 'viz1';
    if (container.layout.xaxis) container.layout.xaxis.autorange = false;
    if (container.layout.yaxis) container.layout.yaxis.autorange = false;
    return container.layout;
  }
  const layout = getViz1Layout();
  layout.xaxis.range = VIZ1_AXIS.x.slice();
  layout.yaxis.range = VIZ1_AXIS.y.slice();
  layout.xaxis.autorange = false;
  layout.yaxis.autorange = false;
  return layout;
}

/**
 * Defensive: only if Plotly actually dropped stored user zoom (rare).
 * Never call every rAF tick — year-boundary / post-react only.
 */
function restoreViz1ZoomIfLost(container) {
  if (!viz1UserZoom || !viz1UserZoom.x || !viz1UserZoom.y) return Promise.resolve();
  const live = getViz1LiveAxisRanges(container);
  if (!live) return Promise.resolve();
  const lost = rangesDiffer(live.x, viz1UserZoom.x) || rangesDiffer(live.y, viz1UserZoom.y);
  if (!lost) return Promise.resolve();
  viz1IgnoreRelayout = true;
  return Plotly.relayout(container, {
    'xaxis.range': viz1UserZoom.x.slice(),
    'yaxis.range': viz1UserZoom.y.slice(),
    'xaxis.autorange': false,
    'yaxis.autorange': false
  }).catch(() => {}).finally(() => {
    viz1IgnoreRelayout = false;
  });
}

function resetViz1Zoom() {
  const container = document.getElementById('viz1-plotly-container');
  clearViz1UserZoom();
  if (!container || typeof Plotly === 'undefined') return;
  viz1IgnoreRelayout = true;
  Plotly.relayout(container, {
    'xaxis.range': VIZ1_AXIS.x.slice(),
    'yaxis.range': VIZ1_AXIS.y.slice(),
    'xaxis.autorange': false,
    'yaxis.autorange': false
  }).catch(() => {}).finally(() => {
    viz1IgnoreRelayout = false;
    updateViz1FlagOverlay(viz1FlagPositions || viz1LastPositions);
  });
}

function clearViz1Compare() {
  if (!viz1ComparedCountries.length) return;
  viz1ComparedCountries = [];
  updateViz1CompareUI();
  drawViz1Plotly();
}

/** Hover / pinned-detail HTML — same fields & style for both. */
function formatViz1CountryDetailHtml(d) {
  if (!d) return '';
  const fmt = (v, decimals = 0) => {
    if (v == null || isNaN(v)) return 'N/A';
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: decimals });
  };
  const pubsLine = d._positionCarried
    ? `Country journal articles: <b>N/A</b> <i>(no docs this year; position held from ${d._carriedFromYear})</i><br>`
    : `Country journal articles (WB/SCImago): <b>${fmt(d.Total_Docs)}</b><br>`;
  return (
    `<b><span style="font-size:16px">${d.Country_Name || 'Unknown'}</span></b><br>` +
    `<i>${d.Region || ''}</i><br><br>` +
    pubsLine +
    `OpenAlex cohort H (pubs in year Y): <b>${fmt(d.H_Index)}</b>` +
    `${d.H_Index_SCImago != null && d.H_Index_SCImago !== "" ? ` <span style="opacity:0.65">(SCImago stock ${fmt(d.H_Index_SCImago)})</span>` : ""}<br>` +
    `R&D Spend (GERD): <b>${d.GERD_Percent_GDP == null || d.GERD_Percent_GDP === "" ? "—" : fmt(d.GERD_Percent_GDP, 2) + "%"}${d.GERD_Source ? " <span style=\"opacity:0.7\">(" + d.GERD_Source + ")</span>" : ""}</b><br>GDP/Capita: <b>$${fmt(d.GDP_Per_Capita_PPP)}</b>`
  );
}

/**
 * Top-right pinned detail for the latest compare-selected country.
 * viz1ComparedCountries is an ordered list: push on select, filter on deselect —
 * last element = most recently toggled ON (or previous when that one is removed).
 */
function updateViz1PinnedDetail() {
  const el = document.getElementById('viz1-pinned-detail');
  if (!el) return;

  // Selection set changed → allow the card again after a manual × dismiss
  const compareKey = viz1ComparedCountries.join(',');
  if (compareKey !== viz1PinnedDetailCompareKey) {
    viz1PinnedDetailCompareKey = compareKey;
    viz1PinnedDetailDismissed = false;
  }

  if (!viz1ComparedCountries.length || viz1PinnedDetailDismissed) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const code = viz1ComparedCountries[viz1ComparedCountries.length - 1];
  const d = resolveViz1NodeForYear(code, parseInt(viz1Year, 10));
  if (!d) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.innerHTML =
    `<button type="button" class="viz1-pinned-detail-close" aria-label="Dismiss country details" title="Dismiss">×</button>` +
    `<div class="viz1-pinned-detail-body">${formatViz1CountryDetailHtml(d)}</div>`;
  el.hidden = false;
  const closeBtn = el.querySelector('.viz1-pinned-detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Hide overlay only — keep compare selection / highlights intact
      viz1PinnedDetailDismissed = true;
      el.hidden = true;
      el.innerHTML = '';
    });
  }
}

function updateViz1CompareUI() {
  const container = document.getElementById('viz1-compare-ui');
  if (!container) return;
  
  if (viz1ComparedCountries.length === 0) {
    container.innerHTML = '';
    updateViz1PinnedDetail();
    return;
  }
  
  let html = '';
  viz1ComparedCountries.forEach(code => {
    const d = VIZ1_DATA.find(x => x.Country_Code === code);
    const name = d ? d.Country_Name : code;
    html += `<span style="background: rgba(95,153,155,0.14); color: #456672; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
      ${name} <span class="viz1-remove-compare" data-code="${code}" style="cursor: pointer;">x</span>
    </span>`;
  });
  
  html += `<button id="viz1-clear-compare" style="background: transparent; border: none; color: #D55E00; font-size: 12px; cursor: pointer; text-decoration: underline;">Clear All</button>`;
  
  container.innerHTML = html;
  
  document.querySelectorAll('.viz1-remove-compare').forEach(el => {
    el.addEventListener('click', (e) => {
      const code = e.target.getAttribute('data-code');
      viz1ComparedCountries = viz1ComparedCountries.filter(c => c !== code);
      drawViz1Plotly();
      updateViz1CompareUI();
    });
  });
  
  const clearBtn = document.getElementById('viz1-clear-compare');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      viz1ComparedCountries = [];
      drawViz1Plotly();
      updateViz1CompareUI();
    });
  }
  updateViz1PinnedDetail();
}

const VIZ1_SPECIFIC_COUNTRIES = [
  "USA", "CHN", "GBR", "DEU", "IND", "JPN", "FRA", "CAN", "ITA", "KOR", "AUS", "ESP", "BRA", "RUS", "NLD", 
  "IDN", "TUR", "IRN", "SAU", "POL", "CHE", "MYS", "PAK", "EGY", "MEX", "PRT", "SWE", "BEL", "ZAF", "NGA", "DNK", "UKR", "HKG", "AUT", "NOR",
  "IRQ", "ECU", "NPL", "VNM", "PER", "ETH", "GHA", "CYP", "COL", "UGA", "ARE", "BGD", "TJK", "PHL", "DZA"
];

/** Fixed country order per region across all years — keeps Plotly point identity stable on Play. */
let VIZ1_REGION_ROSTERS = null;
function getViz1RegionRosters() {
  if (VIZ1_REGION_ROSTERS) return VIZ1_REGION_ROSTERS;
  const map = {};
  if (typeof VIZ1_DATA !== 'undefined') {
    VIZ1_DATA.forEach((d) => {
      const r = d.Region || 'Other';
      if (!map[r]) map[r] = new Set();
      if (d.Country_Code) map[r].add(d.Country_Code);
    });
  }
  VIZ1_REGION_ROSTERS = {};
  Object.keys(map).forEach((r) => {
    VIZ1_REGION_ROSTERS[r] = [...map[r]].sort();
  });
  return VIZ1_REGION_ROSTERS;
}

/** Per-country year→row index for O(1) lookups + carry-forward of true gaps. */
let VIZ1_BY_CODE_YEAR = null;
function getViz1ByCodeYear() {
  if (VIZ1_BY_CODE_YEAR) return VIZ1_BY_CODE_YEAR;
  VIZ1_BY_CODE_YEAR = {};
  if (typeof VIZ1_DATA === 'undefined') return VIZ1_BY_CODE_YEAR;
  VIZ1_DATA.forEach((d) => {
    if (!d.Country_Code || d.Year == null) return;
    if (!VIZ1_BY_CODE_YEAR[d.Country_Code]) VIZ1_BY_CODE_YEAR[d.Country_Code] = {};
    VIZ1_BY_CODE_YEAR[d.Country_Code][d.Year] = d;
  });
  return VIZ1_BY_CODE_YEAR;
}

/**
 * Resolve a roster country for a year. Exact pool row wins; otherwise carry-forward
 * last known (x,y) from an earlier year so markers don't vanish mid-timeline.
 * Does NOT invent publication counts — Total_Docs forced to 0 / N/A in hover.
 */
function resolveViz1NodeForYear(code, year) {
  const byYear = getViz1ByCodeYear()[code];
  if (!byYear) return null;
  if (byYear[year]) return byYear[year];
  let bestYear = null;
  for (const yStr of Object.keys(byYear)) {
    const y = +yStr;
    if (y < year && (bestYear == null || y > bestYear)) bestYear = y;
  }
  if (bestYear == null) return null;
  const src = byYear[bestYear];
  return {
    Country_Code: code,
    Country_Name: src.Country_Name,
    Year: year,
    Region: src.Region,
    Total_Docs: 0,
    H_Index: src.H_Index,
    H_Index_Yearly: src.H_Index_Yearly,
    H_Index_SCImago: src.H_Index_SCImago,
    H_Index_Display_Source: src.H_Index_Display_Source,
    // Do not carry GERD across missing years (hierarchical river may be null)
    GERD_Percent_GDP: null,
    GERD_Source: null,
    GDP_Per_Capita_PPP: src.GDP_Per_Capita_PPP,
    x: src.x,
    y: src.y,
    _positionCarried: true,
    _carriedFromYear: bestYear
  };
}

function viz1EaseInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function cancelViz1Motion(keepTrails) {
  viz1MotionGen++;
  if (viz1MotionRaf) {
    cancelAnimationFrame(viz1MotionRaf);
    viz1MotionRaf = null;
  }
  if (!keepTrails) clearViz1Trails();
}

function clearViz1Trails() {
  viz1Trails = [];
  if (viz1TrailRaf) {
    cancelAnimationFrame(viz1TrailRaf);
    viz1TrailRaf = null;
  }
}

function ensureViz1TrailFadeLoop() {
  if (viz1TrailRaf) return;
  let lastFadePaint = 0;
  const tick = (now) => {
    viz1TrailRaf = null;
    if (viz1MotionRaf) {
      // Lerp owns frames; resume fade after motion ends
      viz1TrailRaf = requestAnimationFrame(tick);
      return;
    }
    viz1Trails = viz1Trails.filter((tr) => now - tr.born < tr.life);
    if (viz1Trails.length === 0) return;
    // ~20fps fade updates — enough for soft vanish without Plotly thrash
    if (now - lastFadePaint >= 50) {
      lastFadePaint = now;
      redrawViz1WithTrails();
    }
    viz1TrailRaf = requestAnimationFrame(tick);
  };
  viz1TrailRaf = requestAnimationFrame(tick);
}

function spawnViz1Trails(fromPos, toPos) {
  const candidates = [];
  for (const code of Object.keys(toPos)) {
    const a = fromPos[code];
    const b = toPos[code];
    if (!a || !b) continue;
    if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const size = Math.max(a.size || 0, b.size || 0);
    if (size < VIZ1_TRAIL_MIN_SIZE) continue;
    // Strength ∝ bubble size — USA/CHN thick bright tails; tiny nations almost none
    const strength = Math.min(1, Math.max(0, (size - VIZ1_TRAIL_MIN_SIZE) / 36));
    if (strength < 0.06) continue;
    // Giants trail on tiny drifts; small countries need a clearer hop (size-scaled eps)
    const minDist = VIZ1_MOVE_EPS + (1 - strength) * 0.08;
    if (dist < minDist) continue;
    candidates.push({ code, a, b, dist, size, strength });
  }
  candidates.sort((u, v) => v.strength - u.strength || v.dist - u.dist);
  const top = candidates.slice(0, 28);
  const now = performance.now();
  for (const c of top) {
    // Longer path sample for bigger/farther movers
    const nPts = Math.round(5 + c.strength * 14 + Math.min(8, c.dist * 20));
    const xs = [];
    const ys = [];
    for (let i = 0; i <= nPts; i++) {
      const t = i / nPts;
      xs.push(c.a.x + (c.b.x - c.a.x) * t);
      ys.push(c.a.y + (c.b.y - c.a.y) * t);
    }
    viz1Trails.push({
      code: c.code,
      color: c.a.color || c.b.color || '#5f9192',
      xs,
      ys,
      width: 1.2 + c.strength * 7,
      baseOpacity: 0.22 + c.strength * 0.58,
      life: 1100 + c.strength * 900,
      born: now,
      head: 0 // 0..1 filled during lerp so comet grows behind the bubble
    });
  }
  if (viz1Trails.length > 48) viz1Trails = viz1Trails.slice(-48);
  // Fade loop starts after lerp finishes — otherwise it redraws from lastPositions mid-flight
}

/**
 * True when a country marker is currently drawn as a pickable/visible bubble
 * (size/opacity > 0 under region + Show Specific filters). Used to refuse
 * compare toggles on Plotly hit-tests against size-0 "ghost" markers.
 */
function isViz1CountryVisuallySelectable(code) {
  if (!code) return false;
  const row = (typeof VIZ1_DATA !== 'undefined')
    ? (VIZ1_DATA.find(d => d.Country_Code === code && d.Year === viz1Year)
      || VIZ1_DATA.find(d => d.Country_Code === code))
    : null;
  if (!row) return false;
  if (viz1SelectedRegion && row.Region !== viz1SelectedRegion) return false;
  if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(code)) return false;
  return true;
}

/**
 * Trail visibility multiplier matching marker focus rules for a country code.
 * Unfocused global view → 1.0 (keeps current trail look). Compare/search/region/
 * show-specific gate the same way as marker opacities in buildViz1MarkerBundle.
 */
function getViz1TrailVisibility(code) {
  if (!code) return 0;
  const row = (typeof VIZ1_DATA !== 'undefined')
    ? (VIZ1_DATA.find(d => d.Country_Code === code && d.Year === viz1Year)
      || VIZ1_DATA.find(d => d.Country_Code === code))
    : null;
  if (!row) return 0;
  if (viz1SelectedRegion && row.Region !== viz1SelectedRegion) return 0;
  if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(code)) return 0;

  const isCompareActive = viz1ComparedCountries.length > 0;
  if (isCompareActive) {
    return viz1ComparedCountries.includes(code) ? 1.0 : 0.05;
  }

  const searchTerms = viz1SearchQuery.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (searchTerms.length > 0) {
    const name = (row.Country_Name || '').toLowerCase();
    const match = searchTerms.some(term => name.includes(term));
    return match ? 1.0 : 0.15;
  }

  return 1.0;
}

function buildViz1TrailTraces(now) {
  const traces = [];
  for (const tr of viz1Trails) {
    const age = now - tr.born;
    if (age >= tr.life) continue;
    const vis = getViz1TrailVisibility(tr.code);
    if (vis <= 0) continue;
    const fade = 1 - age / tr.life;
    const head = Math.max(0.05, Math.min(1, tr.head == null ? 1 : tr.head));
    const n = tr.xs.length;
    const cut = Math.max(2, Math.ceil(n * head));
    const xs = tr.xs.slice(0, cut);
    const ys = tr.ys.slice(0, cut);
    // Helios comet: bright head near bubble, fading tail (line + soft markers).
    // Multiply by marker-matched visibility so dimmed countries don't leave bright trails.
    const op = tr.baseOpacity * fade * vis;
    traces.push({
      x: xs,
      y: ys,
      mode: 'lines',
      type: 'scatter',
      line: {
        color: tr.color,
        width: Math.max(0.5, tr.width * fade * (0.55 + 0.45 * head)),
        shape: 'spline',
        simplify: false
      },
      opacity: op,
      hoverinfo: 'skip',
      showlegend: false,
      cliponaxis: false
    });
    // Soft glow dots denser toward the head
    const mx = [];
    const my = [];
    const ms = [];
    const mo = [];
    for (let i = 0; i < cut; i++) {
      const u = cut <= 1 ? 1 : i / (cut - 1);
      mx.push(xs[i]);
      my.push(ys[i]);
      ms.push(Math.max(1.5, tr.width * (0.25 + 0.85 * u) * fade));
      mo.push(op * (0.15 + 0.85 * u));
    }
    traces.push({
      x: mx,
      y: my,
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: ms,
        color: tr.color,
        opacity: mo,
        line: { width: 0 }
      },
      hoverinfo: 'skip',
      showlegend: false,
      cliponaxis: false
    });
  }
  return traces;
}

function setViz1TrailHeads(progress) {
  // Only the trails spawned for this transition (recently born) grow with the lerp
  const now = performance.now();
  for (const tr of viz1Trails) {
    if (now - tr.born < VIZ1_LERP_MS + 80) tr.head = progress;
    else if (tr.head == null || tr.head < 1) tr.head = 1;
  }
}

/**
 * Build region marker traces for a year. positionOverride: {code:{x,y}} for lerp frames.
 * Returns { traces, positions }.
 */
function buildViz1MarkerBundle(targetYear, positionOverride) {
  const allRegions = getViz1Regions();
  let yearData = VIZ1_DATA.filter(d => d.Year === targetYear);
  if (viz1SelectedRegion) {
    yearData = yearData.filter(d => d.Region === viz1SelectedRegion);
  }

  const searchTerms = viz1SearchQuery.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const isSearchActive = searchTerms.length > 0;
  const matchesSearch = (countryName) => {
    if (!isSearchActive) return true;
    const name = (countryName || '').toLowerCase();
    return searchTerms.some(term => name.includes(term));
  };
  const isCompareActive = viz1ComparedCountries.length > 0;
  const rosters = getViz1RegionRosters();
  const positions = {};

  const traces = allRegions.map((region, globalIndex) => {
    const regionColor = viz1ColorForRegion(region) || viz1ColorPalette[globalIndex % viz1ColorPalette.length];
    const regionLine = viz1DarkenHex(regionColor, 36);
    const roster = rosters[region] || [];
    const nodes = roster.map((code) => {
      const d = resolveViz1NodeForYear(code, targetYear);
      if (!d) return null;
      // Region filter / roster region mismatch: only show if this year belongs here
      if (d.Region && d.Region !== region) return null;
      if (viz1SelectedRegion && d.Region !== viz1SelectedRegion) return null;
      return d;
    });

    if (roster.length === 0) {
      return { x: [], y: [], mode: 'markers', type: 'scatter', name: region, marker: { color: regionColor } };
    }

    const sizes = nodes.map((d) => {
      if (!d) return 0;
      if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(d.Country_Code)) return 0;
      // True-gap carry-forward: keep a faint pin so identity stays; do not look like real volume
      if (d._positionCarried) return 4;
      return Math.max(6, Math.sqrt(d.Total_Docs || 0) * 0.08);
    });

    const opacities = nodes.map((d) => {
      if (!d) return 0;
      if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(d.Country_Code)) return 0;
      // fig2: semi-transparent fills (~0.75) so overlaps blend
      const base = d._positionCarried ? 0.35 : 0.75;
      if (isCompareActive) return viz1ComparedCountries.includes(d.Country_Code) ? 1.0 : 0.05;
      if (!isSearchActive) return base;
      return matchesSearch(d.Country_Name) ? 1.0 : 0.15;
    });

    const lineWidths = nodes.map((d) => {
      if (!d) return 0;
      if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(d.Country_Code)) return 0;
      if (isCompareActive) return viz1ComparedCountries.includes(d.Country_Code) ? 4 : 0.5;
      if (!isSearchActive) return d._positionCarried ? 0.5 : 0.9;
      return matchesSearch(d.Country_Name) ? 3 : 0.5;
    });

    const lineColors = nodes.map((d) => {
      if (!d) return 'transparent';
      if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(d.Country_Code)) return 'transparent';
      if (isCompareActive) return viz1ComparedCountries.includes(d.Country_Code) ? '#456672' : 'rgba(26,29,36,0.08)';
      if (!isSearchActive) return d._positionCarried ? 'rgba(26,29,36,0.30)' : regionLine;
      return matchesSearch(d.Country_Name) ? '#1a1d24' : 'rgba(26,29,36,0.08)';
    });

    const hoverinfos = nodes.map((d) => {
      if (!d) return 'skip';
      if (viz1ShowSpecific && !VIZ1_SPECIFIC_COUNTRIES.includes(d.Country_Code)) return 'skip';
      return 'text';
    });

    const text = nodes.map((d) => (d ? formatViz1CountryDetailHtml(d) : ''));

    const xs = nodes.map((d, i) => {
      const code = roster[i];
      if (positionOverride && positionOverride[code] && positionOverride[code].x != null) {
        return positionOverride[code].x;
      }
      return d ? d.x : null;
    });
    const ys = nodes.map((d, i) => {
      const code = roster[i];
      if (positionOverride && positionOverride[code] && positionOverride[code].y != null) {
        return positionOverride[code].y;
      }
      return d ? d.y : null;
    });

    roster.forEach((code, i) => {
      const d = nodes[i];
      const x = xs[i];
      const y = ys[i];
      if (x == null || y == null) return;
      positions[code] = {
        x,
        y,
        size: sizes[i],
        color: regionColor,
        pubs: d && !d._positionCarried ? (d.Total_Docs || 0) : 0
      };
    });

    return {
      x: xs,
      y: ys,
      ids: roster.slice(),
      customdata: roster.slice(),
      mode: 'markers',
      type: 'scatter',
      name: region,
      text: text,
      hoverinfo: hoverinfos,
      marker: { size: sizes, color: regionColor, opacity: opacities, line: { color: lineColors, width: lineWidths }, sizemode: 'diameter', sizeref: 1 }
    };
  });

  return { traces, positions, yearData, allRegions };
}

function getViz1Layout() {
  return {
    // Stable across year updates — Plotly keeps drag-zoom/pan when range keys are omitted.
    uirevision: 'viz1',
    title: false,
    dragmode: 'zoom',
    // MUST stay 0: Plotly non-zero transition morphs SVG markers by list index.
    // When year roster order/length changed, index i became another country → USA "flew"
    // to the wrong coords. We animate by fixed roster + ids via rAF lerp instead; trails
    // are extra scatter traces under markers that fade over ~1.2–2s (size-scaled comets).
    transition: { duration: 0, easing: 'linear' },
    paper_bgcolor: '#f4f3ee', plot_bgcolor: '#f4f3ee',
    font: { family: 'Plus Jakarta Sans, sans-serif', color: '#1a1d24' },
    xaxis: {
      title: {
        text: 'Dimensionality Reduction (Wealth, R&D, Volume, Quality)',
        font: { color: 'rgba(90,101,112,0.45)', size: 11 }
      },
      type: 'linear',
      showgrid: true,
      gridcolor: 'rgba(26,29,36,0.07)',
      zeroline: false,
      showline: false,
      linecolor: 'rgba(26,29,36,0.12)',
      showticklabels: false,
      // Ranges applied only on first draw via getViz1ReactLayout.
      // Year/lerp updates reuse container.layout so uirevision keeps drag-zoom without thrash.
      autorange: false,
      fixedrange: false
    },
    yaxis: {
      title: {
        text: 'UMAP Projection Space',
        font: { color: 'rgba(90,101,112,0.40)', size: 11 }
      },
      type: 'linear',
      showgrid: true,
      gridcolor: 'rgba(26,29,36,0.07)',
      zeroline: false,
      showline: false,
      linecolor: 'rgba(26,29,36,0.12)',
      showticklabels: false,
      autorange: false,
      fixedrange: false
    },
    hovermode: 'closest',
    hoverlabel: { bgcolor: 'rgba(255, 255, 255, 0.98)', font: { family: 'Plus Jakarta Sans, sans-serif', size: 13, color: '#1a1d24' }, bordercolor: '#5f9192' },
    legend: { font: { color: '#3d4650', size: 12 }, orientation: 'h', yanchor: 'bottom', y: 1.05, xanchor: 'center', x: 0.5, bgcolor: 'rgba(0,0,0,0)', itemclick: false, itemdoubleclick: false },
    margin: { l: 20, r: 20, t: 48, b: 28 }
  };
}

function bindViz1PlotEvents(container) {
  if (viz1EventsBound) return;
  viz1EventsBound = true;
  let ignoreNextBgClick = false;

  container.on('plotly_click', function(data) {
    const point = data.points && data.points[0];
    if (!point || point.customdata == null) return;
    // Ignore trail/comet traces (no country customdata on those)
    if (typeof point.customdata !== 'string') return;
    const code = point.customdata;
    // Size-0 / opacity-0 markers (Show Specific, region filter) still hit-test in Plotly —
    // refuse compare toggles so "empty" clicks cannot ghost-select hidden countries.
    if (!isViz1CountryVisuallySelectable(code)) return;
    ignoreNextBgClick = true;
    if (viz1ComparedCountries.includes(code)) {
      viz1ComparedCountries = viz1ComparedCountries.filter(c => c !== code);
    } else {
      viz1ComparedCountries.push(code);
    }
    updateViz1CompareUI();
    drawViz1Plotly({ animate: false });
    setTimeout(() => { ignoreNextBgClick = false; }, 50);
  });

  container.addEventListener('click', function(ev) {
    if (ignoreNextBgClick) return;
    const t = ev.target;
    if (!t || !t.classList) return;
    if (!(t.classList.contains('bg') || t.classList.contains('nsewdrag'))) return;
    if (viz1ComparedCountries.length) clearViz1Compare();
  });

  container.on('plotly_relayout', function(e) {
    if (!e || viz1IgnoreRelayout) return;
    document.querySelectorAll('.plotly-notifier, .notifier-note').forEach((n) => n.remove());
    // Autoscale / double-click-style reset → drop stored zoom and lock full-view axes.
    if (e['xaxis.autorange'] === true || e['yaxis.autorange'] === true) {
      clearViz1UserZoom();
      viz1IgnoreRelayout = true;
      Plotly.relayout(container, {
        'xaxis.range': VIZ1_AXIS.x.slice(),
        'yaxis.range': VIZ1_AXIS.y.slice(),
        'xaxis.autorange': false,
        'yaxis.autorange': false
      }).catch(() => {}).finally(() => {
        viz1IgnoreRelayout = false;
        updateViz1FlagOverlay(viz1FlagPositions || viz1LastPositions);
      });
      return;
    }
    if (e['xaxis.range[0]'] != null || e['xaxis.range'] || e['yaxis.range[0]'] != null || e['yaxis.range']) {
      const xr = e['xaxis.range'] || (e['xaxis.range[0]'] != null ? [e['xaxis.range[0]'], e['xaxis.range[1]']] : null);
      const yr = e['yaxis.range'] || (e['yaxis.range[0]'] != null ? [e['yaxis.range[0]'], e['yaxis.range[1]']] : null);
      const curX = xr || (container.layout && container.layout.xaxis && container.layout.xaxis.range);
      const curY = yr || (container.layout && container.layout.yaxis && container.layout.yaxis.range);
      if (curX && curY && curX.length >= 2 && curY.length >= 2) {
        const zoomed = rangesDiffer(curX, VIZ1_AXIS.x) || rangesDiffer(curY, VIZ1_AXIS.y);
        if (zoomed) {
          // Store for Reset Zoom + defensive restore — do NOT re-inject on every Plotly.react.
          viz1UserZoom = { x: [curX[0], curX[1]], y: [curY[0], curY[1]] };
          viz1IsZoomed = true;
        } else {
          viz1UserZoom = null;
          viz1IsZoomed = false;
        }
        updateViz1ZoomButton();
      }
    }
    // Keep Show-Specific circular flags glued after pan/zoom (layout reuse unchanged).
    updateViz1FlagOverlay(viz1FlagPositions || viz1LastPositions);
  });

  container.on('plotly_doubleclick', function() {
    resetViz1Zoom();
    return false;
  });
  container.addEventListener('dblclick', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (viz1IsZoomed) resetViz1Zoom();
  }, true);

  container.on('plotly_legendclick', function(data) {
    const r = data.data[data.curveNumber] && data.data[data.curveNumber].name;
    if (!r) return false;
    // Same region again → global; different region → switch focus. No chip/back button.
    viz1SelectedRegion = (viz1SelectedRegion === r) ? null : r;
    drawViz1Plotly({ animate: false });
    return false;
  });
}

let viz1PendingReact = null;
/** Last bubble positions used to glue Show-Specific flag badges (data coords). */
let viz1FlagPositions = null;
let viz1FlagResizeObs = null;

/** ISO3 → ISO2 for flagcdn (Show Specific roster + VIZ1 countries). */
const VIZ1_ISO3_TO_ISO2 = {
  ABW: 'aw', AFG: 'af', AGO: 'ao', ALB: 'al', AND: 'ad', ARE: 'ae', ARG: 'ar', ARM: 'am', ATG: 'ag', AUS: 'au',
  AUT: 'at', AZE: 'az', BDI: 'bi', BEL: 'be', BEN: 'bj', BFA: 'bf', BGD: 'bd', BGR: 'bg', BHR: 'bh', BHS: 'bs',
  BIH: 'ba', BLR: 'by', BLZ: 'bz', BMU: 'bm', BOL: 'bo', BRA: 'br', BRB: 'bb', BRN: 'bn', BTN: 'bt', BWA: 'bw',
  CAF: 'cf', CAN: 'ca', CHE: 'ch', CHL: 'cl', CHN: 'cn', CIV: 'ci', CMR: 'cm', COD: 'cd', COG: 'cg', COL: 'co',
  COM: 'km', CPV: 'cv', CRI: 'cr', CYM: 'ky', CYP: 'cy', CZE: 'cz', DEU: 'de', DJI: 'dj', DMA: 'dm', DNK: 'dk',
  DOM: 'do', DZA: 'dz', ECU: 'ec', EGY: 'eg', ERI: 'er', ESP: 'es', EST: 'ee', ETH: 'et', FIN: 'fi', FJI: 'fj',
  FRA: 'fr', FRO: 'fo', FSM: 'fm', GAB: 'ga', GBR: 'gb', GEO: 'ge', GHA: 'gh', GIN: 'gn', GMB: 'gm', GNB: 'gw',
  GNQ: 'gq', GRC: 'gr', GRD: 'gd', GRL: 'gl', GTM: 'gt', GUY: 'gy', HKG: 'hk', HND: 'hn', HRV: 'hr', HTI: 'ht',
  HUN: 'hu', IDN: 'id', IND: 'in', IRL: 'ie', IRN: 'ir', IRQ: 'iq', ISL: 'is', ISR: 'il', ITA: 'it', JAM: 'jm',
  JOR: 'jo', JPN: 'jp', KAZ: 'kz', KEN: 'ke', KGZ: 'kg', KHM: 'kh', KIR: 'ki', KNA: 'kn', KOR: 'kr', KWT: 'kw',
  LAO: 'la', LBN: 'lb', LBR: 'lr', LBY: 'ly', LCA: 'lc', LKA: 'lk', LSO: 'ls', LTU: 'lt', LUX: 'lu', LVA: 'lv',
  MAC: 'mo', MAR: 'ma', MDA: 'md', MDG: 'mg', MDV: 'mv', MEX: 'mx', MHL: 'mh', MKD: 'mk', MLI: 'ml', MLT: 'mt',
  MMR: 'mm', MNE: 'me', MNG: 'mn', MOZ: 'mz', MRT: 'mr', MUS: 'mu', MWI: 'mw', MYS: 'my', NAM: 'na', NER: 'ne',
  NGA: 'ng', NIC: 'ni', NLD: 'nl', NOR: 'no', NPL: 'np', NRU: 'nr', NZL: 'nz', OMN: 'om', PAK: 'pk', PAN: 'pa',
  PER: 'pe', PHL: 'ph', PLW: 'pw', PNG: 'pg', POL: 'pl', PRI: 'pr', PRT: 'pt', PRY: 'py', PSE: 'ps', QAT: 'qa',
  ROU: 'ro', RUS: 'ru', RWA: 'rw', SAU: 'sa', SDN: 'sd', SEN: 'sn', SGP: 'sg', SLB: 'sb', SLE: 'sl', SLV: 'sv',
  SMR: 'sm', SOM: 'so', SRB: 'rs', SSD: 'ss', STP: 'st', SUR: 'sr', SVK: 'sk', SVN: 'si', SWE: 'se', SWZ: 'sz',
  SXM: 'sx', SYC: 'sc', SYR: 'sy', TCA: 'tc', TCD: 'td', TGO: 'tg', THA: 'th', TJK: 'tj', TKM: 'tm', TLS: 'tl',
  TON: 'to', TTO: 'tt', TUN: 'tn', TUR: 'tr', TUV: 'tv', TZA: 'tz', UGA: 'ug', UKR: 'ua', URY: 'uy', USA: 'us',
  UZB: 'uz', VCT: 'vc', VEN: 've', VIR: 'vi', VNM: 'vn', VUT: 'vu', WSM: 'ws', YEM: 'ye', ZAF: 'za', ZMB: 'zm',
  ZWE: 'zw'
};

/**
 * Circular-cropped flag badges for Show Specific countries only.
 * HTML overlay (Plotly WebGL cannot clip images) — glued via axis→pixel on relayout/year/lerp.
 */
function ensureViz1FlagLayer() {
  let layer = document.getElementById('viz1-flag-layer');
  if (layer) return layer;
  const plot = document.querySelector('.viz1-plot');
  if (!plot) return null;
  layer = document.createElement('div');
  layer.id = 'viz1-flag-layer';
  layer.className = 'viz1-flag-layer';
  layer.setAttribute('aria-hidden', 'true');
  plot.appendChild(layer);
  return layer;
}

function clearViz1FlagOverlay() {
  viz1FlagPositions = null;
  const layer = document.getElementById('viz1-flag-layer');
  if (layer) layer.innerHTML = '';
}

function viz1DataToPixel(container, x, y) {
  const full = container && container._fullLayout;
  if (!full || !full.xaxis || !full.yaxis) return null;
  const xa = full.xaxis;
  const ya = full.yaxis;
  if (typeof xa.l2p !== 'function' || typeof ya.l2p !== 'function') return null;
  const left = xa.l2p(x) + (xa._offset || 0);
  const top = ya.l2p(y) + (ya._offset || 0);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { left, top };
}

/**
 * Reposition / rebuild circular flag badges.
 * Rule: only when Show Specific is ON — one badge per VIZ1_SPECIFIC_COUNTRIES bubble
 * that is currently drawn (size > 0). Cleared when Show Specific is off.
 */
function updateViz1FlagOverlay(positions) {
  const layer = ensureViz1FlagLayer();
  const container = document.getElementById('viz1-plotly-container');
  if (!layer || !container) return;

  if (!viz1ShowSpecific) {
    clearViz1FlagOverlay();
    return;
  }

  const pos = positions || viz1FlagPositions || viz1LastPositions || {};
  viz1FlagPositions = pos;

  const want = new Set();
  for (const code of VIZ1_SPECIFIC_COUNTRIES) {
    const p = pos[code];
    if (!p || p.x == null || p.y == null) continue;
    if (!(p.size > 0)) continue;
    // Region filter / Show Specific already zeroed size for hidden — still gate selectable
    if (!isViz1CountryVisuallySelectable(code)) continue;
    if (!VIZ1_ISO3_TO_ISO2[code]) continue;
    want.add(code);
  }

  [...layer.children].forEach((el) => {
    if (!want.has(el.dataset.code)) el.remove();
  });

  const full = container._fullLayout;
  const plotSize = full && full._size;

  want.forEach((code) => {
    const p = pos[code];
    const pixel = viz1DataToPixel(container, p.x, p.y);
    if (!pixel) return;

    let inView = true;
    if (plotSize) {
      const pad = 8;
      if (
        pixel.left < plotSize.l - pad ||
        pixel.left > plotSize.l + plotSize.w + pad ||
        pixel.top < plotSize.t - pad ||
        pixel.top > plotSize.t + plotSize.h + pad
      ) {
        inView = false;
      }
    }

    let badge = layer.querySelector(`[data-code="${code}"]`);
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'viz1-flag-badge';
      badge.dataset.code = code;
      const img = document.createElement('img');
      const iso2 = VIZ1_ISO3_TO_ISO2[code];
      img.src = `https://flagcdn.com/w80/${iso2}.png`;
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.draggable = false;
      img.addEventListener('error', () => { badge.style.display = 'none'; });
      badge.appendChild(img);
      layer.appendChild(badge);
    }

    // Fill the bubble (slightly inset so region rim peeks); circular clip via CSS
    const diam = Math.max(10, Math.min(52, (p.size || 10) * 0.86));
    badge.style.width = `${diam}px`;
    badge.style.height = `${diam}px`;
    badge.style.left = `${pixel.left}px`;
    badge.style.top = `${pixel.top}px`;
    badge.style.visibility = inView ? 'visible' : 'hidden';
    badge.style.display = '';
  });
}

function bindViz1FlagResizeObserver(container) {
  if (!container || typeof ResizeObserver === 'undefined') return;
  if (viz1FlagResizeObs) {
    try { viz1FlagResizeObs.disconnect(); } catch (e) {}
  }
  viz1FlagResizeObs = new ResizeObserver(() => {
    updateViz1FlagOverlay(viz1FlagPositions || viz1LastPositions);
  });
  viz1FlagResizeObs.observe(container);
}

function reactViz1(container, traces, layout, config, opts = {}) {
  // During rAF lerp, drop frames if Plotly is still painting (avoids backlog / stutter)
  if (opts.skipIfBusy && viz1PendingReact) return Promise.resolve();
  const checkZoom = opts.checkZoom !== false && !opts.skipIfBusy;
  const flagPositions = opts.flagPositions;
  const run = () => {
    viz1PendingReact = Plotly.react(container, traces, layout, config)
      .then(async () => {
        bindViz1PlotEvents(container);
        bindViz1FlagResizeObserver(container);
        // Year-boundary / idle frames only — never mid-lerp (skipIfBusy path).
        if (checkZoom) await restoreViz1ZoomIfLost(container);
        updateViz1FlagOverlay(flagPositions || viz1LastPositions);
      })
      .catch(() => {})
      .finally(() => { viz1PendingReact = null; });
    return viz1PendingReact;
  };
  if (viz1PendingReact && !opts.skipIfBusy) {
    return viz1PendingReact.then(run, run);
  }
  return run();
}

function redrawViz1WithTrails() {
  const container = document.getElementById('viz1-plotly-container');
  if (!container || typeof Plotly === 'undefined' || typeof VIZ1_DATA === 'undefined') return;
  if (viz1MotionRaf) return; // do not fight in-flight year lerp
  const targetYear = parseInt(viz1Year, 10);
  const bundle = buildViz1MarkerBundle(targetYear, null);
  const layout = getViz1ReactLayout(container);
  const config = { displayModeBar: false, responsive: true, doubleClick: false, showTips: false };
  const trailTraces = buildViz1TrailTraces(performance.now());
  // Trails UNDER country markers (drawn first)
  reactViz1(container, trailTraces.concat(bundle.traces), layout, config);
}

function interpolatePositions(fromPos, toPos, t) {
  const out = {};
  const codes = new Set([...Object.keys(fromPos || {}), ...Object.keys(toPos || {})]);
  codes.forEach((code) => {
    const a = fromPos && fromPos[code];
    const b = toPos && toPos[code];
    if (a && b && a.x != null && b.x != null && a.y != null && b.y != null) {
      out[code] = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        size: (b.size != null ? b.size : a.size),
        color: b.color || a.color,
        pubs: b.pubs != null ? b.pubs : a.pubs
      };
    } else if (b && b.x != null) {
      out[code] = { ...b };
    } else if (a && a.x != null && t < 1) {
      // Fading out of year — hold until end then drop
      out[code] = t < 0.95 ? { ...a } : null;
    }
  });
  Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; });
  return out;
}

function anyViz1Moved(fromPos, toPos) {
  if (!fromPos || !toPos) return false;
  for (const code of Object.keys(toPos)) {
    const a = fromPos[code];
    const b = toPos[code];
    if (!a || !b) continue;
    if (a.x != null && b.x != null && a.y != null && b.y != null) {
      if (Math.hypot(b.x - a.x, b.y - a.y) >= VIZ1_MOVE_EPS) return true;
    }
    // Pubs (marker size) can jump even when UMAP barely drifts — still lerp
    if (Math.abs((b.size || 0) - (a.size || 0)) >= 1.5) return true;
  }
  return false;
}

function updateViz1Stats(yearData, allRegions) {
  const statNations = document.getElementById('viz1-stat-nations');
  const statRegions = document.getElementById('viz1-stat-regions');
  const statPubs = document.getElementById('viz1-stat-pubs');
  if (statNations) statNations.textContent = yearData.length;
  if (statRegions) {
    if (viz1SelectedRegion) statRegions.textContent = 1;
    else statRegions.textContent = allRegions.length;
  }
  if (statPubs) {
    const totalPubs = Math.round(yearData.reduce((sum, d) => sum + (d.Total_Docs || 0), 0));
    // Compact form keeps the metric column readable in the narrow sidebar
    if (totalPubs >= 1e6) {
      statPubs.textContent = (totalPubs / 1e6).toFixed(totalPubs >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    } else if (totalPubs >= 1e4) {
      statPubs.textContent = (totalPubs / 1e3).toFixed(totalPubs >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
    } else {
      statPubs.textContent = totalPubs.toLocaleString();
    }
    statPubs.title = totalPubs.toLocaleString() + ' publications';
  }
}

/**
 * Draw Graph 1. opts.animate (default true on year change) runs rAF lerp + comet trails.
 * Layout transition stays duration:0 — identity-safe motion uses fixed rosters + ids.
 */
function drawViz1Plotly(opts = {}) {
  const container = document.getElementById('viz1-plotly-container');
  if (!container || typeof VIZ1_DATA === 'undefined') return Promise.resolve();
  if (typeof Plotly === 'undefined') return Promise.resolve();

  const wantAnimate = opts.animate !== false;
  const targetYear = parseInt(viz1Year, 10);
  const yearChanged = viz1LastDrawnYear != null && viz1LastDrawnYear !== targetYear;
  const bundleTarget = buildViz1MarkerBundle(targetYear, null);
  updateViz1Stats(bundleTarget.yearData, bundleTarget.allRegions);
  // Refresh pinned detail whenever year/selection redraws (slider, Play, lerp end, compare toggle)
  updateViz1PinnedDetail();

  const layout = getViz1ReactLayout(container);
  const config = { displayModeBar: false, responsive: true, doubleClick: false, showTips: false };

  const shouldLerp = wantAnimate && yearChanged && viz1LastPositions && anyViz1Moved(viz1LastPositions, bundleTarget.positions);

  if (!shouldLerp) {
    const trailTraces = buildViz1TrailTraces(performance.now());
    viz1LastPositions = bundleTarget.positions;
    viz1LastDrawnYear = targetYear;
    return reactViz1(container, trailTraces.concat(bundleTarget.traces), layout, config);
  }

  // Spawn size-scaled comet trails (old → new), then lerp marker x/y by id-stable roster
  spawnViz1Trails(viz1LastPositions, bundleTarget.positions);
  const fromPos = viz1LastPositions;
  const toPos = bundleTarget.positions;
  const gen = ++viz1MotionGen;
  const lerpMs = Math.min(620, Math.max(180, Math.round((viz1Speed * 0.85) / (viz1SpeedMultiplier || 1))));

  return new Promise((resolve) => {
    const t0 = performance.now();
    let lastPaint = 0;

    const frame = (now) => {
      if (gen !== viz1MotionGen) {
        resolve();
        return;
      }
      const raw = Math.min(1, (now - t0) / lerpMs);
      const t = viz1EaseInOut(raw);
      // ~30fps ceiling during lerp; always paint the final frame
      if (raw < 1 && now - lastPaint < 32) {
        viz1MotionRaf = requestAnimationFrame(frame);
        return;
      }
      lastPaint = now;
      setViz1TrailHeads(t);
      const mid = interpolatePositions(fromPos, toPos, t);
      const midBundle = buildViz1MarkerBundle(targetYear, mid);
      midBundle.traces.forEach((tr) => {
        if (!tr.ids || !tr.marker) return;
        tr.ids.forEach((code, i) => {
          const a = fromPos[code];
          const b = toPos[code];
          if (a && b && tr.marker.size) {
            tr.marker.size[i] = (a.size || 0) + ((b.size || 0) - (a.size || 0)) * t;
          }
        });
      });
      const trailTraces = buildViz1TrailTraces(now);
      // Reuse live layout ref — never rewrite axis ranges mid-lerp.
      const lay = getViz1ReactLayout(container);
      // Flags follow mid positions even if Plotly skips a busy frame.
      updateViz1FlagOverlay(mid);
      reactViz1(container, trailTraces.concat(midBundle.traces), lay, config, {
        skipIfBusy: raw < 1,
        flagPositions: mid
      });

      if (raw < 1) {
        viz1MotionRaf = requestAnimationFrame(frame);
      } else {
        viz1MotionRaf = null;
        setViz1TrailHeads(1);
        viz1LastPositions = toPos;
        viz1LastDrawnYear = targetYear;
        const trailTracesEnd = buildViz1TrailTraces(performance.now());
        reactViz1(container, trailTracesEnd.concat(bundleTarget.traces), layout, config, {
          flagPositions: toPos
        }).then(resolve, resolve);
        ensureViz1TrailFadeLoop();
      }
    };

    viz1MotionRaf = requestAnimationFrame(frame);
  });
}


// ══════════════════════════════════════════════════════════
