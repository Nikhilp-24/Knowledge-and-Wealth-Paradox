#!/usr/bin/env python3
"""Full OpenAlex topic × country × year extract for Module 3 (G3).

Loops the 7 dashboard topics × years × group_by=authorships.countries.
Uses canonical topic_id_map.json (concepts). Quantum = C58053490 (NOT ASJC 2500).

Resume-safe: skips (topic_id, year) pairs already present in the CSV checkpoint
or recorded as empty (0 country groups) in fetched_empty.json.

Coordinated parallelism (one process):
  --workers N (default 2, capped at 3) via ThreadPoolExecutor
  Shared lock around CSV / log / empty-marker writes
  Shared polite delay between request *starts*
  Periodic /rate-limit checks; stop cleanly if daily_remaining_usd is low
  HTTP 429 → exponential backoff

Examples:
  python fetch_topics_full.py --years 2015-2024
  python fetch_topics_full.py --years 1972-1999 --topics "Infectious Diseases" --workers 2
  python fetch_topics_full.py --years 1950-1999 --workers 2 --sleep 0.35
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]  # CS661/
OUT = HERE / "topics_full"
MAP_PATH = OUT / "topic_id_map.json"
CSV_PATH = OUT / "openalex_topic_country_year.csv"
MANIFEST_PATH = OUT / "MANIFEST.md"
PROGRESS_PATH = OUT / "progress.json"
REQUEST_LOG_PATH = OUT / "request_log.jsonl"
EMPTY_PATH = OUT / "fetched_empty.json"

MAILTO = "bratadeeps24@iitk.ac.in"
UA = f"CS661-G3-full/1.0 (mailto:{MAILTO}; IITK CS661 research course project)"
BASE = "https://api.openalex.org/works"
RATE_LIMIT_URL = "https://api.openalex.org/rate-limit"
MAX_WORKERS = 3
MIN_REMAINING_USD = 0.02
RATE_CHECK_EVERY = 15


def load_dotenv(path: Path) -> None:
    """Load KEY=VALUE from .env into os.environ if not already set. Never prints values."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def load_env_keys() -> list[str]:
    """Load OpenAlex keys from .env. Never prints values. Order: KEYS csv, then KEY/KEY_2/KEY_3."""
    load_dotenv(ROOT / ".env")
    load_dotenv(HERE / ".env")
    env_path = ROOT / ".env"
    primary = (os.environ.get("OPENALEX_API_KEY") or "").strip()
    key2 = (os.environ.get("OPENALEX_API_KEY_2") or "").strip()
    key3 = (os.environ.get("OPENALEX_API_KEY_3") or "").strip()
    keys_csv = (os.environ.get("OPENALEX_API_KEYS") or "").strip()
    # Also re-read file for KEY_2/KEY_3 if present (may not be exported yet)
    if env_path.is_file():
        for raw in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, val = line.split("=", 1)
            name = name.strip().lstrip("\ufeff")
            val = val.strip().strip('"').strip("'")
            if name == "OPENALEX_API_KEY" and not primary:
                primary = val
            elif name == "OPENALEX_API_KEY_2":
                key2 = val
            elif name == "OPENALEX_API_KEY_3":
                key3 = val
            elif name == "OPENALEX_API_KEYS" and not keys_csv:
                keys_csv = val
    keys: list[str] = []
    seen: set[str] = set()
    for k in [x.strip() for x in keys_csv.replace(";", ",").split(",") if x.strip()] + [
        primary,
        key2,
        key3,
    ]:
        if k and k not in seen:
            seen.add(k)
            keys.append(k)
    return keys


class KeyPool:
    """Rotate OpenAlex API keys on 429 / low budget. Never logs key material."""

    def __init__(self, keys: list[str], start_idx: int = 0) -> None:
        if not keys:
            raise SystemExit("No OPENALEX_API_KEY / OPENALEX_API_KEYS found in .env")
        self.keys = keys
        self.idx = max(0, min(start_idx, len(keys) - 1))
        self.exhausted: set[int] = set()
        print(f"KeyPool: {len(self.keys)} key(s) loaded; start={self.label()} (values not shown)", flush=True)

    @property
    def current(self) -> str:
        return self.keys[self.idx]

    def label(self) -> str:
        return f"key#{self.idx + 1}/{len(self.keys)}"

    def mark_exhausted(self, reason: str = "budget") -> bool:
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


def pick_start_key_idx(keys: list[str]) -> int:
    """Prefer the key with the highest daily_remaining_usd (share politely with G4)."""
    best_i, best_rem = 0, -1.0
    for i, key in enumerate(keys):
        try:
            q = urllib.parse.urlencode({"mailto": MAILTO, "api_key": key})
            req = urllib.request.Request(
                f"{RATE_LIMIT_URL}?{q}",
                headers={"User-Agent": UA},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            rate = data.get("rate_limit") or data
            rem = float(rate.get("daily_remaining_usd") or 0)
            print(
                f"  probe {i + 1}/{len(keys)}: daily_remaining_usd={rem} "
                f"budget={rate.get('daily_budget_usd')} resets_at={rate.get('resets_at')}",
                flush=True,
            )
            if rem > best_rem:
                best_rem = rem
                best_i = i
        except Exception as e:  # noqa: BLE001
            print(f"  probe {i + 1}/{len(keys)} failed: {type(e).__name__}", flush=True)
    return best_i


# Populated in main() after KeyPool init; kept for redact helpers
API_KEY: str | None = None
KEY_POOL: KeyPool | None = None
CSV_FIELDS = [
    "year",
    "country_iso2",
    "country_key_display_name",
    "dashboard_topic",
    "openalex_entity_type",
    "openalex_id",
    "topic_display_name",
    "works_count",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_years(spec: str) -> list[int]:
    spec = spec.strip()
    if "-" in spec and "," not in spec:
        a, b = spec.split("-", 1)
        lo, hi = int(a), int(b)
        if hi < lo:
            raise ValueError(f"bad year range: {spec}")
        return list(range(lo, hi + 1))
    return [int(x.strip()) for x in spec.split(",") if x.strip()]


def load_map() -> list[dict]:
    data = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    topics = data["topics"]
    for t in topics:
        if t["dashboard_topic"] == "Quantum Computing":
            oid = t["primary"]["openalex_id"]
            if oid in ("2500", "C2500") or oid.endswith("2500"):
                raise SystemExit("REFUSING: Quantum mapped to 2500 / Materials Science")
            if oid != "C58053490":
                print(f"WARN: Quantum primary is {oid}, expected C58053490", file=sys.stderr)
    return topics


def auth_params(api_key: str | None = None) -> dict[str, str]:
    """Prefer API key (≈$1/day free budget) over bare mailto (≈$0.10/day)."""
    params: dict[str, str] = {"mailto": MAILTO}
    key = api_key if api_key is not None else (KEY_POOL.current if KEY_POOL else API_KEY)
    if key:
        params["api_key"] = key
    return params


def redact_url(url: str) -> str:
    out = url
    keys = KEY_POOL.keys if KEY_POOL else ([API_KEY] if API_KEY else [])
    for k in keys:
        if k:
            out = out.replace(k, "***")
    return out


def redact_text(text: str) -> str:
    out = text
    keys = KEY_POOL.keys if KEY_POOL else ([API_KEY] if API_KEY else [])
    for k in keys:
        if k:
            out = out.replace(k, "***")
    return out


def get_json(url: str, retries: int = 8) -> dict:
    """GET JSON with key rotation on 429. Builds URL without api_key; injects current key."""
    last_err: Exception | None = None
    # Strip any baked-in api_key so rotation can swap
    parsed = urllib.parse.urlparse(url)
    q = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    q.pop("api_key", None)
    base_q = q

    for attempt in range(retries):
        if KEY_POOL and not KEY_POOL.any_usable():
            raise RuntimeError("All OpenAlex API keys exhausted (429/budget)")
        key = KEY_POOL.current if KEY_POOL else API_KEY
        params = dict(base_q)
        params["mailto"] = MAILTO
        if key:
            params["api_key"] = key
        live_url = urllib.parse.urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                urllib.parse.urlencode(params),
                parsed.fragment,
            )
        )
        try:
            req = urllib.request.Request(live_url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = redact_text(e.read().decode("utf-8", "replace")[:300])
            last_err = e
            if e.code == 429 and attempt < retries - 1:
                wait = min(120, 2 ** (attempt + 2))
                label = KEY_POOL.label() if KEY_POOL else "key"
                print(f"  HTTP 429 on {label}, sleep {wait}s ...", flush=True)
                time.sleep(wait)
                if KEY_POOL and attempt >= 1:
                    if not KEY_POOL.mark_exhausted("HTTP 429"):
                        raise RuntimeError(
                            f"All keys exhausted after HTTP 429: {body}"
                        ) from e
                continue
            if e.code in (500, 502, 503, 504) and attempt < retries - 1:
                wait = min(120, 2 ** (attempt + 2))
                print(f"  HTTP {e.code}, sleep {wait}s ...", flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f"HTTP {e.code} for {redact_url(live_url)}: {body}") from e
        except Exception as e:  # noqa: BLE001 — network/timeout retry
            last_err = e
            if attempt < retries - 1:
                wait = min(120, 2 ** (attempt + 2))
                print(f"  error {redact_text(repr(e))}, sleep {wait}s ...", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"failed after retries: {last_err}")


def check_rate_limit() -> dict:
    q = urllib.parse.urlencode(auth_params())
    return get_json(f"{RATE_LIMIT_URL}?{q}")


def remaining_usd(rl: dict) -> float | None:
    rate = rl.get("rate_limit") or rl
    val = rate.get("daily_remaining_usd")
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def works_group_by_country(entity_type: str, entity_id: str, year: int) -> tuple[str, dict]:
    if entity_type == "concept":
        filt = f"concepts.id:{entity_id},publication_year:{year}"
    elif entity_type == "topic":
        filt = f"topics.id:{entity_id},publication_year:{year}"
    else:
        raise ValueError(entity_type)
    params = {
        "filter": filt,
        "group_by": "authorships.countries",
        "per_page": 200,
        **auth_params(),
    }
    url = BASE + "?" + urllib.parse.urlencode(params)
    return url, get_json(url)


def groups_to_rows(
    dashboard_topic: str,
    entity_type: str,
    entity_id: str,
    display_name: str,
    year: int,
    data: dict,
) -> list[dict]:
    rows = []
    for g in data.get("group_by") or []:
        key = g.get("key") or ""
        iso = key.rstrip("/").split("/")[-1] if key else ""
        if not iso:
            continue
        rows.append(
            {
                "year": year,
                "country_iso2": iso.upper(),
                "country_key_display_name": g.get("key_display_name") or "",
                "dashboard_topic": dashboard_topic,
                "openalex_entity_type": entity_type,
                "openalex_id": entity_id,
                "topic_display_name": display_name,
                "works_count": int(g.get("count") or 0),
            }
        )
    return rows


def load_done_pairs(csv_path: Path) -> set[tuple[str, int]]:
    done: set[tuple[str, int]] = set()
    if not csv_path.exists():
        return done
    with csv_path.open(newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                done.add((row["openalex_id"], int(row["year"])))
            except (KeyError, ValueError):
                continue
    return done


def load_empty_pairs(path: Path) -> set[tuple[str, int]]:
    if not path.exists():
        return set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    out: set[tuple[str, int]] = set()
    for item in data.get("pairs") or []:
        try:
            out.add((str(item["openalex_id"]), int(item["year"])))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def save_empty_pairs(path: Path, pairs: set[tuple[str, int]]) -> None:
    payload = {
        "updated": utc_now(),
        "note": "Fetched (openalex_id, year) with 0 country groups — skipped on resume",
        "pairs": [
            {"openalex_id": oid, "year": year}
            for oid, year in sorted(pairs, key=lambda x: (x[0], x[1]))
        ],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def ensure_csv_header(csv_path: Path) -> None:
    if csv_path.exists() and csv_path.stat().st_size > 0:
        return
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=CSV_FIELDS).writeheader()


def append_rows(csv_path: Path, rows: list[dict]) -> None:
    with csv_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writerows(rows)


def write_manifest(
    topics: list[dict],
    years: list[int],
    n_rows: int,
    done_pairs: set[tuple[str, int]],
    planned_pairs: int,
    workers: int,
) -> None:
    lines = [
        "# OpenAlex G3 topics_full MANIFEST",
        "",
        f"- **Updated (UTC):** {utc_now()}",
        f"- **mailto:** `{MAILTO}`",
        f"- **API auth:** `{'api_key from .env (OPENALEX_API_KEY)' if API_KEY else 'mailto only — set OPENALEX_API_KEY in CS661/.env for 10× daily budget'}`",
        f"- **User-Agent:** `{UA}`",
        f"- **Workers:** {workers} (single-process ThreadPoolExecutor; locked CSV writes)",
        f"- **Method:** `GET /works?filter={{concepts|topics}}.id:{{ID}},publication_year:{{YYYY}}&group_by=authorships.countries&per_page=200`",
        f"- **Output CSV:** `{CSV_PATH.name}`",
        f"- **Topic map:** `{MAP_PATH.name}`",
        f"- **Rows written (CSV body):** {n_rows}",
        f"- **(topic_id, year) pairs complete:** {len(done_pairs)} / {planned_pairs} planned for this run's year set × topics",
        f"- **Years in this extract request:** {min(years)}–{max(years)} ({len(years)} years)",
        "",
        "## Primary IDs used",
        "",
        "| Dashboard topic | Entity | OpenAlex ID | display_name |",
        "|-----------------|--------|-------------|--------------|",
    ]
    for t in topics:
        p = t["primary"]
        lines.append(
            f"| {t['dashboard_topic']} | {p['openalex_entity_type']} | `{p['openalex_id']}` | {p['display_name']} |"
        )
    lines.extend(
        [
            "",
            "## Quantum rule",
            "",
            "- Primary: **`C58053490`** (Quantum computer).",
            "- Alternate Topics ID: **`T10682`** (Quantum Computing Algorithms and Architecture).",
            "- **Forbidden:** ASJC / FE `2500` (Materials Science).",
            "",
            "## Resume",
            "",
            "```text",
            "python fetch_topics_full.py --years 1972-1999 --topics \"Infectious Diseases\" --workers 2",
            "python fetch_topics_full.py --years 1950-1999 --workers 2 --sleep 0.35",
            "python fetch_topics_full.py --years 2000-2024 --workers 2",
            "```",
            "",
            "Already-fetched (openalex_id, year) pairs are skipped automatically.",
            "",
        ]
    )
    MANIFEST_PATH.write_text("\n".join(lines), encoding="utf-8")


def count_csv_rows(csv_path: Path) -> int:
    if not csv_path.exists():
        return 0
    with csv_path.open(encoding="utf-8") as f:
        return max(0, sum(1 for _ in f) - 1)


class RateLimiter:
    """Shared polite delay between request starts + budget stop flag."""

    def __init__(self, sleep_s: float) -> None:
        self.sleep_s = max(0.0, sleep_s)
        self._lock = threading.Lock()
        self._next_at = 0.0
        self.stop = False
        self.stop_reason = ""
        self.last_remaining: float | None = None

    def wait_turn(self) -> bool:
        """Block until allowed to start a request. Returns False if stopped."""
        with self._lock:
            if self.stop:
                return False
            now = time.monotonic()
            wait = max(0.0, self._next_at - now)
            self._next_at = max(now, self._next_at) + self.sleep_s
        if wait > 0:
            time.sleep(wait)
        with self._lock:
            return not self.stop

    def request_stop(self, reason: str) -> None:
        with self._lock:
            self.stop = True
            self.stop_reason = reason


def main() -> None:
    ap = argparse.ArgumentParser(description="Full G3 OpenAlex topic×country×year extract")
    ap.add_argument("--years", default="2015-2024", help="e.g. 2015-2024 or 1950-2014 or 2020,2022")
    ap.add_argument("--sleep", type=float, default=0.35, help="polite delay between request starts (s)")
    ap.add_argument(
        "--workers",
        type=int,
        default=2,
        help=f"coordinated thread workers (default 2, max {MAX_WORKERS})",
    )
    ap.add_argument(
        "--min-remaining-usd",
        type=float,
        default=MIN_REMAINING_USD,
        help="stop cleanly when daily_remaining_usd falls below this",
    )
    ap.add_argument(
        "--topics",
        default="",
        help="optional comma-separated dashboard topic names to subset",
    )
    ap.add_argument(
        "--start-key",
        type=int,
        default=-1,
        help="1-based key index to start on; -1 = auto-pick highest daily_remaining_usd",
    )
    args = ap.parse_args()

    global API_KEY, KEY_POOL
    keys = load_env_keys()
    if keys:
        start_idx = (
            max(0, args.start_key - 1)
            if args.start_key >= 1
            else pick_start_key_idx(keys)
        )
        KEY_POOL = KeyPool(keys, start_idx=start_idx)
        API_KEY = KEY_POOL.current
    else:
        KEY_POOL = None
        API_KEY = None

    workers = max(1, min(MAX_WORKERS, int(args.workers)))
    OUT.mkdir(parents=True, exist_ok=True)
    if not MAP_PATH.exists():
        raise SystemExit(f"Missing topic map: {MAP_PATH}")

    years = parse_years(args.years)
    topics = load_map()
    if args.topics.strip():
        want = {x.strip() for x in args.topics.split(",") if x.strip()}
        topics = [t for t in topics if t["dashboard_topic"] in want]
        if not topics:
            raise SystemExit(f"No topics matched --topics={args.topics!r}")

    if API_KEY:
        print(f"AUTH api_key pool size={len(KEY_POOL.keys) if KEY_POOL else 1} (values not printed)")
        try:
            rl = check_rate_limit()
            rem = remaining_usd(rl)
            rate = rl.get("rate_limit") or rl
            print(
                "RATE_LIMIT "
                f"daily_budget_usd={rate.get('daily_budget_usd')} "
                f"daily_remaining_usd={rate.get('daily_remaining_usd')} "
                f"prepaid_remaining_usd={rate.get('prepaid_remaining_usd')} "
                f"resets_at={rate.get('resets_at')} "
                f"active={KEY_POOL.label() if KEY_POOL else 'single'}",
                flush=True,
            )
            if rem is not None and rem < args.min_remaining_usd:
                if KEY_POOL and KEY_POOL.mark_exhausted(f"daily_remaining_usd={rem}"):
                    API_KEY = KEY_POOL.current
                    rl = check_rate_limit()
                    rem = remaining_usd(rl)
                    rate = rl.get("rate_limit") or rl
                    print(
                        "RATE_LIMIT after rotate "
                        f"daily_remaining_usd={rate.get('daily_remaining_usd')} "
                        f"active={KEY_POOL.label()}",
                        flush=True,
                    )
                if rem is not None and rem < args.min_remaining_usd:
                    raise SystemExit(
                        f"STOP: daily_remaining_usd={rem} < {args.min_remaining_usd} — try after reset"
                    )
        except SystemExit:
            raise
        except Exception as e:  # noqa: BLE001
            print(f"WARN could not read /rate-limit: {redact_text(str(e))}", flush=True)
    else:
        print(
            "WARN OPENALEX_API_KEY missing — using mailto only (~$0.10/day). "
            "Add key to CS661/.env for ~$1/day free budget.",
            flush=True,
        )

    ensure_csv_header(CSV_PATH)
    done = load_done_pairs(CSV_PATH)
    empty_pairs = load_empty_pairs(EMPTY_PATH)
    done |= empty_pairs
    planned = len(topics) * len(years)
    print(f"OUT {OUT}")
    print(
        f"years {years[0]}-{years[-1]} ({len(years)}); topics {len(topics)}; "
        f"workers={workers}; sleep={args.sleep}; already done pairs {len(done)} "
        f"(incl empty={len(empty_pairs)})"
    )

    jobs: list[tuple[str, str, str, str, int]] = []
    for t in topics:
        dash = t["dashboard_topic"]
        p = t["primary"]
        et, eid, dname = p["openalex_entity_type"], p["openalex_id"], p["display_name"]
        for year in years:
            if (eid, year) in done:
                print(f"SKIP {dash} {eid} {year}", flush=True)
                continue
            jobs.append((dash, et, eid, dname, year))

    print(f"QUEUE {len(jobs)} fetches", flush=True)
    if not jobs:
        n_rows = count_csv_rows(CSV_PATH)
        write_manifest(topics, years, n_rows, done, planned, workers)
        print("DONE nothing to fetch")
        return

    write_lock = threading.Lock()
    limiter = RateLimiter(args.sleep)
    state = {
        "fetched_this_run": 0,
        "rows_this_run": 0,
        "empty_this_run": 0,
        "errors": [],
        "stopped_budget": False,
    }

    def persist_progress() -> None:
        PROGRESS_PATH.write_text(
            json.dumps(
                {
                    "updated": utc_now(),
                    "years_requested": years,
                    "workers": workers,
                    "fetched_this_run": state["fetched_this_run"],
                    "rows_this_run": state["rows_this_run"],
                    "empty_this_run": state["empty_this_run"],
                    "done_pairs": len(done),
                    "planned_pairs": planned,
                    "daily_remaining_usd": limiter.last_remaining,
                    "stop_reason": limiter.stop_reason or None,
                    "errors": state["errors"],
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def maybe_check_budget(force: bool = False) -> None:
        if not API_KEY:
            return
        with write_lock:
            n = state["fetched_this_run"]
            should = force or (n > 0 and n % RATE_CHECK_EVERY == 0)
        if not should:
            return
        try:
            rl = check_rate_limit()
            rem = remaining_usd(rl)
            limiter.last_remaining = rem
            if rem is not None:
                print(
                    f"  BUDGET daily_remaining_usd={rem} "
                    f"({KEY_POOL.label() if KEY_POOL else 'single'})",
                    flush=True,
                )
                if rem < args.min_remaining_usd:
                    if KEY_POOL and KEY_POOL.mark_exhausted(f"daily_remaining_usd={rem}"):
                        print(f"  continuing on {KEY_POOL.label()}", flush=True)
                    else:
                        limiter.request_stop(
                            f"daily_remaining_usd={rem} < {args.min_remaining_usd}"
                        )
                        state["stopped_budget"] = True
        except Exception as e:  # noqa: BLE001
            print(f"  WARN rate-limit check failed: {redact_text(str(e))}", flush=True)

    def fetch_one(job: tuple[str, str, str, str, int]) -> dict:
        dash, et, eid, dname, year = job
        if not limiter.wait_turn():
            return {"skipped": True, "dashboard_topic": dash, "openalex_id": eid, "year": year}
        print(f"FETCH {dash} {eid} {year} ...", flush=True)
        try:
            url, resp = works_group_by_country(et, eid, year)
            rows = groups_to_rows(dash, et, eid, dname, year, resp)
            with write_lock:
                if rows:
                    append_rows(CSV_PATH, rows)
                else:
                    empty_pairs.add((eid, year))
                    save_empty_pairs(EMPTY_PATH, empty_pairs)
                    state["empty_this_run"] += 1
                done.add((eid, year))
                state["fetched_this_run"] += 1
                state["rows_this_run"] += len(rows)
                with REQUEST_LOG_PATH.open("a", encoding="utf-8") as lf:
                    lf.write(
                        json.dumps(
                            {
                                "ts": utc_now(),
                                "dashboard_topic": dash,
                                "openalex_id": eid,
                                "year": year,
                                "url": redact_url(url),
                                "auth": "api_key" if API_KEY else "mailto",
                                "n_groups": len(rows),
                                "meta": resp.get("meta"),
                            }
                        )
                        + "\n"
                    )
                if state["fetched_this_run"] % 5 == 0:
                    persist_progress()
                top = sorted(rows, key=lambda r: r["works_count"], reverse=True)[:3]
            print(
                f"  +{len(rows)} rows; top {[(r['country_iso2'], r['works_count']) for r in top]}",
                flush=True,
            )
            maybe_check_budget()
            return {
                "ok": True,
                "dashboard_topic": dash,
                "openalex_id": eid,
                "year": year,
                "n_rows": len(rows),
            }
        except Exception as e:  # noqa: BLE001
            err_s = redact_text(str(e))
            err = {"dashboard_topic": dash, "openalex_id": eid, "year": year, "error": err_s}
            with write_lock:
                state["errors"].append(err)
            print(f"  ERROR {err}", flush=True)
            if "429" in err_s or "Insufficient budget" in err_s or "exhausted" in err_s.lower():
                if KEY_POOL and KEY_POOL.mark_exhausted(err_s[:80]):
                    print(f"  continuing on {KEY_POOL.label()} after error", flush=True)
                else:
                    limiter.request_stop(f"HTTP/budget error: {err_s[:120]}")
                    state["stopped_budget"] = True
            return {"ok": False, **err}

    # Submit in topic-priority order already in jobs list; small stagger between submissions
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = []
        for i, job in enumerate(jobs):
            if limiter.stop:
                break
            futures.append(pool.submit(fetch_one, job))
            # brief stagger so workers don't all hit wait_turn at t=0
            if i + 1 < len(jobs) and workers > 1:
                time.sleep(min(0.05, args.sleep / max(workers, 1)))
        for fut in as_completed(futures):
            _ = fut.result()
            if limiter.stop:
                # remaining queued futures will no-op via wait_turn / early return
                pass

    maybe_check_budget(force=True)
    n_rows = count_csv_rows(CSV_PATH)
    write_manifest(topics, years, n_rows, done, planned, workers)
    persist_progress()
    final = {
        "updated": utc_now(),
        "years_requested": years,
        "workers": workers,
        "fetched_this_run": state["fetched_this_run"],
        "rows_this_run": state["rows_this_run"],
        "empty_this_run": state["empty_this_run"],
        "csv_rows_total": n_rows,
        "done_pairs": len(done),
        "planned_pairs": planned,
        "daily_remaining_usd": limiter.last_remaining,
        "stop_reason": limiter.stop_reason or None,
        "errors": state["errors"],
        "quantum_id": "C58053490",
    }
    PROGRESS_PATH.write_text(json.dumps(final, indent=2), encoding="utf-8")
    print(
        f"DONE fetched={state['fetched_this_run']} rows_this_run={state['rows_this_run']} "
        f"empty={state['empty_this_run']} csv_rows={n_rows} errors={len(state['errors'])} "
        f"workers={workers} remaining_usd={limiter.last_remaining}"
    )
    if limiter.stop_reason:
        print(f"STOPPED: {limiter.stop_reason}", flush=True)
    if state["errors"] and not state["stopped_budget"]:
        sys.exit(2)
    if state["stopped_budget"] and jobs and state["fetched_this_run"] < len(jobs):
        sys.exit(3)


if __name__ == "__main__":
    main()
