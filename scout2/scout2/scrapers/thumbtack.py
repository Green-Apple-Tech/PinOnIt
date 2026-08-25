"""Thumbtack pro-profile scraper via ScaleSerp."""

from __future__ import annotations

from urllib.parse import urlparse

import httpx

from ..politeness import PoliteFetcher
from ..scaleserp import organic_links
from .common import (
    Deadline,
    Known,
    ScrapeStats,
    business_domain,
    extract_profile,
    ingest_website,
    is_http_url,
    load_directory_niches,
)

SKIP_PATH = (
    "/blog",
    "/learn",
    "/help",
    "/about",
    "/login",
    "/join",
    "/search",
    "/near-me",
    "/pro-resources",
    "/cost",
    "/how-it-works",
)


def is_thumbtack_profile(url: str) -> bool:
    try:
        p = urlparse(url)
    except Exception:
        return False
    host = (p.hostname or "").lower()
    if "thumbtack.com" not in host:
        return False
    path = p.path.lower()
    if not path or path == "/":
        return False
    if any(path.startswith(s) for s in SKIP_PATH):
        return False
    return True


async def run_thumbtack(
    *,
    known: Known,
    stats: ScrapeStats,
    deadline: Deadline | None = None,
    pages: int = 1,
    niches: list[str] | None = None,
    location: str = "USA",
) -> ScrapeStats:
    niches = niches or load_directory_niches()
    loc = (location or "USA").strip() or "USA"
    async with httpx.AsyncClient() as client, PoliteFetcher() as fetcher:
        for niche in niches:
            if deadline and deadline.expired():
                break
            q = f"site:thumbtack.com {niche} {loc}"
            links = await organic_links(
                client,
                q,
                pages=pages,
                max_links=20,
                deadline_expired=(deadline.expired if deadline else None),
            )
            for url in links:
                if deadline and deadline.expired():
                    break
                if not is_http_url(url) or not is_thumbtack_profile(url):
                    continue
                _, _, html = await fetcher.get_text(url)
                if not html:
                    continue
                rec = extract_profile(html, url)
                rec["category"] = niche
                if not rec.get("domain"):
                    rec["domain"] = business_domain(rec.get("website"))
                if not rec.get("domain"):
                    continue
                await ingest_website(
                    fetcher,
                    source="thumbtack",
                    category=niche,
                    rec=rec,
                    known=known,
                    stats=stats,
                    deadline=deadline,
                )
    return stats
