#!/usr/bin/env python3
"""Fetch all Indian education institutions from OpenAlex."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pandas as pd
sys.path.insert(0, str(Path(__file__).parent))
from config import PROCESSED_DIR  # noqa: E402
from openalex_http import openalex_get  # noqa: E402

OUT_PATH = PROCESSED_DIR / "openalex_institutions.parquet"
MIN_WORKS = 1  # filter applied later in master build


def fetch_page(cursor: str | None = None) -> dict:
    params = {
        "filter": "country_code:IN,type:education",
        "per_page": 200,
    }
    if cursor:
        params["cursor"] = cursor
    resp = openalex_get("institutions", params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def flatten_institution(row: dict) -> dict:
    geo = row.get("geo") or {}
    ror = row.get("ror")
    return {
        "openalex_id": (row.get("id") or "").rsplit("/", 1)[-1],
        "display_name": row.get("display_name"),
        "ror_id": ror.rsplit("/", 1)[-1] if ror else None,
        "works_count": row.get("works_count") or 0,
        "cited_by_count": row.get("cited_by_count") or 0,
        "city": geo.get("city"),
        "region": geo.get("region"),
        "latitude": geo.get("latitude"),
        "longitude": geo.get("longitude"),
        "type": row.get("type"),
    }


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    cursor = "*"
    page = 0

    while cursor:
        page += 1
        print(f"Page {page}...", flush=True)
        data = fetch_page(None if cursor == "*" else cursor)
        for inst in data.get("results", []):
            rows.append(flatten_institution(inst))
        cursor = (data.get("meta") or {}).get("next_cursor")
        time.sleep(0.15)

    df = pd.DataFrame(rows)
    df = df[df["works_count"] >= MIN_WORKS].copy()
    df.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(df)} institutions → {OUT_PATH}")


if __name__ == "__main__":
    main()
