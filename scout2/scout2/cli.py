"""Scout2 CLI — resumable pipeline stages via Supabase."""

from __future__ import annotations

import asyncio
import csv
from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint

from . import __version__
from .classify import run_classify
from .db import fetch_ready, get_client
from .discover_cc import discover
from .extract import run_extract
from .fingerprint import run_fingerprint
from .score import run_score
from .export_sheet import campaign_stats, export_sheet
from .ramp_export import export_batch, list_batches
from .sheets_sync import sheets_configured, sync_leads_to_sheets
from .sync_results import sync_gmass_results
from .verify import run_verify

app = typer.Typer(help="Scout2 — appointment-SMB lead pipeline", no_args_is_help=True)


def _run(coro):
    return asyncio.run(coro)


@app.command()
def version() -> None:
    rprint(f"scout2 {__version__}")


@app.command("discover")
def discover_cmd(
    source: str = typer.Option(
        "seedlist",
        "--source",
        "-s",
        help="seedlist | places | commoncrawl (stub)",
    ),
    limit_queries: Optional[int] = typer.Option(
        None,
        "--limit-queries",
        help="Places only: cap niche×city queries this run (cost control)",
    ),
    limit_cities: Optional[int] = typer.Option(
        None,
        "--cities",
        help="Places only: finish this many cities (all niches) then stop",
    ),
    enqueue_all: bool = typer.Option(
        True,
        "--enqueue-all/--calendly-homepage-only",
        help="Seedlist: queue all domains (fingerprint later) vs only homepage calendly hits",
    ),
) -> None:
    """Discover domains and upsert status=discovered."""
    kwargs = {}
    if source == "places" and limit_queries is not None:
        kwargs["limit_queries"] = limit_queries
    if source == "places" and limit_cities is not None:
        kwargs["limit_cities"] = limit_cities
    if source == "seedlist":
        kwargs["enqueue_all"] = enqueue_all
    result = _run(discover(source=source, **kwargs))
    rprint(result)


@app.command("places-status")
def places_status_cmd(
    as_json: bool = typer.Option(False, "--json"),
) -> None:
    """How many cities/queries are left, and today's Places cap."""
    import json

    from .discover_cc import load_yaml_list
    from .places_progress import places_status as status_fn
    from .settings import settings as load_settings

    s = load_settings()
    data = status_fn(
        load_yaml_list(s["niches_path"], "niches"),
        load_yaml_list(s["metros_path"], "metros"),
    )
    if as_json:
        print(json.dumps(data))
    else:
        rprint(data)


@app.command("places-once")
def places_once_cmd(
    cities: int = typer.Option(
        1,
        "--cities",
        "-c",
        help="How many cities to finish this run (all job types in each city).",
    ),
) -> None:
    """Run Places for the next city (or N cities) now, then classify/extract. No loop."""
    import os

    os.environ["SCOUT2_SEARCH"] = "free"
    os.environ.pop("SCALESERP_KEY", None)
    os.environ.pop("SCALESERP_API_KEY", None)
    n = max(1, cities)
    rprint(f"Places once — {n} city(ies), ScaleSERP off")
    kwargs = {"limit_cities": n, "ignore_daily_cap": True}
    result = _run(discover(source="places", **kwargs))
    rprint(result)
    rprint(_run(run_fingerprint(limit=400)))
    rprint(_run(run_classify(limit=150)))
    rprint(_run(run_extract(limit=150)))
    rprint(_run(run_verify(limit=300)))
    rprint(_run(run_score(limit=500)))
    if sheets_configured():
        try:
            rprint(sync_leads_to_sheets())
        except Exception as exc:
            rprint(f"sheets-sync skipped: {exc}")
    from .places_progress import places_status as status_fn
    from .discover_cc import load_yaml_list
    from .settings import settings as load_settings

    s = load_settings()
    rprint(
        status_fn(
            load_yaml_list(s["niches_path"], "niches"),
            load_yaml_list(s["metros_path"], "metros"),
        )
    )


@app.command("fingerprint")
def fingerprint_cmd(
    limit: int = typer.Option(200, "--limit", "-n"),
) -> None:
    """Detect scheduler, meeting links, phone-only, and MX provider."""
    rprint(_run(run_fingerprint(limit=limit)))


@app.command("detect")
def detect_cmd(
    limit: int = typer.Option(200, "--limit", "-n"),
) -> None:
    """Alias for fingerprint."""
    rprint(_run(run_fingerprint(limit=limit)))


@app.command("classify")
def classify_cmd(
    limit: int = typer.Option(100, "--limit", "-n"),
) -> None:
    """Haiku classify; skip 11+, non-US, and clinics."""
    rprint(_run(run_classify(limit=limit)))


@app.command("extract")
def extract_cmd(
    limit: int = typer.Option(100, "--limit", "-n"),
) -> None:
    """Pull and rank emails."""
    rprint(_run(run_extract(limit=limit)))


@app.command("verify")
def verify_cmd(
    limit: int = typer.Option(200, "--limit", "-n"),
) -> None:
    """Syntax + MX → status=ready."""
    rprint(_run(run_verify(limit=limit)))


@app.command("score")
def score_cmd(
    limit: int = typer.Option(500, "--limit", "-n"),
) -> None:
    """Compute lead_score 0–100 and segment (switcher | greenfield | cold)."""
    rprint(_run(run_score(limit=limit)))


@app.command("export")
def export_cmd(
    out: Path = typer.Option(Path("leads_ready.csv"), "--out", "-o"),
    segment: Optional[str] = typer.Option(
        None, "--segment", help="switcher | greenfield | cold"
    ),
    min_score: Optional[int] = typer.Option(
        None, "--min-score", help="Minimum lead_score (inclusive)"
    ),
) -> None:
    """CSV of status=ready leads. Includes segment for outreach copy."""
    sb = get_client()
    rows = fetch_ready(sb, segment=segment, min_score=min_score, limit=5000)
    fields = [
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
    ]
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fields})
    rprint(
        {
            "exported": len(rows),
            "path": str(out),
            "segment": segment,
            "min_score": min_score,
        }
    )


@app.command("sheets-sync")
def sheets_sync_cmd() -> None:
    """Split/push leads into 5 tabs: Calendly, emails+phones, emails, phones, blanks."""
    if not sheets_configured():
        email_hint = service_account_email()
        rprint(
            {
                "ok": False,
                "need": [
                    "Close the Google Cloud key error — your org blocks JSON keys.",
                    "In the Google Sheet: Extensions → Apps Script, paste secrets/sheets-webhook.gs",
                    "Deploy → Web app (Execute as Me, Who has access: Anyone)",
                    "Put that URL in .env as GOOGLE_SHEETS_WEBAPP_URL",
                ],
            }
        )
        raise typer.Exit(code=1)
    rprint(sync_leads_to_sheets())


@app.command("export-sheet")
def export_sheet_cmd(
    niche: Optional[str] = typer.Option(
        None, "--niche", help="Exact niche (case-insensitive), e.g. landscaping"
    ),
    limit: int = typer.Option(
        25, "--limit", "-n", help="Max rows this batch (GMass-sized chunks)"
    ),
) -> None:
    """Write a GMass sheet of ready leads (classified, valid email, not previously exported)."""
    rprint(export_sheet(niche=niche, limit=limit))


@app.command("export-batch")
def export_batch_cmd(
    niche: str = typer.Option(..., "--niche", help="Niche to ramp, e.g. landscaping"),
    send_date: Optional[str] = typer.Option(
        None,
        "--date",
        help="Send date YYYY-MM-DD (default: today America/New_York)",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        help="Allow a second export for the same niche+date",
    ),
    schedule: bool = typer.Option(
        False,
        "--schedule",
        help="Write a weekday 10:00am launchd plist (does not enable it)",
    ),
) -> None:
    """Ramp warmup export: next day_number from ramp.yaml → new sheet tab → status=exported."""
    from datetime import date

    parsed: date | None = None
    if send_date:
        try:
            parsed = date.fromisoformat(send_date)
        except ValueError as e:
            raise typer.BadParameter(f"Invalid --date {send_date!r}; use YYYY-MM-DD") from e
    result = export_batch(niche=niche, send_date=parsed, force=force, schedule=schedule)
    rprint(result)
    if result.get("scheduled"):
        rprint(f"Load (you run this): {result.get('load')}")
        rprint(f"Unload: {result.get('unload')}")
        rprint(f"Verify: {result.get('verify')}")
        return
    if result.get("tab_name") and result.get("sheet_url"):
        rprint(f"Tab: {result['tab_name']}")
        rprint(f"Sheet: {result['sheet_url']}")
    if result.get("checklist"):
        rprint(result["checklist"])
    if result.get("warning"):
        rprint(f"[yellow]Warning:[/yellow] {result['warning']}")


@app.command("batches")
def batches_cmd(
    niche: Optional[str] = typer.Option(None, "--niche", help="Filter by niche"),
    limit: int = typer.Option(50, "--limit", "-n"),
) -> None:
    """List ramp send batches (day number, date, counts, tab)."""
    rows = list_batches(niche=niche, limit=limit)
    if not rows:
        rprint({"batches": [], "count": 0})
        return
    rprint({"count": len(rows), "batches": rows})


@app.command("sync-results")
def sync_results_cmd(
    sheet: str = typer.Option(..., "--sheet", help="GMass results spreadsheet id"),
) -> None:
    """Match GMass results on email → replied / bounced / unsubscribed / sent."""
    rprint(sync_gmass_results(sheet))

@app.command("stats")
def stats_cmd() -> None:
    """Counts by pipeline/campaign status, plus the remaining ready export pool by niche."""
    rprint(campaign_stats())


@app.command("conversions")
def conversions_cmd(
    limit: int = typer.Option(50, "--limit", "-n"),
) -> None:
    """List Scout2 leads marked converted (email matched a PinOnIt signup)."""
    sb = get_client()
    rows = list(
        sb.table("scout2_leads")
        .select("domain,email,niche,converted_user_id,converted_at,status,source")
        .eq("status", "converted")
        .order("converted_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    rprint({"count": len(rows), "conversions": rows})


@app.command("run-all")
def run_all(
    source: str = typer.Option("seedlist", "--source", "-s"),
    limit_queries: Optional[int] = typer.Option(None, "--limit-queries"),
) -> None:
    """discover → fingerprint → classify → extract → verify → score → sheets."""
    discover_cmd(source=source, limit_queries=limit_queries, enqueue_all=True)
    fingerprint_cmd(limit=500)
    classify_cmd(limit=200)
    extract_cmd(limit=200)
    verify_cmd(limit=200)
    score_cmd(limit=500)
    if sheets_configured():
        rprint(sync_leads_to_sheets())


def _print_night_summary(text: str) -> None:
    print(text, flush=True)


@app.command("scrape-night")
def scrape_night_cmd(
    hours: float = typer.Option(
        5.0,
        "--hours",
        help="Stop after this many hours (default 5). Does not touch Places nightly.",
    ),
) -> None:
    """One-click session: free SERP, chamber, thumbtack, bark, plus extra directories."""
    from .night import NightSession

    session = NightSession(hours=hours)
    try:
        _run(session.run())
    except KeyboardInterrupt:
        session.stopped = "interrupt"
        session.finish()
    _print_night_summary(session.summary())


@app.command("scrape-chamber")
def scrape_chamber_cmd() -> None:
    """Chamber of Commerce directories, one pass."""
    from .night import _known
    from .scrapers.chamber import run_chamber
    from .scrapers.common import ScrapeStats
    from .sheets_sync import flush_pending_sheets

    stats = ScrapeStats()
    _run(run_chamber(known=_known(), stats=stats, pages=2))
    flush_pending_sheets()
    rprint({"new": stats.new_by_source.get("chamber", 0), "dupes": stats.dupes})


@app.command("scrape-thumbtack")
def scrape_thumbtack_cmd() -> None:
    """Thumbtack profiles, one pass."""
    from .night import _known
    from .scrapers.common import ScrapeStats
    from .scrapers.thumbtack import run_thumbtack
    from .sheets_sync import flush_pending_sheets

    stats = ScrapeStats()
    _run(run_thumbtack(known=_known(), stats=stats, pages=2))
    flush_pending_sheets()
    rprint({"new": stats.new_by_source.get("thumbtack", 0), "dupes": stats.dupes})


@app.command("scrape-bark")
def scrape_bark_cmd() -> None:
    """Bark.com profiles, one pass."""
    from .night import _known
    from .scrapers.bark import run_bark
    from .scrapers.common import ScrapeStats
    from .sheets_sync import flush_pending_sheets

    stats = ScrapeStats()
    _run(run_bark(known=_known(), stats=stats, pages=2))
    flush_pending_sheets()
    rprint({"new": stats.new_by_source.get("bark", 0), "dupes": stats.dupes})


@app.command("scrape-directories")
def scrape_directories_cmd(
    location: str = typer.Option("USA", "--location", "-l"),
) -> None:
    """Chamber, Thumbtack, Bark, extra directories, and Calendly DuckDuckGo — one pass."""
    from .night import run_directories_once

    stats = _run(run_directories_once(pages=2, location=location))
    rprint(
        {
            "new": dict(stats.new_by_source),
            "dupes": stats.dupes,
            "total_new": stats.total_new,
        }
    )


@app.command("scrape-extra")
def scrape_extra_cmd(
    location: str = typer.Option("USA", "--location", "-l"),
) -> None:
    """Psychology Today, wedding, coaches, Houzz, Angi, BBB, Avvo, licenses, Calendly-on-the-web."""
    from .night import _known
    from .scrapers.common import ScrapeStats
    from .scrapers.extra import run_extra
    from .sheets_sync import flush_pending_sheets

    stats = ScrapeStats()
    _run(run_extra(known=_known(), stats=stats, pages=1, location=location))
    flush_pending_sheets()
    rprint({"new": dict(stats.new_by_source), "dupes": stats.dupes, "total_new": stats.total_new})


@app.command("import-domains")
def import_domains_cmd(
    path: Path = typer.Argument(..., exists=True, readable=True, help="One domain or URL per line (BuiltWith / PublicWWW export)"),
    source: str = typer.Option("tech_list", "--source"),
) -> None:
    """Load a who-uses-Calendly list. Then run: fingerprint → classify → extract → verify."""
    from .db import get_client, upsert_lead
    from .politeness import domain_of

    queued = 0
    skipped = 0
    sb = get_client()
    for line in path.read_text(errors="replace").splitlines():
        raw = line.strip().split(",")[0].strip().strip('"').strip("'")
        if not raw or raw.lower() in {"domain", "url", "website", "root domain"}:
            continue
        d = domain_of(raw)
        if not d:
            skipped += 1
            continue
        upsert_lead(sb, {"domain": d, "source": source, "status": "discovered"})
        queued += 1
    rprint({"queued": queued, "skipped": skipped, "next": "python -m scout2.cli fingerprint --limit 500"})


def main() -> None:
    app()


if __name__ == "__main__":
    main()
