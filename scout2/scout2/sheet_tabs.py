"""Route a lead to one of five Google Sheet tabs (mutually exclusive)."""

from __future__ import annotations

TABS = (
    "Calendly users",
    "Emails and phones",
    "Emails",
    "Phones",
    "Blanks",
)

OLD_TAB = "Scout2 Leads"


def _filled(value) -> bool:
    if value is None or value is False:
        return False
    if isinstance(value, (int, float)) and value == 0:
        return False
    s = str(value).strip()
    if not s:
        return False
    return s.lower() not in {"false", "none", "null", "n/a", "-", "no"}


def is_calendly_lead(lead: dict) -> bool:
    det = lead.get("calendly_detected")
    if det is True:
        return True
    d = str(det or "").strip().lower()
    if d in {"yes", "true", "1"}:
        return True
    if str(lead.get("scheduler_name") or "").strip().lower() == "calendly":
        return True
    url = f"{lead.get('calendly_url') or ''} {lead.get('booking_url') or ''}".lower()
    return "calendly.com" in url


def lead_tab(lead: dict) -> str:
    """Calendly first, then email+phone, email-only, phone-only, else blanks."""
    if is_calendly_lead(lead):
        return "Calendly users"
    has_email = _filled(lead.get("email"))
    has_phone = _filled(lead.get("phone"))
    if has_email and has_phone:
        return "Emails and phones"
    if has_email:
        return "Emails"
    if has_phone:
        return "Phones"
    return "Blanks"
