"""Privacy isolation: members see only themselves; admin monitors members; admin is protected."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

MEMBER_ACTIVITY = "member_activity"
ADMIN_AUDIT = "admin_audit"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def user_id_str(user: dict[str, Any]) -> str:
    return str(user["_id"])


def is_admin(user: dict[str, Any]) -> bool:
    return user.get("role") == "admin"


def is_member(user: dict[str, Any]) -> bool:
    return user.get("role") == "member"


def require_member_account(user: dict[str, Any]) -> dict[str, Any]:
    """Member self-service only — administrators use the admin control center."""
    if not is_member(user):
        raise HTTPException(
            status_code=403,
            detail="Administrator accounts are isolated. Use the Admin Control Center.",
        )
    return user


def require_admin_account(user: dict[str, Any]) -> dict[str, Any]:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def verify_session_user(payload: dict[str, Any], user: dict[str, Any]) -> None:
    """Ensure the JWT belongs to the loaded account — blocks cross-account session reuse."""
    if str(user["_id"]) != str(payload.get("sub")):
        raise HTTPException(status_code=401, detail="Session invalid — please sign in again")
    token_email = (payload.get("email") or "").lower()
    if token_email and (user.get("email") or "").lower() != token_email:
        raise HTTPException(status_code=401, detail="Session invalid — please sign in again")


def assert_member_resource_owner(user: dict[str, Any], owner_id: str) -> None:
    if user_id_str(user) != str(owner_id):
        raise HTTPException(status_code=403, detail="Access denied — you can only view your own account")


def assert_not_admin_target(target: dict[str, Any] | None) -> None:
    if target and is_admin(target):
        raise HTTPException(status_code=403, detail="Administrator accounts are protected and cannot be modified")


def serialize_identity(user: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return only the signed-in user's own profile — never another account."""
    if not user:
        return None
    out: dict[str, Any] = {
        "id": user_id_str(user),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "status": user.get("status"),
        "enrollment_complete": bool(user.get("enrollment_complete")),
    }
    if is_member(user):
        out["member_id"] = user.get("member_id")
    return out


def serialize_admin_directory_user(user: dict[str, Any]) -> dict[str, Any]:
    """Admin list view — administrator records are masked; members are fully listed for admin."""
    if is_admin(user):
        return {
            "id": user_id_str(user),
            "role": "admin",
            "name": user.get("name") or "IAM Administrator",
            "email": "[protected]",
            "status": user.get("status", "active"),
            "protected": True,
            "approval_label": "Administrator (Secured)",
            "enrollment_complete": True,
            "isolated": True,
        }
    out = {k: v for k, v in user.items() if k not in {"_id", "password"}}
    out["id"] = user_id_str(user)
    for key, val in list(out.items()):
        if isinstance(val, datetime):
            out[key] = val.isoformat()
    return out


async def log_member_activity(
    db: AsyncIOMotorDatabase,
    user: dict[str, Any],
    action: str,
    detail: str = "",
    request: Request | None = None,
) -> None:
    if not is_member(user):
        return
    ip = request.client.host if request and request.client else None
    await db[MEMBER_ACTIVITY].insert_one(
        {
            "user_id": user_id_str(user),
            "email": user.get("email"),
            "name": user.get("name"),
            "action": action,
            "detail": detail[:500] if detail else "",
            "ip": ip,
            "created_at": utcnow(),
            "visibility": "admin_only",
        }
    )


async def log_admin_audit(
    db: AsyncIOMotorDatabase,
    admin: dict[str, Any],
    action: str,
    detail: str = "",
    request: Request | None = None,
) -> None:
    if not is_admin(admin):
        return
    ip = request.client.host if request and request.client else None
    await db[ADMIN_AUDIT].insert_one(
        {
            "admin_id": user_id_str(admin),
            "action": action,
            "detail": detail[:500] if detail else "",
            "ip": ip,
            "created_at": utcnow(),
            "visibility": "admin_secured",
        }
    )


def parse_activity_date(date_str: str | None) -> tuple[datetime, datetime] | None:
    if not date_str or not date_str.strip():
        return None
    try:
        day = datetime.strptime(date_str.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date — use YYYY-MM-DD") from exc
    return day, day + timedelta(days=1)


def build_member_activity_query(
    q: str | None = None,
    date: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if user_id:
        query["user_id"] = user_id
    date_range = parse_activity_date(date)
    if date_range:
        start, end = date_range
        query["created_at"] = {"$gte": start, "$lt": end}
    term = (q or "").strip()
    if term:
        pattern = re.escape(term)
        query["$or"] = [
            {"name": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
            {"action": {"$regex": pattern, "$options": "i"}},
            {"detail": {"$regex": pattern, "$options": "i"}},
        ]
    return query


def build_admin_audit_query(q: str | None = None, date: str | None = None) -> dict[str, Any]:
    query: dict[str, Any] = {}
    date_range = parse_activity_date(date)
    if date_range:
        start, end = date_range
        query["created_at"] = {"$gte": start, "$lt": end}
    term = (q or "").strip()
    if term:
        pattern = re.escape(term)
        query["$or"] = [
            {"action": {"$regex": pattern, "$options": "i"}},
            {"detail": {"$regex": pattern, "$options": "i"}},
            {"admin_id": {"$regex": pattern, "$options": "i"}},
        ]
    return query


def build_recycle_bin_query(q: str | None = None, date: str | None = None) -> dict[str, Any]:
    query: dict[str, Any] = {}
    date_range = parse_activity_date(date)
    if date_range:
        start, end = date_range
        query["deleted_at"] = {"$gte": start, "$lt": end}
    term = (q or "").strip()
    if term:
        pattern = re.escape(term)
        query["$or"] = [
            {"title": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
            {"item_type": {"$regex": pattern, "$options": "i"}},
        ]
    return query


def serialize_activity_row(doc: dict[str, Any]) -> dict[str, Any]:
    out = dict(doc)
    out["id"] = str(doc["_id"])
    out.pop("_id", None)
    for key in ("created_at", "deleted_at"):
        val = out.get(key)
        if isinstance(val, datetime):
            out[key] = val.isoformat()
    return out
