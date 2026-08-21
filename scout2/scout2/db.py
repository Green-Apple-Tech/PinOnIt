from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from .settings import require_env, settings

STATUSES = (
    "discovered",
    "detected",
    "no_calendly",
    "classified",
    "skipped_size",
    "extracted",
    "verified",
    "ready",
    "invalid_email",
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
        sb.table("leads")
        .upsert(payload, on_conflict="domain")
        .execute()
    )
    data = res.data or []
    return data[0] if data else payload


def fetch_by_status(sb: Client, status: str | list[str], limit: int = 500) -> list[dict]:
    q = sb.table("leads").select("*").limit(limit)
    if isinstance(status, list):
        q = q.in_("status", status)
    else:
        q = q.eq("status", status)
    return list(q.execute().data or [])


def fetch_needing(sb: Client, statuses: list[str], limit: int = 500) -> list[dict]:
    return fetch_by_status(sb, statuses, limit=limit)
