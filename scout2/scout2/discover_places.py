"""Google Places Text Search → business websites → domains queue."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .db import get_client, upsert_lead
from .discover_cc import load_yaml_list
from .politeness import domain_of
from .settings import require_env, settings

PLACES_TEXT = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"


def website_to_domain(website: str | None) -> str | None:
    if not website:
        return None
    d = domain_of(website)
    return d or None


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
) -> dict:
    require_env("google_places_key", "supabase_url", "supabase_service_key")
    s = settings()
    niches = niches or load_yaml_list(s["niches_path"], "niches")
    metros = metros or load_yaml_list(s["metros_path"], "metros")
    key = s["google_places_key"]
    sb = get_client()

    queries = [f"{n} in {m}" for n in niches for m in metros]
    if limit_queries is not None:
        queries = queries[:limit_queries]

    queued = 0
    seen_domains: set[str] = set()
    api_calls = 0

    async with httpx.AsyncClient(timeout=20.0) as client:
        for q in queries:
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
                if not d or d in seen_domains:
                    continue
                # Skip calendly itself and obvious aggregators
                if d.endswith("calendly.com") or d in {"facebook.com", "instagram.com", "linktr.ee"}:
                    continue
                seen_domains.add(d)
                upsert_lead(
                    sb,
                    {
                        "domain": d,
                        "source": "places",
                        "status": "discovered",
                        "niche": None,
                    },
                )
                queued += 1

    return {
        "source": "places",
        "queries": len(queries),
        "unique_domains": len(seen_domains),
        "queued": queued,
        "approx_api_calls": api_calls,
    }
