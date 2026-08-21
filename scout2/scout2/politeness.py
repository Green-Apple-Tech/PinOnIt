from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

from .settings import settings


def domain_of(url_or_host: str) -> str:
    raw = url_or_host.strip()
    if not raw:
        return ""
    if "://" not in raw:
        raw = "https://" + raw
    host = urlparse(raw).hostname or ""
    return host.lower().removeprefix("www.")


def origin_of(url_or_host: str) -> str:
    d = domain_of(url_or_host)
    return f"https://{d}" if d else ""


class PoliteFetcher:
    """1 req/sec per domain, robots.txt, UA, timeout, retries."""

    def __init__(self) -> None:
        s = settings()
        self.ua = s["user_agent"]
        self.timeout = s["timeout_sec"]
        self.retries = s["retries"]
        self.rate = s["rate_per_domain"]
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._last: dict[str, float] = defaultdict(float)
        self._robots: dict[str, RobotFileParser | None] = {}
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> PoliteFetcher:
        self._client = httpx.AsyncClient(
            headers={"User-Agent": self.ua, "Accept": "text/html,application/xhtml+xml"},
            follow_redirects=True,
            timeout=self.timeout,
        )
        return self

    async def __aexit__(self, *_) -> None:
        if self._client:
            await self._client.aclose()

    @property
    def client(self) -> httpx.AsyncClient:
        assert self._client is not None
        return self._client

    async def _throttle(self, domain: str) -> None:
        lock = self._locks[domain]
        async with lock:
            elapsed = time.monotonic() - self._last[domain]
            wait = self.rate - elapsed
            if wait > 0:
                await asyncio.sleep(wait)
            self._last[domain] = time.monotonic()

    async def allowed(self, url: str) -> bool:
        d = domain_of(url)
        if not d:
            return False
        if d not in self._robots:
            rp = RobotFileParser()
            robots_url = f"https://{d}/robots.txt"
            try:
                await self._throttle(d)
                r = await self.client.get(robots_url)
                if r.status_code >= 400:
                    self._robots[d] = None
                else:
                    rp.parse(r.text.splitlines())
                    self._robots[d] = rp
            except Exception:
                self._robots[d] = None
        rp = self._robots[d]
        if rp is None:
            return True
        try:
            return rp.can_fetch(self.ua, url)
        except Exception:
            return True

    async def get_text(self, url: str) -> tuple[int | None, str, str]:
        """Returns (status, final_url, text). Empty text on failure."""
        d = domain_of(url)
        if not d:
            return None, url, ""
        if not await self.allowed(url):
            return None, url, ""

        last_err: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                await self._throttle(d)
                r = await self.client.get(url)
                ctype = r.headers.get("content-type", "")
                if "text" not in ctype and "html" not in ctype and "json" not in ctype:
                    return r.status_code, str(r.url), ""
                return r.status_code, str(r.url), r.text
            except Exception as e:
                last_err = e
                await asyncio.sleep(0.5 * (attempt + 1))
        _ = last_err
        return None, url, ""
