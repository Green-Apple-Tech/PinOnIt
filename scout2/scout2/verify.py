"""Syntax + MX verification for extracted emails."""

from __future__ import annotations

import asyncio
import re

import dns.asyncresolver
import dns.exception

from .db import fetch_by_status, get_client, upsert_lead

EMAIL_SYNTAX = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)


def syntax_ok(email: str) -> bool:
    return bool(EMAIL_SYNTAX.match(email or ""))


async def mx_check(domain: str) -> str:
    """Return valid | invalid | unknown."""
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = 5.0
    try:
        answers = await resolver.resolve(domain, "MX")
        if answers:
            return "valid"
        return "invalid"
    except dns.asyncresolver.NXDOMAIN:
        return "invalid"
    except (dns.exception.DNSException, asyncio.TimeoutError, OSError):
        return "unknown"


async def run_verify(limit: int = 200) -> dict:
    sb = get_client()
    rows = fetch_by_status(sb, "extracted", limit=limit)
    ready = 0
    invalid = 0
    unknown = 0
    skipped = 0

    for row in rows:
        domain = row["domain"]
        email = (row.get("email") or "").strip()
        if not email or not syntax_ok(email):
            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "mx_valid": False,
                    "status": "invalid_email",
                },
            )
            skipped += 1
            continue

        host = email.split("@", 1)[1]
        result = await mx_check(host)
        if result == "valid":
            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "email": email,
                    "email_rank": row.get("email_rank"),
                    "mx_valid": True,
                    "status": "ready",
                    "niche": row.get("niche"),
                    "employees_bucket": row.get("employees_bucket"),
                    "calendly_url": row.get("calendly_url"),
                    "source": row.get("source"),
                },
            )
            ready += 1
        elif result == "invalid":
            upsert_lead(sb, {"domain": domain, "mx_valid": False, "status": "invalid_email"})
            invalid += 1
        else:
            # Keep usable but mark unknown — still exportable as ready-ish; use ready with mx unknown flag
            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "email": email,
                    "mx_valid": None,
                    "status": "ready",
                    "niche": row.get("niche"),
                    "employees_bucket": row.get("employees_bucket"),
                    "calendly_url": row.get("calendly_url"),
                    "source": row.get("source"),
                },
            )
            unknown += 1

    return {
        "processed": len(rows),
        "ready": ready,
        "invalid": invalid,
        "unknown_mx": unknown,
        "no_email": skipped,
    }
