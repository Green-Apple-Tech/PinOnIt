"""Chamber of Commerce member-directory scraper."""

from __future__ import annotations

import httpx

from ..politeness import PoliteFetcher, domain_of
from ..scaleserp import organic_links
from .common import (
    Deadline,
    Known,
    ScrapeStats,
    extract_directory_members,
    ingest_website,
    is_http_url,
    load_directory_niches,
)

CHAMBER_HINTS = ("chamber", "directory", "member", "commerce")


def _looks_like_directory(url: str) -> bool:
    blob = url.lower()
    return any(h in blob for h in CHAMBER_HINTS)


async def run_chamber(
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
            q = f'"chamber of commerce" "member directory" {niche} {loc}'
            links = await organic_links(
                client,
                q,
                pages=pages,
                max_links=15,
                deadline_expired=(deadline.expired if deadline else None),
            )
            for url in links:
                if deadline and deadline.expired():
                    break
                if not is_http_url(url) or not _looks_like_directory(url):
                    continue
                host = domain_of(url)
                if not host:
                    continue
                _, _, html = await fetcher.get_text(url)
                if not html:
                    continue
                members = extract_directory_members(html, url, niche)
                for rec in members:
                    if deadline and deadline.expired():
                        break
                    await ingest_website(
                        fetcher,
                        source="chamber",
                        category=niche,
                        rec=rec,
                        known=known,
                        stats=stats,
                        deadline=deadline,
                    )
    return stats
