"""MX lookup → email_provider. Cached per domain; reused by fingerprint + verify."""

from __future__ import annotations

import asyncio

import dns.asyncresolver
import dns.exception
import dns.resolver

Provider = str  # m365 | google_workspace | godaddy | zoho | other | none

_CACHE: dict[str, tuple[Provider, list[str]]] = {}


def _norm_host(name: object) -> str:
    return str(name).rstrip(".").lower()


def provider_from_exchanges(exchanges: list[str]) -> Provider:
    if not exchanges:
        return "none"
    blob = " ".join(exchanges).lower()
    if (
        "outlook.com" in blob
        or "protection.outlook" in blob
        or ".mail.protection.outlook.com" in blob
    ):
        return "m365"
    if "google.com" in blob or "googlemail.com" in blob:
        return "google_workspace"
    if "secureserver.net" in blob or "godaddy.com" in blob:
        return "godaddy"
    if "zoho.com" in blob or "zoho.eu" in blob or "zoho.in" in blob:
        return "zoho"
    return "other"


async def lookup_mx(domain: str) -> tuple[Provider, list[str]]:
    """Return (email_provider, mx exchange hosts) for a domain. Cached."""
    key = (domain or "").strip().lower().removeprefix("www.")
    if not key:
        return "none", []
    if key in _CACHE:
        return _CACHE[key]

    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = 5.0
    exchanges: list[str] = []
    try:
        answers = await resolver.resolve(key, "MX")
        for rr in answers:
            exch = _norm_host(getattr(rr, "exchange", ""))
            if exch:
                exchanges.append(exch)
        exchanges.sort()
        provider = provider_from_exchanges(exchanges)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        provider, exchanges = "none", []
    except (dns.exception.DNSException, asyncio.TimeoutError, OSError):
        provider, exchanges = "other", []

    _CACHE[key] = (provider, exchanges)
    return provider, exchanges


async def lookup_email_provider(domain: str) -> Provider:
    provider, _ = await lookup_mx(domain)
    return provider


async def mx_status(domain: str) -> str:
    """valid | invalid | unknown — for extracted-email mailbox hosts."""
    key = (domain or "").strip().lower().removeprefix("www.")
    if not key:
        return "invalid"
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = 5.0
    try:
        answers = await resolver.resolve(key, "MX")
        return "valid" if answers else "invalid"
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        return "invalid"
    except (dns.exception.DNSException, asyncio.TimeoutError, OSError):
        return "unknown"


def clear_cache() -> None:
    _CACHE.clear()
