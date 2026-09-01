"""Export ready leads to a Google Sheet in DRIVE_FOLDER_ID, one tab per niche."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .db import TABLE, get_client, now_iso
from .derived import CAMPAIGN_HEADERS, campaign_row, city_state_from_html, sheet_tab_name, title_from_html
from .exclude import is_excluded_domain, load_exclude_hosts
from .settings import ROOT, settings

BATCHES = "scout2_export_batches"
TAKEN_STATUSES = (
    "exported",
    "sent",
    "replied",
    "bounced",
    "unsubscribed",
    "excluded",
    "converted",
)
DRIVE_SCOPES = (
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
)


def _sa_info() -> dict:
    s = settings()
    raw = (s.get("google_service_account_json") or "").strip()
    path_raw = (s.get("google_service_account_file") or "").strip()
    if raw.startswith("{"):
        return json.loads(raw)
    path = Path(raw or path_raw)
    if raw or path_raw:
        if not path.is_absolute():
            path = ROOT / path
        if path.is_file():
            return json.loads(path.read_text())
    raise SystemExit(
        "Missing GOOGLE_SERVICE_ACCOUNT_JSON (path or JSON) — copy .env.example → .env"
    )


def _credentials():
    from google.oauth2.service_account import Credentials

    return Credentials.from_service_account_info(_sa_info(), scopes=list(DRIVE_SCOPES))


def _gspread_client():
    import gspread

    return gspread.authorize(_credentials())


def is_exportable_lead(lead: dict, hosts: set[str] | None = None) -> bool:
    if (lead.get("status") or "") != "ready":
        return False
    if not (lead.get("email") or "").strip():
        return False
    if lead.get("mx_valid") is not True:
        return False
    if not str(lead.get("employees_bucket") or "").strip():
        return False
    return not is_excluded_domain(str(lead.get("domain") or ""), hosts)


def fetch_taken_emails(sb) -> set[str]:
    taken: set[str] = set()
    start = 0
    page = 1000
    while True:
        chunk = list(
            sb.table(TABLE)
            .select("email,status,exported_at")
            .range(start, start + page - 1)
            .execute()
            .data
            or []
        )
        if not chunk:
            break
        for row in chunk:
            email = (row.get("email") or "").strip().lower()
            if not email:
                continue
            status = row.get("status") or ""
            if status in TAKEN_STATUSES or row.get("exported_at"):
                taken.add(email)
        if len(chunk) < page:
            break
        start += page
    return taken


def fetch_ready_candidates(sb, *, niche: str | None, fetch_limit: int) -> list[dict]:
    q = (
        sb.table(TABLE)
        .select("*")
        .eq("status", "ready")
        .eq("mx_valid", True)
        .not_.is_("email", "null")
        .not_.is_("employees_bucket", "null")
        .limit(fetch_limit)
    )
    if niche:
        q = q.ilike("niche", niche.strip())
    return list(q.execute().data or [])


def select_export_rows(
    sb,
    *,
    niche: str | None = None,
    limit: int = 25,
) -> list[dict]:
    hosts = load_exclude_hosts()
    taken = fetch_taken_emails(sb)
    seen_email: set[str] = set()
    picked: list[dict] = []
    excluded_ids: list[str] = []
    candidates = fetch_ready_candidates(sb, niche=niche, fetch_limit=max(limit * 20, 500))
    for lead in candidates:
        email = (lead.get("email") or "").strip().lower()
        domain = (lead.get("domain") or "").strip().lower()
        if is_excluded_domain(domain, hosts):
            if lead.get("id"):
                excluded_ids.append(lead["id"])
            continue
        if not is_exportable_lead(lead, hosts):
            continue
        if email in taken or email in seen_email:
            continue
        seen_email.add(email)
        picked.append(lead)
        if len(picked) >= limit:
            break
    if excluded_ids:
        sb.table(TABLE).update(
            {"status": "excluded", "updated_at": now_iso()}
        ).in_("id", excluded_ids).execute()
    return picked


async def enrich_export_rows(rows: list[dict]) -> list[dict]:
    """Fill page_title / city / state from the homepage when the row is missing them."""
    from .politeness import PoliteFetcher

    need = [
        r
        for r in rows
        if not (r.get("page_title") or "").strip()
        or not (r.get("city") or "").strip()
        or not (r.get("state") or "").strip()
    ]
    if not need:
        return rows
    async with PoliteFetcher() as fetcher:
        for row in need:
            domain = (row.get("domain") or "").strip()
            if not domain:
                continue
            _url, _ok, html = await fetcher.get_text(f"https://{domain}")
            if not html:
                continue
            if not (row.get("page_title") or "").strip():
                title = title_from_html(html)
                if title:
                    row["page_title"] = title
            if not (row.get("city") or "").strip() or not (row.get("state") or "").strip():
                city, state = city_state_from_html(html)
                if city and not (row.get("city") or "").strip():
                    row["city"] = city
                if state and not (row.get("state") or "").strip():
                    row["state"] = state
    return rows


def _open_campaign_spreadsheet() -> tuple[object, str]:
    """Open the user-owned campaign sheet. Service accounts cannot create files (0 quota)."""
    s = settings()
    sheet_id = (s.get("google_campaign_sheet_id") or "").strip()
    if not sheet_id:
        raise SystemExit(
            "Missing GOOGLE_CAMPAIGN_SHEET_ID. Create a Google Sheet in the "
            "PinOnIt Campaigns folder and put its id in .env"
        )
    sh = _gspread_client().open_by_key(sheet_id)
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}"
    return sh, url


def _ensure_header(ws) -> None:
    first = ws.row_values(1)
    if first[: len(CAMPAIGN_HEADERS)] != CAMPAIGN_HEADERS:
        ws.update("A1", [CAMPAIGN_HEADERS], value_input_option="USER_ENTERED")


def _write_niche_tabs(sh, rows: list[dict]) -> dict[str, int]:
    by_tab: dict[str, list[dict]] = {}
    for lead in rows:
        tab = sheet_tab_name(lead.get("niche"))
        by_tab.setdefault(tab, []).append(lead)
    counts: dict[str, int] = {}
    existing = {ws.title: ws for ws in sh.worksheets()}
    default = existing.get("Sheet1")
    first = True
    for tab, leads in by_tab.items():
        values = [campaign_row(lead) for lead in leads]
        if tab in existing:
            ws = existing[tab]
        elif first and default is not None and default.title == "Sheet1":
            default.update_title(tab)
            ws = default
            existing[tab] = ws
            first = False
        else:
            ws = sh.add_worksheet(
                title=tab, rows=max(100, len(values) + 10), cols=len(CAMPAIGN_HEADERS)
            )
            existing[tab] = ws
            first = False
        _ensure_header(ws)
        if values:
            ws.append_rows(values, value_input_option="USER_ENTERED")
        for lead in leads:
            lead["_sheet_tab"] = tab
        counts[tab] = len(leads)
    return counts


def _batch_label(niche: str | None, count: int) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    slug = re.sub(r"[^a-z0-9]+", "-", (niche or "mixed").lower()).strip("-") or "mixed"
    return f"{slug}-{stamp}-n{count}"


def export_sheet(*, niche: str | None = None, limit: int = 25) -> dict:
    sb = get_client()
    rows = select_export_rows(sb, niche=niche, limit=max(1, limit))
    if not rows:
        return {"exported": 0, "reason": "no ready leads matched filters"}

    import asyncio

    rows = asyncio.run(enrich_export_rows(rows))

    label = _batch_label(niche, len(rows))
    sh, url = _open_campaign_spreadsheet()
    counts = _write_niche_tabs(sh, rows)

    batch = (
        sb.table(BATCHES)
        .insert(
            {
                "batch_label": label,
                "niche": (niche or "").strip() or None,
                "row_count": len(rows),
                "sheet_url": url,
            }
        )
        .execute()
        .data
        or []
    )
    batch_id = batch[0]["id"] if batch else None
    stamped = now_iso()
    for lead in rows:
        sb.table(TABLE).update(
            {
                "status": "exported",
                "exported_at": stamped,
                "export_batch": batch_id,
                "sheet_tab": lead.get("_sheet_tab") or sheet_tab_name(lead.get("niche")),
                "page_title": lead.get("page_title") or None,
                "city": lead.get("city") or None,
                "state": lead.get("state") or None,
                "updated_at": stamped,
            }
        ).eq("id", lead["id"]).execute()

    return {
        "exported": len(rows),
        "batch_id": batch_id,
        "batch_label": label,
        "sheet_url": url,
        "tabs": counts,
        "niche": niche,
        "limit": limit,
    }


INVENTORY_TAB = "All emails"
_RAMP_TAB = re.compile(r".+-day\d{2}-\d{8}$", re.I)


def is_protected_campaign_tab(title: str) -> bool:
    """Leave GMass send tabs alone (ramp days + the first landscaping dump)."""
    name = (title or "").strip()
    if _RAMP_TAB.match(name):
        return True
    return name.lower() == "landscaping"


def leads_with_email(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for lead in rows:
        email = (lead.get("email") or "").strip().lower()
        if not email or "@" not in email:
            continue
        if email in seen:
            continue
        seen.add(email)
        out.append(lead)
    out.sort(
        key=lambda r: (
            (r.get("niche") or "").strip().lower(),
            (r.get("email") or "").strip().lower(),
        )
    )
    return out


def _rewrite_campaign_tab(sh, tab_name: str, rows: list[dict]) -> int:
    values = [campaign_row(lead) for lead in rows]
    existing = {ws.title: ws for ws in sh.worksheets()}
    if tab_name in existing:
        ws = existing[tab_name]
    else:
        ws = sh.add_worksheet(
            title=tab_name[:100],
            rows=max(200, len(values) + 10),
            cols=len(CAMPAIGN_HEADERS),
        )
        try:
            sh.reorder_worksheets([ws] + [w for w in sh.worksheets() if w.id != ws.id])
        except Exception:
            pass
    _ensure_header(ws)
    ws.resize(rows=max(200, len(values) + 10), cols=len(CAMPAIGN_HEADERS))
    if len(ws.get_all_values()) > 1:
        ws.batch_clear(["A2:Z"])
    if values:
        ws.update(
            "A2",
            values,
            value_input_option="USER_ENTERED",
        )
    return len(values)


def sync_campaign_inventory() -> dict:
    """Write every lead-with-email onto Campaigns → All emails. Does not mark exported.

    Scout2 Campaigns was GMass-only and landscaping-only (export-sheet / export-batch
    --niche landscaping). The working Scout2 sheet still has the full mix; this puts
    that mix back on the campaign spreadsheet without touching send-batch tabs.
    """
    from .db import fetch_all

    sb = get_client()
    rows = leads_with_email(fetch_all(sb))
    sh, url = _open_campaign_spreadsheet()
    written = _rewrite_campaign_tab(sh, INVENTORY_TAB, rows)
    niches = {}
    for lead in rows:
        n = (lead.get("niche") or "(none)").strip() or "(none)"
        niches[n] = niches.get(n, 0) + 1
    return {
        "sheet_url": url,
        "tab": INVENTORY_TAB,
        "emails": written,
        "niches": len(niches),
        "marked_exported": False,
        "left_alone": [
            ws.title
            for ws in sh.worksheets()
            if is_protected_campaign_tab(ws.title)
        ],
    }


def campaign_stats(sb=None) -> dict:
    sb = sb or get_client()
    by_status: dict[str, int] = {}
    start = 0
    page = 1000
    ready_by_niche: dict[str, int] = {}
    hosts = load_exclude_hosts()
    taken = fetch_taken_emails(sb)
    ready_pool = 0
    while True:
        chunk = list(
            sb.table(TABLE)
            .select("status,niche,email,mx_valid,employees_bucket,domain,exported_at")
            .range(start, start + page - 1)
            .execute()
            .data
            or []
        )
        if not chunk:
            break
        for row in chunk:
            st = row.get("status") or "(none)"
            by_status[st] = by_status.get(st, 0) + 1
            if is_exportable_lead(row, hosts):
                email = (row.get("email") or "").strip().lower()
                if email and email not in taken:
                    ready_pool += 1
                    niche = (row.get("niche") or "(none)").strip() or "(none)"
                    ready_by_niche[niche] = ready_by_niche.get(niche, 0) + 1
        if len(chunk) < page:
            break
        start += page
    return {
        "by_status": dict(sorted(by_status.items(), key=lambda kv: (-kv[1], kv[0]))),
        "ready_pool": ready_pool,
        "ready_by_niche": dict(sorted(ready_by_niche.items(), key=lambda kv: (-kv[1], kv[0]))),
    }
