// ============================================================
// CS661 Group 10 — Data Module
// Pulls from World Bank API live + rich static fallbacks
// ============================================================

const DATA = (() => {

  // ── Region colour palette ──────────────────────────────────
  const REGIONS = {
    "North America":       "#6366f1",
    "Europe":              "#a78bfa",
    "East Asia & Pacific": "#22d3ee",
    "South Asia":          "#fb7185",
    "Latin America":       "#fbbf24",
    "Middle East & Africa":"#34d399",
    "Oceania":             "#f472b6"
  };

  // ── Country master list (18 countries) ─────────────────────
  // tsneX, tsneY are the starting coordinates in the 2D cluster map.
  const COUNTRIES = [
    { iso: "USA", name: "United States",    region: "North America",       gdp2010: 14964, rdPct: 2.74, basePubs: 497332, hIndex: 1279, tsneX: -3.1, tsneY:  2.8 },
    { iso: "CHN", name: "China",            region: "East Asia & Pacific", gdp2010:  6087, rdPct: 1.71, basePubs: 415234, hIndex:  583, tsneX:  2.1, tsneY:  2.3 },
    { iso: "DEU", name: "Germany",          region: "Europe",              gdp2010:  3417, rdPct: 2.74, basePubs: 104217, hIndex:  505, tsneX: -2.1, tsneY:  1.7 },
    { iso: "GBR", name: "United Kingdom",   region: "Europe",              gdp2010:  2480, rdPct: 1.77, basePubs:  97842, hIndex:  554, tsneX: -2.4, tsneY:  2.1 },
    { iso: "JPN", name: "Japan",            region: "East Asia & Pacific", gdp2010:  5700, rdPct: 3.14, basePubs:  78914, hIndex:  429, tsneX: -1.1, tsneY:  1.0 },
    { iso: "IND", name: "India",            region: "South Asia",          gdp2010:  1708, rdPct: 0.85, basePubs: 132048, hIndex:  260, tsneX:  1.6, tsneY: -1.9 },
    { iso: "KOR", name: "South Korea",      region: "East Asia & Pacific", gdp2010:  1094, rdPct: 3.47, basePubs:  73481, hIndex:  349, tsneX: -0.6, tsneY:  2.6 },
    { iso: "BRA", name: "Brazil",           region: "Latin America",       gdp2010:  2209, rdPct: 1.16, basePubs:  59642, hIndex:  234, tsneX:  0.9, tsneY: -1.4 },
    { iso: "FRA", name: "France",           region: "Europe",              gdp2010:  2646, rdPct: 2.18, basePubs:  77812, hIndex:  470, tsneX: -1.9, tsneY:  1.4 },
    { iso: "CAN", name: "Canada",           region: "North America",       gdp2010:  1614, rdPct: 1.80, basePubs:  64112, hIndex:  468, tsneX: -2.3, tsneY:  1.8 },
    { iso: "AUS", name: "Australia",        region: "Oceania",             gdp2010:  1142, rdPct: 2.24, basePubs:  54720, hIndex:  393, tsneX: -2.5, tsneY:  1.5 },
    { iso: "RUS", name: "Russia",           region: "Europe",              gdp2010:  1524, rdPct: 1.13, basePubs:  47841, hIndex:  266, tsneX:  1.1, tsneY: -2.6 },
    { iso: "ZAF", name: "South Africa",     region: "Middle East & Africa",gdp2010:   363, rdPct: 0.73, basePubs:  21841, hIndex:  168, tsneX:  0.6, tsneY: -0.9 },
    { iso: "SAU", name: "Saudi Arabia",     region: "Middle East & Africa",gdp2010:   528, rdPct: 0.48, basePubs:  27614, hIndex:  137, tsneX:  0.3, tsneY:  0.1 },
    { iso: "CHE", name: "Switzerland",      region: "Europe",              gdp2010:   580, rdPct: 2.93, basePubs:  34918, hIndex:  478, tsneX: -2.9, tsneY:  2.6 },
    { iso: "SGP", name: "Singapore",        region: "East Asia & Pacific", gdp2010:   237, rdPct: 2.01, basePubs:  19872, hIndex:  229, tsneX: -2.7, tsneY:  2.3 },
    { iso: "TUR", name: "Turkey",           region: "Middle East & Africa",gdp2010:   771, rdPct: 0.84, basePubs:  34712, hIndex:  169, tsneX:  1.0, tsneY: -1.6 },
    { iso: "ISR", name: "Israel",           region: "Middle East & Africa",gdp2010:   234, rdPct: 3.93, basePubs:  17841, hIndex:  272, tsneX: -2.1, tsneY:  2.8 }
  ];

  // ── GDP growth rate per year after 2010 ───────────────────
  const GROWTH = {
    "USA": 0.043, "CHN": 0.092, "DEU": 0.030, "GBR": 0.025, "JPN": 0.010,
    "IND": 0.075, "KOR": 0.040, "BRA": 0.028, "FRA": 0.022, "CAN": 0.038,
    "AUS": 0.045, "RUS": 0.018, "ZAF": 0.030, "SAU": 0.050, "CHE": 0.022,
    "SGP": 0.055, "TUR": 0.060, "ISR": 0.040
  };

  // ── Publications growth per year ──────────────────────────
  const PUB_GROWTH = {
    "USA": 0.032, "CHN": 0.135, "DEU": 0.038, "GBR": 0.040, "JPN": 0.008,
    "IND": 0.110, "KOR": 0.055, "BRA": 0.062, "FRA": 0.035, "CAN": 0.042,
    "AUS": 0.065, "RUS": 0.052, "ZAF": 0.048, "SAU": 0.090, "CHE": 0.040,
    "SGP": 0.072, "TUR": 0.095, "ISR": 0.043
  };

  // ── Research Topic Volumes for Bar Chart Race ──────────────
  const TOPICS = [
    { name: "Artificial Intelligence",      cat: "Computer Science",  base: 14200,  trend: 0.135 },
    { name: "Genomics & CRISPR",            cat: "Biomedical",        base: 27800,  trend: 0.080 },
    { name: "Renewable Energy",             cat: "Engineering",       base: 18100,  trend: 0.112 },
    { name: "Infectious Diseases",          cat: "Biomedical",        base: 21600,  trend: 0.040 },
    { name: "Quantum Computing",            cat: "Physics",           base:  4800,  trend: 0.210 },
    { name: "Material Sciences",            cat: "Chemistry",         base: 34900,  trend: 0.022 },
    { name: "Climate Dynamics",             cat: "Earth Sciences",    base: 11800,  trend: 0.118 },
    { name: "Nanotechnology",              cat: "Multidisciplinary", base: 24700,  trend: 0.028 },
    { name: "Robotics & IoT",              cat: "Computer Science",  base: 10800,  trend: 0.152 },
    { name: "Cancer Immunotherapy",        cat: "Biomedical",        base: 19800,  trend: 0.068 },
    { name: "Blockchain & Cryptography",   cat: "Computer Science",  base:  2900,  trend: 0.195 },
    { name: "Neuroscience",               cat: "Biomedical",        base: 16800,  trend: 0.048 }
  ];

  // ── Collaboration (dumbbell) ─────────────────────
  const COLLAB_DATA = [
    { name: "United States",  domestic: 18.2, international: 25.8 },
    { name: "United Kingdom", domestic: 17.5, international: 24.9 },
    { name: "Germany",        domestic: 16.8, international: 23.4 },
    { name: "China",          domestic: 12.2, international: 19.5 },
    { name: "India",          domestic:  8.9, international: 15.6 },
    { name: "Japan",          domestic: 13.1, international: 18.2 },
    { name: "South Korea",    domestic: 14.0, international: 19.8 },
    { name: "Australia",      domestic: 17.2, international: 25.1 },
    { name: "Canada",         domestic: 16.9, international: 24.5 },
    { name: "Switzerland",    domestic: 21.0, international: 29.8 },
    { name: "Brazil",         domestic:  7.8, international: 14.2 },
    { name: "South Africa",   domestic:  9.5, international: 17.8 },
    { name: "Singapore",      domestic: 19.5, international: 27.6 },
    { name: "Saudi Arabia",   domestic: 10.2, international: 21.4 },
    { name: "Israel",         domestic: 18.0, international: 24.8 },
    { name: "France",         domestic: 15.6, international: 22.1 },
    { name: "Russia",         domestic:  6.4, international: 13.2 }
  ];

  // ── India institutional network ───────────────────────────
  const INDIA_NODES = [
    { id:"IISc",     name:"IISc Bengaluru",               lat:13.0184, lon:77.5684, tier:"Premier",          basePubs:4200, funding:250 },
    { id:"IITB",     name:"IIT Bombay",                   lat:19.1334, lon:72.9133, tier:"Premier",          basePubs:3800, funding:220 },
    { id:"IITD",     name:"IIT Delhi",                    lat:28.5450, lon:77.1926, tier:"Premier",          basePubs:3600, funding:210 },
    { id:"IITM",     name:"IIT Madras",                   lat:12.9915, lon:80.2336, tier:"Premier",          basePubs:3900, funding:230 },
    { id:"IITK",     name:"IIT Kanpur",                   lat:26.5123, lon:80.2329, tier:"Premier",          basePubs:2800, funding:180 },
    { id:"IITKgp",   name:"IIT Kharagpur",                lat:22.3149, lon:87.3105, tier:"Premier",          basePubs:3100, funding:190 },
    { id:"TIFR",     name:"TIFR Mumbai",                  lat:18.9067, lon:72.8080, tier:"Premier",          basePubs:1800, funding:140 },
    { id:"BITS",     name:"BITS Pilani",                  lat:28.3639, lon:75.5870, tier:"Premier",          basePubs:1600, funding: 70 },
    { id:"DU",       name:"Delhi University",             lat:28.6904, lon:77.2166, tier:"Central / State",  basePubs:2200, funding: 95 },
    { id:"JNU",      name:"Jawaharlal Nehru Univ.",       lat:28.5398, lon:77.1678, tier:"Central / State",  basePubs:1500, funding: 80 },
    { id:"BHU",      name:"Banaras Hindu Univ.",          lat:25.2677, lon:82.9913, tier:"Central / State",  basePubs:1900, funding: 75 },
    { id:"UoH",      name:"University of Hyderabad",      lat:17.4567, lon:78.3264, tier:"Central / State",  basePubs:1400, funding: 68 },
    { id:"Anna",     name:"Anna University Chennai",      lat:13.0117, lon:80.2354, tier:"Central / State",  basePubs:2400, funding: 55 },
    { id:"Jadavpur", name:"Jadavpur Univ. Kolkata",       lat:22.4996, lon:88.3712, tier:"Central / State",  basePubs:2100, funding: 50 },
    { id:"Pune",     name:"Savitribai Phule Pune Univ.", lat:18.5529, lon:73.8247, tier:"Central / State",  basePubs:1300, funding: 42 },
    { id:"VIT",      name:"Vellore Inst. of Technology",  lat:12.9692, lon:79.1559, tier:"Affiliated / Private", basePubs:2500, funding: 40 },
    { id:"SRM",      name:"SRM University Chennai",       lat:12.8234, lon:80.0424, tier:"Affiliated / Private", basePubs:2000, funding: 35 },
    { id:"Amrita",   name:"Amrita Vishwa Vidyapeetham",   lat:10.9004, lon:76.8996, tier:"Affiliated / Private", basePubs:1700, funding: 30 }
  ];

  const INDIA_LINKS = [
    { source:"IISc",   target:"IITB",     weight:32 },
    { source:"IISc",   target:"IITD",     weight:28 },
    { source:"IISc",   target:"IITM",     weight:35 },
    { source:"IITB",   target:"IITD",     weight:45 },
    { source:"IITD",   target:"IITK",     weight:30 },
    { source:"IITB",   target:"IITKgp",   weight:25 },
    { source:"IITM",   target:"IITKgp",   weight:29 },
    { source:"TIFR",   target:"IISc",     weight:22 },
    { source:"TIFR",   target:"IITB",     weight:26 },
    { source:"DU",     target:"JNU",      weight:40 },
    { source:"DU",     target:"BHU",      weight:18 },
    { source:"BHU",    target:"IITK",     weight:15 },
    { source:"UoH",    target:"IISc",     weight:19 },
    { source:"Anna",   target:"IITM",     weight:31 },
    { source:"Jadavpur",target:"IITKgp",  weight:24 },
    { source:"Pune",   target:"IITB",     weight:18 },
    { source:"BITS",   target:"IITD",     weight:14 },
    { source:"VIT",    target:"IITM",     weight:22 },
    { source:"SRM",    target:"IITM",     weight:16 },
    { source:"Amrita", target:"IISc",     weight:12 }
  ];

  // ── Public API ─────────────────────────

  // 1. Peer Clustering (t-SNE mock for Viz 1)
  function getCountriesForYear(year) {
    const dy = year - 2010;
    return COUNTRIES.map(c => {
      const gdp    = c.gdp2010    * Math.pow(1 + GROWTH[c.iso],    dy);
      const pubs   = c.basePubs   * Math.pow(1 + PUB_GROWTH[c.iso], dy);
      
      // China & India migrate toward high performers
      let sx = 0, sy = 0;
      if (c.iso === "CHN") { sx = -dy * 0.16; sy =  dy * 0.09; }
      else if (c.iso === "IND") { sx = -dy * 0.09; sy = dy * 0.07; }
      else if (c.iso === "KOR") { sx = -dy * 0.06; sy = dy * 0.04; }
      else { sx = dy * 0.02; sy = dy * 0.01; }

      // Add a slight jitter for organic feel
      const jitterX = Math.sin(year * 10 + c.gdp2010) * 0.2;
      const jitterY = Math.cos(year * 10 + c.gdp2010) * 0.2;

      return {
        iso: c.iso, name: c.name, region: c.region,
        publications: Math.round(pubs),
        x: c.tsneX + sx + jitterX,
        y: c.tsneY + sy + jitterY
      };
    });
  }

  // 2. Ridgeline Data for Viz 2 (Q1 vs Q4 global density)
  function getRidgelineData() {
    // Generate density curves for years 2010 to 2025
    const years = d3.range(2010, 2026);
    const data = [];
    years.forEach(year => {
      const dy = year - 2010;
      // Over time, Q1 (elite) shifts right and widens, Q4 (low tier) shifts right and gets 'flooded' (very tall)
      const q1Mean = 40 + dy * 1.5;
      const q1Spread = 15 + dy * 0.5;
      
      const q4Mean = 20 + dy * 2.0;
      const q4Spread = 10;
      
      // Generate bell curve points across X (quality proxy index 0-100)
      const points = [];
      for(let x = 0; x <= 100; x += 2) {
        // Q1 curve
        const q1Val = 0.8 * Math.exp(-Math.pow(x - q1Mean, 2) / (2 * Math.pow(q1Spread, 2)));
        // Q4 curve (the "Q4 flood" grows in magnitude over time)
        const q4Mag = 0.5 + dy * 0.08;
        const q4Val = q4Mag * Math.exp(-Math.pow(x - q4Mean, 2) / (2 * Math.pow(q4Spread, 2)));
        points.push({ x, q1Val, q4Val });
      }
      data.push({ year, points });
    });
    return data;
  }

  // 3. Research topics for Viz 3
  function getTopicsForYear(year) {
    const dy = year - 2010;
    return TOPICS.map(t => {
      let mult = Math.pow(1 + t.trend, dy);
      if (t.name === "Infectious Diseases" && year >= 2020 && year <= 2022) mult *= 1.9;
      if (t.name === "Artificial Intelligence" && year >= 2022) mult *= 1.5 + (year - 2022) * 0.3;
      return { name: t.name, cat: t.cat, volume: Math.round(t.base * mult) };
    }).sort((a, b) => b.volume - a.volume).slice(0, 10);
  }

  // 4. Collaboration for Viz 4
  function getCollabData() {
    // Static for 2024 as it represents current premium
    return COLLAB_DATA.map(c => {
      return { name: c.name, domestic: c.domestic, international: c.international, gain: parseFloat((c.international - c.domestic).toFixed(1)) };
    });
  }

  // 5. India network for Viz 5
  function getIndiaNetwork(year) {
    const dy = year - 2010;
    const grow = 1 + dy * 0.10;
    return {
      nodes: INDIA_NODES.map(n => ({
        ...n,
        publications: Math.round(n.basePubs * grow),
        funding: parseFloat((n.funding * (1 + dy * 0.07)).toFixed(1))
      })),
      links: INDIA_LINKS.map(l => ({ ...l, weight: Math.round(l.weight * grow) }))
    };
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
