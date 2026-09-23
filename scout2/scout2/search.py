"""Organic search links. Default is free (Bing, then DuckDuckGo). ScaleSerp optional."""

from __future__ import annotations

import asyncio
import base64
import time
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
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
BROWSER_HEADERS = {
    "User-Agent": SEARCH_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

ExpiredFn = Callable[[], bool] | None
_backend_logged = False
_ddg_blocked_until = 0.0
_ddg_cooldown = 0.0
_ddg_block_logged = False
_last_ddg_at = 0.0
_DDG_MIN_GAP = 2.5


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


def _decode_bing_redirect(url: str) -> str | None:
    """Bing wraps results as /ck/a?...&u=a1<base64 url>."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if "bing.com" not in host:
        return url
    raw = (parse_qs(parsed.query).get("u") or [""])[0].strip()
    if raw.startswith("a1"):
        raw = raw[2:]
    if not raw:
        return None
    raw += "=" * (-len(raw) % 4)
    try:
        text = base64.urlsafe_b64decode(raw).decode("utf-8", "ignore")
    except Exception:
        return None
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return None


def _clean_result(href: str) -> str | None:
    url = (href or "").strip()
    if not url or url.startswith("#"):
        return None
    host = (urlparse(url).hostname or "").lower()
    if "duckduckgo.com" in host:
        url = _unwrap_ddg(url)
    elif "bing.com" in host:
        decoded = _decode_bing_redirect(url)
        if not decoded:
            return None
        url = decoded
    host = (urlparse(url).hostname or "").lower()
    if not host or host.endswith("duckduckgo.com") or host.endswith("bing.com"):
        return None
    if urlparse(url).scheme not in {"http", "https"}:
        return None
    return url


def _search_client() -> httpx.AsyncClient:
    """Fresh client per query. Reusing DuckDuckGo cookies turns the next search into a 202."""
    return httpx.AsyncClient(
        timeout=20.0,
        follow_redirects=True,
        headers=BROWSER_HEADERS,
    )


def _ddg_is_blocked() -> bool:
    return time.monotonic() < _ddg_blocked_until


def _note_ddg_block(reason: str) -> None:
    global _ddg_blocked_until, _ddg_cooldown, _ddg_block_logged
    _ddg_cooldown = min(600.0, _ddg_cooldown * 2 if _ddg_cooldown else 45.0)
    _ddg_blocked_until = time.monotonic() + _ddg_cooldown
    if not _ddg_block_logged:
        print(
            f"[search] DuckDuckGo blocked ({reason}). "
            f"Using Bing for {int(_ddg_cooldown)}s, then retrying DuckDuckGo.",
            flush=True,
        )
        _ddg_block_logged = True


def _note_ddg_ok() -> None:
    global _ddg_cooldown, _ddg_block_logged, _ddg_blocked_until
    _ddg_cooldown = 0.0
    _ddg_blocked_until = 0.0
    _ddg_block_logged = False


async def _pace_ddg() -> None:
    """Space queries out so a long night does not trip DuckDuckGo's block immediately."""
    global _last_ddg_at
    wait = _DDG_MIN_GAP - (time.monotonic() - _last_ddg_at)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_ddg_at = time.monotonic()


async def _ddg_links(
    client: httpx.AsyncClient,
    query: str,
    *,
    pages: int,
    max_links: int,
    deadline_expired: ExpiredFn,
) -> list[str]:
    if _ddg_is_blocked():
        return []
    links: list[str] = []
    seen: set[str] = set()
    offset = 0
    for _page in range(max(1, pages)):
        if deadline_expired and deadline_expired():
            break
        if len(links) >= max_links:
            break
        await _pace_ddg()
        try:
            # GET on a fresh client. POST, or sending DuckDuckGo's cookie back, returns 202/403.
            async with _search_client() as http:
                r = await http.get(
                    DDG_HTML,
                    params={"q": query, "s": str(offset), "kl": "us-en"},
                    headers={"Referer": "https://duckduckgo.com/"},
                    timeout=12.0,
                )
        except Exception as exc:
            print(f"[search] DuckDuckGo failed q={query!r}: {exc}")
            _note_ddg_block(type(exc).__name__)
            break
        if r.status_code in {202, 403, 429, 503}:
            print(f"[search] DuckDuckGo HTTP {r.status_code} q={query!r}")
            _note_ddg_block(str(r.status_code))
            break
        if r.status_code >= 400:
            print(f"[search] DuckDuckGo failed q={query!r}: HTTP {r.status_code}")
            _note_ddg_block(str(r.status_code))
            break
        soup = BeautifulSoup(r.text, "lxml")
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
            # Challenge pages are HTTP 200 with no result links.
            if offset == 0 and "result__a" not in r.text:
                _note_ddg_block("empty challenge page")
            break
        _note_ddg_ok()
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
            async with _search_client() as http:
                r = await http.get(
                    BING_SEARCH,
                    params={"q": query, "setlang": "en", "cc": "US", "first": first},
                    timeout=30.0,
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
    links = await _bing_links(
        client,
        query,
        pages=pages,
        max_links=max_links,
        deadline_expired=deadline_expired,
    )
    if len(links) >= 3 or (deadline_expired and deadline_expired()):
        return links
    extra = await _ddg_links(
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
        label = "ScaleSerp (paid)" if backend == "scaleserp" else "Bing (free)"
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
