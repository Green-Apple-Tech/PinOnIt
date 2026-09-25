"""Paid ScaleSerp discovery for one manual scrape-night run."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

from .scrapers.common import Known, ScrapeStats, ingest_website, is_skipped_host, load_directory_niches
from .search import SCALE_SERP_URL
from .settings import ROOT, settings

LOG_PATH = ROOT / "data" / "scaleserp_query_log.json"
CALENDLY_TAB = "Calendly Pages"
WAIVER_BITS = (
    "gym",
    "trampoline",
    "tattoo",
    "massage",
    "climbing",
    "rental",
    "camp",
    "training",
    "paintball",
    "escape",
    "yoga",
    "dance",
    "crossfit",
    "axe",
    "kayak",
    "boat",
    "horse",
)


class ScaleSerpBudget:
    def __init__(self, max_searches: int) -> None:
        self.max_searches = max(0, max_searches)
        self.used = 0
        self.stopped = ""

    def allow(self) -> bool:
        return not self.stopped and self.used < self.max_searches

    def stop(self, reason: str) -> None:
        if not self.stopped:
            self.stopped = reason
            print(f"[ScaleSerp] stopping: {reason}", flush=True)


def max_per_run() -> int:
    raw = (os.environ.get("SCALESERP_MAX_PER_RUN") or "50").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 50


def scaleserp_enabled() -> bool:
    raw = (os.environ.get("SCOUT2_SCALESERP_DISCOVERY") or "1").strip().lower()
    return raw not in {"0", "off", "false", "no"}


def is_waiver_niche(niche: str) -> bool:
    text = (niche or "").lower()
    return any(bit in text for bit in WAIVER_BITS)


def discovery_queries(niches: list[str]) -> list[tuple[str, str]]:
    """(kind, query). kind is 'site' for calendly.com pages, else 'web'."""
    ordered = sorted(niches, key=lambda n: (0 if is_waiver_niche(n) else 1, n.lower()))
    out: list[tuple[str, str]] = []
    for niche in ordered:
        name = niche.strip()
        if not name:
            continue
        out.append(("web", f"{name} book online calendly"))
        out.append(("web", f"{name} sign waiver online"))
        if is_waiver_niche(name):
            out.append(("web", f"{name} online waiver"))
        out.append(("site", f'site:calendly.com "{name}"'))
    return out


def _load_log() -> list[dict]:
    if not LOG_PATH.exists():
        return []
    try:
        data = json.loads(LOG_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    return list(data) if isinstance(data, list) else []


def recent_queries(days: int = 30) -> set[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    found: set[str] = set()
    for row in _load_log():
        stamp = row.get("at") or ""
        try:
            when = datetime.fromisoformat(stamp)
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        if when >= cutoff and row.get("query"):
            found.add(str(row["query"]))
    return found


def remember_query(query: str) -> None:
    rows = _load_log()
    rows.append({"query": query, "at": datetime.now(timezone.utc).isoformat()})
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(rows, indent=2) + "\n")


def _credit_failure(status: int, message: str) -> bool:
    text = (message or "").lower()
    if status in {401, 402, 403, 429}:
        return True
    return any(bit in text for bit in ("credit", "quota", "limit exceeded", "out of"))


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


async def _search(
    client: httpx.AsyncClient,
    budget: ScaleSerpBudget,
    query: str,
) -> list[dict[str, str]]:
    if not budget.allow():
        return []
    key = (settings().get("scaleserp_key") or "").strip()
    if not key:
        budget.stop("no SCALESERP_KEY")
        return []
    try:
        response = await client.get(
            SCALE_SERP_URL,
            params={
                "api_key": key,
                "q": query,
                "num": 10,
                "fields": "organic_results",
                "gl": "us",
                "hl": "en",
                "google_domain": "google.com",
            },
            timeout=60.0,
        )
    except Exception as exc:
        budget.stop(f"{type(exc).__name__}: {exc}")
        return []
    budget.used += 1
    remember_query(query)
    if response.status_code >= 400:
        budget.stop(f"HTTP {response.status_code}")
        return []
    try:
        data: dict[str, Any] = response.json() or {}
    except Exception as exc:
        budget.stop(f"bad JSON: {exc}")
        return []
    info = data.get("request_info") or {}
    message = str(info.get("message") or data.get("error") or "")
    if info.get("success") is False or _credit_failure(response.status_code, message):
        budget.stop(message or "ScaleSerp error")
        return []
    rows = []
    for item in data.get("organic_results") or []:
        link = str(item.get("link") or "").strip()
        title = str(item.get("title") or "").strip()
        if link:
            rows.append({"title": title, "link": link})
    return rows


def _append_calendly_pages(rows: list[dict[str, str]]) -> int:
    if not rows:
        return 0
    from .export_sheet import _open_campaign_spreadsheet

    sh, _url = _open_campaign_spreadsheet()
    try:
        ws = sh.worksheet(CALENDLY_TAB)
    except Exception:
        ws = sh.add_worksheet(title=CALENDLY_TAB, rows=200, cols=2)
        ws.update("A1", [["title", "url"]], value_input_option="USER_ENTERED")
    existing = {str(cell).strip() for cell in ws.col_values(2)}
    fresh = [row for row in rows if row["link"] not in existing]
    if not fresh:
        return 0
    ws.append_rows(
        [[row["title"], row["link"]] for row in fresh],
        value_input_option="USER_ENTERED",
    )
    return len(fresh)


def plan_queries(niches: list[str] | None = None) -> list[tuple[str, str]]:
    niches = niches if niches is not None else load_directory_niches()
    done = recent_queries()
    planned: list[tuple[str, str]] = []
    cap = max_per_run()
    for kind, query in discovery_queries(niches):
        if query in done:
            continue
        planned.append((kind, query))
        if len(planned) >= cap:
            break
    return planned


async def run_scaleserp_discovery(
    *,
    known: Known,
    stats: ScrapeStats,
    dry_run: bool = False,
) -> dict:
    planned = plan_queries()
    summary = {
        "searches_used": 0,
        "new_leads": 0,
        "calendly": 0,
        "docusign": 0,
        "waiver": 0,
        "calendly_pages": 0,
        "stopped": "",
        "dry_run": dry_run,
        "queries": [query for _kind, query in planned],
    }
    if dry_run:
        print(f"[ScaleSerp dry-run] {len(planned)} searches, no API calls", flush=True)
        for _kind, query in planned:
            print(f"  {query}", flush=True)
        return summary
    if not scaleserp_enabled():
        summary["stopped"] = "disabled"
        return summary

    budget = ScaleSerpBudget(max_per_run())
    pages: list[dict[str, str]] = []
    before = stats.total_new
    async with httpx.AsyncClient() as client:
        from .politeness import PoliteFetcher

        async with PoliteFetcher() as fetcher:
            for kind, query in planned:
                if not budget.allow():
                    break
                print(f"[ScaleSerp] {budget.used + 1}/{budget.max_searches} {query}", flush=True)
                hits = await _search(client, budget, query)
                if budget.stopped:
                    break
                for hit in hits:
                    host = _host(hit["link"])
                    if kind == "site" or "calendly.com" in host:
                        if "calendly.com" in host:
                            pages.append(hit)
                        continue
                    if not host or is_skipped_host(host) or host in known.domains:
                        continue
                    await ingest_website(
                        fetcher,
                        source="serp",
                        category=query,
                        rec={"domain": host, "website": hit["link"]},
                        known=known,
                        stats=stats,
                    )
    summary["searches_used"] = budget.used
    summary["stopped"] = budget.stopped
    summary["new_leads"] = stats.total_new - before
    summary["calendly_pages"] = _append_calendly_pages(pages) if pages else 0
    flags = _flag_counts(stats)
    summary.update(flags)
    print(
        "[ScaleSerp] searches used={searches_used} new leads={new_leads} "
        "calendly={calendly} docusign={docusign} waiver={waiver} "
        "calendly_pages={calendly_pages} stopped={stopped}".format(**summary),
        flush=True,
    )
    return summary


def _flag_counts(stats: ScrapeStats) -> dict[str, int]:
    counts = getattr(stats, "tool_flags", None) or {}
    return {
        "calendly": int(counts.get("calendly") or 0),
        "docusign": int(counts.get("docusign") or 0),
        "waiver": int(counts.get("waiver") or 0),
    }
