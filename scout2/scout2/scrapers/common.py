"""Shared helpers for directory + SERP scrapers."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from html import unescape
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..db import get_client, insert_new_lead
from ..discover_cc import load_yaml_list
from ..sheets_sync import queue_lead_for_sheets
from ..extract import EMAIL_RE, emails_from_html, pick_best
from ..fingerprint import detect_scheduler
from ..politeness import PoliteFetcher, domain_of
from ..settings import settings

DIRECTORY_SOURCES = (
    "serp",
    "chamber",
    "thumbtack",
    "bark",
    "psychology_today",
    "wedding",
    "coaches",
    "houzz",
    "angi",
    "bbb",
    "avvo",
    "licenses",
    "calendly_web",
)

SKIP_DOMAINS = frozenset(
    {
        "google.com",
        "googleapis.com",
        "gstatic.com",
        "youtube.com",
        "facebook.com",
        "fb.com",
        "instagram.com",
        "linkedin.com",
        "twitter.com",
        "x.com",
        "reddit.com",
        "quora.com",
        "pinterest.com",
        "tiktok.com",
        "yelp.com",
        "wikipedia.org",
        "amazon.com",
        "github.com",
        "medium.com",
        "wordpress.com",
        "wordpress.org",
        "wix.com",
        "squarespace.com",
        "trustpilot.com",
        "g2.com",
        "capterra.com",
        "calendly.com",
        "acuityscheduling.com",
        "psychologytoday.com",
        "theknot.com",
        "weddingwire.com",
        "houzz.com",
        "angi.com",
        "angieslist.com",
        "bbb.org",
        "avvo.com",
        "noomii.com",
        "coachingfederation.org",
        "coachfederation.org",
        "builtwith.com",
        "publicwww.com",
        "similartech.com",
        "maps.google.com",
        "goo.gl",
        "bit.ly",
        "apple.com",
        "microsoft.com",
    }
)

DIRECTORY_HOSTS = frozenset(
    {
        "thumbtack.com",
        "www.thumbtack.com",
        "bark.com",
        "www.bark.com",
        "bark.us",
        "psychologytoday.com",
        "theknot.com",
        "weddingwire.com",
        "houzz.com",
        "angi.com",
        "angieslist.com",
        "bbb.org",
        "avvo.com",
        "noomii.com",
        "coachingfederation.org",
        "coachfederation.org",
    }
)

PHONE_RE = re.compile(
    r"(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}"
)
CITY_STATE_RE = re.compile(
    r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b"
)
US_STATES = frozenset(
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS "
    "MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV "
    "WI WY DC".split()
)


@dataclass
class Deadline:
    hours: float
    start: float = field(default_factory=time.monotonic)

    @property
    def limit_sec(self) -> float:
        return max(0.0, float(self.hours) * 3600.0)

    def elapsed(self) -> float:
        return time.monotonic() - self.start

    def remaining(self) -> float:
        return self.limit_sec - self.elapsed()

    def expired(self) -> bool:
        return self.remaining() <= 0

    def remaining_label(self) -> str:
        sec = max(0.0, self.remaining())
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        return f"{h}h {m}m"

    def duration_label(self) -> str:
        sec = max(0.0, self.elapsed())
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        return f"{h}h {m:02d}m"


@dataclass
class ScrapeStats:
    new_by_source: dict[str, int] = field(
        default_factory=lambda: {s: 0 for s in DIRECTORY_SOURCES}
    )
    dupes: int = 0

    @property
    def total_new(self) -> int:
        return sum(self.new_by_source.values())


@dataclass
class Known:
    domains: set[str]
    emails: set[str]

    def is_dupe(self, domain: str | None, email: str | None) -> bool:
        d = (domain or "").strip().lower()
        e = (email or "").strip().lower()
        if d and d in self.domains:
            return True
        if e and e in self.emails:
            return True
        return False

    def remember(self, domain: str | None, email: str | None) -> None:
        d = (domain or "").strip().lower()
        e = (email or "").strip().lower()
        if d:
            self.domains.add(d)
        if e:
            self.emails.add(e)


def load_directory_niches() -> list[str]:
    return load_yaml_list(settings()["directory_niches_path"], "niches")


def load_metros() -> list[str]:
    return load_yaml_list(settings()["metros_path"], "metros")


def is_http_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in {"http", "https"} and bool(p.netloc)
    except Exception:
        return False


def is_skipped_host(host: str) -> bool:
    h = host.lower().removeprefix("www.")
    if h in SKIP_DOMAINS or h in DIRECTORY_HOSTS:
        return True
    return any(h.endswith("." + d) for d in SKIP_DOMAINS)


def business_domain(url: str | None) -> str | None:
    if not url:
        return None
    d = domain_of(url)
    if not d or is_skipped_host(d):
        return None
    if d.removeprefix("www.") in {h.removeprefix("www.") for h in DIRECTORY_HOSTS}:
        return None
    return d


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return (raw or "").strip()
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def first_phone(text: str) -> str | None:
    m = PHONE_RE.search(text or "")
    return normalize_phone(m.group(0)) if m else None


def city_state_from_text(text: str) -> tuple[str | None, str | None]:
    for m in CITY_STATE_RE.finditer(text or ""):
        city, st = m.group(1).strip(), m.group(2).upper()
        if st in US_STATES:
            return city, st
    return None, None


def json_ld_address(soup: BeautifulSoup) -> tuple[str | None, str | None, str | None]:
    import json

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except Exception:
            continue
        blobs = data if isinstance(data, list) else [data]
        for blob in blobs:
            if not isinstance(blob, dict):
                continue
            addr = blob.get("address")
            if isinstance(addr, list) and addr:
                addr = addr[0]
            if not isinstance(addr, dict):
                continue
            city = addr.get("addressLocality") or addr.get("address_locality")
            region = addr.get("addressRegion") or addr.get("address_region")
            phone = blob.get("telephone")
            state = None
            if region:
                st = str(region).strip().upper()
                if len(st) == 2 and st in US_STATES:
                    state = st
            return (
                str(city).strip() if city else None,
                state,
                str(phone).strip() if phone else None,
            )
    return None, None, None


def website_hrefs(html: str, page_url: str) -> list[str]:
    soup = BeautifulSoup(html or "", "lxml")
    page_host = (urlparse(page_url).hostname or "").lower().removeprefix("www.")
    out: list[str] = []
    seen: set[str] = set()
    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        abs_url = urljoin(page_url, href)
        if not is_http_url(abs_url):
            continue
        host = (urlparse(abs_url).hostname or "").lower().removeprefix("www.")
        if not host or host == page_host or is_skipped_host(host):
            continue
        d = domain_of(abs_url)
        if not d or d in seen:
            continue
        seen.add(d)
        out.append(abs_url)
    return out


def extract_profile(html: str, page_url: str) -> dict[str, Any]:
    """One business from a profile (or thin) page."""
    soup = BeautifulSoup(html or "", "lxml")
    text = unescape(soup.get_text(" ", strip=True))
    emails = emails_from_html(html)
    page_host = domain_of(page_url)
    sites = website_hrefs(html, page_url)
    site = sites[0] if sites else None
    domain = business_domain(site)
    email, _rank = pick_best(emails, domain or page_host or "")
    city, state = city_state_from_text(text)
    ld_city, ld_state, ld_phone = json_ld_address(soup)
    phone = first_phone(text) or ld_phone
    name = ""
    h1 = soup.find("h1")
    if h1:
        name = h1.get_text(" ", strip=True)
    if not name:
        title = soup.find("title")
        name = title.get_text(" ", strip=True) if title else ""
    return {
        "name": name[:200] if name else None,
        "email": email,
        "phone": normalize_phone(phone) if phone else None,
        "website": site,
        "domain": domain,
        "city": city or ld_city,
        "state": (state or ld_state or "")[:2] or None,
    }


def _card_record(node, page_url: str, category: str) -> dict[str, Any] | None:
    html = str(node)
    rec = extract_profile(html, page_url)
    rec["category"] = category
    if rec.get("domain") or rec.get("email"):
        return rec
    return None


def extract_directory_members(
    html: str, page_url: str, category: str
) -> list[dict[str, Any]]:
    """Best-effort member cards from a chamber directory page."""
    soup = BeautifulSoup(html or "", "lxml")
    cards: list[Any] = []
    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip().lower()
        if href.startswith("mailto:") or href.startswith("tel:"):
            parent = a.find_parent(["li", "tr", "article", "section", "div"])
            if parent is not None and parent not in cards:
                cards.append(parent)
    seen_keys: set[tuple] = set()
    out: list[dict[str, Any]] = []
    for card in cards[:80]:
        rec = _card_record(card, page_url, category)
        if not rec:
            continue
        key = (rec.get("domain"), rec.get("email"))
        if key in seen_keys:
            continue
        seen_keys.add(key)
        out.append(rec)
    if len(out) >= 2:
        return out
    fallback = extract_profile(html, page_url)
    fallback["category"] = category
    if fallback.get("domain") or fallback.get("email"):
        return [fallback]
    return []


async def scan_calendly(fetcher: PoliteFetcher, domain: str) -> tuple[str, Optional[str]]:
    url = f"https://{domain}"
    _, _, html = await fetcher.get_text(url)
    if not html:
        return "no", None
    name, booking = detect_scheduler(html)
    if name == "calendly":
        return "yes", booking
    return "no", booking


def commit_lead(
    *,
    source: str,
    category: str,
    rec: dict[str, Any],
    calendly_detected: str,
    calendly_url: str | None,
    known: Known,
    stats: ScrapeStats,
) -> None:
    domain = rec.get("domain")
    email = rec.get("email")
    if not domain:
        return
    if known.is_dupe(domain, email):
        stats.dupes += 1
        return
    yes = calendly_detected == "yes"
    row = {
        "domain": domain,
        "email": email,
        "phone": rec.get("phone"),
        "city": rec.get("city"),
        "state": rec.get("state"),
        "category": category,
        "niche": category,
        "source": source,
        "calendly_detected": "yes" if yes else "no",
        "calendly_url": calendly_url if yes else None,
        "scheduler_name": "calendly" if yes else None,
        "booking_url": calendly_url if yes else None,
        "status": "fingerprinted" if yes else "no_calendly",
    }
    sb = get_client()
    if insert_new_lead(sb, row):
        known.remember(domain, email)
        stats.new_by_source[source] = stats.new_by_source.get(source, 0) + 1
        queue_lead_for_sheets(row)
    else:
        known.remember(domain, email)
        stats.dupes += 1


async def ingest_website(
    fetcher: PoliteFetcher,
    *,
    source: str,
    category: str,
    rec: dict[str, Any],
    known: Known,
    stats: ScrapeStats,
    deadline: Deadline | None = None,
) -> None:
    domain = rec.get("domain")
    if not domain:
        return
    if deadline and deadline.expired():
        return
    if known.is_dupe(domain, rec.get("email")):
        stats.dupes += 1
        return
    detected, booking = await scan_calendly(fetcher, domain)
    commit_lead(
        source=source,
        category=category,
        rec=rec,
        calendly_detected=detected,
        calendly_url=booking,
        known=known,
        stats=stats,
    )


def loc_state(location: str) -> str:
    """'Miami FL' → 'FL'; otherwise the original string."""
    tok = (location or "").strip().split()
    if tok and tok[-1].upper() in US_STATES:
        return tok[-1].upper()
    return (location or "USA").strip() or "USA"


async def harvest_profiles(
    *,
    known: Known,
    stats: ScrapeStats,
    deadline: Deadline | None,
    pages: int,
    niches: list[str],
    location: str,
    source: str,
    query_for,
    is_profile,
    max_links: int = 12,
    as_directory: bool = False,
) -> ScrapeStats:
    """DuckDuckGo/Bing → profile or directory pages → business website → Calendly check."""
    import httpx

    from ..search import organic_links

    loc = (location or "USA").strip() or "USA"
    async with httpx.AsyncClient() as client, PoliteFetcher() as fetcher:
        for niche in niches:
            if deadline and deadline.expired():
                break
            links = await organic_links(
                client,
                query_for(niche, loc),
                pages=pages,
                max_links=max_links,
                deadline_expired=(deadline.expired if deadline else None),
            )
            seen: set[str] = set()
            for url in links:
                if deadline and deadline.expired():
                    break
                if not is_http_url(url) or not is_profile(url):
                    continue
                _, _, html = await fetcher.get_text(url)
                if not html:
                    continue
                recs = (
                    extract_directory_members(html, url, niche)
                    if as_directory
                    else [extract_profile(html, url)]
                )
                for rec in recs:
                    rec["category"] = niche
                    if not rec.get("domain"):
                        rec["domain"] = business_domain(rec.get("website"))
                    domain = rec.get("domain")
                    if not domain or domain in seen:
                        continue
                    seen.add(domain)
                    await ingest_website(
                        fetcher,
                        source=source,
                        category=niche,
                        rec=rec,
                        known=known,
                        stats=stats,
                        deadline=deadline,
                    )
    return stats
