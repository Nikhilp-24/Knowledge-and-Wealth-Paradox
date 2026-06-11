#!/usr/bin/env python3
"""Lightweight OpenAlex works fetch — cache pages to disk only (no RAM blow-up).

Old behaviour loaded every cached JSON into memory per institution, then held all
30 institutions in RAM before writing parquet — that hung laptops with tight disk/RAM.

This script:
  - Downloads only *missing* cache pages
  - Skips institutions whose years are already fully cached
  - Never builds works_raw.parquet (run 05b_assemble_works_from_cache.py after)

Resume safely after crash/reboot — cached pages are never re-downloaded.
"""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from config import (  # noqa: E402
    CACHE_DIR,
    PROCESSED_DIR,
    WORK_SELECT,
    YEAR_MAX,
    YEAR_MIN,
    YEAR_RANGE_JSON,
    openalex_fetch_delay_sec,
)
from openalex_http import openalex_get  # noqa: E402

MAX_PAGE = 50


def load_year_max() -> int:
    if YEAR_RANGE_JSON.exists():
        data = json.loads(YEAR_RANGE_JSON.read_text(encoding="utf-8"))
        return int(data["year_max"])
    return YEAR_MAX


def cache_path(inst_id: str, year: int, page: int) -> Path:
    return CACHE_DIR / f"works_{inst_id}_y{year}_page_{page}.json"


def read_meta(inst_id: str, year: int) -> dict | None:
    p1 = cache_path(inst_id, year, 1)
    if not p1.exists():
        return None
    try:
        return json.loads(p1.read_text(encoding="utf-8")).get("meta") or {}
    except (json.JSONDecodeError, OSError):
        return None


def total_pages_for_year(inst_id: str, year: int) -> int:
    meta = read_meta(inst_id, year)
    if not meta:
        return 0
    count = int(meta.get("count") or 0)
    per_page = int(meta.get("per_page") or 200)
    tp = meta.get("total_pages")
    if tp is None:
        tp = max(1, math.ceil(count / per_page)) if count else 1
    return min(int(tp), MAX_PAGE)


def year_is_cached(inst_id: str, year: int) -> bool:
    p1 = cache_path(inst_id, year, 1)
    if not p1.exists():
        return False
    tp = total_pages_for_year(inst_id, year)
    if tp <= 0:
        return False
    if tp == 1:
        return True
    return cache_path(inst_id, year, tp).exists()


def institution_is_cached(inst_id: str, year_max: int) -> bool:
    return all(year_is_cached(inst_id, y) for y in range(YEAR_MIN, year_max + 1))


def download_page(inst_id: str, year: int, page: int) -> None:
    params = {
        "filter": f"institutions.id:{inst_id},publication_year:{year}",
        "select": WORK_SELECT,
        "per_page": 200,
        "page": page,
    }
    resp = openalex_get("works", params, timeout=90, max_retries=5)
    if resp.status_code == 400 and page > MAX_PAGE:
        raise RuntimeError(f"OpenAlex page cap for {inst_id} y{year} page {page}")
    resp.raise_for_status()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path(inst_id, year, page).write_text(resp.text, encoding="utf-8")
    time.sleep(openalex_fetch_delay_sec())


def ensure_year_cached(inst_id: str, year: int) -> int:
    """Download missing pages for one year. Returns number of new pages written."""
    if year_is_cached(inst_id, year):
        return 0

    new_pages = 0
    page = 1
    total_pages = MAX_PAGE

    while page <= total_pages:
        p = cache_path(inst_id, year, page)
        if not p.exists():
            download_page(inst_id, year, page)
            new_pages += 1
        if page == 1:
            total_pages = total_pages_for_year(inst_id, year) or 1
            if total_pages <= 0:
                break
        page += 1

    return new_pages


def ensure_institution_cached(inst_id: str, year_max: int) -> int:
    if institution_is_cached(inst_id, year_max):
        return 0
    return sum(ensure_year_cached(inst_id, y) for y in range(YEAR_MIN, year_max + 1))


def count_cache_files(inst_id: str) -> int:
    return len(list(CACHE_DIR.glob(f"works_{inst_id}_y*.json")))


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--pilot-top", type=int, default=0, metavar="N")
    parser.add_argument(
        "--assemble",
        action="store_true",
        help="Run 05b_assemble_works_from_cache.py when fetch finishes",
    )
    args = parser.parse_args()

    master_path = PROCESSED_DIR / "institution_master.csv"
    if not master_path.exists():
        raise FileNotFoundError("Run 03_build_institution_master.py first")

    master = pd.read_csv(master_path)
    if args.pilot_top > 0:
        master = master[master["tier"] == "premier"].nlargest(args.pilot_top, "total_works")

    year_max = load_year_max()
    print(f"Cache-only fetch {YEAR_MIN}-{year_max} for {len(master)} institutions")
    print("(Does not load works into RAM — safe to resume after reboot)\n")

    done = 0
    for _, row in tqdm(master.iterrows(), total=len(master)):
        inst_id = str(row["openalex_id"])
        name = row.get("canonical_name", inst_id)

        if institution_is_cached(inst_id, year_max):
            tqdm.write(f"  SKIP (complete): {name} [{count_cache_files(inst_id)} files]")
            done += 1
            continue

        before = count_cache_files(inst_id)
        try:
            new = ensure_institution_cached(inst_id, year_max)
        except SystemExit as exc:
            tqdm.write(f"  STOP (API limit?): {name} — {exc}")
            raise
        after = count_cache_files(inst_id)
        tqdm.write(f"  {name}: +{new} new pages ({after} files total, was {before})")
        if institution_is_cached(inst_id, year_max):
            done += 1

    print(f"\nInstitutions fully cached: {done}/{len(master)}")
    total_files = len(list(CACHE_DIR.glob("works_*.json")))
    print(f"Total cache files: {total_files:,} (~{total_files * 1.0:.0f} MB rough est.)")
    print("\nNext (low memory):")
    print("  python scripts/india_network/05b_assemble_works_from_cache.py --pilot-top 30")
    print("  python scripts/india_network/06_build_domestic_edges.py")

    if args.assemble and done == len(master):
        from importlib import import_module

        mod = import_module("05b_assemble_works_from_cache")
        sys.argv = ["05b", *(["--pilot-top", str(args.pilot_top)] if args.pilot_top else [])]
        mod.main()


if __name__ == "__main__":
    main()
