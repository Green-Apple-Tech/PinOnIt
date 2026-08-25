"""Upsert scout2_leads into five Google Sheet tabs (unattended service account or Apps Script)."""

from __future__ import annotations

import atexit
import threading
from pathlib import Path

from .db import fetch_all, get_client
from .settings import ROOT, settings
from .sheet_tabs import OLD_TAB, TABS, lead_tab

# Live flush: push soon after each new lead so a crash does not wait until
# the 5-hour session ends. Short debounce avoids Sheets rate limits.
_DEBOUNCE_SEC = 2.0
_MAX_PENDING = 5
_pending: dict[str, dict] = {}
_pending_lock = threading.Lock()
_flush_lock = threading.Lock()
_timer: threading.Timer | None = None

HEADERS = [
    "domain",
    "email",
    "email_rank",
    "niche",
    "employees_bucket",
    "practice_type",
    "scheduler_name",
    "booking_url",
    "calendly_url",
    "email_provider",
    "zoom_links",
    "teams_links",
    "phone_only",
    "lead_score",
    "segment",
    "source",
    "phone",
    "city",
    "state",
    "category",
    "calendly_detected",
    "mx_valid",
    "status",
    "created_at",
    "updated_at",
]

WEBAPP_VERSION = 2
_UPSERT_CHUNK = 150


def _sa_path() -> Path | None:
    raw = (settings().get("google_service_account_file") or "").strip()
    if not raw:
        return None
    p = Path(raw)
    if not p.is_absolute():
        p = ROOT / p
    return p if p.is_file() else None


def sheets_configured() -> bool:
    s = settings()
    if _sa_path():
        return bool((s.get("google_sheets_id") or "").strip())
    return bool(
        (s.get("google_sheets_webapp_url") or "").strip()
        and (s.get("google_sheets_webhook_secret") or "").strip()
    )


def service_account_email() -> str | None:
    path = _sa_path()
    if not path:
        return None
    import json

    try:
        data = json.loads(path.read_text())
    except Exception:
        return None
    return data.get("client_email")


def _cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    return str(value)


def _row(lead: dict) -> list[str]:
    return [_cell(lead.get(h)) for h in HEADERS]


def _bucketed_items(rows: list[dict]) -> list[dict]:
    items = []
    for lead in rows:
        domain = str(lead.get("domain") or "").strip().lower()
        if not domain:
            continue
        lead = {**lead, "domain": domain}
        items.append({"tab": lead_tab(lead), "values": _row(lead)})
    return items


def _client():
    import gspread
    from google.oauth2.service_account import Credentials

    path = _sa_path()
    sheet_id = (settings().get("google_sheets_id") or "").strip()
    if not path or not sheet_id:
        return None, None
    creds = Credentials.from_service_account_file(
        str(path),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    gc = gspread.authorize(creds)
    return gc.open_by_key(sheet_id), sheet_id


def _ensure_ws(sh, title: str):
    import gspread

    try:
        ws = sh.worksheet(title)
    except gspread.exceptions.WorksheetNotFound:
        ws = sh.add_worksheet(title=title, rows=2000, cols=len(HEADERS))
        ws.update("A1", [HEADERS], value_input_option="USER_ENTERED")
        return ws
    first = ws.row_values(1)
    if not any(first):
        ws.update("A1", [HEADERS], value_input_option="USER_ENTERED")
    elif first[0].strip().lower() != "domain":
        ws.insert_row(HEADERS, index=1)
    return ws


def _rewrite_ws(ws, leads: list[dict]) -> None:
    from gspread.utils import rowcol_to_a1

    ws.clear()
    ws.update("A1", [HEADERS], value_input_option="USER_ENTERED")
    if not leads:
        return
    values = [_row(lead) for lead in leads]
    end = rowcol_to_a1(1 + len(values), len(HEADERS))
    ws.update(f"A2:{end}", values, value_input_option="USER_ENTERED")


def _records_from_ws(ws) -> list[dict]:
    try:
        return ws.get_all_records(default_blank="")
    except Exception:
        return []


def _reorganize_gspread(sh, rows: list[dict]) -> dict:
    merged: dict[str, dict] = {}
    for title in (OLD_TAB, *TABS):
        try:
            ws = sh.worksheet(title)
        except Exception:
            continue
        for rec in _records_from_ws(ws):
            domain = str(rec.get("domain") or "").strip().lower()
            if domain:
                merged[domain] = rec
    for lead in rows:
        domain = str(lead.get("domain") or "").strip().lower()
        if domain:
            merged[domain] = {**lead, "domain": domain}
    buckets: dict[str, list[dict]] = {tab: [] for tab in TABS}
    for domain, lead in merged.items():
        buckets[lead_tab({**lead, "domain": domain})].append({**lead, "domain": domain})
    counts = {}
    for tab in TABS:
        ws = _ensure_ws(sh, tab)
        _rewrite_ws(ws, buckets[tab])
        counts[tab] = len(buckets[tab])
    try:
        old = sh.worksheet(OLD_TAB)
        old.clear()
        old.update(
            "A1",
            [
                ["Moved"],
                [
                    "Leads are split into: Calendly users, Emails and phones, "
                    "Emails, Phones, Blanks. This tab is unused."
                ],
            ],
            value_input_option="USER_ENTERED",
        )
    except Exception:
        pass
    return counts


def _upsert_gspread(sh, rows: list[dict]) -> dict:
    items = _bucketed_items(rows)
    if not items:
        return {"updated": 0, "appended": len(items), "tabs": {t: 0 for t in TABS}}
    wanted = {item["values"][0].strip().lower(): item for item in items}
    moved = 0
    for tab in TABS:
        ws = _ensure_ws(sh, tab)
        col_a = ws.col_values(1)
        # row 1 is header; delete matching data rows from the bottom
        for rownum in range(len(col_a), 1, -1):
            domain = str(col_a[rownum - 1] or "").strip().lower()
            if domain in wanted:
                ws.delete_rows(rownum)
                moved += 1
    appended_by_tab = {tab: 0 for tab in TABS}
    by_tab: dict[str, list[list[str]]] = {tab: [] for tab in TABS}
    for item in wanted.values():
        by_tab[item["tab"]].append(item["values"])
    for tab, values in by_tab.items():
        if not values:
            continue
        ws = _ensure_ws(sh, tab)
        ws.append_rows(values, value_input_option="USER_ENTERED")
        appended_by_tab[tab] = len(values)
    return {"updated": 0, "appended": sum(appended_by_tab.values()), "moved": moved, "tabs": appended_by_tab}


def _webapp_post(payload: dict, timeout: float = 180.0) -> dict:
    import httpx

    s = settings()
    url = (s.get("google_sheets_webapp_url") or "").strip()
    r = httpx.post(url, json=payload, timeout=timeout, follow_redirects=True)
    r.raise_for_status()
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text[:500]}
    return data


def _webapp_secret() -> str:
    return (settings().get("google_sheets_webhook_secret") or "").strip()


def _webapp_ping() -> dict:
    return _webapp_post({"secret": _webapp_secret(), "ping": True}, timeout=30.0)


def _script_needs_update(data: dict) -> bool:
    if not data.get("ok"):
        return True
    try:
        return int(data.get("version") or 0) < WEBAPP_VERSION
    except (TypeError, ValueError):
        return True


def _needs_script_msg() -> dict:
    return {
        "skipped": True,
        "via": "webapp",
        "error": (
            "The Google Sheet Apps Script is still the old one-tab version. "
            "In the spreadsheet: Extensions → Apps Script, replace the code with "
            "scout2/scripts/sheets-webhook.gs (keep your existing SECRET), then "
            "Deploy → Manage deployments → the web app → New version. "
            "Or reload the sheet and use the Scout2 menu → Split into 5 tabs."
        ),
    }


def _sync_via_webapp(rows: list[dict], *, full: bool) -> dict:
    secret = _webapp_secret()
    ping = _webapp_ping()
    if _script_needs_update(ping):
        return _needs_script_msg()

    if full:
        data = _webapp_post(
            {
                "secret": secret,
                "headers": HEADERS,
                "mode": "reorganize",
                "rows": [_row(lead) for lead in rows if str(lead.get("domain") or "").strip()],
            }
        )
        if not data.get("ok"):
            return {"skipped": True, "error": data.get("error") or data, "via": "webapp"}
        return {
            "skipped": False,
            "via": "webapp",
            "mode": "reorganize",
            "tabs": data.get("tabs") or {},
            "total": data.get("total"),
        }

    appended = 0
    updated = 0
    tabs: dict[str, int] = {t: 0 for t in TABS}
    items = _bucketed_items(rows)
    for i in range(0, len(items), _UPSERT_CHUNK):
        chunk = items[i : i + _UPSERT_CHUNK]
        data = _webapp_post(
            {
                "secret": secret,
                "headers": HEADERS,
                "mode": "upsert",
                "items": chunk,
            }
        )
        if not data.get("ok"):
            return {"skipped": True, "error": data.get("error") or data, "via": "webapp"}
        appended += int(data.get("appended") or 0)
        updated += int(data.get("updated") or 0)
        for tab, n in (data.get("tabs") or {}).items():
            tabs[tab] = tabs.get(tab, 0) + int(n or 0)
    return {
        "skipped": False,
        "via": "webapp",
        "mode": "upsert",
        "tab": "five-tabs",
        "updated": updated,
        "appended": appended,
        "tabs": tabs,
        "total": len(items),
    }


def sync_leads_to_sheets(rows: list[dict] | None = None) -> dict:
    """Upsert leads by domain into the five contact tabs. Safe to call every pipeline stage."""
    if not sheets_configured():
        return {
            "skipped": True,
            "reason": "Need either google-sa.json or GOOGLE_SHEETS_WEBAPP_URL",
        }
    full = rows is None
    if full:
        rows = fetch_all(get_client())
    if (settings().get("google_sheets_webapp_url") or "").strip() and not _sa_path():
        try:
            return _sync_via_webapp(rows, full=full)
        except Exception as e:
            return {"skipped": True, "error": str(e), "via": "webapp"}
    try:
        sh, _ = _client()
        if sh is None:
            return {"skipped": True, "reason": "sheets client not configured"}
        if full:
            counts = _reorganize_gspread(sh, rows)
            return {
                "skipped": False,
                "sheet": sh.url,
                "mode": "reorganize",
                "tabs": counts,
                "total": sum(counts.values()),
            }
        result = _upsert_gspread(sh, rows)
        return {
            "skipped": False,
            "sheet": sh.url,
            "mode": "upsert",
            "tab": "five-tabs",
            **result,
            "total": len(rows),
        }
    except Exception as e:
        return {"skipped": True, "error": str(e)}


def maybe_sync_sheets() -> dict:
    """Never raise — overnight scrapes must keep going if Sheets is down."""
    if not sheets_configured():
        return {"skipped": True, "reason": "sheets not configured"}
    return sync_leads_to_sheets()


def queue_lead_for_sheets(row: dict) -> None:
    """Queue one lead and flush after a short debounce (or immediately if full).

    Never raises. Safe to call after every successful Supabase insert.
    """
    if not sheets_configured():
        return
    domain = str(row.get("domain") or "").strip().lower()
    if not domain:
        return
    with _pending_lock:
        _pending[domain] = dict(row)
        n = len(_pending)
    if n >= _MAX_PENDING:
        flush_pending_sheets()
        return
    _schedule_flush()


def _schedule_flush() -> None:
    global _timer
    with _pending_lock:
        if _timer is not None:
            return
        _timer = threading.Timer(_DEBOUNCE_SEC, _flush_from_timer)
        _timer.daemon = True
        _timer.start()


def _flush_from_timer() -> None:
    global _timer
    with _pending_lock:
        _timer = None
    flush_pending_sheets()


def flush_pending_sheets() -> dict:
    """Push queued leads now. Re-queues on failure so a later flush can retry."""
    global _timer
    if not sheets_configured():
        return {"skipped": True, "reason": "sheets not configured"}
    with _pending_lock:
        if _timer is not None:
            _timer.cancel()
            _timer = None
        rows = list(_pending.values())
        _pending.clear()
    if not rows:
        return {"skipped": True, "reason": "nothing pending"}
    with _flush_lock:
        result = sync_leads_to_sheets(rows)
    if result.get("skipped") and (result.get("error") or result.get("reason")):
        with _pending_lock:
            for lead in rows:
                domain = str(lead.get("domain") or "").strip().lower()
                if domain and domain not in _pending:
                    _pending[domain] = lead
    elif not result.get("skipped"):
        appended = result.get("appended") or 0
        updated = result.get("updated") or 0
        tabs = result.get("tabs") or {}
        extra = f" {tabs}" if tabs else ""
        print(f"[sheets] live +{appended} new, {updated} updated{extra}", flush=True)
    return result


def _flush_on_exit() -> None:
    try:
        flush_pending_sheets()
    except Exception:
        pass


atexit.register(_flush_on_exit)
