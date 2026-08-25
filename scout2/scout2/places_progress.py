"""Remember which Google Places searches already ran so overnight jobs don't repeat them."""

from __future__ import annotations

import json
import os
from datetime import date

from .settings import ROOT

DONE_PATH = ROOT / "data" / "places_queries_done.txt"
DAILY_PATH = ROOT / "data" / "places_daily.json"


def load_done_queries() -> set[str]:
    if not DONE_PATH.exists():
        return set()
    return {
        line.strip()
        for line in DONE_PATH.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def mark_query_done(query: str) -> None:
    DONE_PATH.parent.mkdir(parents=True, exist_ok=True)
    done = load_done_queries()
    if query in done:
        return
    with DONE_PATH.open("a") as f:
        f.write(query.strip() + "\n")
    bump_daily_count(1)


def city_from_query(query: str) -> str:
    """'{niche} in {City ST}' → 'City ST'."""
    parts = query.split(" in ", 1)
    return parts[1].strip() if len(parts) == 2 else query.strip()


def place_queries(niches: list[str], metros: list[str]) -> list[str]:
    """City first, then every niche in that city — knock out one city at a time."""
    return [f"{n} in {m}" for m in metros for n in niches]


def next_queries(
    all_queries: list[str],
    limit: int | None = None,
    *,
    limit_cities: int | None = None,
) -> list[str]:
    done = load_done_queries()
    pending = [q for q in all_queries if q not in done]
    if limit_cities is not None:
        picked: list[str] = []
        cities: list[str] = []
        for q in pending:
            city = city_from_query(q)
            if city not in cities:
                if len(cities) >= max(0, limit_cities):
                    break
                cities.append(city)
            picked.append(q)
        pending = picked
    if limit is None:
        return pending
    return pending[: max(0, limit)]


def remaining_cities(all_queries: list[str]) -> list[str]:
    done = load_done_queries()
    out: list[str] = []
    seen: set[str] = set()
    for q in all_queries:
        if q in done:
            continue
        city = city_from_query(q)
        if city not in seen:
            seen.add(city)
            out.append(city)
    return out


def daily_query_cap() -> int | None:
    raw = (os.environ.get("SCOUT2_DAILY_QUERY_CAP") or "80").strip()
    if raw in {"0", "off", "none", "unlimited"}:
        return None
    try:
        n = int(raw)
    except ValueError:
        return 80
    return None if n <= 0 else n


def _load_daily() -> dict:
    if not DAILY_PATH.exists():
        return {"date": date.today().isoformat(), "count": 0}
    try:
        data = json.loads(DAILY_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        data = {}
    today = date.today().isoformat()
    if data.get("date") != today:
        return {"date": today, "count": 0}
    return {"date": today, "count": int(data.get("count") or 0)}


def daily_count() -> int:
    return _load_daily()["count"]


def remaining_daily_quota(*, ignore: bool = False) -> int | None:
    if ignore:
        return None
    cap = daily_query_cap()
    if cap is None:
        return None
    return max(0, cap - daily_count())


def bump_daily_count(n: int) -> None:
    if n <= 0:
        return
    DAILY_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = _load_daily()
    data["count"] = int(data.get("count") or 0) + n
    DAILY_PATH.write_text(json.dumps(data) + "\n")


def places_status(niches: list[str], metros: list[str]) -> dict:
    all_queries = place_queries(niches, metros)
    done = load_done_queries()
    pending = [q for q in all_queries if q not in done]
    cities_left = remaining_cities(all_queries)
    next_city = cities_left[0] if cities_left else None
    next_left = (
        sum(1 for q in pending if city_from_query(q) == next_city) if next_city else 0
    )
    cap = daily_query_cap()
    used = daily_count()
    return {
        "cities_total": len(metros),
        "cities_left": len(cities_left),
        "next_city": next_city,
        "next_city_queries_left": next_left,
        "queries_total": len(all_queries),
        "queries_done": sum(1 for q in all_queries if q in done),
        "queries_left": len(pending),
        "daily_cap": cap,
        "daily_used": used,
        "daily_left": None if cap is None else max(0, cap - used),
    }
