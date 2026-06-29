// CS661 Group 10 - The Global Knowledge & Wealth Paradox Application Logic
document.addEventListener("DOMContentLoaded", () => {
  // App State
  let state = {
    year: 2010,
    region: "All",
    tier: "All",
    isPlaying: false,
    speed: 1000,
    selectedNode: null,
    fullscreenCardId: null
  };

  let animationInterval = null;

  // Tooltip Helper
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  // Initialize controls
  initControls();

  // Draw initial charts
  updateDashboard();

  // Resize listener for responsiveness
  window.addEventListener("resize", () => {
    updateDashboard();
  });

  // Expand card toggle
  window.expandCard = function(cardId) {
    state.fullscreenCardId = cardId;
    const modal = document.getElementById("fullscreen-modal");
    const container = document.getElementById("modal-plot-container");
    const title = document.getElementById("modal-title");
    
    // Set title
    const originalHeader = document.querySelector(`#${cardId} h2`).innerHTML;
    title.innerHTML = originalHeader;
    
    container.innerHTML = ""; // Clear
    modal.classList.add("active");

    // Render corresponding plot inside modal
    renderPlotById(cardId, "#modal-plot-container");
  };

  window.closeFullscreen = function() {
    state.fullscreenCardId = null;
    document.getElementById("fullscreen-modal").classList.remove("active");
    updateDashboard(); // Redraw main grid plots
  };

  // State Updates & Routing
  function updateDashboard() {
    if (state.fullscreenCardId) {
      renderPlotById(state.fullscreenCardId, "#modal-plot-container");
    } else {
      drawTsnePlot("#tsne-plot");
      drawRidgelinePlot("#ridgeline-plot");
      drawBarchartRace("#barchart-race");
      drawDumbbellPlot("#dumbbell-plot");
      drawIndiaMap("#india-map");
    }
  }

  function renderPlotById(cardId, selector) {
    if (cardId === "card-clustering") drawTsnePlot(selector);
    if (cardId === "card-quality") drawRidgelinePlot(selector);
    if (cardId === "card-topics") drawBarchartRace(selector);
    if (cardId === "card-collaboration") drawDumbbellPlot(selector);
    if (cardId === "card-india") drawIndiaMap(selector);
  }

  function initControls() {
    const slider = document.getElementById("year-slider");
    const display = document.getElementById("year-display");
    const playBtn = document.getElementById("play-pause-btn");
    const playIcon = document.getElementById("play-icon");
    const regionSelect = document.getElementById("region-filter");
    const tierSelect = document.getElementById("tier-filter");
    const dumbbellSort = document.getElementById("dumbbell-sort");
    const speedButtons = document.querySelectorAll(".toggle-btn");

    // Year slider
    slider.addEventListener("input", (e) => {
      state.year = parseInt(e.target.value);
      display.textContent = state.year;
      updateDashboard();
    });

    // Play/Pause animation
    playBtn.addEventListener("click", () => {
      state.isPlaying = !state.isPlaying;
      if (state.isPlaying) {
        playIcon.setAttribute("data-lucide", "pause");
        lucide.createIcons();
        startAnimation();
      } else {
        playIcon.setAttribute("data-lucide", "play");
        lucide.createIcons();
        stopAnimation();
      }
    });

    // Speed Controls
    speedButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        speedButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.speed = parseInt(btn.getAttribute("data-speed"));
        if (state.isPlaying) {
          stopAnimation();
          startAnimation();
        }
      });
    });

    // Region filter
    regionSelect.addEventListener("change", (e) => {
      state.region = e.target.value;
      updateDashboard();
    });

    // Tier filter
    tierSelect.addEventListener("change", (e) => {
      state.tier = e.target.value;
      updateDashboard();
    });

    // Dumbbell sorting
    dumbbellSort.addEventListener("change", () => {
      drawDumbbellPlot(state.fullscreenCardId ? "#modal-plot-container" : "#dumbbell-plot");
    });
  }

  function startAnimation() {
    const slider = document.getElementById("year-slider");
    const display = document.getElementById("year-display");
    
    animationInterval = setInterval(() => {
      state.year++;
      if (state.year > 2025) {
        state.year = 2010;
      }
      slider.value = state.year;
      display.textContent = state.year;
      updateDashboard();
    }, state.speed);
  }

  function stopAnimation() {
    if (animationInterval) {
      clearInterval(animationInterval);
    }
  }

  // Helper: Get container dimensions
  function getDimensions(selector) {
    const element = document.querySelector(selector);
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width || 400,
      height: rect.height || 340,
      margin: { top: 30, right: 30, bottom: 40, left: 50 }
    };
  }

  // --- VISUALIZATION 1: High-Dimensional Peer Clustering ---
  function drawTsnePlot(selector) {
    const container = d3.select(selector);
    container.html(""); // Clear
    
    const { width, height, margin } = getDimensions(selector);
    const data = GlobalDashboardData.getCountryDataForYear(state.year)
      .filter(d => state.region === "All" || d.region === state.region);

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([-4, 4])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([-4, 4])
      .range([height - margin.bottom, margin.top]);

    const sizeScale = d3.scaleSqrt()
      .domain([10000, 600000])
      .range([5, 25]);

    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickSize(-height + margin.top + margin.bottom).tickFormat(""));

    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).tickSize(-width + margin.left + margin.right).tickFormat(""));

    // Set grid line opacity and dashes
    svg.selectAll(".grid line")
      .attr("stroke", "rgba(255, 255, 255, 0.05)")
      .attr("stroke-dasharray", "2, 2");
    
    svg.selectAll(".grid path").attr("stroke", "none");

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .call(g => g.selectAll(".tick text").attr("fill", "#9ca3af").style("font-size", "10px"))
      .call(g => g.select(".domain").attr("stroke", "rgba(255, 255, 255, 0.1)"));

    // Y Axis
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .call(g => g.selectAll(".tick text").attr("fill", "#9ca3af").style("font-size", "10px"))
      .call(g => g.select(".domain").attr("stroke", "rgba(255, 255, 255, 0.1)"));

    // Axes Labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#9ca3af")
      .style("font-size", "10px")
      .text("t-SNE Coordinate X (Macroeconomic Structure)");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#9ca3af")
      .style("font-size", "10px")
      .text("t-SNE Coordinate Y (Academic Efficacy)");

    // Plot nodes
    svg.selectAll(".node")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", d => sizeScale(d.publications))
      .attr("fill", d => GlobalDashboardData.regions[d.region])
      .attr("opacity", 0.85)
      .attr("stroke", "rgba(255, 255, 255, 0.2)")
      .attr("stroke-width", 1.5)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).attr("opacity", 1.0).attr("stroke", "#ffffff");
        tooltip.transition().duration(200).style("opacity", .95);
        tooltip.html(`
          <strong>${d.name}</strong> (${d.region})<br/>
          GDP: $${d.gdp.toLocaleString()} Billion<br/>
          R&D Budget: ${d.rdPercent}% of GDP ($${d.rdSpend.toLocaleString()}M)<br/>
          Publications: ${d.publications.toLocaleString()}<br/>
          Citations/Paper: ${d.citations}
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 15) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget).attr("opacity", 0.85).attr("stroke", "rgba(255, 255, 255, 0.2)");
        tooltip.transition().duration(500).style("opacity", 0);
      });
  }

  // --- VISUALIZATION 2: Global Quality Shift (Ridgeline) ---
  function drawRidgelinePlot(selector) {
    const container = d3.select(selector);
    container.html("");

    const { width, height, margin } = getDimensions(selector);
    const data = GlobalDashboardData.getQualityShiftData(state.year);

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, 5])
      .range([height - margin.bottom, margin.top]);

    // Draw curves
    const lineGenerator = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveBasis);

    const areaGenerator = d3.area()
      .x(d => xScale(d.x))
      .y0(height - margin.bottom)
      .y1(d => yScale(d.y))
      .curve(d3.curveBasis);

    // Q4 Density (Lower quality)
    svg.append("path")
      .datum(data.q4)
      .attr("fill", "rgba(239, 68, 68, 0.15)")
      .attr("d", areaGenerator);

    svg.append("path")
      .datum(data.q4)
      .attr("fill", "none")
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 2.5)
      .attr("d", lineGenerator);

    // Q1 Density (Elite quality)
    svg.append("path")
      .datum(data.q1)
      .attr("fill", "rgba(99, 102, 241, 0.2)")
      .attr("d", areaGenerator);

    svg.append("path")
      .datum(data.q1)
      .attr("fill", "none")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 2.5)
      .attr("d", lineGenerator);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .call(g => g.selectAll(".tick text").attr("fill", "#9ca3af").style("font-size", "10px"))
      .call(g => g.select(".domain").attr("stroke", "rgba(255, 255, 255, 0.15)"));

    // Labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "#9ca3af")
      .style("font-size", "10px")
      .text("Normalized Citation Percentile Match Score");

    // Legends
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 150}, ${margin.top})`);

    // Q1 legend
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", "#6366f1").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 10).text("Q1 Journals (Elite)").attr("fill", "#f3f4f6").style("font-size", "10px");

    // Q4 legend
    legend.append("rect").attr("x", 0).attr("y", 18).attr("width", 12).attr("height", 12).attr("fill", "#ef4444").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 28).text("Q4 Journals (Low Tier)").attr("fill", "#f3f4f6").style("font-size", "10px");
  }

  // --- VISUALIZATION 3: Top 10 Research Topics (Bar Chart Race) ---
  function drawBarchartRace(selector) {
    const container = d3.select(selector);
    container.html("");

    const { width, height, margin } = getDimensions(selector);
    const data = GlobalDashboardData.getTopicsDataForYear(state.year);

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.volume) * 1.1])
      .range([0, plotWidth]);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, plotHeight])
      .padding(0.2);

    // Draw Bars
    svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .selectAll(".bar")
      .data(data, d => d.name)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("y", d => yScale(d.name))
      .attr("x", 0)
      .attr("width", d => xScale(d.volume))
      .attr("height", yScale.bandwidth())
      .attr("fill", (d, i) => d3.interpolatePurple(0.3 + (i * 0.07)))
      .attr("rx", 4)
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", .95);
        tooltip.html(`<strong>${d.name}</strong><br/>Category: ${d.category}<br/>Publication Count: ${d.volume.toLocaleString()}`)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(500).style("opacity", 0);
      });

    // Bar Labels
    svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .selectAll(".bar-label")
      .data(data, d => d.name)
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", -10)
      .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "#f3f4f6")
      .style("font-size", "9px")
      .style("font-weight", "500")
      .text(d => d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name);

    // Value Labels
    svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .selectAll(".value-label")
      .data(data, d => d.name)
      .enter()
      .append("text")
      .attr("class", "value-label")
      .attr("x", d => xScale(d.volume) + 8)
      .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", "#a78bfa")
      .style("font-size", "10px")
      .style("font-weight", "700")
      .text(d => d.volume.toLocaleString());
  }

  // --- VISUALIZATION 4: Dumbbell Plot (Collaboration Premium) ---
  function drawDumbbellPlot(selector) {
    const container = d3.select(selector);
    container.html("");

    const { width, height, margin } = getDimensions(selector);
    const sortVal = document.getElementById("dumbbell-sort").value;

    let data = GlobalDashboardData.getDumbbellData(state.year);
    
    // Sort data
    if (sortVal === "gain") data.sort((a, b) => b.gain - a.gain);
    else if (sortVal === "domestic") data.sort((a, b) => b.domestic - a.domestic);
    else if (sortVal === "international") data.sort((a, b) => b.international - a.international);
    else if (sortVal === "name") data.sort((a, b) => a.name.localeCompare(b.name));

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
      .domain([0, 35])
      .range([0, plotWidth]);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, plotHeight])
      .padding(0.4);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Grid lines
    g.selectAll(".grid-line")
      .data(xScale.ticks(5))
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "rgba(255, 255, 255, 0.05)")
      .attr("stroke-dasharray", "2, 2");

    // Connectors
    g.selectAll(".connector")
      .data(data)
      .enter()
      .append("line")
      .attr("class", "connector")
      .attr("x1", d => xScale(d.domestic))
      .attr("x2", d => xScale(d.international))
      .attr("y1", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("y2", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("stroke", "rgba(255, 255, 255, 0.15)")
      .attr("stroke-width", 2);

    // Domestic Dots (Left)
    g.selectAll(".dot-domestic")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-domestic")
      .attr("cx", d => xScale(d.domestic))
      .attr("cy", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("r", 5)
      .attr("fill", "#f43f5e")
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", .95);
        tooltip.html(`<strong>${d.name}</strong><br/>Domestic citations rate: ${d.domestic} per paper`)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

    // International Dots (Right)
    g.selectAll(".dot-intl")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-intl")
      .attr("cx", d => xScale(d.international))
      .attr("cy", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("r", 5)
      .attr("fill", "#10b981")
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", .95);
        tooltip.html(`<strong>${d.name}</strong><br/>International citations rate: ${d.international} per paper<br/>Premium Gain: +${d.gain}`)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

    // Country labels
    g.selectAll(".label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", -10)
      .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "#9ca3af")
      .style("font-size", "9px")
      .text(d => d.name);

    // X Axis
    g.append("g")
      .attr("transform", `translate(0, ${plotHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .call(g => g.selectAll(".tick text").attr("fill", "#9ca3af").style("font-size", "9px"))
      .call(g => g.select(".domain").attr("stroke", "rgba(255, 255, 255, 0.1)"));
  }

  // --- VISUALIZATION 5: India domestic network map ---
  function drawIndiaMap(selector) {
    const container = d3.select(selector);
    container.html("");

    const { width, height } = getDimensions(selector);
    const network = GlobalDashboardData.getIndiaNetworkData(state.year);
    const tierFilter = document.getElementById("tier-filter").value;

    const filteredNodes = network.nodes.filter(n => tierFilter === "All" || n.tier === tierFilter);
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = network.links.filter(l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target));

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    // Simple geographical projection scaled to map Indian sub-coordinates roughly centered
    const projection = d3.geoMercator()
      .center([82.0, 22.0]) // Center of India
      .scale(width * 1.35)
      .translate([width / 2, height / 2]);

    // Draw outline mapping mock (represented as a bounding path to provide a geographical backdrop)
    // Adding beautiful stylized geometric background representing India boundary
    const indiaOutlinePoints = [
      [68.1, 23.7], [73.5, 34.5], [77.5, 37.1], [80.3, 30.5], [88.5, 27.5], 
      [97.4, 28.2], [91.8, 22.0], [88.0, 21.6], [80.2, 12.5], [77.4, 8.1],
      [73.5, 15.5], [72.8, 20.0], [68.1, 23.7]
    ];
    
    const boundaryPath = d3.line()
      .x(d => projection(d)[0])
      .y(d => projection(d)[1])
      .curve(d3.curveBasisClosed);

    svg.append("path")
      .datum(indiaOutlinePoints)
      .attr("d", boundaryPath)
      .attr("fill", "rgba(255, 255, 255, 0.02)")
      .attr("stroke", "rgba(99, 102, 241, 0.15)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4, 4");

    // Draw Links
    svg.selectAll(".link")
      .data(filteredLinks)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("x1", d => {
        const node = filteredNodes.find(n => n.id === d.source);
        return node ? projection([node.lon, node.lat])[0] : 0;
      })
      .attr("y1", d => {
        const node = filteredNodes.find(n => n.id === d.source);
        return node ? projection([node.lon, node.lat])[1] : 0;
      })
      .attr("x2", d => {
        const node = filteredNodes.find(n => n.id === d.target);
        return node ? projection([node.lon, node.lat])[0] : 0;
      })
      .attr("y2", d => {
        const node = filteredNodes.find(n => n.id === d.target);
        return node ? projection([node.lon, node.lat])[1] : 0;
      })
      .attr("stroke", "rgba(168, 85, 247, 0.25)")
      .attr("stroke-width", d => Math.sqrt(d.weight) / 1.5)
      .attr("opacity", 0.85);

    // Node scale size
    const sizeScale = d3.scaleSqrt()
      .domain([1000, 10000])
      .range([4, 16]);

    // Draw Nodes
    const nodes = svg.selectAll(".node")
      .data(filteredNodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("cx", d => projection([d.lon, d.lat])[0])
      .attr("cy", d => projection([d.lon, d.lat])[1])
      .attr("r", d => sizeScale(d.publications))
      .attr("fill", d => {
        if (d.tier === "Premier") return "#34d399";
        if (d.tier === "Central / State") return "#60a5fa";
        return "#fbbf24";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", d => state.selectedNode && state.selectedNode.id === d.id ? 2 : 1)
      .attr("opacity", 0.9)
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", .95);
        tooltip.html(`
          <strong>${d.name}</strong> (${d.tier})<br/>
          Publications: ${d.publications.toLocaleString()}<br/>
          Budget: ₹${d.funding} Cr
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0))
      .on("click", (event, d) => {
        state.selectedNode = d;
        showInstitutionDetails(d, filteredLinks, filteredNodes);
        drawIndiaMap(selector); // Redraw map to highlight clicked node
      });
  }

  function showInstitutionDetails(node, links, allNodes) {
    const detailsDiv = document.querySelector(".details-content");
    const placeholder = document.querySelector(".details-placeholder");
    
    placeholder.classList.add("hidden");
    detailsDiv.classList.remove("hidden");

    // Populating DOM elements
    document.getElementById("detail-name").textContent = node.name;
    const tierBadge = document.getElementById("detail-tier");
    tierBadge.textContent = node.tier;
    tierBadge.className = "badge detail-tier";
    if (node.tier === "Premier") tierBadge.style.background = "#34d399";
    else if (node.tier === "Central / State") tierBadge.style.background = "#60a5fa";
    else tierBadge.style.background = "#fbbf24";

    document.getElementById("detail-pubs").textContent = node.publications.toLocaleString();
    document.getElementById("detail-funding").textContent = `₹${node.funding} Cr`;

    // Filter connections
    const connections = links.filter(l => l.source === node.id || l.target === node.id);
    const listElement = document.getElementById("detail-collabs");
    listElement.innerHTML = "";

    if (connections.length === 0) {
      listElement.innerHTML = `<p style="font-size:0.75rem; color:var(--text-dim)">No active collaborations mapped.</p>`;
      return;
    }

    connections.forEach(c => {
      const partnerId = c.source === node.id ? c.target : c.source;
      const partner = allNodes.find(n => n.id === partnerId);
      if (partner) {
        const item = document.createElement("div");
        item.className = "collab-item";
        item.innerHTML = `
          <span class="collab-name">${partner.name}</span>
          <span class="collab-val">${c.weight} papers</span>
        `;
        listElement.appendChild(item);
      }
    });
  }
});
