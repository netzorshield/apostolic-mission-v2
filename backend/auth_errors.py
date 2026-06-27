"""Stable sign-in error codes returned as HTTPException detail (string)."""
from __future__ import annotations

from fastapi import HTTPException


class AuthError:
    ACCOUNT_DELETED = "ACCOUNT_DELETED"
    DELETION_PENDING = "DELETION_PENDING"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"


def raise_auth_error(code: str, *, status_code: int = 403) -> None:
    raise HTTPException(status_code=status_code, detail=code)
