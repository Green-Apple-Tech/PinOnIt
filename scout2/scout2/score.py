"""Lead score 0–100 and outreach segment (switcher | greenfield | cold)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from .db import fetch_by_status, get_client, upsert_lead
from .settings import settings
from .sheets_sync import maybe_sync_sheets

SEGMENTS = ("switcher", "greenfield", "cold")


@lru_cache
def appointment_niches() -> list[str]:
    path: Path = settings()["niches_path"]
    data = yaml.safe_load(path.read_text()) or {}
    items = data.get("niches") or []
    return [str(x).strip().lower() for x in items if str(x).strip()]


def niche_is_appointment(niche: str | None) -> bool:
    n = (niche or "").strip().lower()
    if not n:
        return False
    for item in appointment_niches():
        if item in n or n in item:
            return True
    return False


def compute_score(row: dict) -> tuple[int, str]:
    scheduler = (row.get("scheduler_name") or "none").strip().lower() or "none"
    phone_only = bool(row.get("phone_only"))
    niche = row.get("niche")

    if scheduler != "none":
        segment = "switcher"
        base = 80 if scheduler == "calendly" else 70
    elif phone_only and niche_is_appointment(niche):
        segment = "greenfield"
        base = 75
    else:
        segment = "cold"
        base = 40

    score = base
    provider = (row.get("email_provider") or "").strip().lower()
    teams = bool(row.get("teams_links"))
    zoom = bool(row.get("zoom_links"))

    if provider == "google_workspace":
        pass  # no meeting-stack penalty
    elif provider == "m365" and teams:
        score -= 25
    elif teams or zoom:
        score -= 10

    if (row.get("employees_bucket") or "") == "1":
        score += 5
    if (row.get("practice_type") or "").strip().lower() == "clinic":
        score -= 30

    score = max(0, min(100, score))
    return score, segment


async def run_score(limit: int = 500) -> dict:
    sb = get_client()
    rows = fetch_by_status(sb, "ready", limit=limit)
    counts = {s: 0 for s in SEGMENTS}

    for row in rows:
        lead_score, segment = compute_score(row)
        counts[segment] = counts.get(segment, 0) + 1
        upsert_lead(
            sb,
            {
                "domain": row["domain"],
                "status": row.get("status") or "ready",
                "lead_score": lead_score,
                "segment": segment,
                "scheduler_name": row.get("scheduler_name"),
                "booking_url": row.get("booking_url"),
                "email_provider": row.get("email_provider"),
                "zoom_links": row.get("zoom_links"),
                "teams_links": row.get("teams_links"),
                "phone_only": row.get("phone_only"),
                "practice_type": row.get("practice_type"),
                "email": row.get("email"),
                "email_rank": row.get("email_rank"),
                "niche": row.get("niche"),
                "employees_bucket": row.get("employees_bucket"),
                "calendly_url": row.get("calendly_url"),
                "source": row.get("source"),
                "mx_valid": row.get("mx_valid"),
            },
        )

    return {"processed": len(rows), **counts, "sheets": maybe_sync_sheets()}
