from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


@lru_cache
def settings() -> dict:
    return {
        "supabase_url": os.environ.get("SUPABASE_URL", "").rstrip("/"),
        "supabase_service_key": os.environ.get("SUPABASE_SERVICE_KEY", ""),
        "anthropic_api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
        "google_places_key": os.environ.get("GOOGLE_PLACES_KEY", ""),
        "user_agent": os.environ.get(
            "SCOUT2_USER_AGENT",
            "PinOnItScout2/1.0 (+https://pinonit.com; research@pinonit.com)",
        ),
        "timeout_sec": float(os.environ.get("SCOUT2_REQUEST_TIMEOUT_SEC", "10")),
        "retries": int(os.environ.get("SCOUT2_RETRIES", "2")),
        "rate_per_domain": float(os.environ.get("SCOUT2_RATE_PER_DOMAIN", "1.0")),
        "config_dir": ROOT / "config",
        "niches_path": ROOT / "config" / "niches.yaml",
        "metros_path": ROOT / "config" / "metros.yaml",
        "domains_path": ROOT / "config" / "domains.txt",
    }


def require_env(*keys: str) -> None:
    s = settings()
    missing = [k for k in keys if not s.get(k)]
    if missing:
        raise SystemExit(
            f"Missing required env: {', '.join(missing)}. Copy .env.example → .env"
        )
