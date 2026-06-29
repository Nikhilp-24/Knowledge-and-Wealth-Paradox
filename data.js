// CS661 Group 10 - The Global Knowledge & Wealth Paradox Dataset
const GlobalDashboardData = (() => {
  // Years list
  const years = Array.from({ length: 16 }, (_, i) => 2010 + i);

  // Regions
  const regions = {
    "North America": "#38bdf8",
    "Europe": "#818cf8",
    "East Asia & Pacific": "#34d399",
    "South Asia": "#fb7185",
    "Latin America": "#fbbf24",
    "Middle East & Africa": "#a78bfa"
  };

  // 1. Country profiles (t-SNE/UMAP projection + macroeconomic statistics)
  // Generating coordinates that show distinct clusters corresponding to wealth vs. impact
  const countriesList = [
    { name: "United States", region: "North America", baseGdp: 15000, baseRd: 2.8, basePubs: 500000, baseCits: 22.5, tsneX: -2.5, tsneY: 3.0 },
    { name: "China", region: "East Asia & Pacific", baseGdp: 6000, baseRd: 1.7, basePubs: 450000, baseCits: 14.2, tsneX: 2.0, tsneY: 2.5 },
    { name: "Germany", region: "Europe", baseGdp: 3400, baseRd: 3.0, basePubs: 105000, baseCits: 20.8, tsneX: -2.0, tsneY: 1.8 },
    { name: "United Kingdom", region: "Europe", baseGdp: 2400, baseRd: 1.8, basePubs: 98000, baseCits: 21.9, tsneX: -2.2, tsneY: 2.2 },
    { name: "Japan", region: "East Asia & Pacific", baseGdp: 5700, baseRd: 3.2, basePubs: 80000, baseCits: 15.5, tsneX: -1.0, tsneY: 1.2 },
    { name: "India", region: "South Asia", baseGdp: 1700, baseRd: 0.7, basePubs: 130000, baseCits: 11.2, tsneX: 1.5, tsneY: -1.8 },
    { name: "South Korea", region: "East Asia & Pacific", baseGdp: 1100, baseRd: 4.1, basePubs: 75000, baseCits: 16.8, tsneX: -0.5, tsneY: 2.8 },
    { name: "Brazil", region: "Latin America", baseGdp: 2200, baseRd: 1.2, basePubs: 60000, baseCits: 9.8, tsneX: 0.8, tsneY: -1.2 },
    { name: "France", region: "Europe", baseGdp: 2600, baseRd: 2.2, basePubs: 78000, baseCits: 19.5, tsneX: -1.8, tsneY: 1.5 },
    { name: "Canada", region: "North America", baseGdp: 1600, baseRd: 1.7, basePubs: 65000, baseCits: 20.2, tsneX: -2.1, tsneY: 1.9 },
    { name: "Australia", region: "East Asia & Pacific", baseGdp: 1150, baseRd: 2.0, basePubs: 55000, baseCits: 21.1, tsneX: -2.3, tsneY: 1.6 },
    { name: "Russia", region: "Europe", baseGdp: 1600, baseRd: 1.1, basePubs: 48000, baseCits: 7.5, tsneX: 1.0, tsneY: -2.5 },
    { name: "South Africa", region: "Middle East & Africa", baseGdp: 400, baseRd: 0.8, basePubs: 22000, baseCits: 12.8, tsneX: 0.5, tsneY: -0.8 },
    { name: "Saudi Arabia", region: "Middle East & Africa", baseGdp: 600, baseRd: 0.9, basePubs: 28000, baseCits: 13.5, tsneX: 0.2, tsneY: 0.2 },
    { name: "Switzerland", region: "Europe", baseGdp: 600, baseRd: 3.1, basePubs: 35000, baseCits: 25.4, tsneX: -2.8, tsneY: 2.7 },
    { name: "Singapore", region: "East Asia & Pacific", baseGdp: 250, baseRd: 2.1, basePubs: 20000, baseCits: 23.9, tsneX: -2.6, tsneY: 2.4 },
    { name: "Turkey", region: "Middle East & Africa", baseGdp: 800, baseRd: 1.0, basePubs: 35000, baseCits: 10.1, tsneX: 0.9, tsneY: -1.5 },
    { name: "Israel", region: "Middle East & Africa", baseGdp: 250, baseRd: 4.8, basePubs: 18000, baseCits: 21.2, tsneX: -2.0, tsneY: 2.9 }
  ];

  const getCountryDataForYear = (year) => {
    const factor = 1 + (year - 2010) * 0.06; // Growth factor
    return countriesList.map(c => {
      let gdpGrowth = factor;
      let pubGrowth = factor * 1.1;
      
      // China & India grow much faster
      if (c.name === "China") {
        gdpGrowth = 1 + (year - 2010) * 0.12;
        pubGrowth = 1 + (year - 2010) * 0.16;
      } else if (c.name === "India") {
        gdpGrowth = 1 + (year - 2010) * 0.09;
        pubGrowth = 1 + (year - 2010) * 0.13;
      }

      const gdp = c.baseGdp * gdpGrowth;
      const rd = c.baseRd + (c.name === "China" ? (year - 2010) * 0.05 : (c.name === "India" ? -(year - 2010) * 0.01 : 0));
      const rdSpend = (gdp * (rd / 100));
      const publications = Math.round(c.basePubs * pubGrowth);
      const citations = parseFloat((c.baseCits + (year - 2010) * 0.25).toFixed(1));
      
      // Custom evolution for t-SNE coordinate shifts representing progress
      let shiftX = (year - 2010) * 0.08;
      let shiftY = (year - 2010) * 0.05;
      if (c.name === "China") { shiftX = -(year - 2010) * 0.15; shiftY = (year - 2010) * 0.08; }
      if (c.name === "India") { shiftX = -(year - 2010) * 0.08; shiftY = (year - 2010) * 0.06; }

      return {
        name: c.name,
        region: c.region,
        gdp: Math.round(gdp),
        rdPercent: parseFloat(rd.toFixed(2)),
        rdSpend: Math.round(rdSpend),
        publications,
        citations,
        x: c.tsneX + shiftX,
        y: c.tsneY + shiftY
      };
    });
  };

  // 2. Ridgeline density points generator
  // We want to generate density functions for Q1 (quality) and Q4 (low tier) papers over time.
  const getQualityShiftData = (year) => {
    const points = 50;
    const xMin = 0, xMax = 100;
    const step = (xMax - xMin) / points;

    // Shift centers over time. As years go by:
    // Q1 shifts right (elite breakaway)
    // Q4 might shift left or stay flat with a higher peak (Q4 flood)
    const yearDiff = year - 2010;
    const q1Mean = 60 + yearDiff * 1.2;
    const q1Sigma = 12 - yearDiff * 0.15;
    const q4Mean = 35 - yearDiff * 0.4;
    const q4Sigma = 15 + yearDiff * 0.1;

    const normalPdf = (x, mean, sigma) => {
      return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
    };

    const q1Density = [];
    const q4Density = [];

    for (let i = 0; i <= points; i++) {
      const x = xMin + i * step;
      q1Density.push({ x, y: normalPdf(x, q1Mean, q1Sigma) * 100 });
      q4Density.push({ x, y: normalPdf(x, q4Mean, q4Sigma) * 100 });
    }

    return { year, q1: q1Density, q4: q4Density };
  };

  // 3. Top-10 Research Topics (Bar Chart Race)
  const topics = [
    { name: "Artificial Intelligence", category: "Computer Science", baseVol: 15000, trend: 1.28 },
    { name: "Genomics & Crispr", category: "Biomedical", baseVol: 28000, trend: 1.08 },
    { name: "Renewable Energy", category: "Engineering", baseVol: 18000, trend: 1.15 },
    { name: "Infectious Diseases", category: "Biomedical", baseVol: 22000, trend: 1.04 }, // Spikes in 2020
    { name: "Quantum Computing", category: "Physics", baseVol: 5000, trend: 1.22 },
    { name: "Material Sciences", category: "Chemistry", baseVol: 35000, trend: 1.02 },
    { name: "Climate Dynamics", category: "Geosciences", baseVol: 12000, trend: 1.14 },
    { name: "Nanotechnology", category: "Multidisciplinary", baseVol: 25000, trend: 1.03 },
    { name: "Robotics & IoT", category: "Computer Science", baseVol: 11000, trend: 1.16 },
    { name: "Cancer Immunotherapy", category: "Biomedical", baseVol: 20000, trend: 1.07 },
    { name: "Blockchain & Cryptography", category: "Computer Science", baseVol: 3000, trend: 1.20 },
    { name: "Neuroscience", category: "Biomedical", baseVol: 17000, trend: 1.05 }
  ];

  const getTopicsDataForYear = (year) => {
    return topics.map(t => {
      const yearDiff = year - 2010;
      let spike = 1.0;
      // Infectious disease spike around COVID (2020-2022)
      if (t.name === "Infectious Diseases" && year >= 2020 && year <= 2022) {
        spike = 1.85;
      }
      // AI spike starting in 2022
      if (t.name === "Artificial Intelligence" && year >= 2022) {
        spike = 1.45 + (year - 2022) * 0.15;
      }
      
      const volume = Math.round(t.baseVol * Math.pow(t.trend, yearDiff) * spike);
      return {
        name: t.name,
        category: t.category,
        volume
      };
    }).sort((a, b) => b.volume - a.volume).slice(0, 10);
  };

  // 4. Dumbbell Plot (Collaboration Premium)
  const dumbbellCountries = [
    { name: "United States", domestic: 18.2, international: 25.8 },
    { name: "United Kingdom", domestic: 17.5, international: 24.9 },
    { name: "Germany", domestic: 16.8, international: 23.4 },
    { name: "China", domestic: 12.2, international: 19.5 },
    { name: "India", domestic: 8.9, international: 15.6 },
    { name: "Japan", domestic: 13.1, international: 18.2 },
    { name: "South Korea", domestic: 14.0, international: 19.8 },
    { name: "Australia", domestic: 17.2, international: 25.1 },
    { name: "Canada", domestic: 16.9, international: 24.5 },
    { name: "Switzerland", domestic: 21.0, international: 29.8 },
    { name: "Brazil", domestic: 7.8, international: 14.2 },
    { name: "South Africa", domestic: 9.5, international: 17.8 },
    { name: "Singapore", domestic: 19.5, international: 27.6 },
    { name: "Saudi Arabia", domestic: 10.2, international: 21.4 },
    { name: "Israel", domestic: 18.0, international: 24.8 }
  ];

  const getDumbbellData = (year) => {
    const factor = 1 + (year - 2010) * 0.02; // General citations index rise
    return dumbbellCountries.map(c => {
      // Premium (gap) increases slightly as global collaborations yield higher citation weight
      const premiumMod = 1 + (year - 2010) * 0.015;
      const dom = parseFloat((c.domestic * factor).toFixed(1));
      const inter = parseFloat((c.domestic * factor + (c.international - c.domestic) * premiumMod).toFixed(1));
      return {
        name: c.name,
        domestic: dom,
        international: inter,
        gain: parseFloat((inter - dom).toFixed(1))
      };
    });
  };

  // 5. India Domestic Higher Education Network Map
  const indiaInstitutions = [
    { id: "IISc", name: "IISc Bengaluru", lat: 13.0184, lon: 77.5684, tier: "Premier", basePubs: 4200, funding: 250 },
    { id: "IITB", name: "IIT Bombay", lat: 19.1334, lon: 72.9133, tier: "Premier", basePubs: 3800, funding: 220 },
    { id: "IITD", name: "IIT Delhi", lat: 28.5450, lon: 77.1926, tier: "Premier", basePubs: 3600, funding: 210 },
    { id: "IITM", name: "IIT Madras", lat: 12.9915, lon: 80.2336, tier: "Premier", basePubs: 3900, funding: 230 },
    { id: "IITK", name: "IIT Kanpur", lat: 26.5123, lon: 80.2329, tier: "Premier", basePubs: 2800, funding: 180 },
    { id: "IITKgp", name: "IIT Kharagpur", lat: 22.3149, lon: 87.3105, tier: "Premier", basePubs: 3100, funding: 190 },
    { id: "TIFR", name: "TIFR Mumbai", lat: 18.9067, lon: 72.8080, tier: "Premier", basePubs: 1800, funding: 140 },
    { id: "DU", name: "Delhi University", lat: 28.6904, lon: 77.2166, tier: "Central / State", basePubs: 2200, funding: 95 },
    { id: "JNU", name: "Jawaharlal Nehru Univ", lat: 28.5398, lon: 77.1678, tier: "Central / State", basePubs: 1500, funding: 80 },
    { id: "BHU", name: "Banaras Hindu Univ", lat: 25.2677, lon: 82.9913, tier: "Central / State", basePubs: 1900, funding: 75 },
    { id: "UoH", name: "University of Hyderabad", lat: 17.4567, lon: 78.3264, tier: "Central / State", basePubs: 1400, funding: 68 },
    { id: "Anna", name: "Anna University Chennai", lat: 13.0117, lon: 80.2354, tier: "Central / State", basePubs: 2400, funding: 55 },
    { id: "Jadavpur", name: "Jadavpur Univ Kolkata", lat: 22.4996, lon: 88.3712, tier: "Central / State", basePubs: 2100, funding: 50 },
    { id: "Pune", name: "Savitribai Phule Pune Univ", lat: 18.5529, lon: 73.8247, tier: "Central / State", basePubs: 1300, funding: 42 },
    { id: "BITS", name: "BITS Pilani", lat: 28.3639, lon: 75.5870, tier: "Premier", basePubs: 1600, funding: 70 },
    { id: "VIT", name: "Vellore Inst of Technology", lat: 12.9692, lon: 79.1559, tier: "Affiliated / Private", basePubs: 2500, funding: 40 },
    { id: "SRM", name: "SRM University Chennai", lat: 12.8234, lon: 80.0424, tier: "Affiliated / Private", basePubs: 2000, funding: 35 },
    { id: "Amrita", name: "Amrita Vishwa Vidyapeetham", lat: 10.9004, lon: 76.8996, tier: "Affiliated / Private", basePubs: 1700, funding: 30 }
  ];

  const indiaCollaborations = [
    { source: "IISc", target: "IITB", weight: 32 },
    { source: "IISc", target: "IITD", weight: 28 },
    { source: "IISc", target: "IITM", weight: 35 },
    { source: "IITB", target: "IITD", weight: 45 },
    { source: "IITD", target: "IITK", weight: 30 },
    { source: "IITB", target: "IITKgp", weight: 25 },
    { source: "IITM", target: "IITKgp", weight: 29 },
    { source: "TIFR", target: "IISc", weight: 22 },
    { source: "TIFR", target: "IITB", weight: 26 },
    { source: "DU", target: "JNU", weight: 40 },
    { source: "DU", target: "BHU", weight: 18 },
    { source: "BHU", target: "IITK", weight: 15 },
    { source: "UoH", target: "IISc", weight: 19 },
    { source: "Anna", target: "IITM", weight: 31 },
    { source: "Jadavpur", target: "IITKgp", weight: 24 },
    { source: "Pune", target: "IITB", weight: 18 },
    { source: "BITS", target: "IITD", weight: 14 },
    { source: "VIT", target: "IITM", weight: 22 },
    { source: "SRM", target: "IITM", weight: 16 },
    { source: "Amrita", target: "IISc", weight: 12 }
  ];

  const getIndiaNetworkData = (year) => {
    const factor = 1 + (year - 2010) * 0.12; // High academic growth rate in India
    const nodes = indiaInstitutions.map(inst => {
      return {
        ...inst,
        publications: Math.round(inst.basePubs * factor),
        funding: parseFloat((inst.funding * (1 + (year - 2010) * 0.08)).toFixed(1))
      };
    });

    const links = indiaCollaborations.map(collab => {
      return {
        ...collab,
        weight: Math.round(collab.weight * factor)
      };
    });

    return { nodes, links };
  };

  return {
    years,
    regions,
    getCountryDataForYear,
    getQualityShiftData,
    getTopicsDataForYear,
    getDumbbellData,
    getIndiaNetworkData
  };
})();
