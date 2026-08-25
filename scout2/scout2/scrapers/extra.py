"""Extra public directories: therapists, wedding, coaches, home services, licenses, Calendly-on-the-web."""

from __future__ import annotations

from urllib.parse import urlparse

from .common import (
    Deadline,
    Known,
    ScrapeStats,
    harvest_profiles,
    is_http_url,
    is_skipped_host,
    loc_state,
)
from ..politeness import domain_of

N_THERAPY = ("therapist", "life coach", "chiropractor", "nutritionist")
N_WEDDING = ("photographer",)
N_COACH = ("life coach", "consultant", "personal trainer")
N_HOME = ("landscaping", "plumbing", "hvac", "handyman", "house cleaning")
N_LEGAL = ("attorney",)
N_LICENSE = ("contractor", "barber", "notary", "insurance agent")
N_CALENDLY = ("therapist", "photographer", "consultant", "real estate agent", "attorney")

SKIP_BITS = (
    "/blog",
    "/login",
    "/signup",
    "/join",
    "/help",
    "/about",
    "/jobs",
    "/careers",
    "/privacy",
    "/terms",
    "/search",
    "/advice",
    "/cost",
    "/how-it-works",
)


def _host_path(url: str) -> tuple[str, str]:
    p = urlparse(url)
    host = (p.hostname or "").lower().removeprefix("www.")
    path = (p.path or "/").lower()
    return host, path


def _ok_path(path: str) -> bool:
    if not path or path == "/":
        return False
    return not any(path.startswith(s) or s in path for s in SKIP_BITS)


def is_psychology_today(url: str) -> bool:
    host, path = _host_path(url)
    if "psychologytoday.com" not in host:
        return False
    return any(
        x in path
        for x in ("/therapists/", "/psychiatrists/", "/counselling/", "/counseling/")
    )


def is_wedding_profile(url: str) -> bool:
    host, path = _host_path(url)
    if "theknot.com" in host:
        return _ok_path(path) and ("/marketplace/" in path or "/vendors/" in path or "/vendor/" in path)
    if "weddingwire.com" in host:
        return _ok_path(path) and ("/biz/" in path or "/reviews/" in path or "/c/" in path)
    return False


def is_coach_profile(url: str) -> bool:
    host, path = _host_path(url)
    if "noomii.com" in host:
        return _ok_path(path) and ("/coach" in path or "/directory" in path)
    if "coachingfederation.org" in host or "coachfederation.org" in host:
        return _ok_path(path) and ("coach" in path or "directory" in path or "find" in path)
    return False


def is_houzz_profile(url: str) -> bool:
    host, path = _host_path(url)
    return "houzz.com" in host and _ok_path(path) and "/professionals/" in path


def is_angi_profile(url: str) -> bool:
    host, path = _host_path(url)
    if "angi.com" not in host and "angieslist.com" not in host:
        return False
    return _ok_path(path) and (
        "/companylist/" in path or "/pro/" in path or "/directory/" in path or "/wp/" in path
    )


def is_bbb_profile(url: str) -> bool:
    host, path = _host_path(url)
    return "bbb.org" in host and _ok_path(path) and "/profile/" in path


def is_avvo_profile(url: str) -> bool:
    host, path = _host_path(url)
    return "avvo.com" in host and _ok_path(path) and "/attorneys/" in path


def is_gov_directory(url: str) -> bool:
    host, path = _host_path(url)
    if not host.endswith(".gov"):
        return False
    blob = f"{host} {path}"
    return any(
        w in blob
        for w in (
            "license",
            "licens",
            "roster",
            "lookup",
            "directory",
            "cslb",
            "dol.",
            "dbpr",
        )
    )


def is_calendly_mention_page(url: str) -> bool:
    if not is_http_url(url):
        return False
    d = domain_of(url)
    if not d or is_skipped_host(d):
        return False
    return "calendly.com" not in d


def is_calendly_page(url: str) -> bool:
    host, path = _host_path(url)
    if "calendly.com" not in host:
        return False
    if not _ok_path(path):
        return False
    if path.count("/") < 1:
        return False
    blocked = ("/blog/", "/help/", "/pricing", "/features", "/login", "/signup", "/app/")
    return not any(b in path for b in blocked)


async def run_psychology_today(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_THERAPY), location=location, source="psychology_today",
        query_for=lambda n, loc: f"site:psychologytoday.com {n} {loc}",
        is_profile=is_psychology_today,
    )


async def run_wedding(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_WEDDING), location=location, source="wedding",
        query_for=lambda n, loc: f"site:theknot.com OR site:weddingwire.com {n} {loc}",
        is_profile=is_wedding_profile,
    )


async def run_coaches(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_COACH), location=location, source="coaches",
        query_for=lambda n, loc: f"site:noomii.com OR site:coachingfederation.org {n} {loc}",
        is_profile=is_coach_profile,
    )


async def run_houzz(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_HOME), location=location, source="houzz",
        query_for=lambda n, loc: f"site:houzz.com/professionals {n} {loc}",
        is_profile=is_houzz_profile,
    )


async def run_angi(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_HOME), location=location, source="angi",
        query_for=lambda n, loc: f"site:angi.com {n} {loc}",
        is_profile=is_angi_profile,
    )


async def run_bbb(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_HOME) + list(N_LICENSE), location=location, source="bbb",
        query_for=lambda n, loc: f"site:bbb.org/profile {n} {loc}",
        is_profile=is_bbb_profile, max_links=10,
    )


async def run_avvo(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_LEGAL), location=location, source="avvo",
        query_for=lambda n, loc: f"site:avvo.com/attorneys {n} {loc}",
        is_profile=is_avvo_profile,
    )


async def run_licenses(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    def q(n: str, loc: str) -> str:
        where = loc_state(loc)
        return f'site:.gov {n} (roster OR "license search" OR "license lookup" OR directory) {where}'

    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_LICENSE), location=location, source="licenses",
        query_for=q, is_profile=is_gov_directory, as_directory=True, max_links=8,
    )


async def run_calendly_web(*, known: Known, stats: ScrapeStats, deadline: Deadline | None = None, pages: int = 1, location: str = "USA") -> ScrapeStats:
    """Pages that already mention Calendly, plus public Calendly booking URLs."""

    await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_CALENDLY), location=location, source="calendly_web",
        query_for=lambda n, loc: f'"calendly.com/" {n} {loc}',
        is_profile=is_calendly_mention_page,
        max_links=10,
    )
    return await harvest_profiles(
        known=known, stats=stats, deadline=deadline, pages=pages,
        niches=list(N_CALENDLY), location=location, source="calendly_web",
        query_for=lambda n, loc: f"site:calendly.com {n} {loc}",
        is_profile=is_calendly_page, max_links=8,
    )


EXTRA_RUNNERS = (
    run_psychology_today,
    run_wedding,
    run_coaches,
    run_houzz,
    run_angi,
    run_bbb,
    run_avvo,
    run_licenses,
    run_calendly_web,
)


async def run_extra(
    *,
    known: Known,
    stats: ScrapeStats,
    deadline: Deadline | None = None,
    pages: int = 1,
    location: str = "USA",
) -> ScrapeStats:
    for fn in EXTRA_RUNNERS:
        if deadline and deadline.expired():
            break
        await fn(known=known, stats=stats, deadline=deadline, pages=pages, location=location)
    return stats
