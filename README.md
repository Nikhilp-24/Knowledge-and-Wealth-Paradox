# Global Knowledge & Wealth Paradox
### CS661 Final Project - Group 10

An interactive visual analytics dashboard exploring the structural mechanics of global knowledge creation, funding, and scientific prestige.

## Overview
This project investigates the question: *does money buy scientific excellence?* 
Through five interactive visualization modules, this dashboard transforms massive macroeconomic and bibliometric datasets into a tangible narrative, revealing how the global science system is stratifying along multiple axes.

### Modules Included:
1. **The Global Baseline (UMAP Scatter Plot)**: Explores the clustering of global research quality and economic wealth.
2. **The Quality Shift (Ridgeline & Stacked Bars)**: Analyzes the divergence between raw publication volume and high-quality (Q1) output.
3. **The Bar Chart Race (Trend Animation)**: Tracks the rapid momentum of research fields (e.g., AI, Infectious Diseases) over time.
4. **The Collaboration Premium (Dumbbell Chart)**: Measures the citation impact gap between domestic and internationally co-authored papers.
5. **India's Knowledge Economy (Geospatial Network)**: Visualizes the highly siloed and top-heavy nature of India's domestic research infrastructure.

## Repository Structure
- `index.html` & `style.css`: Main application shell and styling.
- `app.js`: Global state management and visualization orchestration.
- `graphs/`: Contains the specific D3, Plotly, and Leaflet logic (JS/CSS) for each of the 5 modules.
- `scripts.zip`: The raw Python ETL pipelines used to scrape, clean, and join the OpenAlex, SCImago, and World Bank datasets.
- `*_data.js`: Statically compiled JSON payloads for zero-latency dashboard rendering.

## Setup & Running

**Live Demo**: The dashboard is hosted live via GitHub Pages and can be viewed here: [https://Nikhilp-24.github.io/Knowledge-and-Wealth-Paradox/](https://Nikhilp-24.github.io/Knowledge-and-Wealth-Paradox/)

### Running Locally
If you prefer to run the project locally, it requires no build step. Simply serve the directory using any local web server:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

## Data Sources
- **World Bank Open Data**: GDP, PPP, and R&D expenditure metrics.
- **OpenAlex API**: Institutional bibliometrics, collaboration networks, and citation counts.
- **SCImago Journal & Country Rank**: Q1–Q4 journal quality distributions.
- **NIRF**: Indian institutional rankings, patents, and funding data.
