#!/usr/bin/env python3
"""Scrape NIRF sponsored-research funding from official institute PDFs (free, no Dataful).

Source: https://www.nirfindia.org/nirfpdfcdn/{year}/pdf/{Category}/{institute_id}.pdf
Output: data/raw/nirf_research_projects_scraped.csv (compatible with 01d_prepare_nirf_funding.py)
"""
from __future__ import annotations

import io
import re
import sys
import time
from pathlib import Path

import pandas as pd
import pdfplumber
import requests

sys.path.insert(0, str(Path(__file__).parent))
from config import OPENALEX_USER_AGENT, PROCESSED_DIR, RAW_DIR  # noqa: E402
from nirf_utils import (  # noqa: E402
    NIRF_YEAR,
    candidate_pdf_urls,
    funding_row_id_name_valid,
    load_nirf_categories,
    load_nirf_id_canonical_names,
    load_nirf_id_overrides,
)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": OPENALEX_USER_AGENT})

OUT_PATH = RAW_DIR / "nirf_research_projects_scraped.csv"
ALIAS_PATH = RAW_DIR / "nirf_research_projects.csv"

FIN_YEAR_RE = re.compile(r"(\d{4})-(\d{2})")
NUM_RE = re.compile(r"[\d,]+")


def parse_amount(raw: str) -> float | None:
    m = NUM_RE.search(raw.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def extract_sponsored_research(pdf_bytes: bytes) -> list[dict]:
    text = ""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"

    low = text.lower()
    start = low.find("sponsored research")
    if start < 0:
        return []
    block = text[start : start + 2500]
    # Stop before consultancy — otherwise consultancy amounts duplicate as research.
    consult = block.lower().find("consultancy")
    if consult > 0:
        block = block[:consult]

    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    if len(lines) < 3:
        return []

    header_idx = next((i for i, ln in enumerate(lines) if "financial year" in ln.lower()), 1)
    header = lines[header_idx]
    years = FIN_YEAR_RE.findall(header)
    if not years:
        return []

    year_labels = [f"{a}-{b}" for a, b in years]
    rows: list[dict] = []

    metrics = {
        "Number of sponsored projects": "Number of sponsored projects",
        "Total no. of Sponsored Projects": "Number of sponsored projects",
        "Total Amount Received": "Amount received (INR)",
    }

    for ln in lines[header_idx + 1 : header_idx + 12]:
        for key, category in metrics.items():
            if key.lower() in ln.lower():
                nums = re.findall(r"[\d,]+", ln.split(key, 1)[-1])
                for i, yr in enumerate(year_labels):
                    if i >= len(nums):
                        break
                    val = parse_amount(nums[i])
                    if val is None:
                        continue
                    rows.append(
                        {
                            "academic_year": yr,
                            "category": category,
                            "value": val,
                            "unit": "value in Absolute Number"
                            if "projects" in category.lower()
                            else "value in Rupees",
                        }
                    )
                break
    return rows


def build_scrape_targets(master: pd.DataFrame) -> pd.DataFrame:
    overrides = load_nirf_id_overrides()
    rows = []
    seen_ids: set[str] = set()
    for _, row in master.iterrows():
        name = row["canonical_name"]
        iid = row.get("nirf_institute_id")
        if pd.isna(iid) and name in overrides:
            iid = overrides[name]
        if pd.isna(iid):
            continue
        iid = str(iid).strip()
        if iid in seen_ids:
            continue
        seen_ids.add(iid)
        rows.append(
            {
                "institution_id": row["institution_id"],
                "canonical_name": name,
                "nirf_institute_id": iid,
                "state": row.get("state"),
                "city": row.get("city"),
            }
        )
    return pd.DataFrame(rows)


def _valid_funding_ids(path: Path) -> set[str]:
    """Institute IDs with at least one row whose name matches NIRF rankings."""
    if not path.exists():
        return set()
    df = pd.read_csv(path)
    if "institute_id" not in df.columns or "institute_name" not in df.columns:
        return set()
    id_to_name = load_nirf_id_canonical_names()
    valid: set[str] = set()
    for iid, grp in df.groupby("institute_id"):
        iid = str(iid).strip()
        if any(
            funding_row_id_name_valid(iid, str(row["institute_name"]), id_to_name)
            for _, row in grp.iterrows()
        ):
            valid.add(iid)
    return valid


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Max institutes (0=all with nirf id)")
    parser.add_argument("--sleep", type=float, default=0.35, help="Seconds between PDF requests")
    parser.add_argument("--only-missing", action="store_true", help="Scrape institutes absent from raw CSV")
    args = parser.parse_args()

    master = pd.read_csv(PROCESSED_DIR / "institution_master.csv")
    targets = build_scrape_targets(master)
    if args.only_missing and ALIAS_PATH.exists():
        have = _valid_funding_ids(ALIAS_PATH)
        targets = targets[~targets["nirf_institute_id"].isin(have)]
        print(f"Only missing (no valid funding row): {len(targets)} institutes to scrape")
    if args.limit > 0:
        targets = targets.head(args.limit)

    cat_map = load_nirf_categories()
    id_to_name = load_nirf_id_canonical_names()
    all_rows: list[dict] = []
    ok = 0
    fail = 0

    for _, row in targets.iterrows():
        iid = str(row["nirf_institute_id"]).strip()
        name = row["canonical_name"]
        cats = cat_map.get(iid, ["Overall", "Engineering", "University", "Medical", "Research"])
        pdf_ok = False
        for cat, url in candidate_pdf_urls(iid, cats):
            try:
                resp = SESSION.get(url, timeout=45)
                if resp.status_code != 200 or len(resp.content) < 500:
                    continue
                parsed = extract_sponsored_research(resp.content)
                if not parsed:
                    continue
                for p in parsed:
                    all_rows.append(
                        {
                            "ranking_year": NIRF_YEAR,
                            "ranking_category": cat,
                            "institute_id": iid,
                            "institute_name": id_to_name.get(iid, name),
                            "state": row.get("state"),
                            "city": row.get("city"),
                            **p,
                        }
                    )
                pdf_ok = True
                ok += 1
                print(f"  OK {name[:50]} ({cat})")
                break
            except requests.RequestException as exc:
                print(f"  net {name[:30]}: {exc}")
            time.sleep(args.sleep)
        if not pdf_ok:
            fail += 1
            print(f"  MISS {name[:50]}")

    if not all_rows:
        print("No funding rows extracted.")
        sys.exit(1)

    new_df = pd.DataFrame(all_rows)
    if args.only_missing and ALIAS_PATH.exists():
        old = pd.read_csv(ALIAS_PATH)
        id_to_name = load_nirf_id_canonical_names()
        old = old[
            old.apply(
                lambda row: funding_row_id_name_valid(
                    str(row["institute_id"]),
                    str(row["institute_name"]),
                    id_to_name,
                ),
                axis=1,
            )
        ]
        scraped_ids = set(new_df["institute_id"].astype(str))
        old = old[~old["institute_id"].astype(str).isin(scraped_ids)]
        df = pd.concat([old, new_df], ignore_index=True)
        df = df.drop_duplicates(
            subset=["institute_id", "academic_year", "category", "value"], keep="last"
        )
    else:
        df = new_df

    id_to_name = load_nirf_id_canonical_names()
    before = len(df)
    df = df[
        df.apply(
            lambda row: funding_row_id_name_valid(
                str(row["institute_id"]),
                str(row["institute_name"]),
                id_to_name,
            ),
            axis=1,
        )
    ]
    dropped = before - len(df)
    if dropped:
        print(f"  Dropped {dropped:,} invalid institute_id/name rows from output")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)
    df.to_csv(ALIAS_PATH, index=False)
    print(f"\nWrote {len(df):,} rows -> {OUT_PATH}")
    print(f"Also -> {ALIAS_PATH} (for 01d/08 pipeline)")
    print(f"Institutes OK this run: {ok} | missed: {fail}")
    print(f"Unique institutes in output: {df['institute_id'].nunique()}")


if __name__ == "__main__":
    main()
