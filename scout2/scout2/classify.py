"""Classify fingerprinted domains with Claude Haiku. Skip 11+ and clinics."""

from __future__ import annotations

import json
import re
from html import unescape

import anthropic
from bs4 import BeautifulSoup

from .db import fetch_by_status, get_client, upsert_lead
from .politeness import PoliteFetcher
from .settings import require_env, settings

TEAM_PATHS = ("", "/about", "/team", "/staff", "/our-team", "/practitioners")

MEDICAL_WELLNESS_HINTS = (
    "therapist",
    "therapy",
    "counselor",
    "chiropractor",
    "med spa",
    "medspa",
    "dietitian",
    "dietician",
    "massage",
    "personal train",
    "lash",
    "wellness",
    "clinic",
    "private practice",
    "psycholog",
    "physio",
    "acupunct",
)

CLINIC_RE = re.compile(
    r"\b(our team|meet the team|our doctors|our providers|our staff|"
    r"our clinicians|our practitioners|multiple locations|our locations)\b",
    re.I,
)
SOLO_RE = re.compile(
    r"\b(about me|my practice|solo practice|i['’]m (a |the )?(licensed )?"
    r"(therapist|chiropractor|dietitian|dietician|practitioner|provider))\b",
    re.I,
)
DR_RE = re.compile(r"\bdr\.?\s+[A-Z]", re.I)

SYSTEM = """You classify small US service businesses for B2B outreach.
Return ONLY valid JSON with keys:
  niche (short string, e.g. "real estate", "photography", "landscaping")
  est_employees_bucket: one of "1", "2-10", "11+"
  us_based: boolean
  practice_type: null, or for medical/wellness only "solo_practitioner" or "clinic"
    clinic = multiple providers / staff directory / several clinicians
    solo_practitioner = one named provider or "about me"
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


def looks_medical_wellness(niche: str, text: str) -> bool:
    blob = f"{niche} {text}".lower()
    return any(h in blob for h in MEDICAL_WELLNESS_HINTS)


def heuristic_practice_type(text: str) -> str | None:
    if not text:
        return None
    drs = len(DR_RE.findall(text))
    if drs >= 3 or CLINIC_RE.search(text):
        return "clinic"
    if SOLO_RE.search(text):
        return "solo_practitioner"
    return None


async def classify_one(
    client: anthropic.Anthropic, snippet: dict, domain: str
) -> dict:
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
    pt = data.get("practice_type")
    if pt not in {"solo_practitioner", "clinic", None}:
        pt = str(pt).strip().lower() if pt else None
        if pt not in {"solo_practitioner", "clinic"}:
            pt = None
    return {
        "niche": str(data.get("niche") or "unknown")[:120],
        "est_employees_bucket": bucket,
        "us_based": bool(data.get("us_based")),
        "practice_type": pt,
    }


async def run_classify(limit: int = 100) -> dict:
    require_env("anthropic_api_key", "supabase_url", "supabase_service_key")
    sb = get_client()
    rows = fetch_by_status(sb, ["fingerprinted", "detected"], limit=limit)
    client = anthropic.Anthropic(api_key=settings()["anthropic_api_key"])
    kept = 0
    skipped = 0
    skipped_clinic = 0
    errors = 0

    async with PoliteFetcher() as fetcher:
        for row in rows:
            domain = row["domain"]
            snippets: list[str] = []
            title_meta = {"title": "", "meta": ""}
            for path in TEAM_PATHS:
                url = f"https://{domain}{path}"
                _, _, html = await fetcher.get_text(url)
                if not html:
                    continue
                sn = visible_snippet(html, limit=1800)
                if not title_meta["title"]:
                    title_meta = {"title": sn["title"], "meta": sn["meta"]}
                snippets.append(sn["text"])
            combined = " ".join(snippets)[:3500]
            snippet = {
                "title": title_meta["title"],
                "meta": title_meta["meta"],
                "text": combined,
            }
            try:
                result = await classify_one(client, snippet, domain)
            except Exception:
                errors += 1
                upsert_lead(sb, {"domain": domain, "status": "error"})
                continue

            practice_type = result["practice_type"]
            if looks_medical_wellness(result["niche"], combined):
                practice_type = practice_type or heuristic_practice_type(combined)
            else:
                practice_type = None

            if result["est_employees_bucket"] == "11+" or not result["us_based"]:
                upsert_lead(
                    sb,
                    {
                        "domain": domain,
                        "niche": result["niche"],
                        "employees_bucket": result["est_employees_bucket"],
                        "practice_type": practice_type,
                        "page_title": title_meta["title"] or None,
                        "status": "skipped_size",
                    },
                )
                skipped += 1
                continue

            if practice_type == "clinic":
                upsert_lead(
                    sb,
                    {
                        "domain": domain,
                        "niche": result["niche"],
                        "employees_bucket": result["est_employees_bucket"],
                        "practice_type": "clinic",
                        "page_title": title_meta["title"] or None,
                        "status": "skipped_clinic",
                    },
                )
                skipped_clinic += 1
                continue

            upsert_lead(
                sb,
                {
                    "domain": domain,
                    "niche": result["niche"],
                    "employees_bucket": result["est_employees_bucket"],
                    "practice_type": practice_type,
                    "page_title": title_meta["title"] or None,
                    "status": "classified",
                },
            )
            kept += 1

    return {
        "processed": len(rows),
        "classified": kept,
        "skipped": skipped,
        "skipped_clinic": skipped_clinic,
        "errors": errors,
    }
