"""ScaleSerp organic search for Calendly-using SMBs (night-session SERP pass)."""

from __future__ import annotations

import httpx

from ..politeness import PoliteFetcher, domain_of
from ..scaleserp import organic_links
from .common import (
    DIRECTORY_HOSTS,
    SKIP_DOMAINS,
    Deadline,
    Known,
    ScrapeStats,
    business_domain,
    extract_profile,
    ingest_website,
    is_http_url,
    is_skipped_host,
    load_directory_niches,
)


def _usable_result(url: str) -> bool:
    if not is_http_url(url):
        return False
    d = domain_of(url)
    if not d or is_skipped_host(d):
        return False
    host = d.removeprefix("www.")
    if host in DIRECTORY_HOSTS or host in SKIP_DOMAINS:
        return False
    if "chamber" in host and "commerce" in url.lower():
        return False
    return True


async def run_serp(
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
            q = f'"{niche}" calendly {loc}'
            links = await organic_links(
                client,
                q,
                pages=pages,
                max_links=15,
                deadline_expired=(deadline.expired if deadline else None),
            )
            seen_domains: set[str] = set()
            for url in links:
                if deadline and deadline.expired():
                    break
                if not _usable_result(url):
                    continue
                domain = business_domain(url)
                if not domain or domain in seen_domains:
                    continue
                seen_domains.add(domain)
                _, _, html = await fetcher.get_text(url)
                rec = extract_profile(html, url) if html else {}
                rec["domain"] = rec.get("domain") or domain
                rec["website"] = rec.get("website") or url
                rec["category"] = niche
                await ingest_website(
                    fetcher,
                    source="serp",
                    category=niche,
                    rec=rec,
                    known=known,
                    stats=stats,
                    deadline=deadline,
                )
    return stats
