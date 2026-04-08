from __future__ import annotations

import os


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_supabase_config() -> tuple[str, str]:
    return require_env("SUPABASE_URL"), require_env("SUPABASE_SERVICE_ROLE_KEY")
