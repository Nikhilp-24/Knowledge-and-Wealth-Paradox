// ============================================================
// CS661 Group 10 — Data Module (thin pool taps only)
// Stub fiction (fake H/GDP growth, fake collab, fake India) neutralized 2026-07-12.
// Live graphs drink: viz1_data.js, ridgeline_data.js, viz3_data.js,
// viz4_data.js, india_network JSON — see docs/RIVER_OWNERS.md
// ============================================================

const DATA = (() => {

  const REGIONS = {
    "North America":       "#0072B2",
    "Europe":              "#56B4E9",
    "East Asia & Pacific": "#E69F00",
    "South Asia":          "#D55E00",
    "Latin America":       "#CC79A7",
    "Middle East & Africa":"#009E73",
    "Oceania":             "#F0E442"
  };

  /** @deprecated Tap fiction removed — use VIZ1_DATA. */
  function getCountriesForYear(_year) {
    console.warn("[DATA] getCountriesForYear stub neutralized — use VIZ1_DATA (G1 river pool).");
    return [];
  }

  function getRidgelineData() {
    return typeof REAL_RIDGELINE_DATA !== "undefined" ? REAL_RIDGELINE_DATA : {};
  }

  /** @deprecated Tap fiction removed — use window.CSV_DATA / viz3_data.js. */
  function getTopicsForYear(_year) {
    console.warn("[DATA] getTopicsForYear stub neutralized — use viz3_data.js (OpenAlex concepts).");
    return [];
  }

  /**
   * Collaboration stub neutralized — must not override VIZ4_BY_YEAR / VIZ4_DATA.
   * Returns [] so G4 cannot silently show invented cites/paper.
   */
  function getCollabData() {
    console.warn("[DATA] getCollabData stub neutralized — use viz4_data.js (collaboration_premium river).");
    return [];
  }

  /**
   * India demo growth neutralized — must not override processed india_network JSON.
   * Returns empty network so legacy G5 path cannot invent pubs/funding.
   */
  function getIndiaNetwork(_year) {
    console.warn("[DATA] getIndiaNetwork demo neutralized — use india_network JSON / INDIA.render.");
    return { nodes: [], links: [] };
  }

  return {
    REGIONS,
    getCountriesForYear,
    getRidgelineData,
    getTopicsForYear,
    getCollabData,
    getIndiaNetwork
  };

})();
