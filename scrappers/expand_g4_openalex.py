#!/usr/bin/env python3
"""Expand G4 collaboration_premium beyond the original 20 countries via OpenAlex.

Recipe (matches G4_RECOVERY_PLAN.md / READY_FOR_TEAM/_notes/G4_RECOVERY_PLAN.md):
  domestic: institutions.country_code:{ISO2},countries_distinct_count:1,publication_year:{Y}
  intl:     institutions.country_code:{ISO2},countries_distinct_count:>1,publication_year:{Y}
  metric:   POPULATION mean cited_by_count (all work types) — NOT 3×200 samples.

Method per bucket:
  1) group_by=cited_by_count (≤200 distinct keys) + cursor-fetch high-cite tail
  2) if residual gap remains → full cursor sum (exact population mean)

Original 20 river rows are kept untouched. Resume via disk cache.
Rebuilds dashboard/viz4_data.js (+ Project mirror) from merged river.

Never prints API keys. Never revives the unverified 111 undated FE snapshot.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(r"C:\Users\brata\Downloads\CS661")
ENV_PATH = ROOT / ".env"
PREM = ROOT / "CS661_Dataset" / "collaboration_premium.csv"
PREM_TEAM = (
    ROOT / "CS661_Dataset" / "raw_vault" / "READY_FOR_TEAM" / "collaboration_premium.csv"
)
PREM_EXPAND = (
    ROOT
    / "CS661_Dataset"
    / "raw_vault"
    / "READY_FOR_TEAM"
    / "collaboration_premium_expanded.csv"
)
OUT_DASH = ROOT / "dashboard" / "viz4_data.js"
OUT_PROJ = ROOT / "CS661 Project" / "viz4_data.js"
CACHE = ROOT / "CS661_Dataset" / "raw_vault" / "g4_expand_cache.json"
CACHE_PARTIAL = ROOT / "CS661_Dataset" / "raw_vault" / "g4_expand_partial.json"
STATUS_MD = ROOT / "dashboard" / "docs" / "G4_EXPAND_STATUS.md"
MAILTO = "bratadeeps24@iitk.ac.in"
UA = "CS661-G4-expand/1.1 (mailto:bratadeeps24@iitk.ac.in; IITK CS661)"
YEARS = list(range(2010, 2025))
SLEEP = 0.12
MIN_CREDITS_STOP = 120

# Original 20 — leave CSV rows as-is (pre-existing population means)
CORE20 = {
    "AU", "BR", "CA", "CN", "FR", "DE", "IN", "IR", "IT", "JP",
    "NL", "PL", "RU", "KR", "ES", "SE", "CH", "TR", "GB", "US",
}

# Expansion candidates: research-active systems beyond core 20.
# All complete 2010–2024 population-mean panels may enter the live pool
# (no Europe/Oceania lock — maximize honest backed coverage).
EXPAND = [
    # --- Region balance priority (Americas / Asia / Africa fills) ---
    ("MX", "Mexico", "Latin America"),
    ("PE", "Peru", "Latin America"),
    ("EC", "Ecuador", "Latin America"),
    ("UY", "Uruguay", "Latin America"),
    ("CR", "Costa Rica", "Latin America"),
    ("TW", "Taiwan", "East Asia & Pacific"),
    ("MY", "Malaysia", "East Asia & Pacific"),
    ("PH", "Philippines", "East Asia & Pacific"),
    ("VN", "Vietnam", "East Asia & Pacific"),
    ("PK", "Pakistan", "South Asia"),
    ("BD", "Bangladesh", "South Asia"),
    ("LK", "Sri Lanka", "South Asia"),
    ("NP", "Nepal", "South Asia"),
    ("AF", "Afghanistan", "South Asia"),
    ("BT", "Bhutan", "South Asia"),
    ("MV", "Maldives", "South Asia"),
    ("ZA", "South Africa", "Middle East & Africa"),
    ("EG", "Egypt", "Middle East & Africa"),
    ("SA", "Saudi Arabia", "Middle East & Africa"),
    ("MA", "Morocco", "Middle East & Africa"),
    ("TN", "Tunisia", "Middle East & Africa"),
    ("KE", "Kenya", "Middle East & Africa"),
    ("GH", "Ghana", "Middle East & Africa"),
    ("ET", "Ethiopia", "Middle East & Africa"),
    # --- Already-live / prior expand (non-Europe) ---
    ("AE", "United Arab Emirates", "Middle East & Africa"),
    ("QA", "Qatar", "Middle East & Africa"),
    ("NZ", "New Zealand", "Oceania"),
    ("TH", "Thailand", "East Asia & Pacific"),
    ("CL", "Chile", "Latin America"),
    ("AR", "Argentina", "Latin America"),
    ("SG", "Singapore", "East Asia & Pacific"),
    ("CO", "Colombia", "Latin America"),
    ("HK", "Hong Kong", "East Asia & Pacific"),
    ("IL", "Israel", "Middle East & Africa"),
    ("NG", "Nigeria", "Middle East & Africa"),
    # --- Europe (cache-only unless already in EUROPE_LOCKED) ---
    ("BG", "Bulgaria", "Europe"),
    ("SI", "Slovenia", "Europe"),
    ("SK", "Slovakia", "Europe"),
    ("HR", "Croatia", "Europe"),
    ("RS", "Serbia", "Europe"),
    ("HU", "Hungary", "Europe"),
    ("RO", "Romania", "Europe"),
    ("IE", "Ireland", "Europe"),
    ("FI", "Finland", "Europe"),
    ("CZ", "Czechia", "Europe"),
    ("GR", "Greece", "Europe"),
    ("NO", "Norway", "Europe"),
    ("AT", "Austria", "Europe"),
    ("DK", "Denmark", "Europe"),
    ("PT", "Portugal", "Europe"),
    ("BE", "Belgium", "Europe"),
    ("UA", "Ukraine", "Europe"),
    ("LU", "Luxembourg", "Europe"),
]

REGION = {
    "AU": "Oceania", "BR": "Latin America", "CA": "North America", "CH": "Europe",
    "CN": "East Asia & Pacific", "DE": "Europe", "ES": "Europe", "FR": "Europe",
    "GB": "Europe", "IN": "South Asia", "IR": "Middle East & Africa", "IT": "Europe",
    "JP": "East Asia & Pacific", "KR": "East Asia & Pacific", "NL": "Europe",
    "PL": "Europe", "RU": "Europe", "SE": "Europe", "TR": "Middle East & Africa",
    "US": "North America",
}
for iso, _name, reg in EXPAND:
    REGION[iso] = reg

NAME_FIX = {
    "Russian Federation": "Russia",
    "United States of America": "United States",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "Czech Republic": "Czechia",
    "Korea, Republic of": "South Korea",
}

CSV_FIELDS = [
    "Country_Code", "Country_Name", "Year",
    "Domestic_Papers", "Domestic_Citations", "Domestic_Avg_Citations",
    "International_Papers", "International_Citations", "International_Avg_Citations",
    "Citation_Gain",
]


class KeyPool:
    """Rotate OpenAlex API keys on 429 / exhausted daily credits. Never logs key material."""

    def __init__(self, keys: list[str]):
        if not keys:
            raise SystemExit("No OpenAlex API keys loaded from .env")
        # Deduplicate while preserving order
        seen: set[str] = set()
        uniq: list[str] = []
        for k in keys:
            if k and k not in seen:
                seen.add(k)
                uniq.append(k)
        self.keys = uniq
        self.idx = 0
        self.exhausted: set[int] = set()
        print(f"KeyPool: {len(self.keys)} key(s) loaded (values not shown)", flush=True)

    @property
    def current(self) -> str:
        return self.keys[self.idx]

    def label(self) -> str:
        return f"key#{self.idx + 1}/{len(self.keys)}"

    def mark_exhausted(self, reason: str = "budget") -> bool:
        """Mark current key exhausted; rotate to next usable. Returns False if all dead."""
        self.exhausted.add(self.idx)
        print(f"  {self.label()} exhausted ({reason})", flush=True)
        return self.rotate()

    def rotate(self) -> bool:
        n = len(self.keys)
        for _ in range(n):
            self.idx = (self.idx + 1) % n
            if self.idx not in self.exhausted:
                print(f"  rotated to {self.label()}", flush=True)
                return True
        return False

    def any_usable(self) -> bool:
        return len(self.exhausted) < len(self.keys)


def load_env_keys() -> list[str]:
    if not ENV_PATH.exists():
        raise SystemExit(f"Missing {ENV_PATH}")
    primary = ""
    key2 = ""
    key3 = ""
    keys_csv = ""
    global SLEEP
    for line in ENV_PATH.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        name = k.strip().lstrip("\ufeff")
        val = v.strip().strip('"').strip("'")
        if name == "OPENALEX_API_KEY":
            primary = val
        elif name == "OPENALEX_API_KEY_2":
            key2 = val
        elif name == "OPENALEX_API_KEY_3":
            key3 = val
        elif name == "OPENALEX_API_KEYS":
            keys_csv = val
        elif name == "OPENALEX_FETCH_DELAY":
            try:
                SLEEP = max(0.05, float(val))
            except ValueError:
                pass
    keys: list[str] = []
    if keys_csv:
        keys.extend(x.strip() for x in keys_csv.split(",") if x.strip())
    for k in (primary, key2, key3):
        if k and k not in keys:
            keys.append(k)
    if not keys:
        raise SystemExit("No OPENALEX_API_KEY / OPENALEX_API_KEYS found in .env")
    return keys


def oa_get(url: str, pool: KeyPool, retries: int = 10) -> dict:
    last_err: Exception | None = None
    for attempt in range(retries):
        if not pool.any_usable():
            raise RuntimeError("All OpenAlex API keys exhausted (429/budget)")
        api_key = pool.current
        headers = {"User-Agent": UA, "Authorization": f"Bearer {api_key}"}
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                wait = min(30, 2 ** min(attempt, 4) + SLEEP)
                print(
                    f"  backoff HTTP 429 on {pool.label()} sleep {wait:.1f}s "
                    f"(attempt {attempt + 1})",
                    flush=True,
                )
                time.sleep(wait)
                if attempt >= 1:
                    if not pool.mark_exhausted("HTTP 429"):
                        raise RuntimeError("All keys exhausted after HTTP 429") from e
                continue
            if e.code in (500, 502, 503, 504):
                wait = min(90, 2 ** attempt + SLEEP)
                print(f"  backoff HTTP {e.code} sleep {wait:.1f}s", flush=True)
                time.sleep(wait)
                continue
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")[:300]
            except Exception:
                pass
            raise RuntimeError(f"HTTP {e.code}: {body}") from e
        except Exception as e:
            last_err = e
            wait = min(40, 1.5 ** attempt)
            print(f"  retry {type(e).__name__} sleep {wait:.1f}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"Failed after retries: {url[:140]} ({last_err})")


def check_rate_limit(pool: KeyPool) -> dict:
    data = oa_get("https://api.openalex.org/rate-limit", pool)
    rl = data.get("rate_limit") or data
    rem = int(rl.get("credits_remaining") or 0)
    print(
        f"rate-limit {pool.label()} credits_remaining={rem} "
        f"daily_remaining_usd={rl.get('daily_remaining_usd')} "
        f"resets_in_seconds={rl.get('resets_in_seconds')}",
        flush=True,
    )
    return rl


def credits_remaining(pool: KeyPool) -> int:
    rl = check_rate_limit(pool)
    return int(rl.get("credits_remaining") or 0)


def pick_usable_key(pool: KeyPool) -> int:
    """Pick the key with the most remaining credits among usable keys."""
    best_rem = -1
    best_idx = pool.idx
    for i in range(len(pool.keys)):
        if i in pool.exhausted:
            continue
        pool.idx = i
        try:
            rem = credits_remaining(pool)
        except Exception as e:
            print(f"  {pool.label()} rate-limit check failed: {e}", flush=True)
            pool.exhausted.add(i)
            continue
        if rem > best_rem:
            best_rem = rem
            best_idx = i
    if best_rem < 0:
        return 0
    pool.idx = best_idx
    if best_rem < MIN_CREDITS_STOP:
        # mark all low keys exhausted
        for i in range(len(pool.keys)):
            if i not in pool.exhausted:
                pool.idx = i
                try:
                    rem = credits_remaining(pool)
                except Exception:
                    rem = 0
                if rem < MIN_CREDITS_STOP:
                    pool.exhausted.add(i)
        pool.idx = best_idx
    print(f"  using {pool.label()} (best rem={best_rem})", flush=True)
    return best_rem


def _bucket_filter(iso2: str, year: int, intl: bool) -> str:
    cdc = ">1" if intl else "1"
    return (
        f"institutions.country_code:{iso2},"
        f"countries_distinct_count:{cdc},"
        f"publication_year:{year}"
    )


def _cursor_sum(pool: KeyPool, filt: str) -> tuple[int, int, int]:
    """Full population sum via cursor. Returns (n, cite_sum, pages)."""
    cursor = "*"
    n = 0
    cite_sum = 0
    pages = 0
    while True:
        q = urllib.parse.urlencode(
            {
                "filter": filt,
                "select": "cited_by_count",
                "per_page": "200",
                "cursor": cursor,
                "mailto": MAILTO,
            }
        )
        data = oa_get(f"https://api.openalex.org/works?{q}", pool)
        time.sleep(SLEEP)
        pages += 1
        results = data.get("results") or []
        for w in results:
            cite_sum += int(w.get("cited_by_count") or 0)
            n += 1
        cursor = (data.get("meta") or {}).get("next_cursor")
        if not cursor or not results:
            break
    return n, cite_sum, pages


def bucket_population_mean(pool: KeyPool, iso2: str, year: int, intl: bool) -> dict:
    """Population mean via group_by (+ tail) or full cursor fallback."""
    filt = _bucket_filter(iso2, year, intl)

    gq = urllib.parse.urlencode(
        {
            "filter": filt,
            "group_by": "cited_by_count",
            "per_page": "200",
            "mailto": MAILTO,
        }
    )
    gd = oa_get(f"https://api.openalex.org/works?{gq}", pool)
    time.sleep(SLEEP)
    groups = gd.get("group_by") or []
    total = int((gd.get("meta") or {}).get("count") or 0)
    pages = 1
    if total == 0:
        return {
            "n": 0,
            "mean": 0.0,
            "cites": 0,
            "method": "empty",
            "pages": pages,
            "gap": 0,
        }

    cite_sum = sum(int(g["key"]) * int(g["count"]) for g in groups)
    n = sum(int(g["count"]) for g in groups)
    max_key = max((int(g["key"]) for g in groups), default=-1)

    if total > n and max_key >= 0:
        tail_filt = f"{filt},cited_by_count:>{max_key}"
        tn, ts, tp = _cursor_sum(pool, tail_filt)
        n += tn
        cite_sum += ts
        pages += tp

    gap = total - n
    method = "groupby_tail"
    near_ok = gap > 0 and total > 0 and (gap <= 80 or (gap / total) <= 0.02)
    if gap != 0 and not near_ok:
        print(
            f"    gap={gap} for {iso2}/{year}/{'intl' if intl else 'dom'} "
            f"-> full cursor ({total} works)",
            flush=True,
        )
        n, cite_sum, tp = _cursor_sum(pool, filt)
        pages += tp
        gap = total - n
        method = "full_cursor"
        if n == 0 and total > 0:
            raise RuntimeError(f"cursor returned 0 for {filt}")
    elif near_ok:
        method = f"groupby_tail_near_pop(gap={gap})"
        print(
            f"    near-pop gap={gap}/{total} for {iso2}/{year}/"
            f"{'intl' if intl else 'dom'} (skip full cursor)",
            flush=True,
        )

    mean = round(cite_sum / n, 6) if n else 0.0
    return {
        "n": int(total if abs(gap) <= max(80, int(0.02 * total) + 1) else n),
        "mean": mean,
        "cites": int(round(cite_sum)),
        "method": method,
        "pages": pages,
        "gap": int(gap),
    }


def fetch_country_year(pool: KeyPool, iso2: str, name: str, year: int) -> dict:
    dom = bucket_population_mean(pool, iso2, year, intl=False)
    intl = bucket_population_mean(pool, iso2, year, intl=True)
    gain = round(intl["mean"] - dom["mean"], 6)
    return {
        "Country_Code": iso2,
        "Country_Name": name,
        "Year": year,
        "Domestic_Papers": dom["n"],
        "Domestic_Citations": dom["cites"],
        "Domestic_Avg_Citations": round(dom["mean"], 3),
        "International_Papers": intl["n"],
        "International_Citations": intl["cites"],
        "International_Avg_Citations": round(intl["mean"], 3),
        "Citation_Gain": round(gain, 3),
        "_method": f"dom={dom['method']};intl={intl['method']}",
        "_pages": dom["pages"] + intl["pages"],
        "_gap_dom": dom["gap"],
        "_gap_intl": intl["gap"],
    }


def load_existing() -> list[dict]:
    with PREM.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in CSV_FIELDS})


def save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def load_cache() -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def rebuild_viz4(rows: list[dict]) -> dict:
    by_y: dict[str, list] = {}
    for r in rows:
        year = str(int(r["Year"]))
        raw_name = r["Country_Name"]
        display = NAME_FIX.get(raw_name, raw_name)
        if display in ("Korea", "Republic of Korea", "Korea, Rep."):
            display = "South Korea"
        if "Iran" in display:
            display = "Iran"
        if display == "Russian Federation":
            display = "Russia"
        iso = r["Country_Code"]
        region = REGION.get(iso, "Unknown")
        by_y.setdefault(year, []).append(
            {
                "name": display,
                "region": region,
                "iso2": iso,
                "domestic": round(float(r["Domestic_Avg_Citations"]), 3),
                "international": round(float(r["International_Avg_Citations"]), 3),
                "gain": round(float(r["Citation_Gain"]), 3),
                "year": int(year),
                "domestic_papers": int(float(r["Domestic_Papers"])),
                "international_papers": int(float(r["International_Papers"])),
            }
        )
    for y in by_y:
        by_y[y] = sorted(by_y[y], key=lambda x: x["name"])
    years = sorted(by_y.keys(), key=int)
    default_year = years[-1]
    n_countries = len({r["Country_Code"] for r in rows})
    expand_n = n_countries - len(CORE20)
    meta = {
        "years": [int(y) for y in years],
        "year_min": int(years[0]),
        "year_max": int(years[-1]),
        "n_countries": n_countries,
        "n_core20": len(CORE20),
        "n_expanded": max(0, expand_n),
        "source": "CS661_Dataset/collaboration_premium.csv (OpenAlex population means)",
        "semantics": (
            "Mean citations/paper: domestic-only vs international coauthorship; "
            "gain = intl - domestic"
        ),
        "method": (
            "Population means via OpenAlex group_by=cited_by_count + high-cite tail, "
            "with full cursor fallback when residual gaps remain. Core20 from prior river."
        ),
        "unverified_111": "NOT used — viz4_data_BEFORE_POOLFIX.js is archived only",
    }
    header = (
        f"// G4 pool: OpenAlex collaboration premium — {n_countries} countries × "
        f"{years[0]}–{years[-1]}\n"
        f"// Population means (domestic countries_distinct_count:1 vs intl >1).\n"
        f"// Do NOT revive unverified 111 undated snapshot.\n"
        f"// Chart family: DUMBBELL (not grouped bars).\n"
    )
    body = (
        header
        + f"const VIZ4_META = {json.dumps(meta, indent=2)};\n"
        + f"const VIZ4_YEARS = {json.dumps([int(y) for y in years])};\n"
        + f"const VIZ4_DEFAULT_YEAR = {default_year};\n"
        + f"const VIZ4_BY_YEAR = {json.dumps(by_y, indent=2)};\n"
        + "const VIZ4_DATA = VIZ4_BY_YEAR[String(VIZ4_DEFAULT_YEAR)];\n"
    )
    for out in (OUT_DASH, OUT_PROJ):
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(body, encoding="utf-8")
        print(f"Wrote {out} ({out.stat().st_size} bytes)", flush=True)
    return meta


def complete_countries(cache: dict) -> list[str]:
    """ISO codes with all YEARS present in cache."""
    by_iso: dict[str, set[int]] = {}
    for key, row in cache.items():
        if not isinstance(row, dict) or "Domestic_Papers" not in row:
            continue
        iso = row.get("Country_Code") or key.split(":")[0]
        year = int(row.get("Year") or key.split(":")[1])
        by_iso.setdefault(iso, set()).add(year)
    need = set(YEARS)
    return sorted(iso for iso, ys in by_iso.items() if need <= ys)


def write_status(
    meta: dict,
    cache: dict,
    pending: list[str],
    stopped_reason: str,
    rem_credits: int,
) -> None:
    done = complete_countries(cache)
    expand_done = [iso for iso in done if iso not in CORE20]
    expand_names = {iso: name for iso, name, _ in EXPAND}
    missing = [iso for iso, _, _ in EXPAND if iso not in expand_done]
    lines = [
        "# G4 Expand Status",
        "",
        f"**Updated:** {time.strftime('%Y-%m-%d %H:%M %Z')}",
        f"**Live pool countries:** {meta.get('n_countries')} "
        f"(core20={meta.get('n_core20')}, expanded=+{meta.get('n_expanded')})",
        f"**Years:** {meta.get('year_min')}–{meta.get('year_max')}",
        f"**Credits remaining (last check):** {rem_credits}",
        f"**Stop reason:** {stopped_reason}",
        "",
        "## API keys",
        "",
        "Keys live only in repo-root `.env` (gitignored): `OPENALEX_API_KEY`, "
        "`OPENALEX_API_KEY_2`, `OPENALEX_API_KEY_3`, and/or `OPENALEX_API_KEYS`. "
        "The expand script rotates on HTTP 429 / low daily credits. "
        "**Never** commit keys or paste them into docs/JS/zips.",
        "",
        "## Why the old 111 was unverified",
        "",
        "The old FE (`viz4_data_BEFORE_POOLFIX.js`) was an **undated snapshot** of 111 countries. "
        "Most of those countries have **zero rows** in `collaboration_premium.csv`. "
        "Even for the overlapping 20, FE scalars do not match any single premium year. "
        "It must **not** be revived as live data.",
        "",
        "## Where backed data comes from",
        "",
        "OpenAlex Works API (same recipe as `G4_RECOVERY_PLAN.md`):",
        "",
        "- Domestic: `institutions.country_code:{ISO2},countries_distinct_count:1,publication_year:{Y}`",
        "- International: `...countries_distinct_count:>1...`",
        "- Metric: **population** mean of `cited_by_count` (all work types)",
        "- Method: `group_by=cited_by_count` + high-cite tail; full cursor if residual gap",
        "",
        "## Completed expanded countries (full 2010–2024)",
        "",
    ]
    if expand_done:
        for iso in expand_done:
            lines.append(f"- `{iso}` — {expand_names.get(iso, iso)}")
    else:
        lines.append("- *(none yet)*")
    lines += [
        "",
        "## Still missing / pending from expand list",
        "",
    ]
    for iso in missing:
        have = sum(1 for y in YEARS if f"{iso}:{y}" in cache)
        lines.append(f"- `{iso}` — {expand_names.get(iso, iso)} ({have}/{len(YEARS)} years cached)")
    lines += [
        "",
        "## Artifacts",
        "",
        f"- River (live): `{PREM.relative_to(ROOT).as_posix()}`",
        f"- River (READY_FOR_TEAM): `{PREM_TEAM.relative_to(ROOT).as_posix()}`",
        f"- Expanded copy: `{PREM_EXPAND.relative_to(ROOT).as_posix()}`",
        f"- Cache (resume): `{CACHE.relative_to(ROOT).as_posix()}`",
        f"- Pool: `dashboard/viz4_data.js`",
        "",
        "## How to continue overnight",
        "",
        "```powershell",
        "cd C:\\Users\\brata\\Downloads\\CS661",
        "python scripts/expand_g4_openalex.py",
        "# optional: limit how many NEW countries to attempt this run",
        "python scripts/expand_g4_openalex.py --max-new 15",
        "```",
        "",
        "Script resumes from `g4_expand_cache.json`. When daily OpenAlex credits reset "
        "(see `resets_in_seconds` on `/rate-limit`), re-run until pending countries "
        "reach `{have}/{years}` = full. Then pool rebuild is automatic at end of run.",
        "",
        "## Integrity rules",
        "",
        "- Do **not** load `viz4_data_BEFORE_POOLFIX.js` as live data.",
        "- Do **not** invent means; only cache-backed population rows enter the river.",
        "- Incomplete countries (partial years) stay in cache only — not in live pool.",
        "",
    ]
    STATUS_MD.parent.mkdir(parents=True, exist_ok=True)
    STATUS_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {STATUS_MD}", flush=True)


def region_of(iso: str) -> str:
    return REGION.get(iso, "Unknown")


def merge_and_rebuild(cache: dict) -> dict:
    existing = load_existing()
    # Prefer original file for core20 (in case root CSV was previously expanded)
    # Re-read uniquely by keeping first CORE20 occurrence from original-shaped rows
    core_by = {}
    for r in existing:
        iso = r["Country_Code"]
        if iso in CORE20:
            core_by[(iso, int(r["Year"]))] = r

    # If root already mixed, still OK — we only take CORE20 keys
    merged: list[dict] = []
    for (iso, year), r in sorted(core_by.items()):
        merged.append({k: r[k] for k in CSV_FIELDS})

    done = complete_countries(cache)
    expand_done = [iso for iso in done if iso not in CORE20]
    name_by = {iso: name for iso, name, _ in EXPAND}
    for iso in expand_done:
        for year in YEARS:
            row = cache[f"{iso}:{year}"]
            # ensure name
            row = dict(row)
            row["Country_Name"] = name_by.get(iso, row.get("Country_Name", iso))
            merged.append({k: row[k] for k in CSV_FIELDS})

    merged.sort(key=lambda r: (r["Country_Code"], int(r["Year"])))
    write_csv(merged, PREM)
    write_csv(merged, PREM_TEAM)
    write_csv(merged, PREM_EXPAND)
    print(
        f"River written: {len(merged)} rows, "
        f"{len({r['Country_Code'] for r in merged})} countries",
        flush=True,
    )
    return rebuild_viz4(merged)


def main() -> None:
    ap = argparse.ArgumentParser(description="Expand G4 OpenAlex population means")
    ap.add_argument(
        "--max-new",
        type=int,
        default=50,
        help="Max new countries to attempt completing this run (default 50)",
    )
    ap.add_argument(
        "--rebuild-only",
        action="store_true",
        help="Only merge cache → CSV → viz4_data.js (no API fetch)",
    )
    ap.add_argument(
        "--only",
        type=str,
        default="",
        help="Comma-separated ISO2 list to fetch (skips others). Europe non-locked ISOs ignored.",
    )
    ap.add_argument(
        "--region-balance",
        action="store_true",
        help="Only fetch non-Europe / non-Oceania-lock targets (region balance pass).",
    )
    args = ap.parse_args()

    pool = KeyPool(load_env_keys())
    cache = load_cache()
    # Drop legacy sample-mean cache entries so we re-fetch with population method
    purged = 0
    for k, v in list(cache.items()):
        if isinstance(v, dict) and str(v.get("_method", "")).startswith("openalex_sample"):
            del cache[k]
            purged += 1
    if purged:
        print(f"Purged {purged} legacy sample-mean cache rows", flush=True)
        save_cache(cache)

    if args.rebuild_only:
        meta = merge_and_rebuild(cache)
        rem = pick_usable_key(pool)
        write_status(meta, cache, [], "rebuild-only", rem)
        print(f"DONE rebuild countries={meta['n_countries']}", flush=True)
        return

    rem = pick_usable_key(pool)
    if rem < MIN_CREDITS_STOP or not pool.any_usable():
        meta = merge_and_rebuild(cache)
        write_status(meta, cache, [], f"credits_too_low ({rem})", rem)
        raise SystemExit(f"Too few credits across all keys ({rem} < {MIN_CREDITS_STOP})")

    only_set = {x.strip().upper() for x in args.only.split(",") if x.strip()}
    already = set(complete_countries(cache))
    targets: list[tuple[str, str]] = []
    for iso, name, reg in EXPAND:
        if iso in already:
            continue
        if only_set and iso not in only_set:
            continue
        if args.region_balance and reg in ("Europe", "Oceania"):
            continue
        targets.append((iso, name))
        if len(targets) >= args.max_new:
            break

    print(
        f"Targets this run: {len(targets)} countries "
        f"(already complete expand={len([i for i in already if i not in CORE20])})",
        flush=True,
    )
    if targets:
        print(f"  -> {[t[0] for t in targets]}", flush=True)

    stopped = "completed_targets"
    pages_used = 0
    for iso, name in targets:
        rem = pick_usable_key(pool)
        if rem < MIN_CREDITS_STOP or not pool.any_usable():
            stopped = f"rate_limit_credits ({rem})"
            print(stopped, flush=True)
            break

        print(f"=== {iso} {name} credits~{rem} {pool.label()} ===", flush=True)
        country_ok = True
        for year in YEARS:
            key = f"{iso}:{year}"
            if key in cache and cache[key].get("Domestic_Papers") is not None:
                # Skip if already population-backed
                meth = str(cache[key].get("_method", ""))
                if "groupby" in meth or "full_cursor" in meth or "empty" in meth:
                    continue
            try:
                row = fetch_country_year(pool, iso, name, year)
            except Exception as e:
                print(f"FAIL {iso} {year}: {e}", flush=True)
                country_ok = False
                err = str(e)
                if "exhausted" in err.lower() or "429" in err:
                    stopped = f"rate_limit_keys_exhausted {iso}/{year}"
                else:
                    stopped = f"error {iso}/{year}: {e}"
                break
            cache[key] = row
            pages_used += int(row.get("_pages") or 0)
            save_cache(cache)
            print(
                f"  {iso}/{year} gain={row['Citation_Gain']} "
                f"method={row['_method']} pages~{row['_pages']}",
                flush=True,
            )
            # Soft credit check mid-country
            if pages_used >= 80:
                rem = pick_usable_key(pool)
                pages_used = 0
                if rem < MIN_CREDITS_STOP or not pool.any_usable():
                    stopped = f"rate_limit_credits mid-country ({rem})"
                    country_ok = False
                    break
        if not country_ok and stopped.startswith("rate_limit"):
            break
        if country_ok and iso in complete_countries(cache):
            print(f"COMPLETED {iso}", flush=True)

    rem = pick_usable_key(pool) if pool.any_usable() else 0
    meta = merge_and_rebuild(cache)
    pending = [iso for iso, _, _ in EXPAND if iso not in complete_countries(cache)]
    write_status(meta, cache, pending, stopped, rem)
    print(
        f"DONE countries={meta['n_countries']} expanded=+{meta.get('n_expanded')} "
        f"stop={stopped} credits={rem}",
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        raise
