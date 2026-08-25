"""Manual 5-hour directory + SERP session. Does not replace Places."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from .db import fetch_known_keys, get_client
from .scrapers.bark import run_bark
from .scrapers.chamber import run_chamber
from .scrapers.common import Deadline, Known, ScrapeStats, load_metros
from .scrapers.extra import run_extra
from .scrapers.serp import run_serp
from .scrapers.thumbtack import run_thumbtack
from .settings import settings
from .sheets_sync import flush_pending_sheets

SUMMARY_BANNER = "Scout directory session complete"


def format_summary(deadline: Deadline, stats: ScrapeStats, log_path: Path) -> str:
    s = stats.new_by_source
    lines = [
        SUMMARY_BANNER,
        f"Duration: {deadline.duration_label()}",
        f"Total new leads: {stats.total_new}",
    ]
    for key, val in s.items():
        if val:
            lines.append(f"  {key}: {val} new")
    lines.append(f"  Dupes skipped: {stats.dupes}")
    lines.append(f"Log: {log_path}")
    return "\n".join(lines)


def write_log(
    log_path: Path,
    deadline: Deadline,
    stats: ScrapeStats,
    *,
    loops: int,
    stopped: str,
) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "date": date.today().isoformat(),
        "duration": deadline.duration_label(),
        "elapsed_sec": round(deadline.elapsed(), 1),
        "loops": loops,
        "stopped": stopped,
        "total_new": stats.total_new,
        "new": dict(stats.new_by_source),
        "dupes_skipped": stats.dupes,
    }
    log_path.write_text(json.dumps(payload, indent=2) + "\n")


def log_path_for_today() -> Path:
    logs = settings()["logs_dir"]
    return Path(logs) / f"night-{date.today().isoformat()}.json"


def _known() -> Known:
    domains, emails = fetch_known_keys(get_client())
    return Known(domains, emails)


async def run_directories_once(
    *,
    known: Known | None = None,
    stats: ScrapeStats | None = None,
    deadline: Deadline | None = None,
    pages: int = 2,
    location: str = "USA",
) -> ScrapeStats:
    """Chamber, Thumbtack, Bark, extra directories, free Calendly SERP. One pass."""
    known = known or _known()
    stats = stats or ScrapeStats()
    await run_chamber(known=known, stats=stats, deadline=deadline, pages=pages, location=location)
    await run_thumbtack(known=known, stats=stats, deadline=deadline, pages=pages, location=location)
    await run_bark(known=known, stats=stats, deadline=deadline, pages=pages, location=location)
    await run_extra(known=known, stats=stats, deadline=deadline, pages=max(1, pages - 1) or 1, location=location)
    await run_serp(known=known, stats=stats, deadline=deadline, pages=pages, location=location)
    flush_pending_sheets()
    return stats


class NightSession:
    """Runs until `hours` elapse. Safe to Ctrl+C — inserts are per-lead."""

    def __init__(self, hours: float = 5.0) -> None:
        self.deadline = Deadline(hours=hours)
        self.stats = ScrapeStats()
        self.loop_n = 0
        self.path = log_path_for_today()
        self.stopped = "time"

    async def run(self) -> None:
        known = _known()
        metros = load_metros() or ["USA"]
        try:
            while True:
                if self.deadline.expired():
                    self.stopped = "time"
                    break
                self.loop_n += 1
                location = metros[(self.loop_n - 1) % len(metros)]
                print(
                    f"[{self.deadline.remaining_label()} remaining] "
                    f"Starting loop {self.loop_n} ({location})...",
                    flush=True,
                )
                await run_serp(
                    known=known,
                    stats=self.stats,
                    deadline=self.deadline,
                    pages=1,
                    location=location,
                )
                flush_pending_sheets()
                if self.deadline.expired():
                    break
                await run_chamber(
                    known=known,
                    stats=self.stats,
                    deadline=self.deadline,
                    pages=1,
                    location=location,
                )
                flush_pending_sheets()
                if self.deadline.expired():
                    break
                await run_thumbtack(
                    known=known,
                    stats=self.stats,
                    deadline=self.deadline,
                    pages=1,
                    location=location,
                )
                flush_pending_sheets()
                if self.deadline.expired():
                    break
                await run_bark(
                    known=known,
                    stats=self.stats,
                    deadline=self.deadline,
                    pages=1,
                    location=location,
                )
                flush_pending_sheets()
                if self.deadline.expired():
                    break
                await run_extra(
                    known=known,
                    stats=self.stats,
                    deadline=self.deadline,
                    pages=1,
                    location=location,
                )
                flush_pending_sheets()
        except KeyboardInterrupt:
            self.stopped = "interrupt"
        self.finish()

    def finish(self) -> None:
        flush_pending_sheets()
        write_log(
            self.path,
            self.deadline,
            self.stats,
            loops=self.loop_n,
            stopped=self.stopped,
        )

    def summary(self) -> str:
        return format_summary(self.deadline, self.stats, self.path)
