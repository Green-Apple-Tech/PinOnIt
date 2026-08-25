"""Ramp warmup exports: daily batch tabs sized from config/ramp.yaml."""

from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from .db import TABLE, get_client, now_iso
from .derived import CAMPAIGN_HEADERS, campaign_row
from .export_sheet import (
    _ensure_header,
    _open_campaign_spreadsheet,
    enrich_export_rows,
    select_export_rows,
)
from .settings import ROOT, settings

SEND_BATCHES = "scout2_send_batches"
LOCAL_TZ = ZoneInfo("America/New_York")
GMASS_CHECKLIST = (
    "Before sending: check yesterday's GMass report — bounces <2%, complaints 0, note replies."
)


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


def ramp_path() -> Path:
    return Path(settings()["config_dir"]) / "ramp.yaml"


def load_ramp(path: Path | None = None) -> dict:
    p = path or ramp_path()
    data = yaml.safe_load(p.read_text()) or {}
    days = {int(k): int(v) for k, v in (data.get("days") or {}).items()}
    cap = int(data.get("21_plus") or data.get("cap") or 110)
    return {"days": days, "21_plus": cap}


def target_for_day(day_number: int, ramp: dict | None = None) -> int:
    ramp = ramp or load_ramp()
    if day_number <= 0:
        raise ValueError("day_number must be >= 1")
    if day_number in ramp["days"]:
        return int(ramp["days"][day_number])
    return int(ramp["21_plus"])


def niche_slug(niche: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (niche or "").lower()).strip("-") or "niche"


def ramp_tab_name(niche: str, day_number: int, send_date: date) -> str:
    return f"{niche_slug(niche)}-day{day_number:02d}-{send_date.strftime('%Y%m%d')}"


def next_day_number(sb, niche: str) -> int:
    rows = (
        sb.table(SEND_BATCHES)
        .select("day_number")
        .ilike("niche", niche.strip())
        .order("day_number", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return 1
    return int(rows[0]["day_number"]) + 1


def existing_batch_for_date(sb, niche: str, send_date: date) -> dict | None:
    rows = (
        sb.table(SEND_BATCHES)
        .select("*")
        .ilike("niche", niche.strip())
        .eq("send_date", send_date.isoformat())
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def _write_new_tab(sh, tab_name: str, rows: list[dict]) -> None:
    values = [campaign_row(lead) for lead in rows]
    existing = {ws.title: ws for ws in sh.worksheets()}
    if tab_name in existing:
        raise SystemExit(
            f"Sheet tab already exists: {tab_name!r}. Pick another date or delete the tab."
        )
    title = tab_name[:100]
    ws = sh.add_worksheet(
        title=title,
        rows=max(50, len(values) + 10),
        cols=len(CAMPAIGN_HEADERS),
    )
    _ensure_header(ws)
    if values:
        ws.append_rows(values, value_input_option="USER_ENTERED")
    for lead in rows:
        lead["_sheet_tab"] = title


def pinonit_root() -> Path:
    # ROOT is scout2/; batch.sh and LaunchAgents live at PinOnIt repo root
    return ROOT.parent


def write_launchd_plist(
    *,
    niche: str = "landscaping",
    plist_path: Path | None = None,
) -> Path:
    """Write weekday 10:00 local launchd plist. Does NOT load it."""
    repo = pinonit_root()
    batch_sh = repo / "batch.sh"
    label = f"com.pinonit.scout2.batch.{niche_slug(niche)}"
    out = plist_path or (Path.home() / "Library" / "LaunchAgents" / f"{label}.plist")
    out.parent.mkdir(parents=True, exist_ok=True)
    log = ROOT / "logs" / "batch.log"
    (ROOT / "logs").mkdir(exist_ok=True)
    body = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{label}</string>
  <key>WorkingDirectory</key>
  <string>{repo}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>{batch_sh}</string>
    <string>{niche}</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>3</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key>
  <string>{log}</string>
  <key>StandardErrorPath</key>
  <string>{log}</string>
</dict>
</plist>
"""
    out.write_text(body)
    return out


def list_batches(sb=None, *, niche: str | None = None, limit: int = 100) -> list[dict]:
    sb = sb or get_client()
    q = (
        sb.table(SEND_BATCHES)
        .select("day_number,send_date,niche,target_count,actual_count,tab_name,sheet_url,created_at")
        .order("send_date", desc=True)
        .order("day_number", desc=True)
        .limit(limit)
    )
    if niche:
        q = q.ilike("niche", niche.strip())
    return list(q.execute().data or [])


def export_batch(
    *,
    niche: str,
    send_date: date | None = None,
    force: bool = False,
    schedule: bool = False,
) -> dict:
    niche = (niche or "").strip()
    if not niche:
        raise SystemExit("--niche is required")

    if schedule:
        plist = write_launchd_plist(niche=niche)
        return {
            "scheduled": True,
            "plist": str(plist),
            "load": f"launchctl load {plist}",
            "unload": f"launchctl unload {plist}",
            "verify": f"launchctl list | grep {plist.stem}",
            "note": "Plist written but NOT loaded. Weekdays 10:00 only — weekends do not run.",
        }

    send_date = send_date or today_local()
    sb = get_client()
    existing = existing_batch_for_date(sb, niche, send_date)
    if existing and not force:
        raise SystemExit(
            f"Already exported for niche={niche!r} date={send_date.isoformat()} "
            f"(day {existing.get('day_number')}, tab={existing.get('tab_name')}). "
            "Pass --force to override."
        )

    day_number = next_day_number(sb, niche)
    if existing and force:
        sb.table(SEND_BATCHES).delete().eq("id", existing["id"]).execute()
        day_number = int(existing["day_number"])

    target = target_for_day(day_number)
    rows = select_export_rows(sb, niche=niche, limit=target)
    shortfall = max(0, target - len(rows))
    warning = None
    if shortfall:
        warning = (
            f"Ready pool short by {shortfall}: target={target}, got={len(rows)}. "
            f"Scraper needs ~{shortfall} more ready {niche} leads."
        )
    if not rows:
        return {
            "exported": 0,
            "day_number": day_number,
            "send_date": send_date.isoformat(),
            "niche": niche,
            "target_count": target,
            "actual_count": 0,
            "warning": warning or "no ready leads matched filters",
            "checklist": GMASS_CHECKLIST,
        }

    import asyncio

    rows = asyncio.run(enrich_export_rows(rows))
    tab = ramp_tab_name(niche, day_number, send_date)
    sh, url = _open_campaign_spreadsheet()
    _write_new_tab(sh, tab, rows)

    batch = (
        sb.table(SEND_BATCHES)
        .insert(
            {
                "day_number": day_number,
                "send_date": send_date.isoformat(),
                "niche": niche,
                "target_count": target,
                "actual_count": len(rows),
                "tab_name": tab,
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
        payload = {
            "status": "exported",
            "exported_at": stamped,
            "sheet_tab": tab,
            "page_title": lead.get("page_title") or None,
            "city": lead.get("city") or None,
            "state": lead.get("state") or None,
            "updated_at": stamped,
        }
        if batch_id:
            payload["send_batch_id"] = batch_id
        sb.table(TABLE).update(payload).eq("id", lead["id"]).execute()

    result = {
        "exported": len(rows),
        "batch_id": batch_id,
        "day_number": day_number,
        "send_date": send_date.isoformat(),
        "niche": niche,
        "target_count": target,
        "actual_count": len(rows),
        "tab_name": tab,
        "sheet_url": url,
        "checklist": GMASS_CHECKLIST,
    }
    if warning:
        result["warning"] = warning
    return result
