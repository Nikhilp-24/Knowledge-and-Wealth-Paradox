#!/usr/bin/env python3
"""Orchestrate all NIRF acquisition probes; append to nirf_acquisition_attempts.json.

Resume-safe: each sub-script skips completed work via cache / disk checks.
Rate-limited: 1–2s between external requests (inside sub-scripts).

Usage:
  python scripts/india_network/acquisition/run_acquisition_marathon.py
  python scripts/india_network/acquisition/run_acquisition_marathon.py --only wayback,cdn
  python scripts/india_network/acquisition/run_acquisition_marathon.py --integrate
"""
from __future__ import annotations

import argparse
import importlib
import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition._common import (  # noqa: E402
    DATA_DIR,
    LOG_JSON,
    LOG_MD,
    PROJECT_ROOT,
    RAW_DIR,
    log_attempt,
    utc_now_iso,
)

SCRIPTS_DIR = Path(__file__).resolve().parent
PYTHON = sys.executable

STEPS = [
    ("live", "scrape_nirf_press.py", []),
    ("wayback", "wayback_nirf_rankings.py", []),
    ("cdn", "probe_nirf_cdn.py", ["--seasons", "2015-2024"]),
    ("legacy", "probe_legacy_cdn.py", []),
    ("datagov", "probe_data_gov.py", []),
]

EXTRA_PROBES = [
    "common_crawl",
    "third_party_reference",
    "funding_crossref",
    "internet_archive_bulk",
]


def run_script(name: str, extra_args: list[str]) -> int:
    path = SCRIPTS_DIR / name
    cmd = [PYTHON, str(path), *extra_args]
    print(f"\n=== Running {name} {' '.join(extra_args)} ===")
    proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=False)
    return proc.returncode


def probe_common_crawl() -> None:
    """Document Common Crawl index search attempt (no institute data fabricated)."""
    # CC index API — search for nirfpdfcdn URLs
    import requests
    from acquisition._common import DEFAULT_SLEEP, CACHE_DIR, session

    sess = session()
    url = "https://index.commoncrawl.org/collinfo.json"
    time.sleep(DEFAULT_SLEEP)
    try:
        resp = sess.get(url, timeout=60)
        colls = resp.json() if resp.status_code == 200 else []
    except Exception as exc:  # noqa: BLE001
        log_attempt(
            method="Common Crawl index",
            source="index.commoncrawl.org",
            script="run_acquisition_marathon.py",
            status="fail",
            why_failed=str(exc),
            next_retry="Manual CC index query for nirfindia.org/nirfpdfcdn",
        )
        return
    recent = colls[-3:] if colls else []
    hits = 0
    for coll in recent:
        idx = coll.get("cdx-api", "")
        if not idx:
            continue
        qurl = f"{idx}?url=nirfindia.org/nirfpdfcdn/*&output=json&limit=5"
        time.sleep(DEFAULT_SLEEP)
        try:
            r = sess.get(qurl, timeout=90)
            if r.status_code == 200 and len(r.text) > 10:
                hits += max(0, len(r.text.splitlines()) - 1)
        except requests.RequestException:
            pass
    cache = CACHE_DIR / "common_crawl_nirf.json"
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"collections": recent, "sample_hits": hits}), encoding="utf-8")
    log_attempt(
        method="Common Crawl index",
        source="index.commoncrawl.org/nirfindia.org/nirfpdfcdn",
        script="run_acquisition_marathon.py",
        status="partial" if hits else "fail",
        rows_recovered=hits,
        detail=f"sample URL hits={hits}; see {cache.name}",
        why_failed="" if hits else "No indexed nirfpdfcdn URLs in recent collections (or API limit)",
        next_retry="Download CC index for full URL list; cross-check CDN probe",
    )


def log_third_party_reference() -> None:
    """Document third-party sources — reference only unless verified matchable."""
    refs = [
        {
            "name": "Shiksha NIRF rank lists",
            "url": "https://www.shiksha.com/university/ranking",
            "status": "reference_only",
            "reason": "Aggregator; institute ID mapping unreliable; legal/attribution unclear for ingestion",
        },
        {
            "name": "Careers360 NIRF archives",
            "url": "https://www.careers360.com/university/ranking",
            "status": "reference_only",
            "reason": "Category/year coverage incomplete; no IR-* IDs",
        },
        {
            "name": "Dataful.in NIRF datasets",
            "url": "https://dataful.in/datasets/19320/",
            "status": "already_in_pipeline",
            "reason": "Used by 01_download_sources; IDs unreliable for funding join",
        },
    ]
    out = DATA_DIR / "logs" / "third_party_nirf_reference.json"
    out.write_text(json.dumps(refs, indent=2), encoding="utf-8")
    for ref in refs:
        log_attempt(
            method="Third-party mirror",
            source=ref["url"],
            script="run_acquisition_marathon.py",
            status="fail" if ref["status"] == "reference_only" else "partial",
            rows_recovered=0,
            why_failed=ref["reason"],
            next_retry="Manual spot-check only; do not ingest without IR-* ID crosswalk",
        )


def crossref_funding_2023() -> None:
    """Check if nirf_rankings_2023.csv or scraped funding contains 2023-24 academic year."""
    import pandas as pd

    found_years: set[str] = set()
    for path in [RAW_DIR / "nirf_research_projects_scraped.csv", RAW_DIR / "nirf_research_projects.csv"]:
        if path.exists():
            df = pd.read_csv(path)
            if "academic_year" in df.columns:
                found_years.update(df["academic_year"].dropna().astype(str).unique())
    has_2324 = "2023-24" in found_years
    log_attempt(
        method="Funding cross-ref on disk",
        source="data/raw/nirf_research_projects*.csv",
        script="run_acquisition_marathon.py",
        status="success" if has_2324 else "fail",
        rows_recovered=len(found_years),
        detail=f"academic_years={sorted(found_years)}",
        why_failed="" if has_2324 else "2023-24 academic year absent from all scraped PDF seasons",
        next_retry="Probe 2025 ranking season PDFs when published; re-run 01e on new CDN",
    )


def probe_internet_archive_bulk() -> None:
    """Search IA advancedsearch for nirfindia ranking HTML captures."""
    import requests
    from acquisition._common import DEFAULT_SLEEP, session

    sess = session()
    query = 'collection:web AND nirfindia.org AND Rankings AND 2016'
    url = "https://archive.org/advancedsearch.php"
    params = {"q": query, "fl[]": "identifier,title", "rows": 10, "output": "json"}
    time.sleep(DEFAULT_SLEEP)
    try:
        resp = sess.get(url, params=params, timeout=90)
        data = resp.json()
        docs = data.get("response", {}).get("docs", [])
    except Exception as exc:  # noqa: BLE001
        log_attempt(
            method="Internet Archive bulk search",
            source="archive.org/advancedsearch",
            script="run_acquisition_marathon.py",
            status="fail",
            why_failed=str(exc),
        )
        return
    log_attempt(
        method="Internet Archive bulk search",
        source=f"archive.org?q={query[:60]}",
        script="run_acquisition_marathon.py",
        status="partial" if docs else "fail",
        rows_recovered=len(docs),
        detail=json.dumps([d.get("identifier") for d in docs[:5]]),
        why_failed="" if docs else "No IA items matching 2016 ranking query",
        next_retry="Use wayback CDX per-category URLs (primary path)",
    )


def integrate_recovered(*, dry_run: bool = False) -> dict:
    """Re-run pipeline stages if new ranking/funding CSVs appeared."""
    import pandas as pd
    from nirf_utils import discover_nirf_ranking_years

    cov_path = DATA_DIR / "logs" / "nirf_historical_coverage.json"
    prev_years: list[int] = []
    if cov_path.exists():
        try:
            prev_years = json.loads(cov_path.read_text(encoding="utf-8")).get("ranking_years_on_disk", [])
        except json.JSONDecodeError:
            prev_years = []

    new_years = discover_nirf_ranking_years()
    report: dict = {"ranking_years": new_years, "prev_years": prev_years, "actions": []}
    added_years = [y for y in new_years if y not in prev_years]
    if added_years:
        report["actions"].append(f"new_ranking_years={added_years}")

    if dry_run:
        return report

    if added_years:
        stages = [
            ("03a_enrich_institution_master.py", []),
            ("09_export_payloads.py", []),
            ("09b_export_year_slices.py", []),
        ]
        for script, args in stages:
            rc = subprocess.run(
                [PYTHON, str(SCRIPTS_DIR.parent / script), *args],
                cwd=str(PROJECT_ROOT),
            ).returncode
            report["actions"].append(f"ran {script} rc={rc}")

    # Always refresh funding/patent joins + verification after acquisition
    for script, args in [
        ("01d_prepare_nirf_funding.py", []),
        ("08_join_nirf_funding.py", []),
        ("08b_join_nirf_patents.py", []),
        ("10_verification_checklist.py", []),
    ]:
        rc = subprocess.run(
            [PYTHON, str(SCRIPTS_DIR.parent / script), *args],
            cwd=str(PROJECT_ROOT),
        ).returncode
        report["actions"].append(f"ran {script} rc={rc}")

    # Refresh coverage JSON
    cov_path = DATA_DIR / "logs" / "nirf_historical_coverage.json"
    funding_years: list[str] = []
    fp = RAW_DIR / "nirf_research_projects_scraped.csv"
    if fp.exists():
        df = pd.read_csv(fp)
        if "academic_year" in df.columns:
            funding_years = sorted(df["academic_year"].dropna().astype(str).unique())
    patent_years: list[int] = [2020, 2021, 2022]
    pp = RAW_DIR / "nirf_patents_scraped.csv"
    if pp.exists():
        pdf = pd.read_csv(pp)
        if "calendar_year" in pdf.columns:
            patent_years = sorted(int(y) for y in pdf["calendar_year"].dropna().unique())

    gaps = {
        "ranking_2015": "404 on nirfindia.org; Wayback attempted; not published",
        "ranking_2016_2017": (
            "recovered — 500 rows/season (live+Wayback)"
            if 2016 in new_years and 2017 in new_years
            else "partial recovery"
        ),
        "patents_pre_2020": "Innovation PDF only on 2024 CDN (probed all seasons)",
        "funding_2023_24": "not in any scraped PDF season yet",
    }
    payload = {
        "ranking_seasons": {
            str(y): int(len(pd.read_csv(RAW_DIR / f"nirf_rankings_{y}.csv")))
            for y in new_years
            if (RAW_DIR / f"nirf_rankings_{y}.csv").exists()
        },
        "ranking_years_on_disk": new_years,
        "funding_academic_years": funding_years,
        "funding_seasons_scraped": [2021, 2022, 2023, 2024],
        "patent_calendar_years": patent_years,
        "gaps": gaps,
        "last_acquisition_run": utc_now_iso(),
    }
    cov_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    report["coverage"] = str(cov_path)
    return report


def init_log_md() -> None:
    if LOG_MD.exists():
        return
    header = (
        "# NIRF Data Acquisition Log\n\n"
        "**Internal team memory — not for dashboard.**\n\n"
        f"Marathon started: {utc_now_iso()}\n\n"
        "## Sections\n"
        "- Live nirfindia.org probes\n"
        "- Wayback Machine (2016–2017 rankings)\n"
        "- PDF CDN season probes (Innovation / Overall / Engineering)\n"
        "- data.gov.in / government portals\n"
        "- NIRF press / MoE releases\n"
        "- Third-party mirrors (reference only)\n"
        "- Common Crawl / Internet Archive bulk search\n"
        "- Manual CSV drops\n\n"
        "| Timestamp (UTC) | Method | Source/URL | Script | Rows | Status | Why failed | Next retry |\n"
        "|-----------------|--------|------------|--------|------|--------|------------|------------|\n"
    )
    LOG_MD.parent.mkdir(parents=True, exist_ok=True)
    LOG_MD.write_text(header, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="NIRF acquisition marathon orchestrator")
    parser.add_argument("--only", type=str, default="", help="Comma: live,wayback,cdn,datagov,press,extra,integrate")
    parser.add_argument("--integrate", action="store_true", help="Run pipeline integration after probes")
    parser.add_argument("--skip-run", action="store_true", help="Only extra probes + integrate")
    args = parser.parse_args()

    init_log_md()
    log_attempt(
        method="Marathon start",
        source="run_acquisition_marathon.py",
        script="run_acquisition_marathon.py",
        status="partial",
        detail=f"only={args.only or 'all'}",
    )

    only = {s.strip() for s in args.only.split(",") if s.strip()} if args.only else set()

    if not args.skip_run:
        seen_scripts: set[str] = set()
        for key, script, extra in STEPS:
            if only and key not in only:
                continue
            if script in seen_scripts:
                continue
            seen_scripts.add(script)
            run_script(script, extra)

        if not only or "extra" in only:
            probe_common_crawl()
            log_third_party_reference()
            crossref_funding_2023()
            probe_internet_archive_bulk()

    if args.integrate or "integrate" in only:
        report = integrate_recovered()
        print(f"\nIntegration report: {json.dumps(report, indent=2)}")
        log_attempt(
            method="Pipeline integration",
            source="scripts/india_network pipeline",
            script="run_acquisition_marathon.py",
            status="partial",
            detail=json.dumps(report.get("actions", [])),
        )

    print(f"\nMarathon complete. Log: {LOG_JSON}")
    print(f"Markdown log: {LOG_MD}")


if __name__ == "__main__":
    main()
