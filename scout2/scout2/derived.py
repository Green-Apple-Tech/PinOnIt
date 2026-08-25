"""Derived outreach columns: first_name, greeting, business_name, city, state."""

from __future__ import annotations

import re
from html import unescape

from bs4 import BeautifulSoup

ROLE_LOCAL = frozenset(
    {
        "info",
        "sales",
        "office",
        "hello",
        "admin",
        "contact",
        "support",
        "billing",
        "booking",
        "appointments",
        "team",
        "staff",
        "help",
        "service",
        "customerservice",
        "customer-service",
        "reception",
        "webmaster",
        "noreply",
        "no-reply",
        "donotreply",
        "do-not-reply",
        "privacy",
        "abuse",
        "postmaster",
        "mailer-daemon",
        "owner",
        "marketing",
        "hr",
        "jobs",
        "careers",
        "press",
        "media",
        "hello-there",
        "enquiries",
        "inquiries",
        "ask",
        "mail",
        "email",
        "general",
    }
)

_LEGAL_SUFFIX = re.compile(
    r"""
    [\s,]*
    (
      l\.?l\.?c\.?
      | inc\.?
      | incorporated
      | ltd\.?
      | limited
      | co\.?
      | corp\.?
      | corporation
      | pllc
      | p\.?c\.?
      | llc
    )
    \.?
    \s*$
    """,
    re.I | re.X,
)
_TITLE_SPLIT = re.compile(r"\s*[|\u2013\u2014·•]\s*")
_NAME_TOKEN = re.compile(r"^[a-z]{2,15}$")


def first_name_from_email(email: str | None) -> str:
    """Personal name from the local-part only. Blank for role addresses."""
    raw = (email or "").strip().lower()
    if "@" not in raw:
        return ""
    local = raw.split("@", 1)[0]
    local = local.split("+", 1)[0]
    if not local or local in ROLE_LOCAL:
        return ""
    token = re.split(r"[._\-]", local)[0]
    if not _NAME_TOKEN.fullmatch(token):
        return ""
    if token in ROLE_LOCAL:
        return ""
    return token[:1].upper() + token[1:]


def greeting_from_email(email: str | None) -> str:
    return first_name_from_email(email) or "there"


def _clean_business_name(raw: str) -> str:
    text = unescape(re.sub(r"\s+", " ", (raw or "").strip()))
    if not text:
        return ""
    text = _TITLE_SPLIT.split(text, 1)[0].strip()
    text = re.sub(r"\s+[-–—]\s+(home|welcome|official site).*$", "", text, flags=re.I)
    text = _LEGAL_SUFFIX.sub("", text).strip(" ,.-")
    if not text:
        return ""
    if text.isupper() or text.islower():
        text = text.title()
    return text[:120]


def business_name_from_title(title: str | None) -> str:
    return _clean_business_name(title or "")


def business_name_from_domain(domain: str | None) -> str:
    d = (domain or "").strip().lower().removeprefix("www.")
    if not d:
        return ""
    stem = d.split(".")[0]
    stem = stem.replace("-", " ").replace("_", " ")
    return _clean_business_name(stem)


def business_name(page_title: str | None, domain: str | None) -> str:
    return business_name_from_title(page_title) or business_name_from_domain(domain)


def title_from_html(html: str | None) -> str:
    soup = BeautifulSoup(html or "", "lxml")
    if not soup.title:
        return ""
    return (soup.title.get_text(" ", strip=True) or "").strip()


def city_state_from_html(html: str | None) -> tuple[str, str]:
    from .scrapers.common import city_state_from_text, json_ld_address

    soup = BeautifulSoup(html or "", "lxml")
    text = unescape(soup.get_text(" ", strip=True))
    city, state = city_state_from_text(text)
    if city and state:
        return city, state
    ld_city, ld_state, _phone = json_ld_address(soup)
    return (ld_city or "").strip(), (ld_state or "").strip()


def sheet_tab_name(niche: str | None) -> str:
    name = re.sub(r"[\[\]:*?/\\]", " ", (niche or "").strip())
    name = re.sub(r"\s+", " ", name).strip() or "uncategorized"
    return name[:100]


CAMPAIGN_HEADERS = [
    "email",
    "greeting",
    "first_name",
    "business_name",
    "niche",
    "city",
    "state",
    "domain",
    "segment",
    "scheduler_name",
    "employees_bucket",
    "lead_score",
    "campaign_sent",
    "date_sent",
    "replied",
    "unsubscribed",
]


def campaign_row(lead: dict) -> list[str]:
    email = (lead.get("email") or "").strip()
    first = first_name_from_email(email)
    return [
        email,
        first or "there",
        first,
        business_name(lead.get("page_title"), lead.get("domain")),
        (lead.get("niche") or "").strip(),
        (lead.get("city") or "").strip(),
        (lead.get("state") or "").strip(),
        (lead.get("domain") or "").strip().lower(),
        (lead.get("segment") or "").strip(),
        (lead.get("scheduler_name") or "").strip(),
        str(lead.get("employees_bucket") or "").strip(),
        "" if lead.get("lead_score") is None else str(lead.get("lead_score")),
        "",
        "",
        "",
        "",
    ]
