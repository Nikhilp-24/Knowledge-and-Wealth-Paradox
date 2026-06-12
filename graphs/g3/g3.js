// graphs/g3/g3.js — Graph 3 (Research topics)
function renderViz3(body) {
  // Clear container
  body.innerHTML = '';
  
  // Set up container
  const container = document.createElement('div');
  container.className = 'viz3-container';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflowY = 'auto';
  container.style.position = 'relative';
  
  // Inject HTML structure
  container.innerHTML = `
    <!-- styles: graphs/g3/g3.css -->
    <div style="padding: 2rem;">
<!-- Controls Card (Redesigned Compact Version) -->
    <div class="glass-card viz3-controls-card" style="margin-bottom: 1.25rem;">
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            
            <!-- Country Selector -->
            <div class="filter-group">
                <label for="countrySelect">Region / Country Filter</label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="countrySelect" class="styled-select" style="flex: 1;">
                        <option value="GLOBAL">Global (All Countries)</option>
                    </select>
                    <button type="button" id="btnClearFilter" class="btn-control" title="Clear filter (Esc)" style="flex-shrink: 0; width: auto; height: auto; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-family: Outfit, sans-serif; color: #0f172a; border-radius: 8px;">
                        Clear
                    </button>
                </div>
            </div>

            <!-- Playback Controls & Slider Row -->
            <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                
                <div class="playback-controls">
                    <!-- Play/Pause Button -->
                    <button id="btnPlay" class="btn-control btn-play" title="Play Animation">
                        <svg id="playIcon" class="icon" style="width: 20px; height: 20px;" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg id="pauseIcon" class="icon" style="display: none; width: 20px; height: 20px;" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        </svg>
                    </button>

                    <!-- Reset Button -->
                    <button id="btnReset" class="btn-control" title="Restart to start year">
                        <svg class="icon" style="width: 20px; height: 20px;" viewBox="0 0 24 24">
                            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                        </svg>
                    </button>
                </div>

                <!-- Timeline Scrubber -->
                <div class="timeline-container">
                    <div class="timeline-labels">
                        <span id="labelStartYear">1974</span>
                        <span id="labelCurrentYear" style="font-weight: 700; color: var(--primary);">Year: 1974</span>
                        <span id="labelEndYear">2024</span>
                    </div>
                    <input type="range" id="timelineSlider" class="timeline-slider" min="1974" max="2024" value="1974">
                </div>

                <!-- Speed Controls -->
                <div class="filter-group">
                    <label>Speed</label>
                    <div class="speed-selector">
                        <button class="speed-btn" data-speed="0.5">0.5x</button>
                        <button class="speed-btn active" data-speed="1.0">1.0x</button>
                        <button class="speed-btn" data-speed="2.0">2.0x</button>
                    </div>
                </div>

            </div>

        </div>
    </div>

    <!-- Main Grid Content -->
    <div class="dashboard-grid">
        
        <!-- Left Panel: Bar Chart Race -->
        <div class="control-panel">
            <!-- Bar Chart Race Card -->
            <div class="glass-card race-card">
                <div class="race-header">
                    <div>
                        <h3 id="raceTitle">Top Research topics</h3>
                        <p id="raceSubtitle" style="margin: 0.2rem 0 0; font-size: 0.72rem; color: #475569; font-weight: 400;">OpenAlex L3 concepts · retrospective tags · same-level race from 1974</p>
                    </div>
                    <div id="yearIndicator" class="year-display">1974</div>
                </div>
                
                <div class="race-body" id="raceBody">
                    <!-- Watermark -->
                    <div id="watermarkYear" class="watermark-year">1974</div>
                    
                    <!-- Background Grid Lines -->
                    <div class="grid-lines-container" id="gridLines">
                        <!-- Will be populated dynamically -->
                    </div>

                    <!-- Rows Container -->
                    <div id="rowsContainer" style="position: relative; width: 100%; height: 100%;">
                        <!-- Will be populated dynamically with topic rows -->
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Panel: Trend Line Chart -->
        <div class="glass-card trend-card">
            <div class="trend-header">
                <h3>Yearly Publication Trend (1974 – 2024)</h3>
            </div>
            <div class="chart-container">
                <canvas id="trendChart"></canvas>
            </div>
</div>

    </div>

    <!-- Bottom Section: Insights Grid -->
    <div class="insights-section">
        <h2 class="insights-title">
            <svg class="icon" style="color: var(--primary); width: 20px; height: 20px;" viewBox="0 0 24 24">
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
            </svg>
            <span id="insightsTitleText">Research Topic Performance Summary</span>
        </h2>
        <div class="insights-grid" id="insightsGrid">
            <!-- Will be populated dynamically -->
        </div>
    </div>
    </div>
  `;
  body.appendChild(container);

  // Inject JS Logic
  if (typeof window.CSV_DATA === 'undefined') {
            document.body.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; text-align: center;">
                    <h2 style="color: #D55E00; margin-bottom: 1rem;">Data File Missing</h2>
                    <p style="color: #94a3b8; max-width: 500px;">
                        Could not find the <code>data.js</code> file. Please make sure you have run the data conversion script or have the file <code>data.js</code> present in the same directory.
                    </p>
                </div>
            `;
            throw new Error("data.js is not loaded.");
        }

        // Configuration and data stores
        // Narrative order = Lane C L3 college cross-domain (plan table).
        // Keep in sync with REQUIRED_G3_TOPICS in _river_to_pool_rebuild.py
        const topics = (typeof window.VIZ3_META === 'object' && Array.isArray(window.VIZ3_META.display_order))
            ? window.VIZ3_META.display_order.slice()
            : [
                "Infectious disease",
                "Robotics",
                "Quantum computer",
                "CRISPR",
                "Energy storage",
                "Photovoltaics",
                "Supervised learning"
            ];

        const topicSubfields = {
            "Infectious disease": "C524204448",
            "Robotics": "C34413123",
            "Quantum computer": "C58053490",
            "CRISPR": "C98108389",
            "Energy storage": "C73916439",
            "Photovoltaics": "C542589376",
            "Supervised learning": "C136389625"
        };

        const topicGradients = {
            "Infectious disease": 'var(--g-diseases)',
            "Robotics": 'var(--g-robotics)',
            "Quantum computer": 'var(--g-quantum)',
            "CRISPR": 'var(--g-crispr)',
            "Energy storage": 'var(--g-energy)',
            "Photovoltaics": 'var(--g-pv)',
            "Supervised learning": 'var(--g-sl)'
        };

        /* Okabe–Ito poles; yellow/sky slightly deepened so they don't vibrate on white */
        const topicColors = {
            "Infectious disease": '#CC79A7',
            "Robotics": '#E69F00',
            "Quantum computer": '#C4A000',
            "CRISPR": '#3D9BC7',
            "Energy storage": '#009E73',
            "Photovoltaics": '#D55E00',
            "Supervised learning": '#0072B2'
        };

        // Per-topic honesty floors (all Lane C share scrubber start 1974).
        const defaultTopicStarts = {
            "Infectious disease": 1974,
            "Robotics": 1974,
            "Quantum computer": 1974,
            "CRISPR": 1974,
            "Energy storage": 1974,
            "Photovoltaics": 1974,
            "Supervised learning": 1974
        };
        const topicStartYears = Object.assign(
            {},
            defaultTopicStarts,
            (typeof window.VIZ3_TOPIC_START_YEARS === 'object' && window.VIZ3_TOPIC_START_YEARS) || {}
        );

        // Derive timeline from tap payload (honesty floors applied by _river_to_pool_rebuild.py)
        const years = (() => {
          const set = new Set();
          String(window.CSV_DATA).split("\n").forEach((line) => {
            const m = line.match(/^(\d{4}),/);
            if (m) set.add(Number(m[1]));
          });
          return [...set].sort((a, b) => a - b);
        })();
        if (!years.length) throw new Error("viz3_data.js has no year rows");
        const yearMin = years[0];
        const yearMax = years[years.length - 1];

        function topicStartYear(topic) {
            return topicStartYears[topic] ?? yearMin;
        }
        function isTopicActive(topic, year) {
            return year >= topicStartYear(topic);
        }

        let globalData = {};  // globalData[year][topic] = sum
        let countryData = {}; // countryData[countryCode][year][topic] = count
        let countryMap = {};  // countryMap[countryCode] = countryName
        // ISO2 → World Bank-style region (for Graph 3 region filter aggregation)
        const VIZ3_ISO2_REGION = {"AM":"Asia","AT":"Europe","AU":"Oceania","BD":"Asia","BE":"Europe","BG":"Europe","BR":"Americas","BY":"Europe","CA":"Americas","CH":"Europe","CN":"Asia","CO":"Americas","CZ":"Europe","DE":"Europe","DK":"Europe","EG":"Africa","ES":"Europe","FI":"Europe","FR":"Europe","GB":"Europe","GH":"Africa","GR":"Europe","HK":"Asia","HR":"Europe","HU":"Europe","ID":"Asia","IE":"Europe","IL":"Asia","IN":"Asia","IQ":"Asia","IT":"Europe","JP":"Asia","KE":"Africa","LB":"Asia","LK":"Asia","LV":"Europe","MX":"Americas","MY":"Asia","NG":"Africa","NL":"Europe","NO":"Europe","NZ":"Oceania","PK":"Asia","PL":"Europe","PR":"Americas","PT":"Europe","QA":"Asia","RO":"Europe","RS":"Europe","RU":"Europe","SA":"Asia","SE":"Europe","SG":"Asia","SI":"Europe","SK":"Europe","SM":"Europe","SO":"Africa","SS":"Africa","TH":"Asia","UA":"Europe","UG":"Africa","US":"Americas","ZA":"Africa","AR":"Americas","CM":"Africa","MM":"Asia","NP":"Asia","PH":"Asia","VN":"Asia","ZM":"Africa","AE":"Asia","MA":"Africa","AZ":"Asia","CL":"Americas","EC":"Americas","GE":"Asia","JM":"Americas","KZ":"Asia","NE":"Africa","TN":"Africa","ML":"Africa","PE":"Americas","BN":"Asia","CY":"Asia","EE":"Europe","JO":"Asia","MN":"Asia","MW":"Africa","PA":"Americas","SD":"Africa","UZ":"Asia","SV":"Americas","BH":"Asia","SN":"Africa","DZ":"Africa","FJ":"Oceania","LT":"Europe","LY":"Africa","MV":"Asia","NI":"Americas","PG":"Oceania","ZW":"Africa","ET":"Africa","LU":"Europe","OM":"Asia","CR":"Americas","GT":"Americas","BJ":"Africa","BS":"Americas","CI":"Africa","IS":"Europe","MK":"Europe","TT":"Americas","GY":"Americas","KW":"Asia","BA":"Europe","MT":"Europe","WS":"Oceania","SY":"Asia","BI":"Africa","TJ":"Asia","BZ":"Americas","KH":"Asia","MU":"Africa","PY":"Americas","UY":"Americas","LS":"Africa","YE":"Asia","MZ":"Africa","BW":"Africa","TD":"Africa","DJ":"Africa","DO":"Americas","GM":"Africa","SX":"Americas","TO":"Oceania","AF":"Asia","GW":"Africa","SR":"Americas","AS":"Oceania","BF":"Africa","HT":"Americas","MG":"Africa","TG":"Africa","AG":"Americas","AO":"Africa","VU":"Oceania","MO":"Asia","HN":"Americas","AL":"Europe","SL":"Africa","GL":"Americas","GA":"Africa","GN":"Africa","CG":"Africa","GD":"Americas","TM":"Asia","BM":"Americas","MR":"Africa","NA":"Africa","RW":"Africa","BB":"Americas","LR":"Africa","ME":"Europe","SZ":"Africa","ER":"Africa","ST":"Africa","CV":"Africa","GQ":"Africa","CF":"Africa","BT":"Asia","SC":"Africa","KY":"Americas","FO":"Europe","PW":"Oceania","DM":"Americas","TC":"Americas","AW":"Americas","TL":"Asia","KI":"Oceania","AD":"Europe","SB":"Oceania","TR":"Asia","GU":"Oceania","CU":"Americas","MF":"Americas","NC":"Oceania","LA":"Asia","GP":"Americas","GI":"Europe","VA":"Europe","RE":"Africa","LI":"Europe","PF":"Oceania","JE":"Europe","SJ":"Europe","IM":"Europe","GF":"Americas","CW":"Americas","KG":"Asia","MC":"Europe","MQ":"Americas","NU":"Oceania","LC":"Americas","XK":"Europe","MS":"Americas","KN":"Americas","FK":"Americas","MP":"Oceania","VC":"Americas","YT":"Africa","CK":"Oceania","AX":"Europe"};

        // Application State
        // selectedFilter: 'GLOBAL' | 'REGION:<name>' | ISO2 country code
        let currentYear = yearMin;
        let isPlaying = false;
        let speedMultiplier = 1.0;
        let selectedFilter = 'GLOBAL';
        let playTimeout = null;
        let lineChart = null;

        // HTML elements cached
        const countrySelect = container.querySelector('#countrySelect');
        const btnPlay = container.querySelector('#btnPlay');
        const playIcon = container.querySelector('#playIcon');
        const pauseIcon = container.querySelector('#pauseIcon');
        const btnReset = container.querySelector('#btnReset');
        const timelineSlider = container.querySelector('#timelineSlider');
        const labelCurrentYear = container.querySelector('#labelCurrentYear');
        const yearIndicator = container.querySelector('#yearIndicator');
        const watermarkYear = container.querySelector('#watermarkYear');
        const rowsContainer = container.querySelector('#rowsContainer');
        const gridLines = container.querySelector('#gridLines');
        const insightsGrid = container.querySelector('#insightsGrid');
        const labelStartYear = container.querySelector('#labelStartYear');
        const labelEndYear = container.querySelector('#labelEndYear');
        const trendHeader = container.querySelector('.trend-header h3');
        const raceTitle = container.querySelector('#raceTitle');
        const insightsTitleText = container.querySelector('#insightsTitleText');

        // Keep controls in sync with tap-derived window
        if (timelineSlider) {
          timelineSlider.min = String(yearMin);
          timelineSlider.max = String(yearMax);
          timelineSlider.value = String(yearMin);
        }
        if (labelStartYear) labelStartYear.textContent = String(yearMin);
        if (labelEndYear) labelEndYear.textContent = String(yearMax);
        if (labelCurrentYear) labelCurrentYear.textContent = `Year: ${yearMin}`;
        if (yearIndicator) yearIndicator.textContent = String(yearMin);
        if (watermarkYear) watermarkYear.textContent = String(yearMin);
        if (btnReset) btnReset.title = `Restart to ${yearMin}`;
        if (trendHeader) trendHeader.textContent = `Yearly Publication Trend (${yearMin} – ${yearMax})`;

        function emptyTopicBag() {
            const o = {};
            topics.forEach(t => { o[t] = 0; });
            return o;
        }

        function parseFilter(value) {
            if (!value || value === 'GLOBAL') return { type: 'global', label: 'Global' };
            if (value.startsWith('REGION:')) {
                const region = value.slice(7);
                return { type: 'region', region, label: region };
            }
            return {
                type: 'country',
                code: value,
                label: countryMap[value] || value
            };
        }

        function codesForFilter(filter) {
            if (filter.type === 'global') return Object.keys(countryData);
            if (filter.type === 'country') return filter.code && countryData[filter.code] ? [filter.code] : [];
            return Object.keys(countryData).filter(c => VIZ3_ISO2_REGION[c] === filter.region);
        }

        function getActiveDataForYear(year) {
            const filter = parseFilter(selectedFilter);
            let raw;
            if (filter.type === 'global') {
                raw = globalData[year] || emptyTopicBag();
            } else if (filter.type === 'country') {
                raw = (countryData[filter.code] && countryData[filter.code][year]) || emptyTopicBag();
            } else {
                raw = emptyTopicBag();
                codesForFilter(filter).forEach(code => {
                    const yd = countryData[code] && countryData[code][year];
                    if (!yd) return;
                    topics.forEach(t => { raw[t] += yd[t] || 0; });
                });
            }
            // Clamp: topics before honesty start year read as 0 (race shows n/a)
            const out = emptyTopicBag();
            topics.forEach(t => {
                out[t] = isTopicActive(t, year) ? (raw[t] || 0) : 0;
            });
            return out;
        }

        function updateScopeLabels() {
            const filter = parseFilter(selectedFilter);
            const scopeTag = filter.type === 'global' ? 'Global' : filter.label;
            if (raceTitle) {
                raceTitle.textContent = filter.type === 'global'
                    ? 'Top Research topics'
                    : `Top Research topics — ${scopeTag}`;
            }
            if (trendHeader) {
                trendHeader.textContent = filter.type === 'global'
                    ? `Yearly Publication Trend (${yearMin} – ${yearMax})`
                    : `Yearly Publication Trend — ${scopeTag} (${yearMin} – ${yearMax})`;
            }
            if (insightsTitleText) {
                insightsTitleText.textContent = filter.type === 'global'
                    ? 'Research Topic Performance Summary'
                    : `${scopeTag} — Research Topic Performance Summary`;
            }
        }

        // Parse and process CSV
        function initializeApp() {
            Papa.parse(window.CSV_DATA, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processParsedData(results.data);
                    setupCountryDropdown();
                    setupBarChartRows();
                    setupGridLines();
                    initializeLineChart();
                    updateDashboard(true); // first draw, recalc stats
                    setupEventListeners();
                }
            });
        }

        function processParsedData(rawData) {
            // Pre-fill years
            years.forEach(y => {
                globalData[y] = {};
                topics.forEach(t => {
                    globalData[y][t] = 0;
                });
            });

            rawData.forEach(row => {
                const year = row.year;
                const topic = row.topic_name;
                const publications = row.publications_count || 0;
                const cCode = row.country_code;
                const cName = row.country_name;

                if (!year || !topic || !topics.includes(topic)) return;

                // Add to global
                globalData[year][topic] = (globalData[year][topic] || 0) + publications;

                // Add to country
                if (cCode) {
                    if (!countryData[cCode]) {
                        countryData[cCode] = {};
                        years.forEach(y => {
                            countryData[cCode][y] = {};
                            topics.forEach(t => {
                                countryData[cCode][y][t] = 0;
                            });
                        });
                        countryMap[cCode] = cName;
                    }
                    countryData[cCode][year][topic] = publications;
                }
            });
        }

        function setupCountryDropdown() {
            countrySelect.innerHTML = '';

            const globalOpt = document.createElement('option');
            globalOpt.value = 'GLOBAL';
            globalOpt.textContent = 'Global (All Countries)';
            countrySelect.appendChild(globalOpt);

            const regionGroup = document.createElement('optgroup');
            regionGroup.label = 'Regions';
            ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'].forEach(region => {
                const option = document.createElement('option');
                option.value = 'REGION:' + region;
                option.textContent = region;
                regionGroup.appendChild(option);
            });
            countrySelect.appendChild(regionGroup);

            const countryGroup = document.createElement('optgroup');
            countryGroup.label = 'Countries';
            const countryList = Object.keys(countryMap).map(code => {
                return { code: code, name: countryMap[code] };
            });
            countryList.sort((a, b) => a.name.localeCompare(b.name));
            countryList.forEach(c => {
                const option = document.createElement('option');
                option.value = c.code;
                option.textContent = c.name;
                countryGroup.appendChild(option);
            });
            countrySelect.appendChild(countryGroup);
        }

        function setupBarChartRows() {
            rowsContainer.innerHTML = '';
            topics.forEach((topic) => {
                const row = document.createElement('div');
                row.className = 'race-row';
                row.id = `row-${sanitizeName(topic)}`;
                row.style.top = '400px'; // Offscreen initially

                row.innerHTML = `
                    <div class="topic-info">
                        <div class="topic-dot" style="background-color: ${topicColors[topic]};"></div>
                        <div class="topic-name" title="${topic}">${topic}</div>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill" id="bar-${sanitizeName(topic)}" style="background: ${topicGradients[topic]}; width: 0%;"></div>
                    </div>
                    <div class="value-display" id="val-${sanitizeName(topic)}">0</div>
                    <div class="flag-display" id="flag-${sanitizeName(topic)}" style="margin-left: 10px; font-size: 1.5em; line-height: 1; display: flex; align-items: center;"></div>
                `;
                rowsContainer.appendChild(row);
            });
        }

        function setupGridLines() {
            gridLines.innerHTML = '';
            // 5 lines at 0%, 25%, 50%, 75%, 100%
            for (let i = 0; i <= 4; i++) {
                const pct = i * 25;
                const line = document.createElement('div');
                line.className = 'grid-line';
                line.style.left = `${pct}%`;

                const label = document.createElement('div');
                label.className = 'grid-line-label';
                label.id = `grid-label-${i}`;
                label.textContent = '0';
                line.appendChild(label);

                gridLines.appendChild(line);
            }
        }

        // Initialize Line Chart
        function initializeLineChart() {
            const ctx = container.querySelector('#trendChart').getContext('2d');
            
            const datasets = topics.map(topic => {
                return {
                    label: topic,
                    data: years.map(y => {
                        if (y > currentYear) return null;
                        if (!isTopicActive(topic, y)) return null;
                        return globalData[y][topic] || 0;
                    }),
                    borderColor: topicColors[topic],
                    backgroundColor: topicColors[topic] + '1A', // transparent fill
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: false,
                    spanGaps: false
                };
            });

            lineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: years,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    color: '#0f172a',
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#0f172a',
                                font: {
                                    family: 'Outfit',
                                    size: 12,
                                    weight: '500'
                                },
                                boxWidth: 12,
                                padding: 16,
                                usePointStyle: false
                            }
                        },
                        tooltip: {
                            backgroundColor: '#ffffff',
                            titleColor: '#0f172a',
                            titleFont: {
                                family: 'Outfit',
                                weight: 600
                            },
                            bodyColor: '#334155',
                            bodyFont: {
                                family: 'Outfit'
                            },
                            borderColor: '#e2e8f0',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toLocaleString();
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(15, 23, 42, 0.08)',
                                drawTicks: false
                            },
                            ticks: {
                                color: '#334155',
                                font: {
                                    family: 'Outfit'
                                }
                            }
                        },
                        y: {
                            grace: '30%',
                            grid: {
                                color: 'rgba(15, 23, 42, 0.08)',
                                drawTicks: false
                            },
                            ticks: {
                                color: '#334155',
                                font: {
                                    family: 'Outfit'
                                },
                                callback: function(value) {
                                    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                                    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'k';
                                    return value;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Update Dashboard Elements
        function updateDashboard(recalcStats = false) {
            updateScopeLabels();
            updateTimelineUI();
            updateBarChartRace();
            updateLineChartData();
            
            if (recalcStats) {
                calculateAndRenderStats();
            }
        }

        function updateTimelineUI() {
            timelineSlider.value = currentYear;
            labelCurrentYear.textContent = `Year: ${currentYear}`;
            yearIndicator.textContent = currentYear;
            watermarkYear.textContent = currentYear;
}

        function updateBarChartRace() {
            const filter = parseFilter(selectedFilter);
            const activeData = getActiveDataForYear(currentYear);

            // Active topics ranked by volume; inactive (pre–honesty floor) sink below with n/a
            const sortedTopics = topics.map(topic => {
                const active = isTopicActive(topic, currentYear);
                return {
                    name: topic,
                    value: active ? (activeData[topic] || 0) : 0,
                    active
                };
            }).sort((a, b) => {
                if (a.active !== b.active) return a.active ? -1 : 1;
                return b.value - a.value;
            });

            const activeOnly = sortedTopics.filter(t => t.active);
            const maxValue = (activeOnly[0] && activeOnly[0].value) || 1;

            // Update background grid labels
            for (let i = 0; i <= 4; i++) {
                const labelElement = container.querySelector(`#grid-label-${i}`);
                const val = (maxValue * (i * 25) / 100);
                if (val >= 1e6) {
                    labelElement.textContent = (val / 1e6).toFixed(1) + 'M';
                } else if (val >= 1e3) {
                    labelElement.textContent = (val / 1e3).toFixed(0) + 'k';
                } else {
                    labelElement.textContent = Math.round(val);
                }
            }

            // Update each topic's bar
            sortedTopics.forEach((item, index) => {
                const sName = sanitizeName(item.name);
                const row = container.querySelector(`#row-${sName}`);
                const bar = container.querySelector(`#bar-${sName}`);
                const valDisp = container.querySelector(`#val-${sName}`);

                if (row && bar && valDisp) {
                    // Reposition row based on sorted rank (rank index * height + spacing)
                    // Visual area height: 400px, 7 rows -> space them at 54px intervals
                    row.style.top = `${index * 54}px`;
                    row.style.opacity = item.active ? '1' : '0.45';

                    if (!item.active) {
                        bar.style.width = '0%';
                        valDisp.textContent = `n/a before ${topicStartYear(item.name)}`;
                        const flagDisp = container.querySelector(`#flag-${sName}`);
                        if (flagDisp) {
                            flagDisp.textContent = '';
                            flagDisp.title = `OpenAlex series starts ${topicStartYear(item.name)} for this concept`;
                        }
                        return;
                    }

                    // Calculate width percentage (cap at 100%)
                    const pct = (item.value / maxValue) * 100;
                    bar.style.width = `${pct}%`;

                    // Update value text (publication count for active filter scope)
                    valDisp.textContent = item.value.toLocaleString();

                    // Flags: GLOBAL = world leader; REGION = leader within region;
                    // COUNTRY = selected country only (never a foreign world-leader flag).
                    const flagDisp = container.querySelector(`#flag-${sName}`);
                    if (flagDisp) {
                        if (filter.type === 'country') {
                            flagDisp.textContent = getFlagEmoji(filter.code);
                            flagDisp.title = filter.label;
                        } else if (filter.type === 'region') {
                            const topC = getTopCountryInYear(item.name, currentYear, codesForFilter(filter));
                            flagDisp.textContent = getFlagEmoji(topC.code);
                            flagDisp.title = topC.code
                                ? `Leader in ${filter.region}: ${topC.name}`
                                : '';
                        } else {
                            const topC = getTopCountryInYear(item.name, currentYear);
                            flagDisp.textContent = getFlagEmoji(topC.code);
                            flagDisp.title = topC.code
                                ? `World leader: ${topC.name}`
                                : '';
                        }
                    }
                }
            });
        }

        function updateLineChartData() {
            if (!lineChart) return;

            const visibleYears = years.filter(y => y <= currentYear);
            lineChart.data.labels = visibleYears;

            topics.forEach((topic, idx) => {
                const dataPoints = visibleYears.map(y => {
                    if (!isTopicActive(topic, y)) return null;
                    const dataSrc = getActiveDataForYear(y);
                    return dataSrc[topic] || 0;
                });
                lineChart.data.datasets[idx].data = dataPoints;
            });
            lineChart.update();
        }

        function clearCountryRegionFilter() {
            selectedFilter = 'GLOBAL';
            if (countrySelect) countrySelect.value = 'GLOBAL';
            updateDashboard(true);
        }

        function calculateAndRenderStats() {
            insightsGrid.innerHTML = '';
            const filter = parseFilter(selectedFilter);
            const scopeCodes = codesForFilter(filter);

            topics.forEach(topic => {
                const startY = topicStartYear(topic);
                // 1. Calculate Total Publications (scoped; honesty window only)
                let totalPubs = 0;
                let peakYear = startY;
                let peakPubs = -1;

                years.forEach(y => {
                    if (y < startY) return;
                    const dataSrc = getActiveDataForYear(y);
                    const val = dataSrc[topic] || 0;
                    totalPubs += val;
                    if (val > peakPubs) {
                        peakPubs = val;
                        peakYear = y;
                    }
                });

                // 2. Calculate Growth Rate (first active honesty year vs latest year in window)
                let firstActiveYear = startY;
                let firstActiveVal = 0;
                
                for (let i = 0; i < years.length; i++) {
                    const y = years[i];
                    if (y < startY) continue;
                    const dataSrc = getActiveDataForYear(y);
                    const val = dataSrc[topic] || 0;
                    if (val > 0) {
                        firstActiveYear = y;
                        firstActiveVal = val;
                        break;
                    }
                }
                if (firstActiveVal === 0) {
                    const dataSrc = getActiveDataForYear(startY);
                    firstActiveVal = dataSrc[topic] || 0;
                }

                const dataEndSrc = getActiveDataForYear(yearMax);
                const valEnd = dataEndSrc[topic] || 0;

                let growthStr = 'N/A';
                let growthClass = 'growth-neutral';
                if (firstActiveVal > 0) {
                    const growthPct = ((valEnd - firstActiveVal) / firstActiveVal) * 100;
                    growthStr = (growthPct >= 0 ? '+' : '') + growthPct.toLocaleString(undefined, {maximumFractionDigits: 0}) + '%';
                    if (growthPct > 0) growthClass = 'growth-positive';
                    else if (growthPct < 0) growthClass = 'growth-negative';
                } else if (valEnd > 0) {
                    growthStr = 'New (+100%)';
                    growthClass = 'growth-positive';
                }

                // 3. Peak publications count
                const peakStr = peakPubs > 0 ? `${peakPubs.toLocaleString()} (${peakYear})` : 'N/A';

                // 4. Secondary Analytical Metric
                let footerLabel = '';
                let footerValue = '';
                
                if (filter.type === 'global') {
                    const top5 = getTop5CountriesInYear(topic, yearMax);
                    footerLabel = `Top Leaders (${yearMax})`;
                    
                    let optionsHtml = top5.map((c, i) => {
                        const pct = valEnd > 0 ? (c.count / valEnd * 100).toFixed(0) : 0;
                        return `<div style="padding: 2px 0;">${i+1}. ${c.name} (${pct}%)</div>`;
                    }).join('');
                    
                    const summaryText = top5.length > 0 ? `1. ${top5[0].name}` : 'Top 5';

                    footerValue = top5.length > 0 
                        ? `<details style="cursor: pointer; max-width: 180px; position: relative;">
                               <summary style="font-size: 0.9em; outline: none; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 5px; user-select: none; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; color: #0f172a;"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${summaryText}</span><span style="font-size: 0.7em; margin-left: 6px;">▼</span></summary>
                               <div style="position: absolute; bottom: 100%; right: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; font-size: 0.85em; color: #0f172a; margin-bottom: 4px; width: max-content; z-index: 10; box-shadow: 0 4px 12px rgba(15,23,42,0.12);">${optionsHtml}</div>
                           </details>` 
                        : 'None';
                } else if (filter.type === 'region') {
                    const top5 = getTop5CountriesInYear(topic, yearMax, scopeCodes);
                    const regionTotal = valEnd;
                    footerLabel = `Top in ${filter.region} (${yearMax})`;
                    let optionsHtml = top5.map((c, i) => {
                        const pct = regionTotal > 0 ? (c.count / regionTotal * 100).toFixed(0) : 0;
                        return `<div style="padding: 2px 0;">${i+1}. ${c.name} (${pct}%)</div>`;
                    }).join('');
                    const summaryText = top5.length > 0 ? `1. ${top5[0].name}` : 'Top 5';
                    footerValue = top5.length > 0
                        ? `<details style="cursor: pointer; max-width: 180px; position: relative;">
                               <summary style="font-size: 0.9em; outline: none; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 5px; user-select: none; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; color: #0f172a;"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${summaryText}</span><span style="font-size: 0.7em; margin-left: 6px;">▼</span></summary>
                               <div style="position: absolute; bottom: 100%; right: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; font-size: 0.85em; color: #0f172a; margin-bottom: 4px; width: max-content; z-index: 10; box-shadow: 0 4px 12px rgba(15,23,42,0.12);">${optionsHtml}</div>
                           </details>`
                        : 'None';
                } else {
                    const globalEndVal = globalData[yearMax][topic] || 0;
                    const countryEndVal = valEnd;
                    const share = globalEndVal > 0 ? (countryEndVal / globalEndVal * 100) : 0;
                    
                    footerLabel = `World share (${yearMax})`;
                    footerValue = share > 0 ? `${share.toFixed(1)}%` : '0%';
                }

                // Render Insight Card
                const card = document.createElement('div');
                card.className = 'insight-card';
                const scopeMetricLabel = filter.type === 'global'
                    ? `Total Pubs (${startY}–${yearMax})`
                    : `${filter.label} Pubs (${startY}–${yearMax})`;
                card.innerHTML = `
                    <div class="card-top">
                        <div class="card-title">${topic}</div>
                        <div class="subfield-pill">Concept ID ${topicSubfields[topic]} · from ${startY}</div>
                    </div>
                    <div class="card-metric">
                        <div class="metric-value">${totalPubs.toLocaleString()}</div>
                        <div class="metric-label">${scopeMetricLabel}</div>
                    </div>
                    <div class="card-footer">
                        <div class="footer-item">
                            <span class="footer-label">Growth (vs ${firstActiveYear})</span>
                            <span class="footer-value ${growthClass}">${growthStr}</span>
                        </div>
                        <div class="footer-item">
                            <span class="footer-label">${footerLabel}</span>
                            <span class="footer-value">${footerValue}</span>
                        </div>
                    </div>
`;
                // peakStr reserved for future footer slot; keep computed for consistency checks
                void peakStr;
                insightsGrid.appendChild(card);
            });
        }

        // Helper to find the top contributing country for a topic in a specific year
        function getTopCountryInYear(topic, year, codeList) {
            let maxPubs = -1;
            let topCode = '';
            let topName = '';
            const codes = codeList || Object.keys(countryData);

            for (const code of codes) {
                if (!countryData[code] || !countryData[code][year]) continue;
                const val = countryData[code][year][topic] || 0;
                if (val > maxPubs) {
                    maxPubs = val;
                    topCode = code;
                    topName = countryMap[code] || code;
                }
            }

            return { code: topCode, name: topName, count: maxPubs };
        }

        function getTop5CountriesInYear(topic, year, codeList) {
            let list = [];
            const codes = codeList || Object.keys(countryData);
            for (const code of codes) {
                if (!countryData[code] || !countryData[code][year]) continue;
                const val = countryData[code][year][topic] || 0;
                if (val > 0) {
                    list.push({ code: code, name: countryMap[code] || code, count: val });
                }
            }
            list.sort((a, b) => b.count - a.count);
            return list.slice(0, 5);
        }

        function getFlagEmoji(countryCode) {
            if (!countryCode) return '';
            if (countryCode.toLowerCase() === 'uk') countryCode = 'GB'; // Handle common edge cases just in case
            const codePoints = countryCode
                .toUpperCase()
                .split('')
                .map(char => 127397 + char.charCodeAt(0));
            return String.fromCodePoint(...codePoints);
        }

        // Animation Loop logic
        function startPlayback() {
            if (isPlaying) return;
            isPlaying = true;
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            runAnimationLoop();
        }

        function pausePlayback() {
            if (!isPlaying) return;
            isPlaying = false;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            if (playTimeout) {
                clearTimeout(playTimeout);
                playTimeout = null;
            }
        }

        function runAnimationLoop() {
            if (!isPlaying) return;

            currentYear++;
            if (currentYear > yearMax) {
                currentYear = yearMin;
            }
            
            updateDashboard(false); // don't recalc heavy stats every frame

            let delay = 800;
            if (speedMultiplier === 0.5) delay = 1500;
            else if (speedMultiplier === 1.0) delay = 800;
            else if (speedMultiplier === 2.0) delay = 350;

            playTimeout = setTimeout(runAnimationLoop, delay);
        }

        // Event Listeners setup
        function setupEventListeners() {
            // Play / Pause Button
            btnPlay.addEventListener('click', () => {
                if (isPlaying) {
                    pausePlayback();
                } else {
                    startPlayback();
                }
            });

            // Reset Button (year only — does not clear country/region filter)
            btnReset.addEventListener('click', () => {
                pausePlayback();
                currentYear = yearMin;
                updateDashboard(false);
            });

            // Timeline slider input
            timelineSlider.addEventListener('input', (e) => {
                pausePlayback();
                currentYear = parseInt(e.target.value);
                updateDashboard(false);
            });

            // Country / region selection change — scopes bars, trend, flags, insights
            countrySelect.addEventListener('change', (e) => {
                selectedFilter = e.target.value;
                updateDashboard(true);
            });

            const btnClearFilter = container.querySelector('#btnClearFilter');
            if (btnClearFilter) {
                btnClearFilter.addEventListener('click', () => {
                    pausePlayback();
                    clearCountryRegionFilter();
                });
            }

            // Esc clears country/region filter back to Global
            const onViz3Keydown = (e) => {
                if (e.key !== 'Escape') return;
                if (selectedFilter === 'GLOBAL') return;
                pausePlayback();
                clearCountryRegionFilter();
            };
            document.addEventListener('keydown', onViz3Keydown);
            // Drop listener when this viz body is replaced (nav away)
            const observer = new MutationObserver(() => {
                if (!document.body.contains(container)) {
                    document.removeEventListener('keydown', onViz3Keydown);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Speed selector buttons
            const speedBtns = container.querySelectorAll('.speed-btn');
            speedBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    speedBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    speedMultiplier = parseFloat(btn.dataset.speed);
                });
            });
        }

        // Helpers
        function sanitizeName(str) {
            return str.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        }

        // Start everything
  
  // Initialize
  if (typeof window.CSV_DATA === 'undefined') {
      container.innerHTML = `<h2 style="color:red; padding: 2rem;">Error: viz3_data.js is missing or not loaded correctly.</h2>`;
      return;
  }
  
  initializeApp();
}

