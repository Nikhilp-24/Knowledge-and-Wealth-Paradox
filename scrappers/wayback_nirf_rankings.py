#!/usr/bin/env python3
"""Fetch NIRF 2016–2017 ranking HTML from Wayback Machine; write per-year CSVs if rows found.

Resume-safe: skips years already on disk unless --force.
Cache: data/cache/nirf/acquisition/wayback_*
"""
from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition._common import (  # noqa: E402
    CACHE_DIR,
    DEFAULT_SLEEP,
    RAW_DIR,
    cached_get,
    log_attempt,
    session,
    utc_now_iso,
)
from nirf_utils import NIRF_RANKING_CATEGORIES  # noqa: E402

_01h = importlib.import_module("01h_scrape_historical_nirf")
_01b = importlib.import_module("01b_scrape_nirf_rankings")


def clean_name(raw: str) -> str:
    name = raw.split("More Details")[0].strip()
    return re.sub(r"\s+", " ", name)

CDX_API = "https://web.archive.org/cdx/search/cdx"
WAYBACK_BASE = "https://web.archive.org/web"

TARGET_YEARS = [2016, 2017]
SNAPSHOT_HINTS = ["201704", "201705", "201706", "201801", "201802", "201803", "201901"]


def cdx_snapshots(url: str, limit: int = 10) -> list[str]:
    params = {
        "url": url,
        "output": "json",
        "filter": "statuscode:200",
        "limit": str(limit),
    }
    sess = session()
    time.sleep(DEFAULT_SLEEP)
    try:
        resp = sess.get(CDX_API, params=params, timeout=90)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, json.JSONDecodeError):
        return []
    if len(data) < 2:
        return []
    # columns: urlkey, timestamp, original, mimetype, statuscode, digest, length
    timestamps = [row[1] for row in data[1:] if len(row) > 1]
    return timestamps


def fetch_wayback_html(original_url: str, timestamp: str) -> str | None:
    wayback_url = f"{WAYBACK_BASE}/{timestamp}id_/{original_url}"
    cache_name = f"wayback_{timestamp}_{original_url.replace('://', '_').replace('/', '_')[:120]}.html"
    sess = session()
    resp, path = cached_get(sess, wayback_url, cache_name=cache_name, sleep=DEFAULT_SLEEP)
    if resp is None or resp.status_code != 200:
        return None
    text = resp.text if hasattr(resp, "text") else (path.read_text(encoding="utf-8", errors="replace") if path and path.exists() else "")
    if len(text) < 500:
        return None
    return text


INST_ID_MODERN = re.compile(r"^IR-[A-Z]-[A-Z]-\d+$")
INST_ID_LEGACY = re.compile(r"^IR-\d+-[A-Z]-[A-Z]+-[A-Z]-\d+$")
INST_ID_SEASON = re.compile(r"^IR\d{2}-[A-Z0-9-]+$")  # e.g. IR17-I-2-18633 (2017 NIRF)


def parse_season_ranking_page(html: str, category: str, year: int) -> list[dict]:
    """2016–2017 tables: IR17-I-2-18633 style IDs; rank in last column."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        return []
    rows: list[dict] = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 4:
            continue
        institute_id = tds[0].get_text(" ", strip=True)
        if not (
            INST_ID_LEGACY.match(institute_id)
            or INST_ID_MODERN.match(institute_id)
            or INST_ID_SEASON.match(institute_id)
        ):
            continue
        name_cell = tds[1].get_text(" ", strip=True)
        name = clean_name(name_cell)
        if len(tds) >= 6:
            city = tds[2].get_text(" ", strip=True)
            state = tds[3].get_text(" ", strip=True)
            try:
                score = float(tds[4].get_text(" ", strip=True))
                rank = int(float(tds[5].get_text(" ", strip=True)))
            except (ValueError, IndexError):
                continue
        else:
            city = state = ""
            try:
                score = float(tds[-2].get_text(" ", strip=True))
                rank = int(float(tds[-1].get_text(" ", strip=True)))
            except (ValueError, IndexError):
                continue
        rows.append(
            {
                "institute_id": institute_id,
                "institute_name": name,
                "city": city,
                "state": state,
                "score": score,
                "rank": rank,
                "ranking_category": category,
                "nirf_year": year,
            }
        )
    return rows


def parse_html(html: str, category: str, year: int) -> list[dict]:
    if year <= 2017:
        rows = parse_season_ranking_page(html, category, year)
        if rows:
            return rows
    if year <= 2018:
        return _01h.parse_legacy_ranking_page(html, category, year)
    rows, _ = _01b.parse_ranking_page(html, category, year)
    return rows


def scrape_year(year: int, *, force: bool = False) -> tuple[int, str]:
    out_path = RAW_DIR / f"nirf_rankings_{year}.csv"
    if out_path.exists() and not force:
        n = len(pd.read_csv(out_path))
        log_attempt(
            method="Wayback Machine",
            source=f"nirfindia.org/Rankings/{year}/",
            script="wayback_nirf_rankings.py",
            status="success",
            rows_recovered=n,
            detail=f"cached {out_path.name}",
        )
        return n, f"cached ({n} rows)"

    all_rows: list[dict] = []
    attempts: list[str] = []

    # Live nirfindia.org first for 2016–2017 (often still hosted; faster than Wayback)
    sess = session()
    for category in NIRF_RANKING_CATEGORIES:
        live_url = f"https://www.nirfindia.org/Rankings/{year}/{category}Ranking.html"
        time.sleep(DEFAULT_SLEEP)
        try:
            resp = sess.get(live_url, timeout=60)
            if resp.status_code == 200:
                rows = parse_html(resp.text, category, year)
                if rows:
                    all_rows.extend(rows)
                    attempts.append(f"{category}: live {len(rows)} rows")
        except requests.RequestException as exc:
            attempts.append(f"{category}: live error {exc}")

    if all_rows:
        df = pd.DataFrame(all_rows).drop_duplicates(
            subset=["institute_id", "ranking_category", "nirf_year"]
        )
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        df.to_csv(out_path, index=False)
        log_attempt(
            method="Live nirfindia.org",
            source=f"nirfindia.org/Rankings/{year}/",
            script="wayback_nirf_rankings.py",
            status="success" if len(df) > 100 else "partial",
            rows_recovered=len(df),
            detail="; ".join(attempts),
            force=True,
        )
        return len(df), f"live wrote {out_path.name}"

    for category in NIRF_RANKING_CATEGORIES:
        live_url = f"https://www.nirfindia.org/Rankings/{year}/{category}Ranking.html"
        timestamps = cdx_snapshots(live_url, limit=8)
        # Prefer captures near ranking release
        timestamps.sort(key=lambda ts: (
            0 if any(h in ts for h in SNAPSHOT_HINTS) else 1,
            ts,
        ))
        if not timestamps:
            attempts.append(f"{category}: no CDX snapshots")
            continue

        got = False
        for ts in timestamps[:5]:
            html = fetch_wayback_html(live_url, ts)
            if not html:
                continue
            rows = parse_html(html, category, year)
            if rows:
                all_rows.extend(rows)
                attempts.append(f"{category}: {len(rows)} rows @ {ts}")
                got = True
                break
        if not got:
            attempts.append(f"{category}: snapshots exist but parse=0")

    if not all_rows:
        log_attempt(
            method="Wayback Machine",
            source=f"nirfindia.org/Rankings/{year}/",
            script="wayback_nirf_rankings.py",
            status="fail",
            rows_recovered=0,
            why_failed="; ".join(attempts) or "no CDX captures",
            next_retry="Try Internet Archive bulk search or alternate snapshot dates",
        )
        return 0, "no rows"

    df = pd.DataFrame(all_rows).drop_duplicates(
        subset=["institute_id", "ranking_category", "nirf_year"]
    )
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    status = "success" if len(df) > 100 else "partial"
    log_attempt(
        method="Wayback Machine",
        source=f"nirfindia.org/Rankings/{year}/",
        script="wayback_nirf_rankings.py",
        status=status,
        rows_recovered=len(df),
        detail="; ".join(attempts),
        extra={"categories": df["ranking_category"].value_counts().to_dict()},
    )
    return len(df), f"wrote {out_path.name}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Wayback NIRF rankings 2016-2017")
    parser.add_argument("--years", type=str, default="2016,2017")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    years = [int(y.strip()) for y in args.years.split(",") if y.strip().isdigit()]
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Wayback NIRF rankings — {utc_now_iso()}")
    for year in years:
        n, msg = scrape_year(year, force=args.force)
        print(f"  {year}: {n} rows — {msg}")


if __name__ == "__main__":
    main()
