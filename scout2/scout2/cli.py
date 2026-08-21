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
from .db import fetch_by_status, get_client
from .detect import run_detect
from .discover_cc import discover
from .extract import run_extract
from .verify import run_verify

app = typer.Typer(help="Scout2 — Calendly SMB lead pipeline", no_args_is_help=True)


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
        help="Places only: cap niche×metro queries (cost control)",
    ),
    enqueue_all: bool = typer.Option(
        True,
        "--enqueue-all/--calendly-homepage-only",
        help="Seedlist: queue all domains (detect later) vs only homepage calendly hits",
    ),
) -> None:
    """Discover domains and upsert status=discovered."""
    kwargs = {}
    if source == "places" and limit_queries is not None:
        kwargs["limit_queries"] = limit_queries
    if source == "seedlist":
        kwargs["enqueue_all"] = enqueue_all
    result = _run(discover(source=source, **kwargs))
    rprint(result)


@app.command("detect")
def detect_cmd(
    limit: int = typer.Option(200, "--limit", "-n"),
) -> None:
    """Find Calendly on discovered domains."""
    rprint(_run(run_detect(limit=limit)))


@app.command("classify")
def classify_cmd(
    limit: int = typer.Option(100, "--limit", "-n"),
) -> None:
    """Haiku classify; skip 11+ / non-US."""
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


@app.command("export")
def export_cmd(
    out: Path = typer.Option(Path("leads_ready.csv"), "--out", "-o"),
) -> None:
    """CSV of status=ready leads."""
    sb = get_client()
    rows = fetch_by_status(sb, "ready", limit=5000)
    fields = [
        "domain",
        "email",
        "email_rank",
        "niche",
        "employees_bucket",
        "calendly_url",
        "source",
        "mx_valid",
        "status",
        "created_at",
    ]
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fields})
    rprint({"exported": len(rows), "path": str(out)})


@app.command("run-all")
def run_all(
    source: str = typer.Option("seedlist", "--source", "-s"),
    limit_queries: Optional[int] = typer.Option(None, "--limit-queries"),
) -> None:
    """discover → detect → classify → extract → verify (same session)."""
    discover_cmd(source=source, limit_queries=limit_queries, enqueue_all=True)
    detect_cmd(limit=500)
    classify_cmd(limit=200)
    extract_cmd(limit=200)
    verify_cmd(limit=200)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
