"""Deleted account restoration requests — verify identity and restore from snapshot."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

import bcrypt
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from account_deletion import restore_deleted_account
from deleted_account_details import snapshot_contact_details


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def normalize_phone(value: str | None) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def verify_password(plain: str, hashed: str | None) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def snapshot_enrollment_data(snapshot: dict[str, Any]) -> dict[str, Any]:
    enrollment = snapshot.get("enrollment") or {}
    if isinstance(enrollment.get("data"), dict):
        return enrollment["data"]
    return enrollment if isinstance(enrollment, dict) else {}


def build_verification(
    record: dict[str, Any] | None,
    *,
    email: str,
    name: str,
    phone: str,
    password: str,
    church_name: str,
) -> dict[str, Any]:
    if not record:
        return {
            "email": False,
            "name": False,
            "phone": False,
            "password": False,
            "church_name": False,
            "all_matched": False,
        }

    snapshot = record.get("snapshot") or {}
    user = snapshot.get("user") or {}
    contact = snapshot_contact_details(snapshot, record)
    data = snapshot_enrollment_data(snapshot)
    church = data.get("church") or {}

    stored_phone = normalize_phone(
        contact.get("phone") or (data.get("personal") or {}).get("mobile")
    )
    stored_church = normalize_text(church.get("church_name") or church.get("name"))

    checks = {
        "email": normalize_text(record.get("email") or user.get("email")) == normalize_text(email),
        "name": normalize_text(user.get("name")) == normalize_text(name),
        "phone": bool(stored_phone) and stored_phone == normalize_phone(phone),
        "password": verify_password(password, user.get("password")),
        "church_name": bool(stored_church) and stored_church == normalize_text(church_name),
    }
    checks["all_matched"] = all(checks.values())
    return checks


async def find_deleted_record(db: AsyncIOMotorDatabase, email: str) -> dict[str, Any] | None:
    return await db.deleted_accounts.find_one(
        {"email": email.lower(), "stage": {"$in": ["held", "purged"]}}
    )


async def submit_restore_request(
    db: AsyncIOMotorDatabase,
    *,
    email: str,
    name: str,
    phone: str,
    password: str,
    church_name: str,
    message: str,
    restore_user_snapshot: Callable[[dict[str, Any]], Awaitable[None]],
) -> dict[str, Any]:
    email_l = email.lower().strip()
    record = await find_deleted_record(db, email_l)

    if not record:
        user = await db.users.find_one({"email": email_l, "status": "deletion_hold"})
        if user:
            record = await db.deleted_accounts.find_one(
                {"email": email_l},
                sort=[("approved_at", -1)],
            )
        if not record:
            raise HTTPException(
                status_code=404,
                detail="No deleted account found for this email. Check your details or contact the administrator.",
            )

    verification = build_verification(
        record,
        email=email_l,
        name=name,
        phone=phone,
        password=password,
        church_name=church_name,
    )

    now = utcnow()
    status = "pending"
    processed_at = None

    if verification["all_matched"] and record.get("stage") in ("held", "purged"):
        await restore_deleted_account(db, record, restore_user_snapshot)
        status = "auto_restored"
        processed_at = now

    doc = {
        "email": email_l,
        "name": name.strip(),
        "phone": phone.strip(),
        "church_name": church_name.strip(),
        "message": message.strip(),
        "deleted_account_id": str(record["_id"]),
        "verification": verification,
        "status": status,
        "created_at": now,
        "updated_at": now,
        "processed_at": processed_at,
    }
    result = await db.account_restore_requests.insert_one(doc)

    if status != "auto_restored":
        await db.deleted_accounts.update_one(
            {"_id": record["_id"]},
            {"$set": {"reactivation_requested": True, "reactivation_at": now}},
        )

    if status == "auto_restored":
        return {
            "ok": True,
            "status": "auto_restored",
            "message": "Your details matched our records. Your account has been restored — you can sign in now.",
            "request_id": str(result.inserted_id),
        }

    return {
        "ok": True,
        "status": "pending",
        "message": "Your restore request was sent to the administrator. They will review your details and restore your account if everything is correct.",
        "request_id": str(result.inserted_id),
        "verification": verification,
    }


def serialize_restore_request(doc: dict[str, Any]) -> dict[str, Any]:
    row = dict(doc)
    row["id"] = str(doc["_id"])
    row.pop("_id", None)
    for key in ("created_at", "updated_at", "processed_at"):
        val = row.get(key)
        if isinstance(val, datetime):
            row[key] = val.isoformat()
    return row
