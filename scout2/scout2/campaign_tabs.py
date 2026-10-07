"""Sent list stays on All emails. New addresses fill new-001, then new-002, 1,000 each."""

from __future__ import annotations

import re
from pathlib import Path

from .db import TABLE, get_client, now_iso
from .derived import CAMPAIGN_HEADERS, campaign_row
from .export_sheet import _open_campaign_spreadsheet
from .settings import ROOT
from .target import is_out_of_scope, lead_text

SENT_TAB = "All emails"
BATCH_SIZE = 1000
_BATCH = re.compile(r"^new-(\d+)$")
_CUTOFF = ROOT / "data" / "campaign_forward_after.txt"


def batch_title(number: int) -> str:
    return f"new-{number:03d}"


def next_open_batch(tabs: list[tuple[str, int]]) -> tuple[str, int]:
    """(title, rows already on it). A full tab rolls to the next number."""
    numbered = []
    for title, count in tabs:
        match = _BATCH.match(title or "")
        if match:
            numbered.append((int(match.group(1)), max(0, count)))
    if not numbered:
        return batch_title(1), 0
    number, count = max(numbered)
    if count >= BATCH_SIZE:
        return batch_title(number + 1), 0
    return batch_title(number), count


def cutoff_path() -> Path:
    return _CUTOFF


def read_cutoff() -> str:
    path = cutoff_path()
    if not path.exists():
        return ""
    return path.read_text().strip()


def write_cutoff(stamp: str) -> None:
    path = cutoff_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(stamp.strip() + "\n")


def _header_map(header: list[str]) -> dict[str, int]:
    found: dict[str, int] = {}
    for i, cell in enumerate(header):
        key = (cell or "").strip().lower()
        if key and key not in found:
            found[key] = i
    return found


def _emails_on(ws) -> set[str]:
    values = ws.get_all_values()
    if not values:
        return set()
    header = _header_map(values[0])
    idx = header.get("email")
    if idx is None:
        return set()
    out: set[str] = set()
    for row in values[1:]:
        if idx >= len(row):
            continue
        email = (row[idx] or "").strip().lower()
        if "@" in email:
            out.add(email)
    return out


def _data_count(ws) -> int:
    values = ws.get_all_values()
    if len(values) < 2:
        return 0
    header = _header_map(values[0])
    idx = header.get("email")
    if idx is None:
        return max(0, len(values) - 1)
    return sum(1 for row in values[1:] if idx < len(row) and "@" in (row[idx] or ""))


def _ensure_batch(sh, title: str):
    existing = {ws.title: ws for ws in sh.worksheets()}
    if title in existing:
        return existing[title]
    ws = sh.add_worksheet(title=title, rows=BATCH_SIZE + 20, cols=len(CAMPAIGN_HEADERS))
    ws.update("A1", [CAMPAIGN_HEADERS], value_input_option="USER_ENTERED")
    return ws


def mark_all_emails_sent() -> dict:
    """Stamp every address on All emails as sent, and start the forward clock."""
    sh, url = _open_campaign_spreadsheet()
    ws = sh.worksheet(SENT_TAB)
    values = ws.get_all_values()
    if not values:
        raise SystemExit("All emails tab is empty")
    header = _header_map(values[0])
    sent_at = header.get("campaign_sent")
    dated = header.get("date_sent")
    if sent_at is None or dated is None:
        raise SystemExit("All emails is missing campaign_sent or date_sent")
    stamp = now_iso()
    day = stamp[:10]
    pair = dated == sent_at + 1
    updates = []
    marked = 0
    for row in values[1:]:
        email = ""
        email_i = header.get("email")
        if email_i is not None and email_i < len(row):
            email = (row[email_i] or "").strip()
        if "@" not in email:
            updates.append(["", ""])
            continue
        updates.append(["sent", day])
        marked += 1
    if updates and pair:
        from gspread.utils import rowcol_to_a1

        start = rowcol_to_a1(2, sent_at + 1)
        end = rowcol_to_a1(1 + len(updates), dated + 1)
        ws.update(f"{start}:{end}", updates, value_input_option="USER_ENTERED")
    write_cutoff(stamp)
    _ensure_batch(sh, batch_title(1))
    return {
        "tab": SENT_TAB,
        "marked_sent": marked,
        "date_sent": day,
        "forward_after": stamp,
        "next_tab": batch_title(1),
        "sheet_url": url,
    }


def _fresh_leads(cutoff: str, taken: set[str]) -> list[dict]:
    sb = get_client()
    out: list[dict] = []
    start = 0
    page = 1000
    while True:
        q = (
            sb.table(TABLE)
            .select(
                "email,niche,category,domain,city,state,page_title,segment,"
                "scheduler_name,employees_bucket,lead_score,created_at"
            )
            .gt("created_at", cutoff)
            .not_.is_("email", "null")
            .order("created_at")
            .range(start, start + page - 1)
        )
        chunk = list(q.execute().data or [])
        for lead in chunk:
            email = (lead.get("email") or "").strip().lower()
            if "@" not in email or email in taken:
                continue
            if is_out_of_scope(*lead_text(lead), email):
                continue
            lead["email"] = email
            taken.add(email)
            out.append(lead)
        if len(chunk) < page:
            break
        start += page
    return out


def append_forward_emails() -> dict:
    """Add emails found after the sent mark. Rolls to a new tab at 1,000."""
    cutoff = read_cutoff()
    if not cutoff:
        return {"appended": 0, "reason": "All emails has not been marked sent"}
    sh, url = _open_campaign_spreadsheet()
    taken: set[str] = set()
    counts: list[tuple[str, int]] = []
    for ws in sh.worksheets():
        taken |= _emails_on(ws)
        if _BATCH.match(ws.title or ""):
            counts.append((ws.title, _data_count(ws)))
    fresh = _fresh_leads(cutoff, taken)
    title, filled = next_open_batch(counts)
    appended = 0
    by_tab: dict[str, int] = {}
    while fresh:
        room = BATCH_SIZE - filled
        if room <= 0:
            number = int(_BATCH.match(title).group(1)) + 1
            title, filled = batch_title(number), 0
            room = BATCH_SIZE
        chunk = fresh[:room]
        fresh = fresh[room:]
        ws = _ensure_batch(sh, title)
        ws.append_rows(
            [campaign_row(lead) for lead in chunk],
            value_input_option="USER_ENTERED",
        )
        appended += len(chunk)
        by_tab[title] = by_tab.get(title, 0) + len(chunk)
        filled += len(chunk)
    return {
        "appended": appended,
        "tabs": by_tab,
        "open_tab": title,
        "open_rows": filled,
        "forward_after": cutoff,
        "sheet_url": url,
    }
