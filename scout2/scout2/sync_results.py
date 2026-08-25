"""Match a GMass results sheet on email and update scout2_leads campaign status."""

from __future__ import annotations

from .db import TABLE, get_client, now_iso
from .export_sheet import _gspread_client

# Highest priority wins when a row matches more than one signal.
_PRIORITY = {
    "unsubscribed": 3,
    "bounced": 2,
    "replied": 1,
    "sent": 0,
}


def re_sub_header(name: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else " " for ch in (name or "")).strip()


def _truthy(value) -> bool:
    s = str(value or "").strip().lower()
    return s in {"1", "true", "yes", "y", "x", "checked"}


def _status_from_record(rec: dict) -> str | None:
    lowered = {re_sub_header(k): v for k, v in rec.items()}
    compact = {k.replace(" ", "_"): v for k, v in lowered.items()}

    if _truthy(compact.get("unsubscribed") or compact.get("unsubscribe")):
        return "unsubscribed"
    if _truthy(compact.get("bounced") or compact.get("bounce")):
        return "bounced"
    if _truthy(compact.get("replied") or compact.get("reply")):
        return "replied"

    raw = str(
        compact.get("status")
        or compact.get("campaign_status")
        or compact.get("result")
        or ""
    ).strip().lower()
    if "unsub" in raw:
        return "unsubscribed"
    if "bounce" in raw:
        return "bounced"
    if "repl" in raw:
        return "replied"
    if raw in {"sent", "opened", "clicked", "open", "click"}:
        return "sent"
    return None


def _email_from_record(rec: dict) -> str:
    for key, value in rec.items():
        nk = re_sub_header(key).replace(" ", "")
        if nk in {"email", "emailaddress", "e-mail"} or nk.endswith("email"):
            addr = str(value or "").strip().lower()
            if "@" in addr:
                return addr
    return ""


def records_from_sheet(sheet_id: str) -> list[dict]:
    sh = _gspread_client().open_by_key(sheet_id.strip())
    rows: list[dict] = []
    for ws in sh.worksheets():
        try:
            rows.extend(ws.get_all_records(default_blank=""))
        except Exception:
            continue
    return rows


def outcomes_from_records(records: list[dict]) -> dict[str, str]:
    """email -> highest-priority campaign status."""
    out: dict[str, str] = {}
    for rec in records:
        email = _email_from_record(rec)
        status = _status_from_record(rec)
        if not email or not status:
            continue
        prev = out.get(email)
        if prev is None or _PRIORITY[status] > _PRIORITY[prev]:
            out[email] = status
    return out


def sync_gmass_results(sheet_id: str, *, sb=None) -> dict:
    if not (sheet_id or "").strip():
        raise SystemExit("Pass a GMass results spreadsheet id: --sheet <id>")
    sb = sb or get_client()
    outcomes = outcomes_from_records(records_from_sheet(sheet_id.strip()))
    updated = {k: 0 for k in _PRIORITY}
    missing = 0
    stamped = now_iso()
    for email, status in outcomes.items():
        rows = list(
            sb.table(TABLE).select("id,status").ilike("email", email).execute().data or []
        )
        if not rows:
            missing += 1
            continue
        for row in rows:
            current = row.get("status") or ""
            # Signup attribution wins — never reopen a converted lead via GMass sync.
            if current == "converted":
                continue
            if current in {"unsubscribed", "bounced"} and status != current:
                # Permanent exclude — never reopen.
                if _PRIORITY.get(current, 0) >= _PRIORITY.get(status, 0):
                    continue
            sb.table(TABLE).update(
                {"status": status, "updated_at": stamped}
            ).eq("id", row["id"]).execute()
            updated[status] = updated.get(status, 0) + 1
    return {
        "sheet": sheet_id.strip(),
        "matched_emails": sum(updated.values()),
        "missing_emails": missing,
        "updated": updated,
    }
