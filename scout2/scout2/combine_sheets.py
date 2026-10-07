"""Fold every email on the connected Scout2 spreadsheets into one tab, without landscapers."""

from __future__ import annotations

from .derived import CAMPAIGN_HEADERS, campaign_row
from .export_sheet import _open_campaign_spreadsheet, _rewrite_campaign_tab
from .settings import settings
from .target import is_landscaper

INVENTORY_TAB = "All emails"
_EMAIL_HEADERS = ("email", "e-mail", "email address")


def _header_index(header: list[str]) -> dict[str, int]:
    found: dict[str, int] = {}
    for i, cell in enumerate(header):
        key = (cell or "").strip().lower()
        if key and key not in found:
            found[key] = i
    return found


def _pick(header: dict[str, int], row: list[str], *names: str) -> str:
    for name in names:
        idx = header.get(name)
        if idx is None or idx >= len(row):
            continue
        value = (row[idx] or "").strip()
        if value:
            return value
    return ""


def _rows_from_worksheet(ws) -> list[dict]:
    values = ws.get_all_values()
    if len(values) < 2:
        return []
    header = _header_index(values[0])
    if not any(name in header for name in _EMAIL_HEADERS):
        return []
    out: list[dict] = []
    for raw in values[1:]:
        email = _pick(header, raw, *_EMAIL_HEADERS).lower()
        if "@" not in email:
            continue
        out.append(
            {
                "email": email,
                "first_name": _pick(header, raw, "first_name", "first name"),
                "business_name": _pick(
                    header, raw, "business_name", "business name", "company", "name"
                ),
                "page_title": _pick(header, raw, "business_name", "business name", "company"),
                "niche": _pick(header, raw, "niche", "category"),
                "category": _pick(header, raw, "category", "niche"),
                "city": _pick(header, raw, "city"),
                "state": _pick(header, raw, "state"),
                "domain": _pick(header, raw, "domain", "website"),
                "segment": _pick(header, raw, "segment"),
                "scheduler_name": _pick(header, raw, "scheduler_name", "scheduler"),
                "employees_bucket": _pick(header, raw, "employees_bucket"),
                "lead_score": _pick(header, raw, "lead_score"),
                "uses_calendly": _pick(header, raw, "uses_calendly"),
                "uses_docusign": _pick(header, raw, "uses_docusign"),
                "uses_waiver": _pick(header, raw, "uses_waiver"),
                "waiver_provider": _pick(header, raw, "waiver_provider"),
                "detected_url": _pick(header, raw, "detected_url"),
                "_filled": sum(1 for cell in raw if (cell or "").strip()),
            }
        )
    return out


def _open_working_spreadsheet():
    from .export_sheet import _gspread_client

    sheet_id = (settings().get("google_sheets_id") or "").strip()
    if not sheet_id:
        return None, ""
    sh = _gspread_client().open_by_key(sheet_id)
    return sh, f"https://docs.google.com/spreadsheets/d/{sheet_id}"


def combine_sheet_emails() -> dict:
    """Read every tab on the campaign sheet and the working sheet. Write one All emails tab."""
    campaign, campaign_url = _open_campaign_spreadsheet()
    working_id = (settings().get("google_sheets_id") or "").strip()
    campaign_id = (settings().get("google_campaign_sheet_id") or "").strip()
    books = [(campaign, campaign_url)]
    if working_id and working_id != campaign_id:
        working, working_url = _open_working_spreadsheet()
        if working is not None:
            books.append((working, working_url))

    best: dict[str, dict] = {}
    landscaper_emails: set[str] = set()
    seen = 0
    tabs = 0
    for sh, _url in books:
        for ws in sh.worksheets():
            tabs += 1
            for lead in _rows_from_worksheet(ws):
                seen += 1
                if is_landscaper(
                    lead.get("niche"),
                    lead.get("category"),
                    lead.get("domain"),
                    lead.get("page_title"),
                    lead.get("email"),
                ):
                    landscaper_emails.add(lead["email"])
                    best.pop(lead["email"], None)
                    continue
                if lead["email"] in landscaper_emails:
                    continue
                prev = best.get(lead["email"])
                if prev is None or lead["_filled"] > prev["_filled"]:
                    best[lead["email"]] = lead

    rows = sorted(best.values(), key=lambda r: (r.get("niche") or "", r["email"]))
    written = _rewrite_campaign_tab(campaign, INVENTORY_TAB, rows)
    return {
        "sheet_url": campaign_url,
        "tab": INVENTORY_TAB,
        "spreadsheets": len(books),
        "tabs_read": tabs,
        "emails_seen": seen,
        "landscapers_removed": len(landscaper_emails),
        "unique_emails": written,
        "columns": len(CAMPAIGN_HEADERS),
        "sample_row_width": len(campaign_row(rows[0])) if rows else 0,
    }
