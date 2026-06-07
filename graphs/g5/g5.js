// graphs/g5/g5.js — Graph 5 shell (India network via INDIA / india_network.js)
// VIZ 5: India Domestic Higher Education Network (real JSON)
// ══════════════════════════════════════════════════════════
function renderViz5(body) {
  if (!INDIA.isReady()) {
    renderViz5Legacy(body);
    return;
  }

  if (APP.indiaController?.destroy) {
    APP.indiaController.destroy();
    APP.indiaController = null;
  }

  const selectedId = APP.selectedNode ? APP.selectedNode.id : null;
  APP.indiaController = INDIA.render(body, {
    tierFilter: APP.tier,
    selectedNodeId: selectedId,
    displayYear: APP.year,
    mode: "full",
    onSelect: (node) => {
      APP.selectedNode = node;
    },
    onYearChange: (y) => {
      APP.year = y;
      const yearVal = document.querySelector(".year-val");
      const slider = document.querySelector(".ctrl-range");
      if (yearVal) yearVal.textContent = y;
      if (slider) slider.value = y;
    },
  });

  if (APP.indiaController?.setYear && APP.year) {
    APP.indiaController.setYear(APP.year);
  }

  if (APP.indiaController?.destroy) {
    APP.cleanupFns.push(() => {
      APP.indiaController?.destroy();
      APP.indiaController = null;
    });
  }
}

function renderViz5Legacy(body) {
  const layout = div("india-layout");
  const mapPane = div("india-map-pane");
  const sidePane = div("india-sidebar");
  sidePane.innerHTML = `
    <h4>Institution Details</h4>
    <p class="inst-placeholder">India network JSON not loaded — using demo fallback</p>
    <div class="inst-details" id="inst-details"></div>
  `;
  layout.append(mapPane, sidePane);
  body.appendChild(layout);

  const net = DATA.getIndiaNetwork(APP.year);
  const tierFilter = APP.tier;
  const nodes = net.nodes.filter(n => tierFilter === "All" || n.tier === tierFilter);
  const nodeIds = new Set(nodes.map(n => n.id));
  const links  = net.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

  const W = mapPane.offsetWidth || 550, H = body.offsetHeight || 500;
  const svg = d3.select(mapPane).append("svg").attr("width",W).attr("height",H);
  const boundary = [
    [68.1,23.7],[73.5,34.5],[77.5,37.0],[80.3,30.5],[88.5,27.5],
    [97.4,28.2],[91.8,22.0],[88.0,21.6],[80.2,12.5],[77.4,8.1],
    [73.5,15.5],[72.8,20.0],[68.1,23.7]
  ];
  const proj = d3.geoMercator().fitSize([W-40, H-40], {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [boundary] }
  });
  svg.append("path")
    .datum({type: "Polygon", coordinates: [boundary]})
    .attr("d", d3.geoPath().projection(proj))
    .attr("fill", "rgba(15,23,42,0.03)")
    .attr("stroke", "rgba(15,23,42,0.14)")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,4");
  svg.selectAll(".link").data(links).join("line").attr("class","link")
    .attr("x1", d => proj([net.nodes.find(n=>n.id===d.source).lon, net.nodes.find(n=>n.id===d.source).lat])[0])
    .attr("y1", d => proj([net.nodes.find(n=>n.id===d.source).lon, net.nodes.find(n=>n.id===d.source).lat])[1])
    .attr("x2", d => proj([net.nodes.find(n=>n.id===d.target).lon, net.nodes.find(n=>n.id===d.target).lat])[0])
    .attr("y2", d => proj([net.nodes.find(n=>n.id===d.target).lon, net.nodes.find(n=>n.id===d.target).lat])[1])
    .attr("stroke", "rgba(204,121,167,0.3)")
    .attr("stroke-width", d => Math.sqrt(d.weight)/2);
  const rSc = d3.scaleSqrt().domain([0, 10000]).range([3, 25]);
  const tierColors = { "Premier":"#0072B2", "Central / State":"#56B4E9", "Affiliated / Private":"#E69F00" };
  const nodeG = svg.selectAll(".node").data(nodes).join("g").attr("class","node")
    .attr("transform", d => `translate(${proj([d.lon, d.lat])})`)
    .style("cursor","pointer")
    .on("click", (e,d) => selectIndiaNode(d, net));
  nodeG.append("circle")
    .attr("r", d => rSc(d.publications))
    .attr("fill", d => tierColors[d.tier] + "dd");
}

function selectIndiaNode(node, net) {
  APP.selectedNode = node;
  const container = document.getElementById("inst-details");
  document.querySelector(".inst-placeholder").style.display = "none";
  
  const connectedLinks = net.links.filter(l => l.source === node.id || l.target === node.id);
  const totalCollabs = d3.sum(connectedLinks, l => l.weight);
  
  container.innerHTML = `
    <h3 style="color:#e2e8f0; margin-bottom:0.5rem; font-size:1.3rem;">${node.name}</h3>
    <div style="color:var(--accent); font-weight:bold; margin-bottom:1.5rem; font-size:0.9rem;">${node.tier}</div>
    
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:1rem; margin-bottom:1rem;">
      <div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Publications (${APP.year})</div>
        <div style="font-size:1.4rem; color:#0f172a; font-weight:bold;">${node.publications.toLocaleString()}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:var(--text-muted);">Gov Funding</div>
        <div style="font-size:1.4rem; color:#0f172a; font-weight:bold;">₹${node.funding} <span style="font-size:0.9rem;">Cr</span></div>
      </div>
    </div>
    
    <div style="font-size:0.95rem; margin-bottom:0.5rem; color:#334155;">Domestic Co-publications: <strong>${totalCollabs}</strong></div>
    
    <ul style="list-style:none; padding:0; font-size:0.85rem; color:#94a3b8;">
      ${connectedLinks.sort((a,b)=>b.weight-a.weight).slice(0,5).map(l => {
        const partnerId = l.source === node.id ? l.target : l.source;
        const partner = net.nodes.find(n=>n.id === partnerId);
        if (!partner) return "";
        return `<li style="padding:4px 0; border-bottom:1px dashed rgba(15,23,42,0.06); display:flex; justify-content:space-between;">
          <span>${partner.name}</span> <span style="color:#56B4E9; font-weight:bold;">${l.weight}</span>
        </li>`;
      }).join("")}
    </ul>
  `;
}

// ─── Play / Animation ──────────────────────────────────────
