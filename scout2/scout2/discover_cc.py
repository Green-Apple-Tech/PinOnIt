"""
Discover domains that may use Calendly.

Plan B (default): seedlist — fetch homepage HTML and queue domains that mention calendly.com.
Places: see discover_places.py (Google Places → domains → same queue).

Common Crawl note: CDX indexes by URL, not page content, so reverse-link
"who links TO calendly.com" is not available cheaply via CDX. Bulk WET scanning
is a later optional path; this module stays seedlist-first so we don't build a dead end.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from .db import get_client, upsert_lead
from .politeness import PoliteFetcher, domain_of
from .settings import settings

CALENDLY_RE = re.compile(r"calendly\.com", re.I)


def load_seed_domains(path: Path | None = None) -> list[str]:
    p = path or settings()["domains_path"]
    if not p.exists():
        return []
    out: list[str] = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        d = domain_of(line)
        if d:
            out.append(d)
    return sorted(set(out))


async def discover_from_seedlist(
    seed_path: Path | None = None,
    *,
    enqueue_all: bool = True,
) -> dict:
    """
    Fetch each seed homepage. If enqueue_all, every domain is queued as discovered
    (detect stage finds Calendly). If False, only queue when homepage HTML mentions calendly.
    """
    domains = load_seed_domains(seed_path)
    sb = get_client()
    queued = 0
    skipped = 0

    async with PoliteFetcher() as fetcher:
        for d in domains:
            url = f"https://{d}"
            status, _, html = await fetcher.get_text(url)
            hit = bool(html and CALENDLY_RE.search(html))
            if enqueue_all or hit:
                upsert_lead(
                    sb,
                    {
                        "domain": d,
                        "source": "seedlist",
                        "status": "discovered",
                        "calendly_url": None,
                    },
                )
                queued += 1
            else:
                skipped += 1
            _ = status

    return {"source": "seedlist", "seen": len(domains), "queued": queued, "skipped": skipped}


async def discover(source: str = "seedlist", **kwargs) -> dict:
    source = (source or "seedlist").lower()
    if source == "seedlist":
        return await discover_from_seedlist(**kwargs)
    if source == "places":
        from .discover_places import discover_places

        return await discover_places(**kwargs)
    if source == "commoncrawl":
        return {
            "source": "commoncrawl",
            "queued": 0,
            "note": (
                "CDX cannot reverse-search page content for calendly.com. "
                "Use source=seedlist or source=places. Optional later: bulk WET scan."
            ),
        }
    raise SystemExit(f"Unknown discover source: {source}. Use seedlist | places")


def load_yaml_list(path: Path, key: str) -> list[str]:
    data = yaml.safe_load(path.read_text()) or {}
    items = data.get(key) or []
    return [str(x).strip() for x in items if str(x).strip()]
