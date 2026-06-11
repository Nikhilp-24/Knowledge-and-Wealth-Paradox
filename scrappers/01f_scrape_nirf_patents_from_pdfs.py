#!/usr/bin/env python3
"""Scrape NIRF patent counts from official Innovation-category PDFs (free, no Dataful).

Patent published/granted counts appear in Innovation PDFs, not Overall/Engineering PDFs.
Source: https://www.nirfindia.org/nirfpdfcdn/{year}/pdf/Innovation/{institute_id}.pdf

Output: data/raw/nirf_patents_scraped.csv (long format, compatible with 01g_prepare_nirf_patents.py)
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
from nirf_utils import NIRF_YEAR, innovation_pdf_url, load_nirf_id_overrides  # noqa: E402

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": OPENALEX_USER_AGENT})

OUT_PATH = RAW_DIR / "nirf_patents_scraped.csv"
ALIAS_PATH = RAW_DIR / "nirf_patents.csv"

CAL_YEAR_RE = re.compile(r"\b(20\d{2})\b")
NUM_RE = re.compile(r"[\d,]+")


def parse_ints(raw: str) -> list[int]:
    out = []
    for m in NUM_RE.findall(raw):
        try:
            out.append(int(m.replace(",", "")))
        except ValueError:
            continue
    return out


def extract_patents(pdf_bytes: bytes) -> list[dict]:
    text = ""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"

    low = text.lower()
    start = low.find("patents")
    if start < 0:
        return []
    block = text[start : start + 1800]
    commercial = block.lower().find("patents commercialized")
    if commercial > 0:
        block = block[:commercial]

    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    year_line = next((ln for ln in lines if "calendar year" in ln.lower()), "")
    years = CAL_YEAR_RE.findall(year_line)
    if not years:
        return []

    rows: list[dict] = []
    metrics = {
        "no. of patents published": "Number of Patents Published",
        "no. of patents granted": "Number of Patents Granted",
    }
    for ln in lines:
        ln_low = ln.lower()
        for key, sub_category in metrics.items():
            if key in ln_low:
                nums = parse_ints(ln.split(key, 1)[-1])
                for i, yr in enumerate(years):
                    if i >= len(nums):
                        break
                    rows.append(
                        {
                            "calendar_year": yr,
                            "category": "Patents",
                            "sub_category": sub_category,
                            "value": nums[i],
                            "unit": "value in Absolute Number",
                        }
                    )
                break
    return rows


def build_targets(master: pd.DataFrame) -> pd.DataFrame:
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
                "canonical_name": name,
                "nirf_institute_id": iid,
                "state": row.get("state"),
                "city": row.get("city"),
            }
        )
    return pd.DataFrame(rows)


def _load_existing_scraped() -> pd.DataFrame:
    if OUT_PATH.exists():
        return pd.read_csv(OUT_PATH)
    return pd.DataFrame()


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--sleep", type=float, default=0.35)
    args = parser.parse_args()

    master = pd.read_csv(PROCESSED_DIR / "institution_master.csv")
    targets = build_targets(master)
    existing = _load_existing_scraped()
    already_ok: set[str] = set()
    if not existing.empty and "institute_id" in existing.columns:
        already_ok = set(existing["institute_id"].astype(str).str.strip())

    if args.limit > 0:
        targets = targets.head(args.limit)

    all_rows: list[dict] = list(existing.to_dict("records")) if not existing.empty else []
    ok = len(already_ok)
    miss = 0
    skip = 0

    for _, row in targets.iterrows():
        iid = str(row["nirf_institute_id"]).strip()
        name = row["canonical_name"]
        if iid in already_ok:
            skip += 1
            continue
        url = innovation_pdf_url(iid)
        try:
            resp = SESSION.get(url, timeout=45)
            if resp.status_code != 200 or len(resp.content) < 5000:
                miss += 1
                print(f"  MISS {name[:45]} (no Innovation PDF)")
                time.sleep(args.sleep)
                continue
            parsed = extract_patents(resp.content)
            if not parsed:
                miss += 1
                print(f"  MISS {name[:45]} (PDF without patent table)")
                time.sleep(args.sleep)
                continue
            for p in parsed:
                all_rows.append(
                    {
                        "ranking_year": NIRF_YEAR,
                        "institute_id": iid,
                        "institute_name": name,
                        "state": row.get("state"),
                        "city": row.get("city"),
                        **p,
                    }
                )
            ok += 1
            print(f"  OK {name[:45]} ({len(parsed)} rows)")
        except requests.RequestException as exc:
            miss += 1
            print(f"  net {name[:30]}: {exc}")
        time.sleep(args.sleep)

    if not all_rows:
        print("No patent rows extracted from Innovation PDFs.")
        sys.exit(1)

    df = pd.DataFrame(all_rows)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)
    df.to_csv(ALIAS_PATH, index=False)
    print(f"\nWrote {len(df):,} rows -> {OUT_PATH}")
    print(f"Also -> {ALIAS_PATH}")
    print(f"Institutes with patents: {ok} | skipped (cached): {skip} | missed: {miss}")


if __name__ == "__main__":
    main()
