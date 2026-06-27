"""SMTP email delivery for IAM (password reset notifications)."""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


def normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def normalize_phone(value: str | None) -> str:
    return "".join(c for c in (value or "") if c.isdigit())


def member_name_candidates(user: dict[str, Any], enrollment_data: dict[str, Any] | None) -> list[str]:
    out: list[str] = []
    if user.get("name"):
        out.append(normalize_text(user["name"]))
    if enrollment_data:
        personal = enrollment_data.get("personal") or {}
        full = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip()
        if full:
            out.append(normalize_text(full))
    return [n for n in out if n]


def member_phone_candidates(
    enrollment_data: dict[str, Any] | None,
    application: dict[str, Any] | None = None,
) -> list[str]:
    out: list[str] = []
    if enrollment_data:
        personal = enrollment_data.get("personal") or {}
        for key in ("mobile", "phone", "cell", "telephone"):
            digits = normalize_phone(personal.get(key))
            if len(digits) >= 6:
                out.append(digits)
        address = enrollment_data.get("address") or {}
        digits = normalize_phone(address.get("phone"))
        if len(digits) >= 6:
            out.append(digits)
    if application:
        digits = normalize_phone(application.get("mobile") or application.get("phone"))
        if len(digits) >= 6:
            out.append(digits)
    return list(dict.fromkeys(out))


def verify_member_identity(
    user: dict[str, Any],
    enrollment_data: dict[str, Any] | None,
    name: str,
    phone: str,
    application: dict[str, Any] | None = None,
) -> bool:
    provided_name = normalize_text(name)
    provided_phone = normalize_phone(phone)
    if not provided_name or len(provided_phone) < 6:
        return False
    if provided_name not in member_name_candidates(user, enrollment_data):
        return False
    stored_phones = member_phone_candidates(enrollment_data, application)
    return bool(stored_phones) and provided_phone in stored_phones


def default_email_settings() -> dict[str, Any]:
    return {
        "enabled": False,
        "smtp_host": os.getenv("SMTP_HOST", "").strip(),
        "smtp_port": int(os.getenv("SMTP_PORT", "587") or "587"),
        "smtp_use_tls": os.getenv("SMTP_USE_TLS", "true").lower() != "false",
        "smtp_user": os.getenv("SMTP_USER", "").strip(),
        "smtp_password": os.getenv("SMTP_PASSWORD", "").strip(),
        "from_email": os.getenv("SMTP_FROM_EMAIL", os.getenv("ADMIN_EMAIL", "")).strip(),
        "from_name": os.getenv("SMTP_FROM_NAME", "International Apostolic Mission").strip(),
        "site_url": os.getenv("SITE_URL", "http://127.0.0.1:8001").strip().rstrip("/"),
    }


async def get_email_settings(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    doc = await db.site_settings.find_one({"_id": "email"})
    base = default_email_settings()
    if not doc:
        return base
    merged = {**base, **{k: v for k, v in doc.items() if k != "_id"}}
    if doc.get("smtp_password"):
        merged["smtp_password"] = doc["smtp_password"]
    return merged


def public_email_settings(settings: dict[str, Any]) -> dict[str, Any]:
    configured = bool(
        settings.get("enabled")
        and settings.get("smtp_host")
        and settings.get("from_email")
        and settings.get("smtp_user")
        and settings.get("smtp_password")
    )
    return {"configured": configured, "enabled": bool(settings.get("enabled"))}


def admin_email_settings_response(settings: dict[str, Any]) -> dict[str, Any]:
    return {
        "enabled": bool(settings.get("enabled")),
        "smtp_host": settings.get("smtp_host") or "",
        "smtp_port": int(settings.get("smtp_port") or 587),
        "smtp_use_tls": bool(settings.get("smtp_use_tls", True)),
        "smtp_user": settings.get("smtp_user") or "",
        "smtp_password_set": bool(settings.get("smtp_password")),
        "from_email": settings.get("from_email") or "",
        "from_name": settings.get("from_name") or "International Apostolic Mission",
        "site_url": settings.get("site_url") or "http://127.0.0.1:8001",
    }


def send_password_reset_email(
    settings: dict[str, Any],
    *,
    to_email: str,
    member_name: str,
    new_password: str,
) -> None:
    if not settings.get("enabled"):
        raise RuntimeError("Email delivery is not enabled. Ask your administrator to configure Password Settings.")
    host = (settings.get("smtp_host") or "").strip()
    user = (settings.get("smtp_user") or "").strip()
    password = settings.get("smtp_password") or ""
    from_email = (settings.get("from_email") or "").strip()
    from_name = (settings.get("from_name") or "International Apostolic Mission").strip()
    site_url = (settings.get("site_url") or "http://127.0.0.1:8001").strip().rstrip("/")

    if not host or not user or not password or not from_email:
        raise RuntimeError("Email is not fully configured. Contact the administrator.")

    port = int(settings.get("smtp_port") or 587)
    use_tls = bool(settings.get("smtp_use_tls", True))

    subject = "Your IAM account password has been reset"
    body = f"""Dear {member_name},

Your International Apostolic Mission account password has been reset as requested.

Email: {to_email}
New password: {new_password}

Sign in here: {site_url}/login

If you did not request this change, contact the administrator immediately.

— International Apostolic Mission
"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        if use_tls:
            smtp.starttls()
        smtp.login(user, password)
        smtp.send_message(msg)
