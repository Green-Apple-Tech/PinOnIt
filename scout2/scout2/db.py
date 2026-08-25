from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from .settings import require_env, settings

TABLE = "scout2_leads"
PAGE = 1000

STATUSES = (
    "discovered",
    "fingerprinted",
    "detected",
    "no_calendly",
    "classified",
    "skipped_size",
    "skipped_clinic",
    "extracted",
    "verified",
    "ready",
    "invalid_email",
    "exported",
    "sent",
    "replied",
    "bounced",
    "unsubscribed",
    "excluded",
    "converted",
    "error",
)


def get_client() -> Client:
    require_env("supabase_url", "supabase_service_key")
    s = settings()
    return create_client(s["supabase_url"], s["supabase_service_key"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_lead(sb: Client, row: dict[str, Any]) -> dict[str, Any]:
    payload = {**row, "updated_at": now_iso()}
    if "created_at" not in payload:
        payload["created_at"] = now_iso()
    res = (
        sb.table(TABLE)
        .upsert(payload, on_conflict="domain")
        .execute()
    )
    data = res.data or []
    return data[0] if data else payload


def fetch_by_status(sb: Client, status: str | list[str], limit: int = 500) -> list[dict]:
    q = sb.table(TABLE).select("*").limit(limit)
    if isinstance(status, list):
        q = q.in_("status", status)
    else:
        q = q.eq("status", status)
    return list(q.execute().data or [])


def fetch_needing(sb: Client, statuses: list[str], limit: int = 500) -> list[dict]:
    return fetch_by_status(sb, statuses, limit=limit)


def fetch_ready(
    sb: Client,
    *,
    segment: str | None = None,
    min_score: int | None = None,
    limit: int = 5000,
) -> list[dict]:
    q = sb.table(TABLE).select("*").eq("status", "ready").limit(limit)
    if segment:
        q = q.eq("segment", segment)
    if min_score is not None:
        q = q.gte("lead_score", min_score)
    return list(q.execute().data or [])


def fetch_all(sb: Client, limit: int | None = None) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        end = start + PAGE - 1
        chunk = list(
            sb.table(TABLE).select("*").range(start, end).execute().data or []
        )
        if not chunk:
            break
        rows.extend(chunk)
        if limit is not None and len(rows) >= limit:
            return rows[:limit]
        if len(chunk) < PAGE:
            break
        start += PAGE
    return rows


def fetch_known_keys(sb: Client) -> tuple[set[str], set[str]]:
    """All known domains and emails for directory-scraper dedup."""
    domains: set[str] = set()
    emails: set[str] = set()
    start = 0
    while True:
        end = start + PAGE - 1
        chunk = list(
            sb.table(TABLE)
            .select("domain,email")
            .range(start, end)
            .execute()
            .data
            or []
        )
        if not chunk:
            break
        for row in chunk:
            d = (row.get("domain") or "").strip().lower()
            if d:
                domains.add(d)
            e = (row.get("email") or "").strip().lower()
            if e:
                emails.add(e)
        if len(chunk) < PAGE:
            break
        start += PAGE
    return domains, emails


def insert_new_lead(sb: Client, row: dict[str, Any]) -> bool:
    """Insert if domain and email are new. Returns True on insert, False on dupe.

    Unique on domain; also skip when the email is already on another lead.
    """
    domain = (row.get("domain") or "").strip().lower()
    email = (row.get("email") or "").strip().lower() or None
    if not domain:
        return False
    existing = (
        sb.table(TABLE).select("id").eq("domain", domain).limit(1).execute().data or []
    )
    if existing:
        return False
    if email:
        existing_email = (
            sb.table(TABLE).select("id").eq("email", email).limit(1).execute().data
            or []
        )
        if existing_email:
            return False
    payload = {**row, "domain": domain, "updated_at": now_iso()}
    if email:
        payload["email"] = email
    if "created_at" not in payload:
        payload["created_at"] = now_iso()
    try:
        sb.table(TABLE).insert(payload).execute()
        return True
    except Exception:
        return False
