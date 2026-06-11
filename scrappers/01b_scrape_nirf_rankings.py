#!/usr/bin/env python3
"""Scrape NIRF ranking tables from nirfindia.org into data/raw/nirf_rankings.csv."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from config import OPENALEX_USER_AGENT, RAW_DIR  # noqa: E402
from nirf_utils import (  # noqa: E402
    NIRF_RANKING_CATEGORIES,
    build_nirf_scrape_gaps_report,
    write_nirf_scrape_gaps,
)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": OPENALEX_USER_AGENT})

INST_ID_RE = re.compile(r"^IR-[A-Z]-[A-Z]-\d+$")


def clean_name(raw: str) -> str:
    name = raw.split("More Details")[0].strip()
    name = re.sub(r"\s+", " ", name)
    return name


def extract_ids_from_table(soup: BeautifulSoup) -> set[str]:
    table = soup.find("table", class_=lambda cls: cls and "table-condensed" in cls)
    if table is None:
        return set()
    ids: set[str] = set()
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        institute_id = tds[0].get_text(" ", strip=True)
        if INST_ID_RE.match(institute_id):
            ids.add(institute_id)
    return ids


def parse_ranking_page(html: str, category: str, year: int) -> tuple[list[dict], set[str]]:
    soup = BeautifulSoup(html, "html.parser")
    web_ids = extract_ids_from_table(soup)
    table = soup.find("table", class_=lambda cls: cls and "table-condensed" in cls)
    if table is None:
        return [], web_ids

    rows: list[dict] = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 10:
            continue
        vals = [td.get_text(" ", strip=True) for td in tds]
        institute_id = vals[0]
        if not INST_ID_RE.match(institute_id):
            continue
        try:
            score = float(vals[9])
            rank = int(float(vals[10]))
        except (ValueError, IndexError):
            continue
        rows.append(
            {
                "institute_id": institute_id,
                "institute_name": clean_name(vals[1]),
                "city": vals[7],
                "state": vals[8],
                "score": score,
                "rank": rank,
                "ranking_category": category,
                "nirf_year": year,
            }
        )
    return rows, web_ids


def fetch_category(year: int, category: str) -> tuple[list[dict], set[str]]:
    url = f"https://www.nirfindia.org/Rankings/{year}/{category}Ranking.html"
    print(f"  Fetching {category} ...")
    resp = SESSION.get(url, timeout=60)
    resp.raise_for_status()
    rows, web_ids = parse_ranking_page(resp.text, category, year)
    print(f"    -> {len(rows)} parsed rows, {len(web_ids)} website IDs")
    return rows, web_ids


def validate_csv_against_website(
    df: pd.DataFrame, year: int, *, source: str = "01b_scrape_nirf_rankings"
) -> dict:
    website_ids_by_category: dict[str, set[str]] = {}
    for category in NIRF_RANKING_CATEGORIES:
        try:
            _, web_ids = fetch_category(year, category)
            website_ids_by_category[category] = web_ids
        except requests.RequestException as exc:
            print(f"  FAILED {category}: {exc}")
    report = build_nirf_scrape_gaps_report(
        df,
        website_ids_by_category=website_ids_by_category,
        year=year,
        source=source,
    )
    gaps_path = write_nirf_scrape_gaps(report)
    missing = len(report["missing_from_csv"])
    mismatched = [
        cat
        for cat, counts in report["category_counts"].items()
        if counts.get("website", 0) != counts.get("csv", 0)
    ]
    print(f"\nScrape gap report -> {gaps_path}")
    print(f"  Missing from CSV: {missing} institute IDs")
    if mismatched:
        print(f"  Category count mismatches: {', '.join(mismatched)}")
    else:
        print("  Category counts match website for all fetched categories")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape NIRF rankings to CSV")
    parser.add_argument("--year", type=int, default=2024, help="NIRF release year (default: 2024)")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output CSV path (default: data/raw/nirf_rankings_{year}.csv + nirf_rankings.csv)",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Diff existing CSV vs NIRF website; write data/logs/nirf_scrape_gaps.json",
    )
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    year_path = RAW_DIR / f"nirf_rankings_{args.year}.csv"
    canonical_path = RAW_DIR / "nirf_rankings.csv"

    if args.validate_only:
        csv_path = year_path if year_path.exists() else canonical_path
        if not csv_path.exists():
            print(f"No rankings CSV at {csv_path}")
            sys.exit(1)
        df = pd.read_csv(csv_path)
        print(f"Validating {csv_path} ({len(df)} rows) against NIRF {args.year} website ...")
        validate_csv_against_website(df, args.year, source="01b_validate_only")
        return

    output_path = args.output or year_path
    all_rows: list[dict] = []
    website_ids_by_category: dict[str, set[str]] = {}
    for category in NIRF_RANKING_CATEGORIES:
        try:
            rows, web_ids = fetch_category(args.year, category)
            all_rows.extend(rows)
            website_ids_by_category[category] = web_ids
        except requests.RequestException as exc:
            print(f"  FAILED {category}: {exc}")

    if not all_rows:
        print("No rows scraped. Check network or NIRF site layout.")
        sys.exit(1)

    df = pd.DataFrame(all_rows).drop_duplicates(
        subset=["institute_id", "ranking_category", "nirf_year"]
    )
    df = df.sort_values(["ranking_category", "rank", "institute_name"]).reset_index(drop=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    update_canonical = True
    if canonical_path.exists() and output_path.resolve() != canonical_path.resolve():
        try:
            existing_year = int(pd.read_csv(canonical_path, usecols=["nirf_year"])["nirf_year"].iloc[0])
            if args.year < existing_year:
                update_canonical = False
        except (ValueError, KeyError, IndexError):
            pass
    if update_canonical or output_path.resolve() == canonical_path.resolve():
        df.to_csv(canonical_path, index=False)
        print(f"Canonical copy -> {canonical_path} (year {args.year})")
    else:
        print(f"Left canonical copy at {existing_year} (newer than scraped {args.year})")

    print(f"\nWrote {len(df):,} rows -> {output_path}")
    print(f"Categories: {df['ranking_category'].nunique()}")
    print(f"Unique institutes: {df['institute_id'].nunique()}")
    print(f"NIRF year in file: {args.year}")
    print("Note: Innovation category often has 0 rows (different page layout) — not blocking.")

    validate_csv_against_website(df, args.year)


if __name__ == "__main__":
    main()
