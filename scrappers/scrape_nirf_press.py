#!/usr/bin/env python3
"""Scrape nirfindia.org news/press and related MoE pages for ranking PDFs or tables."""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition._common import (  # noqa: E402
    CACHE_DIR,
    DEFAULT_SLEEP,
    EXTERNAL_DIR,
    cached_get,
    log_attempt,
    session,
    utc_now_iso,
)

SEED_URLS = [
    "https://www.nirfindia.org/",
    "https://www.nirfindia.org/Rankings/",
    "https://www.nirfindia.org/News/",
    "https://www.nirfindia.org/PressRelease/",
    "https://www.nirfindia.org/sitemap.xml",
    "https://www.nirfindia.org/robots.txt",
    "https://www.education.gov.in/en/nirf",
    "https://pib.gov.in/Search.aspx?Search=NIRF",
]

PDF_RE = re.compile(r"https?://[^\s\"']+\.pdf", re.I)
RANKING_RE = re.compile(r"/Rankings/\d{4}/", re.I)
NIRF_LINK_RE = re.compile(r"nirf|ranking", re.I)


def extract_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        full = urljoin(base_url, href)
        links.append(full)
    return links


def classify_url(url: str) -> str:
    if PDF_RE.search(url):
        return "pdf"
    if RANKING_RE.search(url):
        return "ranking_page"
    if "nirfpdfcdn" in url:
        return "cdn_pdf"
    return "other"


def probe_url(url: str) -> dict:
    sess = session()
    cache_name = f"press_{urlparse(url).netloc}_{url.replace('://', '_').replace('/', '_')[:100]}.html"
    resp, path = cached_get(sess, url, cache_name=cache_name, sleep=DEFAULT_SLEEP, timeout=90)
    result: dict = {"url": url, "status": resp.status_code if resp else 0, "links": [], "pdfs": []}
    if resp is None or resp.status_code != 200:
        result["error"] = "fetch failed"
        return result
    text = resp.text if hasattr(resp, "text") else path.read_text(encoding="utf-8", errors="replace")
    links = extract_links(text, url)
    pdfs = list({m.group(0) for m in PDF_RE.finditer(text)})
    ranking_links = [ln for ln in links if classify_url(ln) == "ranking_page"]
    cdn_links = [ln for ln in links if "nirfpdfcdn" in ln]
    result["links"] = links[:50]
    result["pdfs"] = pdfs
    result["ranking_links"] = ranking_links[:30]
    result["cdn_links"] = cdn_links[:30]
    result["nirf_mentions"] = len([ln for ln in links if NIRF_LINK_RE.search(ln)])
    return result


def discover_ranking_years_live() -> dict[int, int]:
    """GET nirfindia.org/Rankings/{year}/OverallRanking.html for 2015-2025."""
    sess = session()
    out: dict[int, int] = {}
    for year in range(2015, 2026):
        url = f"https://www.nirfindia.org/Rankings/{year}/OverallRanking.html"
        time.sleep(DEFAULT_SLEEP)
        try:
            resp = sess.get(url, timeout=45, allow_redirects=True)
            out[year] = resp.status_code
        except requests.RequestException:
            out[year] = 0
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape NIRF press/news for PDFs")
    parser.add_argument("--urls", type=str, default="", help="Extra comma-separated URLs")
    args = parser.parse_args()
    urls = list(SEED_URLS)
    if args.urls.strip():
        urls.extend(u.strip() for u in args.urls.split(",") if u.strip())

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    EXTERNAL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"NIRF press scrape — {utc_now_iso()}")

    live_years = discover_ranking_years_live()
    log_attempt(
        method="Live nirfindia.org ranking probe",
        source="nirfindia.org/Rankings/{2015..2025}/OverallRanking.html",
        script="scrape_nirf_press.py",
        status="partial",
        rows_recovered=sum(1 for c in live_years.values() if c == 200),
        detail=json.dumps(live_years),
        why_failed=f"404 years: {[y for y, c in live_years.items() if c == 404]}",
        next_retry="Wayback for 2016-2017; live for 2018+",
    )

    all_pdfs: set[str] = set()
    all_ranking: set[str] = set()
    results: list[dict] = []
    for url in urls:
        print(f"  {url[:70]}...")
        r = probe_url(url)
        results.append(r)
        all_pdfs.update(r.get("pdfs", []))
        all_ranking.update(r.get("ranking_links", []))
        status = "success" if r.get("status") == 200 else "fail"
        log_attempt(
            method="NIRF press / discovery",
            source=url,
            script="scrape_nirf_press.py",
            status=status,
            rows_recovered=len(r.get("pdfs", [])) + len(r.get("ranking_links", [])),
            detail=f"pdfs={len(r.get('pdfs', []))}, ranking_links={len(r.get('ranking_links', []))}",
            why_failed=r.get("error", "") if status == "fail" else "",
        )

    out = EXTERNAL_DIR / "nirf_press_discovery.json"
    payload = {
        "live_ranking_years": live_years,
        "seed_results": results,
        "all_pdfs": sorted(all_pdfs),
        "all_ranking_links": sorted(all_ranking),
    }
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Discovery -> {out} ({len(all_pdfs)} PDFs, {len(all_ranking)} ranking links)")


if __name__ == "__main__":
    main()
