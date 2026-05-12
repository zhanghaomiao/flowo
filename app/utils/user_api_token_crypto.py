"""HMAC-based storage for user API tokens (flw_...)."""

from __future__ import annotations

import hashlib
import hmac


def hash_user_token(token: str, *, secret: str) -> str:
    """HMAC-SHA256 hex digest; ``secret`` is typically ``settings.SECRET_KEY``."""
    return hmac.new(
        secret.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def build_token_prefix(token: str) -> str:
    if len(token) > 10:
        return f"{token[:10]}…"
    return "—"
