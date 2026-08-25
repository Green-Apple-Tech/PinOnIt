"""Extract and rank emails (and textable phones) from classified leads."""

from __future__ import annotations

import json
import re
from html import unescape

from bs4 import BeautifulSoup

from .db import fetch_by_status, get_client, upsert_lead
from .politeness import PoliteFetcher

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)
DROP_LOCAL = frozenset(
    {
        "noreply",
        "no-reply",
        "donotreply",
        "do-not-reply",
        "support",
        "privacy",
        "abuse",
        "postmaster",
        "mailer-daemon",
        "webmaster",
    }
)
PATHS = ("", "/contact", "/about", "/team", "/book")
PHONE_RE = re.compile(
    r"(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}"
)
TEL_RE = re.compile(r"tel:(\+?[\d][\d\s().-]{7,})", re.I)


def _local_part(email: str) -> str:
    return email.split("@", 1)[0].lower()


def rank_email(email: str, domain: str) -> int:
    """Lower is better."""
    e = email.lower().strip()
    local = _local_part(e)
    if local in DROP_LOCAL or local.startswith("noreply") or local.startswith("no-reply"):
        return 999
    if local in {"info"}:
        return 40
    if local in {"contact", "hello", "hi", "office"}:
        return 50
    # owner / firstname heuristics
    if local in {"owner", "admin"}:
        return 10
    if re.fullmatch(r"[a-z]{2,15}", local):
        return 5  # likely first name
    if "." in local and re.fullmatch(r"[a-z]+\.[a-z]+", local):
        return 8  # first.last
    host = e.split("@", 1)[-1]
    if host.endswith(domain) or host == domain:
        return 20
    return 80


def emails_from_html(html: str) -> set[str]:
    found: set[str] = set()
    soup = BeautifulSoup(html or "", "lxml")
    for a in soup.select('a[href^="mailto:"]'):
        href = a.get("href") or ""
        addr = href.split("mailto:", 1)[-1].split("?", 1)[0].strip()
        if EMAIL_RE.fullmatch(addr):
            found.add(addr.lower())
    text = unescape(soup.get_text(" "))
    for m in EMAIL_RE.finditer(text):
        found.add(m.group(0).lower())
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except Exception:
            continue
        blob = json.dumps(data)
        for m in EMAIL_RE.finditer(blob):
            found.add(m.group(0).lower())
    return found


def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return None
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def phones_from_html(html: str) -> str | None:
    soup = BeautifulSoup(html or "", "lxml")
    for a in soup.select('a[href^="tel:"]'):
        href = a.get("href") or ""
        m = TEL_RE.search(href)
        if m:
            phone = normalize_phone(m.group(1))
            if phone:
                return phone
    text = unescape(soup.get_text(" "))
    m = PHONE_RE.search(text)
    return normalize_phone(m.group(0)) if m else None


def pick_best(emails: set[str], domain: str) -> tuple[str | None, int | None]:
    ranked = []
    for e in emails:
        r = rank_email(e, domain)
        if r >= 999:
            continue
        ranked.append((r, e))
    if not ranked:
        return None, None
    ranked.sort()
    return ranked[0][1], ranked[0][0]


async def run_extract(limit: int = 100) -> dict:
    sb = get_client()
    rows = fetch_by_status(sb, "classified", limit=limit)
    got = 0
    missing = 0

    async with PoliteFetcher() as fetcher:
        for row in rows:
            domain = row["domain"]
            all_emails: set[str] = set()
            phone: str | None = None
            for path in PATHS:
                url = f"https://{domain}{path}"
                _, _, html = await fetcher.get_text(url)
                if html:
                    all_emails |= emails_from_html(html)
                    if not phone:
                        phone = phones_from_html(html)
            email, email_rank = pick_best(all_emails, domain)
            payload = {
                "domain": domain,
                "email": email,
                "status": "extracted",
            }
            if email:
                payload["email_rank"] = email_rank
                payload["niche"] = row.get("niche")
                payload["employees_bucket"] = row.get("employees_bucket")
                payload["practice_type"] = row.get("practice_type")
                payload["calendly_url"] = row.get("calendly_url")
                payload["scheduler_name"] = row.get("scheduler_name")
                payload["booking_url"] = row.get("booking_url")
                payload["source"] = row.get("source")
                got += 1
            else:
                missing += 1
            if phone:
                payload["phone"] = phone
            upsert_lead(sb, payload)

    return {"processed": len(rows), "with_email": got, "without_email": missing}
