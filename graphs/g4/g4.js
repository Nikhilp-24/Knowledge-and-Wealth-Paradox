// graphs/g4/g4.js — Graph 4 (Collaboration Premium)
function renderViz4(body) {
  // Core viz = classic dumbbell (domestic vs international). Bars were a mistaken overnight swap — only G2 keeps bars.
  // Light-theme chart chrome (semantic poles stay Okabe orange/blue)
  const C = {
    ink: "#0f172a",
    muted: "#475569",
    label: "#334155",
    border: "rgba(15,23,42,0.12)",
    grid: "rgba(15,23,42,0.08)",
    shaft: "rgba(71,85,105,0.40)",
    shaftHover: "rgba(51,65,85,0.65)",
    surface: "rgba(255,255,255,0.98)",
    surfaceSoft: "#f8fafc",
    haloFill: "rgba(14,116,144,0.08)",
    haloStroke: "rgba(14,116,144,0.35)",
    // Sky pole darkened for WCAG text on light bg (dots stay OKABE_ITO.orange / .blue)
    premium: "#0369a1",
    dotStroke: "#ffffff"
  };
  const yMin = (typeof VIZ4_META !== "undefined" && VIZ4_META.year_min) ? VIZ4_META.year_min : 2010;
  const yMax = (typeof VIZ4_META !== "undefined" && VIZ4_META.year_max) ? VIZ4_META.year_max : 2024;
  const nCountries = (typeof VIZ4_META !== "undefined" && VIZ4_META.n_countries) ? VIZ4_META.n_countries : null;
  const year = (APP.year >= yMin && APP.year <= yMax) ? APP.year : yMax;
  APP.year = year;

  let rawData = [];
  if (typeof VIZ4_BY_YEAR !== "undefined" && VIZ4_BY_YEAR[String(year)]) {
    rawData = VIZ4_BY_YEAR[String(year)];
  } else if (typeof VIZ4_DATA !== "undefined") {
    rawData = VIZ4_DATA;
  } else {
    rawData = DATA.getCollabData();
  }
  const countryN = nCountries || new Set(rawData.map(d => d.name)).size;

  let data = [];
  if (!APP.region || APP.region === "All") {
    const grouped = d3.group(rawData, d => d.region);
    for (const [region, countries] of grouped) {
      const dom = d3.mean(countries, d => d.domestic);
      const intl = d3.mean(countries, d => d.international);
      data.push({
        name: region,
        region: region,
        domestic: dom,
        international: intl,
        gain: intl - dom,
        isRegionAgg: true,
        countryCount: countries.length
      });
    }
  } else {
    data = rawData.filter(d => d.region === APP.region).map(d => ({ ...d, isRegionAgg: false }));
  }

  if (APP.sort === "gain") data.sort((a,b)=>b.gain-a.gain);
  else if (APP.sort === "international") data.sort((a,b)=>b.international-a.international);
  else if (APP.sort === "domestic") data.sort((a,b)=>b.domestic-a.domestic);
  else data.sort((a,b)=>a.name.localeCompare(b.name));

  body.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;";
  body.appendChild(wrapper);

  const avgDom = data.length ? d3.mean(data, d => d.domestic) : 0;
  const avgInt = data.length ? d3.mean(data, d => d.international) : 0;
  const avgGain = data.length ? d3.mean(data, d => d.gain) : 0;

  wrapper.className = "g4-root";
  const statsBar = document.createElement("div");
  statsBar.className = "g4-stats";
  statsBar.style.cssText = `padding:12px 20px;background:${C.surface};border-bottom:1px solid ${C.border};display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;`;
  statsBar.innerHTML = `
    <div style="display:flex;flex:1;justify-content:space-evenly;gap:12px;flex-wrap:wrap;">
      <div style="text-align:center;"><div style="color:${C.muted};font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;">Year</div><div style="color:${C.ink};font-size:1.35rem;font-weight:800;">${year}</div></div>
      <div style="text-align:center;"><div style="color:${C.muted};font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;">Rows</div><div style="color:${C.ink};font-size:1.35rem;font-weight:800;">${data.length}</div></div>
      <div style="text-align:center;"><div style="color:${OKABE_ITO.orange};font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;">Avg Domestic</div><div style="color:${C.ink};font-size:1.35rem;font-weight:800;">${avgDom.toFixed(1)}</div></div>
      <div style="text-align:center;"><div style="color:${OKABE_ITO.blue};font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;">Avg Int'l</div><div style="color:${C.ink};font-size:1.35rem;font-weight:800;">${avgInt.toFixed(1)}</div></div>
      <div style="text-align:center;"><div style="color:${C.premium};font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;">Avg Premium</div><div style="color:${C.ink};font-size:1.35rem;font-weight:800;">+${avgGain.toFixed(1)}</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;background:${C.surfaceSoft};padding:8px 12px;border-radius:8px;border:1px solid ${C.border};">
      <div style="display:flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:50%;background:${OKABE_ITO.orange};border:1.5px solid ${C.dotStroke};display:inline-block;"></span><span style="color:${C.label};font-size:0.8rem;font-weight:600;">Domestic cites/paper</span></div>
      <div style="display:flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:50%;background:${OKABE_ITO.blue};border:1.5px solid ${C.dotStroke};display:inline-block;"></span><span style="color:${C.label};font-size:0.8rem;font-weight:600;">Int'l collab cites/paper</span></div>
    </div>
  `;
  wrapper.appendChild(statsBar);

  const mainRow = document.createElement("div");
  mainRow.className = "g4-main";
  mainRow.style.cssText = "display:flex;flex:1;overflow:hidden;background:#ffffff;";
  wrapper.appendChild(mainRow);

  const scrollContainer = document.createElement("div");
  scrollContainer.className = "g4-plot";
  scrollContainer.style.cssText = "flex:1;overflow-y:auto;overflow-x:hidden;position:relative;background:#ffffff;";
  mainRow.appendChild(scrollContainer);

  const sidePanel = document.createElement("div");
  sidePanel.className = "g4-side";
  sidePanel.style.cssText = `width:280px;border-left:1px solid ${C.border};padding:20px;background:${C.surfaceSoft};display:flex;flex-direction:column;gap:16px;overflow-y:auto;`;
  const selected = APP.selectedCollab;
  sidePanel.innerHTML = `
    <h3 style="color:${C.ink};font-size:1.05rem;margin:0;padding-bottom:8px;border-bottom:1px solid ${C.border};">Details</h3>
    <div style="color:${C.muted};font-size:0.75rem;line-height:1.35;">Pool: <b style="color:${C.label};">${countryN} countries × ${yMin}–${yMax}</b>. Dumbbell = citation gap. Year slider / region / Esc.</div>
    <div id="viz4-detail-box" style="color:${C.muted};font-size:0.85rem;line-height:1.45;">
      ${selected ? "" : "Click a dumbbell to pin details. Esc or ← Regions clears."}
    </div>
    <div>
      <div style="color:${OKABE_ITO.orange};font-size:0.8rem;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Domestic Impact</div>
      <div style="color:${C.muted};font-size:0.82rem;line-height:1.4;">Mean citations for papers with authors only from this country.</div>
    </div>
    <div>
      <div style="color:${OKABE_ITO.blue};font-size:0.8rem;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Int'l Collab Impact</div>
      <div style="color:${C.muted};font-size:0.82rem;line-height:1.4;">Mean citations for papers with ≥1 foreign co-author.</div>
    </div>
    <div>
      <div style="color:${C.premium};font-size:0.8rem;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Collaboration Premium</div>
      <div style="color:${C.muted};font-size:0.82rem;line-height:1.4;">International − domestic (dumbbell length). Higher = larger citation gain from cross-border co-authorship.</div>
    </div>
  `;
  mainRow.appendChild(sidePanel);

  const detailBox = sidePanel.querySelector("#viz4-detail-box");
  const fillDetail = (d) => {
    if (!detailBox || !d) return;
    detailBox.innerHTML = `
      <div style="font-size:1rem;font-weight:800;color:${C.ink};margin-bottom:6px;">${d.name}</div>
      <div style="font-size:0.75rem;color:${C.muted};margin-bottom:8px;">${d.isRegionAgg ? `Region · ${d.countryCount} countries · ${year}` : `${d.region} · ${year}`}</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:${OKABE_ITO.orange};">Domestic</span><b style="color:${C.ink};">${d.domestic.toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:${OKABE_ITO.blue};">Int'l</span><b style="color:${C.ink};">${d.international.toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between;border-top:1px dashed rgba(15,23,42,0.14);padding-top:6px;"><span style="color:${C.premium};font-weight:700;">Premium</span><b style="color:${C.premium};">+${d.gain.toFixed(2)}</b></div>
      ${d.isRegionAgg ? `<div style="margin-top:8px;font-size:0.72rem;color:${C.label};font-style:italic;">Click again to drill into countries</div>` : ""}
    `;
  };
  if (selected) {
    const match = data.find(d => d.name === selected.name) || selected;
    fillDetail(match);
  }

  const W = scrollContainer.offsetWidth || 900;
  const rowH = 35;
  const m = { top: 60, right: 80, bottom: 40, left: 200 };
  const H = Math.max(scrollContainer.offsetHeight || 500, data.length * rowH + m.top + m.bottom + 20);
  const svg = d3.select(scrollContainer).append("svg").attr("width", W).attr("height", H);

  const defs = svg.append("defs");
  const dropShadow = defs.append("filter")
    .attr("id", "viz4-glow")
    .attr("x", "-20%").attr("y", "-20%")
    .attr("width", "140%").attr("height", "140%");
  dropShadow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
  const feMerge = dropShadow.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "blur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  svg.append("text").attr("x", W/2).attr("y", 28).attr("text-anchor", "middle")
    .attr("fill", C.ink).attr("font-size", 17).attr("font-weight", 800)
    .text(`Collaboration Premium — Dumbbell (${year})`);

  const maxVal = d3.max(data, d => Math.max(d.domestic, d.international)) || 1;
  const xSc = d3.scaleLinear().domain([0, maxVal * 1.05]).range([m.left, W - m.right]);
  const ySc = d3.scaleBand().domain(data.map(d => d.name)).range([m.top, H - m.bottom]).padding(0.4);
  const cy = d => ySc(d.name) + ySc.bandwidth() / 2;

  svg.append("g").attr("transform", `translate(0,${m.top - 20})`)
    .call(d3.axisTop(xSc).ticks(8))
    .call(g => g.select(".domain").attr("stroke", C.label))
    .call(g => g.selectAll("text").attr("fill", C.muted).attr("font-size", 11));
  svg.append("g").attr("transform", `translate(0,${H - m.bottom})`)
    .call(d3.axisBottom(xSc).ticks(8))
    .call(g => g.select(".domain").attr("stroke", C.label))
    .call(g => g.selectAll("line").attr("stroke", C.grid).attr("y2", -(H - m.top - m.bottom + 20)))
    .call(g => g.selectAll("text").attr("fill", C.muted).attr("font-size", 11));
  svg.append("g").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(ySc).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("font-size", 13).attr("font-weight", 500).attr("fill", C.label);

  const tipHtml = (d) => `
    <div style="font-weight:800;margin-bottom:4px;border-bottom:1px solid ${C.border};padding-bottom:4px;color:${C.ink};">${d.name}</div>
    <div style="font-size:11px;color:${C.muted};margin-bottom:6px;">${d.isRegionAgg ? d.countryCount + " countries" : d.region} · ${year}</div>
    <div style="font-size:12px;color:${C.label};">Domestic: <b style="color:${OKABE_ITO.orange}">${d.domestic.toFixed(2)}</b></div>
    <div style="font-size:12px;color:${C.label};">Int'l: <b style="color:${OKABE_ITO.blue}">${d.international.toFixed(2)}</b></div>
    <div style="font-size:12px;color:${C.label};">Premium: <b style="color:${C.premium}">+${d.gain.toFixed(2)}</b></div>
    <div style="font-size:10px;color:${C.muted};margin-top:6px;">${d.isRegionAgg ? "Click to drill down" : "Click to pin · Esc clears"}</div>
  `;

  // Connector lines (dumbbell shafts)
  svg.selectAll(".con").data(data, d => d.name).join(
    enter => enter.append("line").attr("class", "con")
      .attr("x1", d => xSc(d.domestic)).attr("x2", d => xSc(d.domestic))
      .attr("y1", cy).attr("y2", cy)
      .attr("stroke", C.shaft).attr("stroke-width", 4)
      .style("pointer-events", "none")
      .call(enter => enter.transition().duration(700).delay((d,i)=>i*5)
        .attr("x2", d => xSc(d.international))),
    update => update.call(update => update.transition().duration(500)
      .attr("y1", cy).attr("y2", cy)
      .attr("x1", d => xSc(d.domestic)).attr("x2", d => xSc(d.international))),
    exit => exit.transition().duration(300).style("opacity", 0).remove()
  );

  // Premium labels at the right end
  svg.selectAll(".viz4-gain").data(data, d => d.name).join("text")
    .attr("class", "viz4-gain")
    .attr("x", d => xSc(Math.max(d.domestic, d.international)) + 10)
    .attr("y", cy)
    .attr("dy", "0.35em")
    .attr("fill", C.premium).attr("font-size", 11).attr("font-weight", 700)
    .style("pointer-events", "none")
    .text(d => `+${d.gain.toFixed(1)}`);

  // Selection halo behind dots
  if (APP.selectedCollab) {
    const sel = data.find(d => d.name === APP.selectedCollab.name);
    if (sel) {
      svg.append("rect")
        .attr("x", m.left - 8)
        .attr("y", ySc(sel.name) - 2)
        .attr("width", W - m.left - m.right + 16)
        .attr("height", ySc.bandwidth() + 4)
        .attr("fill", C.haloFill)
        .attr("stroke", C.haloStroke)
        .attr("stroke-width", 1)
        .attr("rx", 4)
        .style("pointer-events", "none");
    }
  }

  // Domestic dots (Okabe orange / gold)
  svg.selectAll(".dd").data(data, d => d.name).join(
    enter => enter.append("circle").attr("class", "dd")
      .attr("cx", d => xSc(d.domestic)).attr("cy", cy).attr("r", 0)
      .attr("fill", OKABE_ITO.orange).attr("stroke", C.dotStroke).attr("stroke-width", 1.5)
      .style("pointer-events", "none")
      .call(enter => enter.transition().duration(700).delay((d,i)=>i*5).attr("r", 6)),
    update => update.transition().duration(500)
      .attr("cx", d => xSc(d.domestic)).attr("cy", cy).attr("r", 6),
    exit => exit.transition().duration(300).attr("r", 0).remove()
  );

  // International dots (Okabe blue)
  svg.selectAll(".di").data(data, d => d.name).join(
    enter => enter.append("circle").attr("class", "di")
      .attr("cx", d => xSc(d.domestic)).attr("cy", cy).attr("r", 0)
      .attr("fill", OKABE_ITO.blue).attr("stroke", C.dotStroke).attr("stroke-width", 1.5)
      .style("pointer-events", "none")
      .call(enter => enter.transition().duration(700).delay((d,i)=>i*5)
        .attr("cx", d => xSc(d.international)).attr("r", 6)),
    update => update.transition().duration(500)
      .attr("cx", d => xSc(d.international)).attr("cy", cy).attr("r", 6),
    exit => exit.transition().duration(300).attr("r", 0).remove()
  );

  // Invisible hit targets
  svg.selectAll(".row-hover").data(data, d => d.name).join("rect")
    .attr("class", "row-hover")
    .attr("x", 0).attr("y", d => ySc(d.name))
    .attr("width", W).attr("height", ySc.bandwidth())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseenter", function(e, d) {
      svg.selectAll(".dd").style("opacity", s => s.name === d.name ? 1 : 0.25);
      svg.selectAll(".di").style("opacity", s => s.name === d.name ? 1 : 0.25);
      svg.selectAll(".con").style("opacity", s => s.name === d.name ? 1 : 0.15);
      svg.selectAll(".dd").filter(x => x.name === d.name).attr("r", 9).style("filter", "url(#viz4-glow)");
      svg.selectAll(".di").filter(x => x.name === d.name).attr("r", 9).style("filter", "url(#viz4-glow)");
      svg.selectAll(".con").filter(x => x.name === d.name).attr("stroke", C.shaftHover).attr("stroke-width", 6);
      showTip(e, tipHtml(d));
    })
    .on("mousemove", moveTip)
    .on("mouseleave", function(e, d) {
      svg.selectAll(".dd").style("opacity", 1).attr("r", 6).style("filter", "none");
      svg.selectAll(".di").style("opacity", 1).attr("r", 6).style("filter", "none");
      svg.selectAll(".con").style("opacity", 1).attr("stroke", C.shaft).attr("stroke-width", 4);
      hideTip();
    })
    .on("click", function(e, d) {
      if (d.isRegionAgg) {
        APP.region = d.name;
        APP.selectedCollab = null;
        const select = document.getElementById("viz4-region-select");
        if (select) select.value = d.name;
        hideTip();
        renderViz(4);
        return;
      }
      APP.selectedCollab = (APP.selectedCollab && APP.selectedCollab.name === d.name) ? null : d;
      hideTip();
      renderViz(4);
    });

  const onViz4Keydown = (e) => {
    if (e.key !== "Escape") return;
    let changed = false;
    if (APP.selectedCollab) { APP.selectedCollab = null; changed = true; }
    else if (APP.region && APP.region !== "All") {
      APP.region = "All";
      const select = document.getElementById("viz4-region-select");
      if (select) select.value = "All";
      changed = true;
    }
    if (changed) { hideTip(); renderViz(4); }
  };
  document.addEventListener("keydown", onViz4Keydown);
  if (APP.cleanupFns) APP.cleanupFns.push(() => document.removeEventListener("keydown", onViz4Keydown));
}


// ══════════════════════════════════════════════════════════
