"""Google Places Text Search → business websites → domains queue."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .db import fetch_known_keys, get_client, upsert_lead
from .discover_cc import load_yaml_list
from .places_progress import (
    city_from_query,
    mark_query_done,
    next_queries,
    place_queries,
    places_status,
    remaining_daily_quota,
)
from .politeness import domain_of
from .settings import require_env, settings

PLACES_TEXT = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"


def website_to_domain(website: str | None) -> str | None:
    if not website:
        return None
    d = domain_of(website)
    return d or None


def _metro_city_state(metro: str) -> tuple[str | None, str | None]:
    raw = (metro or "").strip()
    if not raw:
        return None, None
    parts = raw.rsplit(" ", 1)
    if len(parts) == 2 and len(parts[1]) == 2 and parts[1].isalpha():
        return parts[0].strip(), parts[1].upper()
    return raw, None


async def _text_search(
    client: httpx.AsyncClient, query: str, key: str, *, max_pages: int = 2
) -> list[dict[str, Any]]:
    results: list[dict] = []
    params: dict[str, Any] = {"query": query, "key": key}
    for _ in range(max_pages):
        r = await client.get(PLACES_TEXT, params=params)
        r.raise_for_status()
        data = r.json()
        results.extend(data.get("results") or [])
        token = data.get("next_page_token")
        if not token:
            break
        # Google requires a short delay before next_page_token works
        await asyncio.sleep(2.0)
        params = {"pagetoken": token, "key": key}
    return results


async def _place_website(
    client: httpx.AsyncClient, place_id: str, key: str
) -> str | None:
    r = await client.get(
        PLACES_DETAILS,
        params={"place_id": place_id, "fields": "website", "key": key},
    )
    r.raise_for_status()
    return (r.json().get("result") or {}).get("website")


async def discover_places(
    *,
    niches: list[str] | None = None,
    metros: list[str] | None = None,
    max_pages: int = 2,
    limit_queries: int | None = None,
    limit_cities: int | None = None,
    ignore_daily_cap: bool = False,
) -> dict:
    require_env("google_places_key", "supabase_url", "supabase_service_key")
    s = settings()
    niches = niches or load_yaml_list(s["niches_path"], "niches")
    metros = metros or load_yaml_list(s["metros_path"], "metros")
    key = s["google_places_key"]
    sb = get_client()
    known, _emails = fetch_known_keys(sb)

    all_queries = place_queries(niches, metros)
    quota = remaining_daily_quota(ignore=ignore_daily_cap)
    stopped = None
    if quota == 0:
        stopped = "daily_cap"
        queries: list[str] = []
    else:
        queries = next_queries(
            all_queries, limit_queries, limit_cities=limit_cities
        )
        if quota is not None:
            queries = queries[:quota]

    queued = 0
    skipped_existing = 0
    seen_domains: set[str] = set(known)
    api_calls = 0

    async with httpx.AsyncClient(timeout=20.0) as client:
        for q in queries:
            metro = city_from_query(q)
            city, state = _metro_city_state(metro)
            places = await _text_search(client, q, key, max_pages=max_pages)
            api_calls += 1
            for place in places:
                pid = place.get("place_id")
                if not pid:
                    continue
                website = await _place_website(client, pid, key)
                api_calls += 1
                await asyncio.sleep(0.05)
                d = website_to_domain(website)
                if not d:
                    continue
                d = d.lower()
                if d.endswith("calendly.com") or d in {
                    "facebook.com",
                    "instagram.com",
                    "linktr.ee",
                }:
                    continue
                if d in seen_domains:
                    skipped_existing += 1
                    continue
                seen_domains.add(d)
                upsert_lead(
                    sb,
                    {
                        "domain": d,
                        "source": "places",
                        "status": "discovered",
                        "niche": None,
                        "city": city,
                        "state": state,
                    },
                )
                queued += 1
            mark_query_done(q)

    progress = places_status(niches, metros)
    if not queries and not stopped:
        stopped = "done" if progress["queries_left"] == 0 else "daily_cap"
    return {
        "source": "places",
        "queries": len(queries),
        "query_list": queries,
        "unique_new_domains": queued,
        "skipped_already_in_sheet": skipped_existing,
        "queued": queued,
        "approx_api_calls": api_calls,
        "places_searches_left": progress["queries_left"],
        "cities_left": progress["cities_left"],
        "next_city": progress["next_city"],
        "daily_left": progress["daily_left"],
        "stopped": stopped,
    }
