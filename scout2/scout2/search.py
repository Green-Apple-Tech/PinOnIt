"""Organic search links. Default is free (DuckDuckGo, then Bing). ScaleSerp optional."""

from __future__ import annotations

import asyncio
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from .settings import settings

SCALE_SERP_URL = "https://api.scaleserp.com/search"
DDG_HTML = "https://html.duckduckgo.com/html/"
BING_SEARCH = "https://www.bing.com/search"
SEARCH_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

ExpiredFn = Callable[[], bool] | None
_backend_logged = False
_ddg_fail_streak = 0
_DDG_GIVE_UP = 3


def _has_scaleserp() -> bool:
    return bool((settings().get("scaleserp_key") or "").strip())


def _backend() -> str:
    raw = (settings().get("search_backend") or "free").strip().lower()
    if raw in {"scaleserp", "serp"} and _has_scaleserp():
        return "scaleserp"
    return "free"


def _unwrap_ddg(href: str) -> str:
    if not href:
        return ""
    abs_url = href if href.startswith("http") else urljoin("https://duckduckgo.com", href)
    parsed = urlparse(abs_url)
    qs = parse_qs(parsed.query)
    if qs.get("uddg"):
        return unquote(qs["uddg"][0])
    return abs_url


def _clean_result(href: str) -> str | None:
    url = (href or "").strip()
    if not url or url.startswith("#"):
        return None
    if "duckduckgo.com" in urlparse(url).netloc:
        url = _unwrap_ddg(url)
    host = (urlparse(url).hostname or "").lower()
    if not host or host.endswith("duckduckgo.com") or host.endswith("bing.com"):
        return None
    if urlparse(url).scheme not in {"http", "https"}:
        return None
    return url


async def _ddg_links(
    client: httpx.AsyncClient,
    query: str,
    *,
    pages: int,
    max_links: int,
    deadline_expired: ExpiredFn,
) -> list[str]:
    global _ddg_fail_streak
    if _ddg_fail_streak >= _DDG_GIVE_UP:
        return []
    links: list[str] = []
    seen: set[str] = set()
    offset = 0
    for _ in range(max(1, pages)):
        if deadline_expired and deadline_expired():
            break
        if len(links) >= max_links:
            break
        try:
            r = await client.post(
                DDG_HTML,
                data={"q": query, "s": str(offset), "b": ""},
                headers={
                    "User-Agent": SEARCH_UA,
                    "Referer": DDG_HTML,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout=12.0,
                follow_redirects=True,
            )
            r.raise_for_status()
            html = r.text
        except Exception as exc:
            _ddg_fail_streak += 1
            print(f"[search] DuckDuckGo failed q={query!r}: {exc}")
            if _ddg_fail_streak >= _DDG_GIVE_UP:
                print(
                    "[search] DuckDuckGo blocked — skipping it for this run",
                    flush=True,
                )
            break
        _ddg_fail_streak = 0
        soup = BeautifulSoup(html, "lxml")
        found = 0
        for a in soup.select("a.result__a, a.result-link"):
            url = _clean_result(a.get("href") or "")
            if not url or url in seen:
                continue
            seen.add(url)
            links.append(url)
            found += 1
            if len(links) >= max_links:
                break
        if found == 0:
            break
        offset += 30
        await asyncio.sleep(1.5)
    return links


async def _bing_links(
    client: httpx.AsyncClient,
    query: str,
    *,
    pages: int,
    max_links: int,
    deadline_expired: ExpiredFn,
) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for page in range(max(1, pages)):
        if deadline_expired and deadline_expired():
            break
        if len(links) >= max_links:
            break
        first = 1 + page * 10
        try:
            r = await client.get(
                BING_SEARCH,
                params={"q": query, "setlang": "en", "cc": "US", "first": first},
                headers={"User-Agent": SEARCH_UA, "Accept-Language": "en-US,en;q=0.9"},
                timeout=30.0,
                follow_redirects=True,
            )
            r.raise_for_status()
            html = r.text
        except Exception as exc:
            print(f"[search] Bing failed q={query!r}: {exc}")
            break
        soup = BeautifulSoup(html, "lxml")
        found = 0
        for a in soup.select("ol#b_results li.b_algo h2 a, li.b_algo h2 a"):
            url = _clean_result(a.get("href") or "")
            if not url or url in seen:
                continue
            seen.add(url)
            links.append(url)
            found += 1
            if len(links) >= max_links:
                break
        if found == 0:
            break
        await asyncio.sleep(1.5)
    return links


async def _free_links(
    client: httpx.AsyncClient,
    query: str,
    *,
    pages: int,
    max_links: int,
    deadline_expired: ExpiredFn,
) -> list[str]:
    links = await _ddg_links(
        client,
        query,
        pages=pages,
        max_links=max_links,
        deadline_expired=deadline_expired,
    )
    if len(links) >= 3 or (deadline_expired and deadline_expired()):
        return links
    extra = await _bing_links(
        client,
        query,
        pages=pages,
        max_links=max_links,
        deadline_expired=deadline_expired,
    )
    seen = set(links)
    for url in extra:
        if url not in seen:
            links.append(url)
            seen.add(url)
        if len(links) >= max_links:
            break
    return links


async def _scaleserp_links(
    client: httpx.AsyncClient,
    query: str,
    *,
    pages: int,
    max_links: int,
    deadline_expired: ExpiredFn,
) -> list[str]:
    key = settings().get("scaleserp_key") or ""
    if not key:
        print("[search] SCOUT2_SEARCH=scaleserp but no SCALESERP_KEY — using free search")
        return await _free_links(
            client,
            query,
            pages=pages,
            max_links=max_links,
            deadline_expired=deadline_expired,
        )
    links: list[str] = []
    seen: set[str] = set()
    for page in range(1, max(1, pages) + 1):
        if deadline_expired and deadline_expired():
            break
        if len(links) >= max_links:
            break
        try:
            r = await client.get(
                SCALE_SERP_URL,
                params={
                    "api_key": key,
                    "q": query,
                    "page": page,
                    "fields": "organic_results",
                    "gl": "us",
                    "hl": "en",
                    "google_domain": "google.com",
                },
                timeout=60.0,
            )
            r.raise_for_status()
            data: dict[str, Any] = r.json() or {}
        except Exception as exc:
            print(f"[ScaleSerp] failed q={query!r} page={page}: {type(exc).__name__}")
            break
        info = data.get("request_info") or {}
        if info.get("success") is False:
            print(f"[ScaleSerp] API message: {info.get('message')}")
            break
        organic = data.get("organic_results") or []
        if not organic:
            break
        for row in organic:
            href = (row.get("link") or "").strip()
            if not href or href in seen:
                continue
            seen.add(href)
            links.append(href)
            if len(links) >= max_links:
                break
        await asyncio.sleep(1.0)
    return links


async def organic_links(
    client: httpx.AsyncClient,
    query: str,
    *,
    pages: int = 1,
    max_links: int = 30,
    deadline_expired: ExpiredFn = None,
) -> list[str]:
    """Organic result URLs. Free HTML search by default; ScaleSerp if configured."""
    global _backend_logged
    backend = _backend()
    if not _backend_logged:
        label = "ScaleSerp (paid)" if backend == "scaleserp" else "DuckDuckGo/Bing (free)"
        print(f"[search] using {label}", flush=True)
        _backend_logged = True
    if backend == "scaleserp":
        return await _scaleserp_links(
            client,
            query,
            pages=pages,
            max_links=max_links,
            deadline_expired=deadline_expired,
        )
    return await _free_links(
        client,
        query,
        pages=pages,
        max_links=max_links,
        deadline_expired=deadline_expired,
    )
