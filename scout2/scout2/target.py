"""Who Scout2 looks for: same-day, one-signature waivers. Not landscapers or multi-party contracts."""

from __future__ import annotations

import re

# Liability release a customer signs the day they show up. One signer.
# "landscape" alone stays out so landscape photography is not treated as a landscaper.
LANDSCAPER_RE = re.compile(
    r"\blandscap(?:er|ers|ing)\b|\blawn ?care\b|\blawn service\b|\blawncare\b",
    re.I,
)

# Multi-page, multi-signer paperwork (purchase agreements, closings). Not a same-day waiver.
MULTIPARTY_RE = re.compile(
    r"\breal estate\b|\brealtor\b|\bmortgage\b|\btitle company\b|\bescrow\b|"
    r"\battorney\b|\blaw firm\b|\bnotary\b",
    re.I,
)


def _blob(*parts: str | None) -> str:
    return " ".join((p or "").strip() for p in parts if p and str(p).strip())


def is_landscaper(*parts: str | None) -> bool:
    return bool(LANDSCAPER_RE.search(_blob(*parts)))


def is_multiparty_contract(*parts: str | None) -> bool:
    return bool(MULTIPARTY_RE.search(_blob(*parts)))


def is_out_of_scope(*parts: str | None) -> bool:
    return is_landscaper(*parts) or is_multiparty_contract(*parts)


def lead_text(lead: dict) -> tuple[str, str, str, str]:
    return (
        str(lead.get("niche") or ""),
        str(lead.get("category") or ""),
        str(lead.get("domain") or ""),
        str(lead.get("page_title") or lead.get("business_name") or ""),
    )
