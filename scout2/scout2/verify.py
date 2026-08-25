"""Syntax + MX verification for extracted emails. Reuses dns_stack lookups."""

from __future__ import annotations

import re

from .db import fetch_by_status, get_client, upsert_lead
from .dns_stack import lookup_email_provider, mx_status
from .sheets_sync import maybe_sync_sheets

EMAIL_SYNTAX = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)


def syntax_ok(email: str) -> bool:
    return bool(EMAIL_SYNTAX.match(email or ""))


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
        provider = row.get("email_provider") or await lookup_email_provider(domain)
        if not email or not syntax_ok(email):
            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "mx_valid": False,
                    "email_provider": provider,
                    "status": "invalid_email",
                },
            )
            skipped += 1
            continue

        host = email.split("@", 1)[1]
        result = await mx_status(host)
        payload = {
            "domain": domain,
            "email": email,
            "email_rank": row.get("email_rank"),
            "email_provider": provider,
            "niche": row.get("niche"),
            "employees_bucket": row.get("employees_bucket"),
            "calendly_url": row.get("calendly_url"),
            "scheduler_name": row.get("scheduler_name"),
            "booking_url": row.get("booking_url"),
            "practice_type": row.get("practice_type"),
            "source": row.get("source"),
        }
        if result == "valid":
            payload.update({"mx_valid": True, "status": "ready"})
            upsert_lead(sb, payload)
            ready += 1
        elif result == "invalid":
            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "mx_valid": False,
                    "email_provider": provider,
                    "status": "invalid_email",
                },
            )
            invalid += 1
        else:
            payload.update({"mx_valid": None, "status": "ready"})
            upsert_lead(sb, payload)
            unknown += 1

    return {
        "processed": len(rows),
        "ready": ready,
        "invalid": invalid,
        "unknown_mx": unknown,
        "no_email": skipped,
        "sheets": maybe_sync_sheets(),
    }
