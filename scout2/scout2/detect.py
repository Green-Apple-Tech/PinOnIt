"""Detect Calendly on discovered domains (homepage + common paths)."""

from __future__ import annotations

import re
from .db import fetch_by_status, get_client, upsert_lead
from .politeness import PoliteFetcher

PATHS = ("", "/book", "/booking", "/schedule", "/contact", "/about")
CALENDLY_HREF = re.compile(
    r"""https?://(?:www\.)?calendly\.com/[^\s"'<>]+""",
    re.I,
)
CALENDLY_ANY = re.compile(r"calendly\.com", re.I)


def first_calendly_url(html: str) -> str | None:
    m = CALENDLY_HREF.search(html or "")
    if m:
        return m.group(0).rstrip(").,;'\"")
    if CALENDLY_ANY.search(html or ""):
        return "https://calendly.com/"
    return None


async def detect_domain(fetcher: PoliteFetcher, domain: str) -> tuple[bool, str | None]:
    base = f"https://{domain}"
    for path in PATHS:
        url = base if path == "" else f"{base}{path}"
        status, final, html = await fetcher.get_text(url)
        if not html:
            continue
        cal = first_calendly_url(html)
        if cal:
            return True, cal
        _ = status, final
    return False, None


async def run_detect(limit: int = 200) -> dict:
    sb = get_client()
    rows = fetch_by_status(sb, "discovered", limit=limit)
    found = 0
    none = 0

    async with PoliteFetcher() as fetcher:
        for row in rows:
            domain = row["domain"]
            ok, cal_url = await detect_domain(fetcher, domain)
            if ok:
                upsert_lead(
                    sb,
                    {
                        "domain": domain,
                        "calendly_url": cal_url,
                        "status": "detected",
                        "source": row.get("source"),
                    },
                )
                found += 1
            else:
                upsert_lead(
                    sb,
                    {
                        "domain": domain,
                        "status": "no_calendly",
                        "source": row.get("source"),
                    },
                )
                none += 1

    return {"processed": len(rows), "calendly_found": found, "no_calendly": none}
