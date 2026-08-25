"""Fingerprint domains: scheduler, meeting links, phone-only booking signal."""

from __future__ import annotations

import re
from typing import Optional

from .db import fetch_by_status, get_client, upsert_lead
from .dns_stack import lookup_email_provider
from .politeness import PoliteFetcher
from .sheets_sync import maybe_sync_sheets

PATHS = ("", "/book", "/booking", "/schedule", "/appointments", "/contact")

# First match wins (calendly preferred if a site embeds more than one).
SCHEDULERS: dict[str, tuple[re.Pattern[str], ...]] = {
    "calendly": (re.compile(r"calendly\.com", re.I),),
    "acuity": (
        re.compile(r"acuityscheduling\.com", re.I),
        re.compile(r"squarespace-scheduling", re.I),
        re.compile(r"scheduling\.squarespace\.com", re.I),
        re.compile(r"squarespace\.com/scheduling", re.I),
    ),
    "square": (
        re.compile(r"squareup\.com/appointments", re.I),
        re.compile(r"app\.squareup\.com", re.I),
        re.compile(r"book(ing)?\.squareup\.com", re.I),
        re.compile(r"square\.site", re.I),
        re.compile(r"squareappointments", re.I),
    ),
    "setmore": (re.compile(r"setmore\.com", re.I),),
    "simplybook": (
        re.compile(r"simplybook\.me", re.I),
        re.compile(r"simplybookit\.com", re.I),
    ),
    "youcanbook.me": (re.compile(r"youcanbook\.me", re.I),),
    "booksy": (re.compile(r"booksy\.com", re.I),),
    "vagaro": (re.compile(r"vagaro\.com", re.I),),
    "schedulista": (re.compile(r"schedulista\.com", re.I),),
    "appointlet": (re.compile(r"appointlet\.com", re.I),),
    "cal.com": (re.compile(r"(?:^|[^\w.])cal\.com(?:[^\w]|$)", re.I),),
    "tidycal": (re.compile(r"tidycal\.com", re.I),),
}

HREF_RE = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.I)
ZOOM_RE = re.compile(r"zoom\.us/j/", re.I)
TEAMS_RE = re.compile(r"teams\.microsoft\.com/l/", re.I)
TEL_RE = re.compile(r"""(?:href\s*=\s*["']tel:|tel:)""", re.I)
CALL_TO_BOOK_RE = re.compile(
    r"call\s+(?:us\s+|now\s+)?to\s+(?:book|schedule)|"
    r"call\s+to\s+(?:book|schedule)|"
    r"phone\s+(?:us\s+)?to\s+(?:book|schedule)|"
    r"please\s+call\s+to\s+(?:book|schedule)",
    re.I,
)


def _clean_url(raw: str) -> str:
    return raw.strip().rstrip(").,;'\"").split()[0] if raw.strip() else ""


def _booking_url_for(html: str, patterns: tuple[re.Pattern[str], ...]) -> Optional[str]:
    for href in HREF_RE.findall(html or ""):
        if any(p.search(href) for p in patterns):
            url = _clean_url(href)
            if url.startswith("//"):
                url = "https:" + url
            if re.match(r"^https?://", url, re.I):
                return url
    for p in patterns:
        m = p.search(html or "")
        if not m:
            continue
        start = max(0, m.start() - 80)
        window = (html or "")[start : m.end() + 80]
        um = re.search(r"https?://[^\s\"'<>]+", window, re.I)
        if um and any(pp.search(um.group(0)) for pp in patterns):
            return _clean_url(um.group(0))
    return None


def detect_scheduler(html: str) -> tuple[str, Optional[str]]:
    blob = html or ""
    for name, patterns in SCHEDULERS.items():
        if any(p.search(blob) for p in patterns):
            return name, _booking_url_for(blob, patterns)
    return "none", None


def detect_meeting_links(html: str) -> tuple[bool, bool]:
    blob = html or ""
    return bool(ZOOM_RE.search(blob)), bool(TEAMS_RE.search(blob))


def detect_phone_only(html: str, scheduler_name: str) -> bool:
    if scheduler_name and scheduler_name != "none":
        return False
    blob = html or ""
    return bool(TEL_RE.search(blob) or CALL_TO_BOOK_RE.search(blob))


async def fingerprint_domain(fetcher: PoliteFetcher, domain: str) -> dict:
    base = f"https://{domain}"
    pages: list[str] = []
    for path in PATHS:
        url = base if path == "" else f"{base}{path}"
        _, _, html = await fetcher.get_text(url)
        if html:
            pages.append(html)
    blob = "\n".join(pages)
    scheduler_name, booking_url = detect_scheduler(blob)
    zoom_links, teams_links = detect_meeting_links(blob)
    phone_only = detect_phone_only(blob, scheduler_name)
    email_provider = await lookup_email_provider(domain)
    calendly_url = booking_url if scheduler_name == "calendly" else None
    return {
        "scheduler_name": scheduler_name,
        "booking_url": booking_url,
        "calendly_url": calendly_url,
        "zoom_links": zoom_links,
        "teams_links": teams_links,
        "phone_only": phone_only,
        "email_provider": email_provider,
    }


async def run_fingerprint(limit: int = 200) -> dict:
    sb = get_client()
    rows = fetch_by_status(sb, "discovered", limit=limit)
    with_scheduler = 0
    none = 0
    phone_only_n = 0

    async with PoliteFetcher() as fetcher:
        for row in rows:
            domain = row["domain"]
            fp = await fingerprint_domain(fetcher, domain)
            if fp["scheduler_name"] != "none":
                with_scheduler += 1
            else:
                none += 1
            if fp["phone_only"]:
                phone_only_n += 1
            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "status": "fingerprinted",
                    "source": row.get("source"),
                    "niche": row.get("niche"),
                    **fp,
                },
            )

    return {
        "processed": len(rows),
        "with_scheduler": with_scheduler,
        "scheduler_none": none,
        "phone_only": phone_only_n,
        "sheets": maybe_sync_sheets(),
    }


# Back-compat name used by older docs / muscle memory.
run_detect = run_fingerprint
