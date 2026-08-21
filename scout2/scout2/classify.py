"""Classify Calendly-positive domains with Claude Haiku. Skip 11+ employees."""

from __future__ import annotations

import json
import re
from html import unescape

import anthropic
from bs4 import BeautifulSoup

from .db import fetch_by_status, get_client, upsert_lead
from .politeness import PoliteFetcher
from .settings import require_env, settings

SYSTEM = """You classify small US service businesses for B2B outreach.
Return ONLY valid JSON with keys:
  niche (short string, e.g. "real estate", "photography", "coaching")
  est_employees_bucket: one of "1", "2-10", "11+"
  us_based: boolean
No markdown, no commentary."""


def visible_snippet(html: str, limit: int = 2000) -> dict[str, str]:
    soup = BeautifulSoup(html or "", "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    title = (soup.title.string or "").strip() if soup.title else ""
    meta = ""
    md = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    if md and md.get("content"):
        meta = md["content"].strip()
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    text = unescape(text)[:limit]
    return {"title": title[:300], "meta": meta[:500], "text": text}


async def classify_one(client: anthropic.Anthropic, snippet: dict, domain: str) -> dict:
    user = (
        f"Domain: {domain}\n"
        f"Title: {snippet.get('title')}\n"
        f"Meta: {snippet.get('meta')}\n"
        f"Text: {snippet.get('text')}\n"
    )
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=256,
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    raw = ""
    for block in msg.content:
        if hasattr(block, "text"):
            raw += block.text
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    data = json.loads(raw)
    bucket = str(data.get("est_employees_bucket") or "").strip()
    if bucket not in {"1", "2-10", "11+"}:
        bucket = "2-10"
    return {
        "niche": str(data.get("niche") or "unknown")[:120],
        "est_employees_bucket": bucket,
        "us_based": bool(data.get("us_based")),
    }


async def run_classify(limit: int = 100) -> dict:
    require_env("anthropic_api_key", "supabase_url", "supabase_service_key")
    sb = get_client()
    rows = fetch_by_status(sb, "detected", limit=limit)
    client = anthropic.Anthropic(api_key=settings()["anthropic_api_key"])
    kept = 0
    skipped = 0
    errors = 0

    async with PoliteFetcher() as fetcher:
        for row in rows:
            domain = row["domain"]
            _, _, html = await fetcher.get_text(f"https://{domain}")
            snippet = visible_snippet(html)
            try:
                result = await classify_one(client, snippet, domain)
            except Exception:
                errors += 1
                upsert_lead(sb, {"domain": domain, "status": "error"})
                continue

            if result["est_employees_bucket"] == "11+" or not result["us_based"]:
                upsert_lead(
                    sb,
                    {
                        "domain": domain,
                        "niche": result["niche"],
                        "employees_bucket": result["est_employees_bucket"],
                        "status": "skipped_size",
                    },
                )
                skipped += 1
            else:
                upsert_lead(
                    sb,
                    {
                        "domain": domain,
                        "niche": result["niche"],
                        "employees_bucket": result["est_employees_bucket"],
                        "status": "classified",
                    },
                )
                kept += 1

    return {"processed": len(rows), "classified": kept, "skipped": skipped, "errors": errors}
