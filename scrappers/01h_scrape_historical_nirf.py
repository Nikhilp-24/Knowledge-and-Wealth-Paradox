#!/usr/bin/env python3
"""Scrape historical NIRF ranking seasons and optional multi-season funding PDFs.

Resume-safe: skips years already cached in data/raw/nirf_rankings_{year}.csv.
Legacy layout (2016–2018): institute IDs use IR-N-… format — rows stored with
name-based matching at export time.

Funding: re-scrapes 2021–2023 CDN seasons to extend academic years to 2017-18..2022-23.
Patents: Innovation PDFs only exist on 2024 CDN — not scraped here.

Usage:
  python scripts/india_network/01h_scrape_historical_nirf.py --ranks-only
  python scripts/india_network/01h_scrape_historical_nirf.py --funding-only --limit 20
  python scripts/india_network/01h_scrape_historical_nirf.py
"""
from __future__ import annotations

import argparse
import importlib
import io
import json
import re
import sys
import time
from pathlib import Path

import pandas as pd
import pdfplumber
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR, OPENALEX_USER_AGENT, PROCESSED_DIR, RAW_DIR  # noqa: E402
from nirf_utils import (  # noqa: E402
    NIRF_RANKING_CATEGORIES,
    candidate_pdf_urls,
    discover_nirf_ranking_years,
    funding_row_id_name_valid,
    load_nirf_categories,
    load_nirf_id_canonical_names,
    load_nirf_id_overrides,
    nirf_pdf_base,
)

_01b = importlib.import_module("01b_scrape_nirf_rankings")
_01e = importlib.import_module("01e_scrape_nirf_funding_from_pdfs")

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": OPENALEX_USER_AGENT})

CACHE_DIR = DATA_DIR / "cache" / "nirf"
COVERAGE_PATH = DATA_DIR / "logs" / "nirf_historical_coverage.json"

INST_ID_MODERN = re.compile(r"^IR-[A-Z]-[A-Z]-\d+$")
INST_ID_LEGACY = re.compile(r"^IR-\d+-[A-Z]-[A-Z]+-[A-Z]-\d+$")

DEFAULT_RANK_YEARS = list(range(2016, 2025))  # 2015 returns 404 on nirfindia.org
DEFAULT_FUNDING_SEASONS = [2021, 2022, 2023, 2024]


def clean_name(raw: str) -> str:
    name = raw.split("More Details")[0].strip()
    return re.sub(r"\s+", " ", name)


def parse_legacy_ranking_page(html: str, category: str, year: int) -> list[dict]:
    """2016–2018 tables: IR-2-E-OE-U-0456 style IDs, rank in last column."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        return []
    rows: list[dict] = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue
        institute_id = tds[0].get_text(" ", strip=True)
        if not (INST_ID_LEGACY.match(institute_id) or INST_ID_MODERN.match(institute_id)):
            continue
        vals = [td.get_text(" ", strip=True) for td in tds]
        try:
            rank = int(float(vals[-1]))
        except (ValueError, IndexError):
            continue
        score = 0.0
        for v in vals[2:-1]:
            try:
                score = float(v)
                break
            except ValueError:
                continue
        rows.append(
            {
                "institute_id": institute_id,
                "institute_name": clean_name(vals[1]),
                "city": "",
                "state": "",
                "score": score,
                "rank": rank,
                "ranking_category": category,
                "nirf_year": year,
            }
        )
    return rows


def fetch_ranking_year(year: int, *, force: bool = False) -> tuple[int, str]:
    out_path = RAW_DIR / f"nirf_rankings_{year}.csv"
    if out_path.exists() and not force:
        df = pd.read_csv(out_path)
        return len(df), f"cached {out_path.name}"

    all_rows: list[dict] = []
    for category in NIRF_RANKING_CATEGORIES:
        url = f"https://www.nirfindia.org/Rankings/{year}/{category}Ranking.html"
        try:
            resp = SESSION.get(url, timeout=60)
            if resp.status_code == 404:
                continue
            resp.raise_for_status()
            if year <= 2018:
                rows = parse_legacy_ranking_page(resp.text, category, year)
            else:
                rows, _ = _01b.parse_ranking_page(resp.text, category, year)
            all_rows.extend(rows)
            time.sleep(0.25)
        except requests.RequestException as exc:
            print(f"    {category} FAILED: {exc}")

    if not all_rows:
        return 0, f"no rows for {year}"

    df = pd.DataFrame(all_rows).drop_duplicates(
        subset=["institute_id", "ranking_category", "nirf_year"]
    )
    df = df.sort_values(["ranking_category", "rank", "institute_name"]).reset_index(drop=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    return len(df), f"wrote {out_path.name}"


def scrape_rankings(years: list[int], *, force: bool = False) -> dict[int, int]:
    counts: dict[int, int] = {}
    for year in years:
        print(f"Rankings {year} ...")
        n, msg = fetch_ranking_year(year, force=force)
        counts[year] = n
        print(f"  -> {n} rows ({msg})")
    return counts


def build_funding_targets(limit: int) -> pd.DataFrame:
    master = pd.read_csv(PROCESSED_DIR / "institution_master.csv")
    overrides = load_nirf_id_overrides()
    rows = []
    seen: set[str] = set()
    for _, row in master.iterrows():
        name = row["canonical_name"]
        iid = row.get("nirf_institute_id")
        if pd.isna(iid) and name in overrides:
            iid = overrides[name]
        if pd.isna(iid):
            continue
        iid = str(iid).strip()
        if iid in seen:
            continue
        seen.add(iid)
        rows.append(
            {
                "institution_id": row["institution_id"],
                "canonical_name": name,
                "nirf_institute_id": iid,
                "state": row.get("state"),
                "city": row.get("city"),
            }
        )
    df = pd.DataFrame(rows)
    if limit > 0:
        df = df.head(limit)
    return df


def scrape_funding_seasons(
    seasons: list[int],
    *,
    limit: int = 0,
    sleep: float = 0.35,
) -> pd.DataFrame:
    targets = build_funding_targets(limit)
    cat_map = load_nirf_categories()
    id_to_name = load_nirf_id_canonical_names()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    all_rows: list[dict] = []

    for season in seasons:
        print(f"Funding PDF season {season} ({nirf_pdf_base(season)}) ...")
        for _, row in targets.iterrows():
            iid = str(row["nirf_institute_id"]).strip()
            name = row["canonical_name"]
            cache_key = CACHE_DIR / f"funding_{season}_{iid}.json"
            if cache_key.exists():
                cached = json.loads(cache_key.read_text(encoding="utf-8"))
                if cached.get("rows"):
                    all_rows.extend(cached["rows"])
                    continue

            cats = cat_map.get(iid, ["Overall", "Engineering", "University", "Medical", "Research"])
            pdf_ok = False
            season_rows: list[dict] = []
            for cat, url in candidate_pdf_urls(iid, cats, season=season):
                try:
                    resp = SESSION.get(url, timeout=45)
                    if resp.status_code != 200 or len(resp.content) < 500:
                        continue
                    parsed = _01e.extract_sponsored_research(resp.content)
                    if not parsed:
                        continue
                    for p in parsed:
                        season_rows.append(
                            {
                                "ranking_year": season,
                                "ranking_category": cat,
                                "institute_id": iid,
                                "institute_name": id_to_name.get(iid, name),
                                "state": row.get("state"),
                                "city": row.get("city"),
                                **p,
                            }
                        )
                    pdf_ok = True
                    break
                except requests.RequestException:
                    pass
                time.sleep(sleep)
            cache_key.write_text(json.dumps({"rows": season_rows}), encoding="utf-8")
            if pdf_ok:
                all_rows.extend(season_rows)
                print(f"  OK {name[:45]} ({season})")
            else:
                print(f"  MISS {name[:45]} ({season})")

    if not all_rows:
        return pd.DataFrame()

    df = pd.DataFrame(all_rows)
    id_to_name = load_nirf_id_canonical_names()
    df = df[
        df.apply(
            lambda r: funding_row_id_name_valid(
                str(r["institute_id"]),
                str(r["institute_name"]),
                id_to_name,
            ),
            axis=1,
        )
    ]
    return df


def merge_funding_output(new_df: pd.DataFrame) -> Path:
    alias = RAW_DIR / "nirf_research_projects.csv"
    out = RAW_DIR / "nirf_research_projects_scraped.csv"
    frames = []
    if alias.exists():
        frames.append(pd.read_csv(alias))
    if not new_df.empty:
        frames.append(new_df)
    if not frames:
        raise SystemExit("No funding rows to merge")
    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates(
        subset=["institute_id", "academic_year", "category", "value", "ranking_year"],
        keep="last",
    )
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    df.to_csv(alias, index=False)
    return out


def write_coverage(rank_counts: dict[int, int], funding_df: pd.DataFrame | None) -> Path:
    funding_years: list[str] = []
    if funding_df is not None and not funding_df.empty and "academic_year" in funding_df.columns:
        funding_years = sorted(funding_df["academic_year"].dropna().astype(str).unique())
    payload = {
        "ranking_seasons": {str(y): rank_counts.get(y, 0) for y in sorted(rank_counts)},
        "ranking_years_on_disk": discover_nirf_ranking_years(),
        "funding_academic_years": funding_years,
        "funding_seasons_scraped": DEFAULT_FUNDING_SEASONS,
        "patent_calendar_years": [2020, 2021, 2022],
        "gaps": {
            "ranking_2015": "404 on nirfindia.org",
            "ranking_2016_2018": "legacy ID format; name match at export",
            "patents_pre_2020": "Innovation PDF only on 2024 CDN",
            "funding_2023_24": "not in any scraped PDF season yet",
        },
    }
    COVERAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    COVERAGE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return COVERAGE_PATH


def main() -> None:
    parser = argparse.ArgumentParser(description="Historical NIRF ranks + multi-season funding")
    parser.add_argument("--years", type=str, default="", help="Ranking years comma-sep (default 2016-2024)")
    parser.add_argument("--force-ranks", action="store_true", help="Re-scrape even if CSV exists")
    parser.add_argument("--ranks-only", action="store_true")
    parser.add_argument("--funding-only", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max institutes for funding scrape")
    parser.add_argument("--sleep", type=float, default=0.35)
    args = parser.parse_args()

    years = DEFAULT_RANK_YEARS
    if args.years.strip():
        years = [int(y.strip()) for y in args.years.split(",") if y.strip().isdigit()]

    rank_counts: dict[int, int] = {}
    funding_df: pd.DataFrame | None = None

    if not args.funding_only:
        rank_counts = scrape_rankings(years, force=args.force_ranks)

    if not args.ranks_only:
        funding_df = scrape_funding_seasons(DEFAULT_FUNDING_SEASONS, limit=args.limit, sleep=args.sleep)
        if funding_df is not None and not funding_df.empty:
            path = merge_funding_output(funding_df)
            yrs = sorted(funding_df["academic_year"].dropna().unique())
            print(f"\nMerged funding -> {path} ({len(funding_df):,} new rows, years {yrs})")
        else:
            print("\nNo new funding rows (cache hit or all misses)")

    cov = write_coverage(rank_counts, funding_df)
    print(f"Coverage report -> {cov}")


if __name__ == "__main__":
    main()
