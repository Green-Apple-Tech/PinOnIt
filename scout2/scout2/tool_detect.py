"""Flag Calendly, DocuSign, and waiver tools in HTML we already fetched."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .settings import ROOT

SCAN_PATHS = ("", "/contact", "/book", "/booking", "/schedule", "/appointments", "/waiver")

TOOL_HEADERS = [
    "uses_calendly",
    "uses_docusign",
    "uses_waiver",
    "waiver_provider",
    "detected_url",
]

WAIVER_HOSTS = {
    "smartwaiver.com": "smartwaiver",
    "waiverforever.com": "waiverforever",
    "waiversign.com": "waiversign",
    "waiverfile.com": "waiverfile",
}

FLAGS_PATH = ROOT / "data" / "tool_flags.json"
_cache: dict[str, dict] | None = None


def _yn(flag: bool) -> str:
    return "Y" if flag else "N"


def _host(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _provider_for(url: str, text: str) -> str:
    blob = f"{url} {text}".lower()
    host = _host(url)
    for domain, name in WAIVER_HOSTS.items():
        if domain in host or domain in blob:
            return name
    if "wodify" in blob:
        return "wodify"
    if "jotform" in blob and "waiver" in blob:
        return "jotform"
    path = (urlparse(url).path or "").lower()
    if path.endswith(".pdf") or "release form" in blob:
        return "pdf"
    if "waiver" in blob or "release form" in blob:
        return "unknown"
    return ""


def _is_waiver_link(url: str, text: str) -> bool:
    blob = f"{url} {text}".lower()
    host = _host(url)
    if any(domain in host for domain in WAIVER_HOSTS):
        return True
    if "wodify" in blob:
        return True
    if "jotform" in blob and "waiver" in blob:
        return True
    return "waiver" in blob or "release form" in blob


def detect_tools(html: str) -> dict:
    """Scan one page. Y/N flags plus the first matching link."""
    raw = html or ""
    lowered = raw.lower()
    soup = BeautifulSoup(raw, "lxml")
    calendly = False
    docusign = False
    waiver = False
    provider = ""
    detected = ""

    def mark_calendly() -> None:
        nonlocal calendly
        calendly = True

    def mark_docusign() -> None:
        nonlocal docusign
        docusign = True

    def mark_waiver(url: str, text: str) -> None:
        nonlocal waiver, provider
        waiver = True
        if not provider:
            provider = _provider_for(url, text) or "unknown"

    def take_url(url: str) -> None:
        nonlocal detected
        if url and not detected:
            detected = url

    if (
        "calendly.com" in lowered
        or "assets.calendly.com" in lowered
        or "calendly.initinlinewidget" in lowered
    ):
        mark_calendly()
    if "docusign.net" in lowered or "docusign.com" in lowered or "powerforms" in lowered:
        mark_docusign()

    for tag in soup.find_all("a"):
        href = (tag.get("href") or "").strip()
        text = tag.get_text(" ", strip=True)
        blob = f"{href} {text}".lower()
        if not href:
            continue
        if "calendly.com" in blob or "calendly.initinlinewidget" in blob:
            mark_calendly()
            take_url(href)
        if "docusign.net" in blob or "docusign.com" in blob or "powerforms" in blob:
            mark_docusign()
            take_url(href)
        if _is_waiver_link(href, text):
            mark_waiver(href, text)
            take_url(href)

    if calendly and not detected:
        for needle in ("https://calendly.com", "https://assets.calendly.com"):
            i = lowered.find(needle)
            if i >= 0:
                take_url(raw[i:].split()[0].strip("\"'<>"))
                break
    if waiver and not provider:
        provider = "unknown"

    return {
        "uses_calendly": _yn(calendly),
        "uses_docusign": _yn(docusign),
        "uses_waiver": _yn(waiver),
        "waiver_provider": provider if waiver else "",
        "detected_url": detected,
    }


def merge_tool_flags(pages: list[str]) -> dict:
    merged = detect_tools("")
    for html in pages:
        found = detect_tools(html)
        for key in ("uses_calendly", "uses_docusign", "uses_waiver"):
            if found[key] == "Y":
                merged[key] = "Y"
        if not merged["waiver_provider"] and found["waiver_provider"]:
            merged["waiver_provider"] = found["waiver_provider"]
        if not merged["detected_url"] and found["detected_url"]:
            merged["detected_url"] = found["detected_url"]
    return merged


def _load() -> dict[str, dict]:
    global _cache
    if _cache is not None:
        return _cache
    if not FLAGS_PATH.exists():
        _cache = {}
        return _cache
    try:
        _cache = json.loads(FLAGS_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        _cache = {}
    return _cache


def remember_flags(domain: str, flags: dict) -> None:
    domain = (domain or "").strip().lower()
    if not domain:
        return
    data = _load()
    data[domain] = {key: flags.get(key) or "" for key in TOOL_HEADERS}
    FLAGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    FLAGS_PATH.write_text(json.dumps(data, indent=2) + "\n")


def flags_for(domain: str) -> dict:
    return dict(_load().get((domain or "").strip().lower()) or {})


def note_flags(stats: object, flags: dict) -> None:
    bucket = getattr(stats, "tool_flags", None)
    if bucket is None:
        bucket = {"calendly": 0, "docusign": 0, "waiver": 0}
        setattr(stats, "tool_flags", bucket)
    if flags.get("uses_calendly") == "Y":
        bucket["calendly"] += 1
    if flags.get("uses_docusign") == "Y":
        bucket["docusign"] += 1
    if flags.get("uses_waiver") == "Y":
        bucket["waiver"] += 1
    remember_flags(str(flags.get("_domain") or ""), flags)
