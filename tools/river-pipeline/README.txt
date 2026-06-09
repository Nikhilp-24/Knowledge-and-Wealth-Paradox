CS661 — River → Pool → Tap pipeline map (dashboard-light)
=========================================================

What
----
Interactive diagram of how raw sources (rivers) become chart bundles
(pools) and then UI graphs (taps). Built so the team can see ownership,
quarantine, and the India GERD gap without reading the MD wall.

This copy lives under dashboard-light/ (fig1 cream paper chrome). The dark
original is under dashboard/tools/river-pipeline/ — do not mix ports or folders.

Open
----
From the light dashboard folder, serve on port 8088, then visit:

  http://127.0.0.1:8088/tools/river-pipeline/

Example (PowerShell, from dashboard-light/):

  python -m http.server 8088

Or from repo root:

  python -m http.server 8088 --directory dashboard-light

Hard-refresh (Ctrl+Shift+R) after CSS/JS cache-bust changes.
Do not open index.html as a file:// URL if D3 path resolution fails;
use a local server. Do not use the dark dashboard on :8080 for this page.

Files
-----
  index.html   — shell + chrome + Flows→Pools “What is this?” explainer
  style.css    — fig1 cream chrome (matches dashboard-light tokens; diagram semantics unchanged)
  app.js       — topology data + D3 diagram + interactions
  README.txt   — this file

Does not touch live G1–G5 chart modules. Optional landing link only.
Diagram node/edge meanings are unchanged; the explainer only describes the
middle Flows→Pools gate/cleaning cluster for humans.

Source of truth (docs)
----------------------
  dashboard/docs/RIVER_OWNERS.md
  dashboard/docs/RIVER_PIPELINE_REPORT.md
  dashboard/docs/RIVER_GERD_HIERARCHY.md
  dashboard/docs/RIVER_TO_POOL_FIX.md
  dashboard/docs/EXPLAINER_FINDINGS_AND_CHANGES.md
