"""International Apostolic Mission API."""
from __future__ import annotations

import secrets
import string
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from account_deletion import (
    DELETION_HOLD_DAYS,
    build_user_snapshot,
    flag_reactivation_attempt,
    generate_deletion_pdf,
    purge_expired_deleted_accounts,
    restore_deleted_account,
)
from auth_errors import AuthError, raise_auth_error
from account_restore import serialize_restore_request, submit_restore_request
from deleted_account_details import purge_single_deleted_account, snapshot_contact_details
from mission_posts import (
    ALLOWED_EXT,
    MISSION_DIR,
    enrich_post_for_member,
    get_published_post,
    save_mission_media_file,
    serialize_post,
)
from security_isolation import (
    ADMIN_AUDIT,
    MEMBER_ACTIVITY,
    assert_not_admin_target,
    build_admin_audit_query,
    build_member_activity_query,
    build_recycle_bin_query,
    log_admin_audit,
    log_member_activity,
    require_admin_account,
    require_member_account,
    serialize_activity_row,
    serialize_identity,
    verify_session_user,
)
from security_middleware import SecurityHeadersMiddleware
from config import load_settings
from enrollment_documents import (
    DOC_TYPES,
    media_type_for_path,
    resolve_enrollment_document,
    save_enrollment_document,
)
from email_service import (
    admin_email_settings_response,
    get_email_settings,
    public_email_settings,
    send_password_reset_email,
    verify_member_identity,
)

settings = load_settings()
db: AsyncIOMotorDatabase
WALLPAPER_DIR = Path(__file__).resolve().parent / "uploads" / "wallpapers"
WALLPAPER_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_WALLPAPER_URL = "/uploads/wallpapers/default-sunset.png"
DEFAULT_WALLPAPER_FILE = "default-sunset.png"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc


SENSITIVE_FIELDS = {"_id", "password", "login_password"}


def enroll_password_fields(plain_password: str) -> dict[str, Any]:
    """Enroll only — admin may view the password the member chose at registration."""
    return {
        "password": hash_password(plain_password),
        "login_password": plain_password,
    }


def member_password_hash_only(plain_password: str) -> dict[str, Any]:
    """Forgot-password and admin reset — hash only; login_password is cleared."""
    return {"password": hash_password(plain_password)}


def generate_reset_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def attach_admin_password_info(item: dict[str, Any], user: dict[str, Any]) -> None:
    item["has_password"] = bool(user.get("password"))
    item["login_password"] = user.get("login_password") or None


def serialize(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    out = {k: v for k, v in doc.items() if k not in SENSITIVE_FIELDS}
    out["id"] = str(doc["_id"])
    for key, val in list(out.items()):
        if isinstance(val, datetime):
            out[key] = val.isoformat()
    return out


def snapshot_doc(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    out = dict(doc)
    out["id"] = str(doc["_id"])
    out.pop("_id", None)
    for key, val in list(out.items()):
        if isinstance(val, datetime):
            out[key] = val.isoformat()
        elif isinstance(val, ObjectId):
            out[key] = str(val)
    return out


def sanitize_for_json(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for key, val in value.items():
            if key == "_id":
                cleaned["id"] = str(val) if isinstance(val, ObjectId) else val
                continue
            cleaned[key] = sanitize_for_json(val)
        return cleaned
    if isinstance(value, list):
        return [sanitize_for_json(v) for v in value]
    return value


def restore_doc(snapshot: dict[str, Any] | None) -> dict[str, Any] | None:
    if not snapshot:
        return None
    doc = dict(snapshot)
    doc_id = doc.pop("id", None) or doc.pop("_id", None)
    if not doc_id:
        return None
    doc["_id"] = oid(str(doc_id))
    return doc


RECYCLE_LABELS = {
    "user": "User / Member",
    "application": "Application",
    "enrollment": "Enrollment",
    "help": "Help Submission",
}


async def archive_to_recycle_bin(
    item_type: str,
    original_id: str,
    title: str,
    email: str | None,
    snapshot: dict[str, Any],
    admin: dict[str, Any],
) -> None:
    await db.recycle_bin.insert_one(
        {
            "item_type": item_type,
            "original_id": original_id,
            "title": title or "Untitled",
            "email": email,
            "snapshot": snapshot,
            "deleted_at": utcnow(),
            "deleted_by": str(admin["_id"]),
        }
    )


async def restore_user_snapshot(snapshot: dict[str, Any]) -> None:
    user_raw = snapshot.get("user")
    if not user_raw:
        raise HTTPException(status_code=400, detail="Invalid user snapshot")
    user_doc = restore_doc(user_raw)
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid user snapshot")
    user_id = user_doc["_id"]
    if await db.users.find_one({"_id": user_id}):
        raise HTTPException(status_code=400, detail="User already exists")
    email = user_doc.get("email", "").lower()
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already in use by another account")
    await db.users.insert_one(user_doc)

    enrollment_raw = snapshot.get("enrollment")
    if enrollment_raw:
        enrollment_doc = restore_doc(enrollment_raw)
        if enrollment_doc and not await db.enrollments.find_one({"_id": enrollment_doc["_id"]}):
            await db.enrollments.insert_one(enrollment_doc)

    card_raw = snapshot.get("membership_card")
    if card_raw:
        card_doc = restore_doc(card_raw)
        if card_doc and not await db.membership_cards.find_one({"_id": card_doc["_id"]}):
            await db.membership_cards.insert_one(card_doc)

    for app_raw in snapshot.get("applications") or []:
        app_doc = restore_doc(app_raw)
        if app_doc and not await db.applications.find_one({"_id": app_doc["_id"]}):
            await db.applications.insert_one(app_doc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": utcnow() + timedelta(hours=settings.jwt_access_token_expire_hours),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


def clear_auth_cookie(response: Response) -> None:
    """Remove legacy shared-browser cookie sessions (Bearer token only)."""
    response.delete_cookie(
        "access_token",
        path="/",
        secure=settings.require_https,
        samesite="lax",
    )


async def get_current_user(request: Request) -> dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    user = await db.users.find_one({"_id": oid(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    verify_session_user(payload, user)
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact administrator.")
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="Registration was rejected by the administrator.")
    return user


def is_approved_member(user: dict[str, Any]) -> bool:
    if user.get("role") != "member":
        return False
    return bool(
        user.get("enrollment_complete")
        and user.get("member_id")
        and user.get("status") == "active"
    )


def approved_member_query() -> dict[str, Any]:
    """Members approved by admin — administrator accounts are never counted as users."""
    return {
        "role": "member",
        "enrollment_complete": True,
        "status": "active",
        "member_id": {"$exists": True, "$ne": None},
    }


async def require_member(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    return require_member_account(user)


async def require_approved_member_account(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    require_member_account(user)
    if not is_approved_member(user):
        raise HTTPException(
            status_code=403,
            detail="Member Portal access requires admin approval of your registration.",
        )
    return user


def assert_login_allowed(user: dict[str, Any]) -> None:
    status = user.get("status")
    if status == "pending_approval":
        raise_auth_error(AuthError.PENDING_APPROVAL)
    if status == "rejected":
        raise_auth_error(AuthError.REJECTED)
    if status == "suspended":
        raise_auth_error(AuthError.SUSPENDED)
    if status == "deletion_requested":
        raise_auth_error(AuthError.DELETION_PENDING)
    if status == "deletion_hold":
        raise_auth_error(AuthError.ACCOUNT_DELETED)


async def require_approved_member(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    if user.get("role") == "admin":
        return user
    return await require_approved_member_account(user)


async def require_admin(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    return require_admin_account(user)


async def seed_admin() -> None:
    existing = await db.users.find_one({"email": settings.admin_email.lower()})
    hashed = hash_password(settings.admin_password)
    if not existing:
        await db.users.insert_one(
            {
                "email": settings.admin_email.lower(),
                "password": hashed,
                "name": settings.admin_name,
                "role": "admin",
                "status": "active",
                "member_id": None,
                "enrollment_complete": True,
                "created_at": utcnow(),
                "updated_at": utcnow(),
            }
        )
        return
    updates: dict[str, Any] = {"updated_at": utcnow()}
    if existing.get("name") != settings.admin_name:
        updates["name"] = settings.admin_name
    if not verify_password(settings.admin_password, existing["password"]):
        updates["password"] = hashed
    if len(updates) > 1:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": updates})


def ensure_default_wallpaper_file() -> None:
    WALLPAPER_DIR.mkdir(parents=True, exist_ok=True)
    target = WALLPAPER_DIR / DEFAULT_WALLPAPER_FILE
    if target.is_file():
        return
    emblem = Path(__file__).resolve().parent / "assets" / "iam-emblem.png"
    if emblem.is_file():
        try:
            from PIL import Image

            img = Image.open(emblem).convert("RGB")
            img = img.resize((1920, 1080), Image.Resampling.LANCZOS)
            img.save(target, "PNG", optimize=True)
            return
        except Exception:
            pass
    target.write_bytes(
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x00\x05\xfe\xd4\xef\x00\x00\x00\x00IEND\xaeB`\x82"
    )


async def seed_wallpaper() -> None:
    ensure_default_wallpaper_file()
    existing = await db.site_settings.find_one({"_id": "wallpaper"})
    if existing:
        return
    await db.site_settings.insert_one(
        {
            "_id": "wallpaper",
            "type": "image",
            "url": DEFAULT_WALLPAPER_URL,
            "source": "upload",
            "fit": "cover",
            "position_x": 50,
            "position_y": 50,
            "zoom": 100,
            "updated_at": utcnow(),
        }
    )


async def seed_email_settings() -> None:
    existing = await db.site_settings.find_one({"_id": "email"})
    if existing:
        return
    from email_service import default_email_settings

    doc = {"_id": "email", **default_email_settings(), "updated_at": utcnow()}
    await db.site_settings.insert_one(doc)


def wallpaper_response(doc: dict[str, Any]) -> dict[str, Any]:
    updated = doc.get("updated_at")
    url = doc.get("url", "")
    wtype = doc.get("type", "image")
    if wtype in ("video", "ai"):
        wtype = "image"
    if wtype == "none" or not url:
        wtype = "none"
    return {
        "type": wtype,
        "url": url,
        "source": doc.get("source"),
        "fit": doc.get("fit", "cover"),
        "position_x": doc.get("position_x", 50),
        "position_y": doc.get("position_y", 50),
        "zoom": doc.get("zoom", 100),
        "updated_at": updated.isoformat() if isinstance(updated, datetime) else updated,
    }


async def get_wallpaper_doc() -> dict[str, Any]:
    doc = await db.site_settings.find_one({"_id": "wallpaper"})
    if not doc:
        return {
            "type": "image",
            "url": DEFAULT_WALLPAPER_URL,
            "source": "default",
            "fit": "cover",
            "position_x": 50,
            "position_y": 50,
            "zoom": 100,
        }
    return {
        "type": doc.get("type", "image"),
        "url": doc.get("url", DEFAULT_WALLPAPER_URL),
        "source": doc.get("source", "upload"),
        "fit": doc.get("fit", "cover"),
        "position_x": doc.get("position_x", 50),
        "position_y": doc.get("position_y", 50),
        "zoom": doc.get("zoom", 100),
        "updated_at": doc.get("updated_at"),
    }


def cleanup_wallpaper_uploads(keep_url: str | None = None) -> None:
    """Keep only the active wallpaper upload and the bundled default image."""
    keep_name = Path(keep_url).name if keep_url and keep_url.startswith("/uploads/wallpapers/") else None
    if not WALLPAPER_DIR.is_dir():
        return
    for path in WALLPAPER_DIR.iterdir():
        if not path.is_file():
            continue
        if path.name == DEFAULT_WALLPAPER_FILE:
            continue
        if keep_name and path.name == keep_name:
            continue
        path.unlink(missing_ok=True)


async def check_login_lockout(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{email.lower()}"
    record = await db.login_attempts.find_one({"_id": key})
    if not record:
        return
    locked_until = record.get("locked_until")
    if locked_until and as_utc(locked_until) > utcnow():
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Try again later.")


async def record_failed_login(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{email.lower()}"
    record = await db.login_attempts.find_one({"_id": key})
    attempts = (record or {}).get("attempts", 0) + 1
    update: dict[str, Any] = {"attempts": attempts, "updated_at": utcnow()}
    if attempts >= settings.login_max_attempts:
        update["locked_until"] = utcnow() + timedelta(minutes=settings.login_lockout_minutes)
    await db.login_attempts.update_one({"_id": key}, {"$set": update}, upsert=True)


async def clear_login_attempts(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{email.lower()}"
    await db.login_attempts.delete_one({"_id": key})


async def check_forgot_password_lockout(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"forgot:{client_ip}:{email.lower()}"
    record = await db.login_attempts.find_one({"_id": key})
    if not record:
        return
    locked_until = record.get("locked_until")
    if locked_until and as_utc(locked_until) > utcnow():
        raise HTTPException(status_code=429, detail="Too many password reset attempts. Try again later.")


async def record_failed_forgot_password(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"forgot:{client_ip}:{email.lower()}"
    record = await db.login_attempts.find_one({"_id": key})
    attempts = (record or {}).get("attempts", 0) + 1
    update: dict[str, Any] = {"attempts": attempts, "updated_at": utcnow()}
    if attempts >= settings.login_max_attempts:
        update["locked_until"] = utcnow() + timedelta(minutes=settings.login_lockout_minutes)
    await db.login_attempts.update_one({"_id": key}, {"$set": update}, upsert=True)


async def clear_forgot_password_attempts(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"forgot:{client_ip}:{email.lower()}"
    await db.login_attempts.delete_one({"_id": key})


async def next_member_id(enrollment: dict[str, Any]) -> str:
    data = enrollment.get("data") or {}
    address = data.get("address") or {}
    personal = data.get("personal") or {}
    country = str(address.get("country") or personal.get("nationality") or "INT")[:3].upper().ljust(3, "X")[:3]
    region = str(address.get("state") or personal.get("state") or "GE")[:2].upper().ljust(2, "X")[:2]
    year = utcnow().year
    counter_key = f"member_{country}_{region}_{year}"
    result = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result.get("seq", 1)
    return f"IAM-{country}-{region}-{year}-{seq:06d}"


async def finalize_member_approval(user: dict[str, Any], enrollment: dict[str, Any]) -> str:
    if user.get("enrollment_complete") and user.get("member_id"):
        return user["member_id"]

    member_id = await next_member_id(enrollment)
    now = utcnow()
    user_id = str(user["_id"])

    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "status": "approved",
                "member_id": member_id,
                "approved_at": now,
                "updated_at": now,
                "submitted": True,
            }
        },
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "member_id": member_id,
                "enrollment_complete": True,
                "status": "active",
                "updated_at": now,
            }
        },
    )
    existing_card = await db.membership_cards.find_one({"user_id": user_id})
    if not existing_card:
        await db.membership_cards.insert_one(
            {
                "user_id": user_id,
                "member_id": member_id,
                "issued_at": now,
                "expires_at": now + timedelta(days=365),
            }
        )
    if user.get("email"):
        await db.applications.update_many(
            {"email": user["email"], "status": {"$in": ["received", "reviewed"]}},
            {"$set": {"status": "acknowledged", "updated_at": now}},
        )
    return member_id


async def ensure_enrollment_for_user(user: dict[str, Any]) -> dict[str, Any]:
    user_id = str(user["_id"])
    enrollment = await db.enrollments.find_one({"user_id": user_id})
    if enrollment:
        return enrollment

    app = await db.applications.find_one({"email": user.get("email")})
    data: dict[str, Any] = {}
    if app:
        name_parts = (user.get("name") or "").split(" ", 1)
        data["personal"] = {
            "first_name": app.get("first_name") or (name_parts[0] if name_parts else ""),
            "last_name": app.get("last_name") or (name_parts[1] if len(name_parts) > 1 else ""),
            "nationality": app.get("country"),
        }
        data["address"] = {"country": app.get("country"), "phone": app.get("mobile")}
    elif user.get("name"):
        name_parts = user["name"].split(" ", 1)
        data["personal"] = {
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
        }

    doc = {
        "user_id": user_id,
        "data": data,
        "status": "pending_review",
        "submitted": True,
        "submitted_at": utcnow(),
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = await db.enrollments.insert_one(doc)
    return await db.enrollments.find_one({"_id": result.inserted_id})  # type: ignore[return-value]


def member_approval_info(user: dict[str, Any], enrollment: dict[str, Any] | None) -> dict[str, Any]:
    if user.get("role") == "admin":
        return {"approval_status": "admin", "approval_label": "Administrator"}
    if user.get("status") == "rejected":
        return {"approval_status": "rejected", "approval_label": "Rejected", "is_member": False}
    if user.get("status") == "pending_approval":
        return {"approval_status": "pending_approval", "approval_label": "Pending Approval", "is_member": False}
    if user.get("enrollment_complete") and user.get("member_id"):
        info: dict[str, Any] = {
            "approval_status": "approved",
            "approval_label": "User & Member",
            "approved_member_id": user.get("member_id"),
            "is_member": True,
        }
        approved_at = None
        if enrollment:
            approved_at = enrollment.get("approved_at")
        if isinstance(approved_at, datetime):
            info["approved_at"] = approved_at.isoformat()
        elif approved_at:
            info["approved_at"] = approved_at
        return info
    if not enrollment:
        return {"approval_status": "registered", "approval_label": "Registered", "is_member": False}
    status = enrollment.get("status") or "draft"
    labels = {
        "approved": "User & Member",
        "pending_review": "Pending Review",
        "rejected": "Rejected",
        "draft": "In Progress",
    }
    info = {
        "approval_status": status,
        "approval_label": labels.get(status, status.replace("_", " ").title()),
        "is_member": status == "approved",
    }
    approved_at = enrollment.get("approved_at")
    if isinstance(approved_at, datetime):
        info["approved_at"] = approved_at.isoformat()
    elif approved_at:
        info["approved_at"] = approved_at
    if enrollment.get("member_id"):
        info["approved_member_id"] = enrollment.get("member_id")
    return info


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ApplicationIn(BaseModel):
    first_name: str
    last_name: str
    mobile: str
    email: EmailStr
    country: str
    purpose: str


class ApplicationPatch(BaseModel):
    status: str | None = None
    notes: str | None = None


class EnrollmentPayload(BaseModel):
    model_config = ConfigDict(extra="allow")
    data: dict[str, Any] | None = None
    status: str | None = None


class EditRequestIn(BaseModel):
    message: str = Field(default="", max_length=1000)


class RejectIn(BaseModel):
    status: str
    reason: str | None = None


class WallpaperUpdate(BaseModel):
    url: str | None = Field(default=None, min_length=1, max_length=2048)
    fit: Literal["cover", "contain", "fill"] | None = None
    position_x: int | None = Field(default=None, ge=0, le=100)
    position_y: int | None = Field(default=None, ge=0, le=100)
    zoom: int | None = Field(default=None, ge=50, le=200)


class HelpIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = ""
    country: str = ""
    help_type: Literal["financial", "volunteering", "prayer", "resources", "ministry", "other"]
    message: str = Field(min_length=10, max_length=2000)
    amount: str = ""


class HelpPatch(BaseModel):
    status: Literal["received", "reviewed", "acknowledged", "closed"] | None = None
    admin_notes: str | None = None


class AdminUserPatch(BaseModel):
    status: Literal["active", "suspended"] | None = None
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None


class AdminResetPasswordIn(BaseModel):
    password: str = Field(min_length=6)


class AdminSelfUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    current_password: str | None = Field(default=None, min_length=6)
    new_password: str | None = Field(default=None, min_length=6)


class ForgotPasswordIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=40)


class AccountRestoreRequestIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=40)
    password: str = Field(min_length=6)
    church_name: str = Field(min_length=2, max_length=200)
    message: str = Field(default="", max_length=2000)


class EmailSettingsUpdate(BaseModel):
    enabled: bool | None = None
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_use_tls: bool | None = None
    smtp_user: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=512)
    from_email: EmailStr | None = None
    from_name: str | None = Field(default=None, max_length=120)
    site_url: str | None = Field(default=None, max_length=512)


class AccountDeletionRequestIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    confirm: bool = False


class AccountDeletionRejectIn(BaseModel):
    reason: str = Field(default="", max_length=500)


class MissionPostIn(BaseModel):
    heading: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=15000)
    media_url: str | None = Field(default=None, max_length=2048)
    media_type: Literal["none", "image", "video", "document", "file"] = "none"


class MissionPostPatch(BaseModel):
    heading: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=15000)
    media_url: str | None = Field(default=None, max_length=2048)
    media_type: Literal["none", "image", "video", "document", "file"] | None = None


class MissionCommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: str | None = None


class MissionCommentPatch(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class MemberActivityNoteIn(BaseModel):
    user_id: str
    detail: str = Field(min_length=1, max_length=500)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]
    await seed_admin()
    await seed_wallpaper()
    await seed_email_settings()
    try:
        from generate_iam_study_pdf import generate as generate_study_guide

        generate_study_guide()
    except Exception:
        pass
    doc = await get_wallpaper_doc()
    cleanup_wallpaper_uploads(doc.get("url"))
    await purge_expired_deleted_accounts(db, restore_user_snapshot)
    yield
    client.close()


app = FastAPI(title="International Apostolic Mission API", lifespan=lifespan)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
api = APIRouter(prefix="/api")


@api.get("/")
async def health():
    return {"message": "International Apostolic Mission API", "status": "operational"}


@api.post("/auth/register")
async def register(body: RegisterIn, request: Request, response: Response):
    clear_auth_cookie(response)
    email = body.email.lower()
    if email == settings.admin_email.lower():
        raise HTTPException(status_code=400, detail="Email already registered")
    held = await db.deleted_accounts.find_one({"email": email, "stage": "held"})
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get("status") == "deletion_hold":
            await flag_reactivation_attempt(db, email)
            raise HTTPException(
                status_code=400,
                detail="This account is in deletion hold. The administrator has been notified and can restore your account.",
            )
        raise HTTPException(status_code=400, detail="Email already registered")
    if held:
        await flag_reactivation_attempt(db, email)
        raise HTTPException(
            status_code=400,
            detail="This email belongs to an account scheduled for deletion. The administrator has been notified.",
        )
    doc = {
        "email": email,
        **enroll_password_fields(body.password),
        "name": body.name,
        "role": "member",
        "status": "pending_approval",
        "member_id": None,
        "enrollment_complete": False,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_member_activity(db, doc, "register", "New member registration", request)
    token = create_token(doc)
    return {"user": serialize_identity(doc), "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    await check_login_lockout(request, email)
    user = await db.users.find_one({"email": email})
    deleted = await db.deleted_accounts.find_one(
        {"email": email, "stage": {"$in": ["held", "purged"]}}
    )

    def password_matches(stored_hash: str | None) -> bool:
        return bool(stored_hash and verify_password(body.password, stored_hash))

    if user and password_matches(user.get("password")):
        pending_deletion = await db.account_deletion_requests.find_one(
            {"user_id": str(user["_id"]), "status": "pending"}
        )
        if user.get("status") == "deletion_requested" or pending_deletion:
            raise_auth_error(AuthError.DELETION_PENDING)
        if user.get("status") == "deletion_hold":
            raise_auth_error(AuthError.ACCOUNT_DELETED)
        assert_login_allowed(user)
        await clear_login_attempts(request, email)
        clear_auth_cookie(response)
        token = create_token(user)
        if user.get("role") == "admin":
            await log_admin_audit(db, user, "admin_login", "Administrator signed in", request)
        else:
            await log_member_activity(db, user, "login", "Member signed in", request)
        return {"user": serialize_identity(user), "token": token}

    if not user and deleted:
        snap_user = (deleted.get("snapshot") or {}).get("user") or {}
        if password_matches(snap_user.get("password")):
            raise_auth_error(AuthError.ACCOUNT_DELETED)

    if not user or not password_matches(user.get("password")):
        await record_failed_login(request, email)
        raise_auth_error(AuthError.INVALID_CREDENTIALS, status_code=401)

    raise_auth_error(AuthError.INVALID_CREDENTIALS, status_code=401)


@api.get("/auth/me")
async def me(user: Annotated[dict[str, Any], Depends(get_current_user)]):
    return serialize_identity(user)


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


FORGOT_PASSWORD_OK = {
    "ok": True,
    "message": "If your email, full name, and phone number match our records, your new password has been sent to your email.",
}


@api.get("/auth/password-reset-status")
async def password_reset_status():
    settings_doc = await get_email_settings(db)
    return public_email_settings(settings_doc)


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn, request: Request):
    email = body.email.lower()
    await check_forgot_password_lockout(request, email)

    email_settings = await get_email_settings(db)
    if not public_email_settings(email_settings).get("configured"):
        raise HTTPException(
            status_code=503,
            detail="Password reset email is not configured yet. Please contact the IAM administrator.",
        )

    user = await db.users.find_one({"email": email})
    if not user:
        await record_failed_forgot_password(request, email)
        return FORGOT_PASSWORD_OK
    if user.get("role") == "admin":
        await record_failed_forgot_password(request, email)
        return FORGOT_PASSWORD_OK

    status = user.get("status")
    if status in ("rejected", "suspended", "deletion_hold"):
        await record_failed_forgot_password(request, email)
        return FORGOT_PASSWORD_OK

    enrollment = await db.enrollments.find_one({"user_id": str(user["_id"])})
    enrollment_data = (enrollment or {}).get("data") or {}
    application = await db.applications.find_one({"email": email})

    if not verify_member_identity(user, enrollment_data, body.name, body.phone, application):
        await record_failed_forgot_password(request, email)
        return FORGOT_PASSWORD_OK

    new_password = generate_reset_password()
    old_hash = user.get("password")
    old_login_password = user.get("login_password")
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {**member_password_hash_only(new_password), "updated_at": utcnow()},
            "$unset": {"login_password": ""},
        },
    )

    try:
        send_password_reset_email(
            email_settings,
            to_email=email,
            member_name=body.name.strip(),
            new_password=new_password,
        )
    except Exception as exc:
        rollback: dict[str, Any] = {"updated_at": utcnow()}
        unset: dict[str, str] = {}
        if old_hash:
            rollback["password"] = old_hash
        else:
            unset["password"] = ""
        if old_login_password:
            rollback["login_password"] = old_login_password
        else:
            unset["login_password"] = ""
        op: dict[str, Any] = {"$set": rollback}
        if unset:
            op["$unset"] = unset
        await db.users.update_one({"_id": user["_id"]}, op)
        raise HTTPException(
            status_code=503,
            detail="We could not send your new password by email. Check your details or contact the administrator.",
        ) from exc

    await clear_forgot_password_attempts(request, email)
    await log_member_activity(db, user, "password_reset", "Member reset password via forgot-password", request)
    return FORGOT_PASSWORD_OK


@api.get("/admin/account")
async def get_admin_account(admin: Annotated[dict[str, Any], Depends(require_admin)]):
    return {
        "id": str(admin["_id"]),
        "name": admin.get("name") or "",
        "email": admin.get("email") or "",
        "role": admin.get("role"),
    }


@api.patch("/admin/account")
async def update_admin_account(
    body: AdminSelfUpdateIn,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    if body.new_password and not body.current_password:
        raise HTTPException(status_code=400, detail="Current password is required to set a new password")
    if body.current_password and not verify_password(body.current_password, admin.get("password")):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    update: dict[str, Any] = {"updated_at": utcnow()}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.email is not None:
        email_l = str(body.email).lower()
        if email_l != admin.get("email", "").lower():
            existing = await db.users.find_one({"email": email_l, "_id": {"$ne": admin["_id"]}})
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
            update["email"] = email_l
    if body.new_password:
        update["password"] = hash_password(body.new_password)

    if len(update) == 1:
        raise HTTPException(status_code=400, detail="No changes to save")

    await db.users.update_one({"_id": admin["_id"]}, {"$set": update})
    updated = await db.users.find_one({"_id": admin["_id"]})
    await log_admin_audit(
        db,
        admin,
        "admin_account_update",
        f"Administrator updated account ({', '.join(k for k in update if k not in ('updated_at', 'password'))})",
        request,
    )
    return {
        "ok": True,
        "message": "Administrator account updated",
        "account": {
            "id": str(updated["_id"]),
            "name": updated.get("name") or "",
            "email": updated.get("email") or "",
            "role": updated.get("role"),
        },
    }


@api.post("/auth/account-restore-request")
async def account_restore_request(body: AccountRestoreRequestIn, request: Request):
    result = await submit_restore_request(
        db,
        email=str(body.email),
        name=body.name,
        phone=body.phone,
        password=body.password,
        church_name=body.church_name,
        message=body.message,
        restore_user_snapshot=restore_user_snapshot,
    )
    return result


@api.post("/applications")
async def create_application(body: ApplicationIn):
    email = body.email.lower()
    held = await db.deleted_accounts.find_one({"email": email, "stage": "held"})
    if held:
        await flag_reactivation_attempt(db, email)
    user = await db.users.find_one({"email": email})
    if user and user.get("status") == "deletion_hold":
        await flag_reactivation_attempt(db, email)
    tracking_id = f"IAM-APP-{uuid.uuid4().hex[:10].upper()}"
    doc = {
        **body.model_dump(),
        "status": "received",
        "tracking_id": tracking_id,
        "notes": "",
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = await db.applications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@api.get("/applications")
async def list_applications(_: Annotated[dict[str, Any], Depends(require_admin)]):
    apps = await db.applications.find().sort("created_at", -1).to_list(500)
    return [serialize(a) for a in apps]


@api.patch("/applications/{app_id}")
async def patch_application(app_id: str, body: ApplicationPatch, _: Annotated[dict[str, Any], Depends(require_admin)]):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = utcnow()
    result = await db.applications.find_one_and_update({"_id": oid(app_id)}, {"$set": update}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize(result)


@api.get("/enrollment")
async def get_enrollment(user: Annotated[dict[str, Any], Depends(require_member)]):
    enrollment = await db.enrollments.find_one({"user_id": str(user["_id"])})
    if not enrollment:
        return {"data": None}
    return serialize(enrollment)


async def _upsert_enrollment_document(user_id: str, doc_type: str, stored_name: str) -> None:
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    existing = await db.enrollments.find_one({"user_id": user_id})
    if existing and existing.get("status") == "pending_review":
        raise HTTPException(status_code=403, detail="Enrollment is under admin review and cannot be edited.")
    if existing and existing.get("status") == "approved" and not existing.get("edit_unlocked"):
        raise HTTPException(status_code=403, detail="Profile is locked. Request admin approval to edit.")
    now = utcnow()
    doc_defaults = {
        "profile_photo": "",
        "government_id": "",
        "address_proof": "",
        "church_recommendation": "",
    }
    if existing:
        data = dict(existing.get("data") or {})
        documents = dict(data.get("documents") or doc_defaults)
        documents[doc_type] = stored_name
        data["documents"] = documents
        await db.enrollments.update_one(
            {"_id": existing["_id"]},
            {"$set": {"data": data, "updated_at": now}},
        )
        return
    documents = {**doc_defaults, doc_type: stored_name}
    await db.enrollments.insert_one(
        {
            "user_id": user_id,
            "data": {"documents": documents},
            "status": "draft",
            "submitted": False,
            "created_at": now,
            "updated_at": now,
        }
    )


@api.post("/enrollment/documents/{doc_type}")
async def upload_enrollment_document(
    doc_type: str,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
    file: UploadFile = File(...),
):
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    content = await file.read()
    user_id = str(user["_id"])
    stored = save_enrollment_document(user_id, doc_type, file.filename or "upload", content)
    await _upsert_enrollment_document(user_id, doc_type, stored)
    await log_member_activity(db, user, "enrollment_document_upload", doc_type, request)
    return {"doc_type": doc_type, "filename": stored, "uploaded": True}


@api.get("/enrollment/documents/{doc_type}")
async def get_member_enrollment_document(
    doc_type: str,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    enrollment = await db.enrollments.find_one({"user_id": str(user["_id"])})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Document not found")
    stored = (enrollment.get("data") or {}).get("documents", {}).get(doc_type)
    if not stored:
        raise HTTPException(status_code=404, detail="Document not found")
    path = resolve_enrollment_document(str(user["_id"]), stored)
    from fastapi.responses import FileResponse

    return FileResponse(path, media_type=media_type_for_path(path), filename=path.name)


@api.get("/admin/enrollments/{enrollment_id}/documents/{doc_type}")
async def get_admin_enrollment_document(
    enrollment_id: str,
    doc_type: str,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    stored = (enrollment.get("data") or {}).get("documents", {}).get(doc_type)
    if not stored:
        raise HTTPException(status_code=404, detail="Document not found")
    path = resolve_enrollment_document(str(enrollment["user_id"]), stored)
    from fastapi.responses import FileResponse

    return FileResponse(path, media_type=media_type_for_path(path), filename=path.name)


@api.post("/enrollment/save")
async def save_enrollment(
    body: EnrollmentPayload,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    user_id = str(user["_id"])
    existing = await db.enrollments.find_one({"user_id": user_id})
    now = utcnow()

    if existing and existing.get("status") == "approved":
        if not existing.get("edit_unlocked"):
            raise HTTPException(status_code=403, detail="Profile is locked. Request admin approval to edit.")
        await db.enrollments.update_one(
            {"_id": existing["_id"]},
            {"$set": {"pending_changes": body.data, "updated_at": now}},
        )
        enrollment = await db.enrollments.find_one({"_id": existing["_id"]})
        await log_member_activity(db, user, "enrollment_save", "Profile changes draft saved", request)
        return serialize(enrollment)

    if existing and existing.get("status") == "pending_review":
        raise HTTPException(status_code=403, detail="Enrollment is under admin review and cannot be edited.")

    doc = {
        "user_id": user_id,
        "data": body.data,
        "status": "draft",
        "submitted": False,
        "updated_at": now,
    }
    if existing:
        await db.enrollments.update_one({"_id": existing["_id"]}, {"$set": doc})
        enrollment = await db.enrollments.find_one({"_id": existing["_id"]})
    else:
        doc["created_at"] = now
        result = await db.enrollments.insert_one(doc)
        enrollment = await db.enrollments.find_one({"_id": result.inserted_id})
    await log_member_activity(db, user, "enrollment_save", "Enrollment draft saved", request)
    return serialize(enrollment)


@api.post("/enrollment/submit")
async def submit_enrollment(
    body: EnrollmentPayload,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    user_id = str(user["_id"])
    existing = await db.enrollments.find_one({"user_id": user_id})
    if existing and existing.get("status") == "approved":
        raise HTTPException(
            status_code=400,
            detail="Use submit changes after admin approves your edit request.",
        )
    if existing and existing.get("status") == "pending_review":
        raise HTTPException(status_code=400, detail="Enrollment is already submitted for review.")

    now = utcnow()
    doc = {
        "user_id": user_id,
        "data": body.data,
        "status": "pending_review",
        "submitted": True,
        "submitted_at": now,
        "updated_at": now,
    }
    if existing:
        await db.enrollments.update_one({"_id": existing["_id"]}, {"$set": doc})
        enrollment = await db.enrollments.find_one({"_id": existing["_id"]})
    else:
        doc["created_at"] = now
        result = await db.enrollments.insert_one(doc)
        enrollment = await db.enrollments.find_one({"_id": result.inserted_id})
    await log_member_activity(db, user, "enrollment_submit", "Enrollment submitted for review", request)
    return serialize(enrollment)


@api.post("/enrollment/edit-request")
async def request_enrollment_edit(
    body: EditRequestIn,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    enrollment = await db.enrollments.find_one({"user_id": str(user["_id"])})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Only approved members can request profile edits")
    if enrollment.get("edit_request_status") == "pending":
        raise HTTPException(status_code=400, detail="Edit request already pending admin approval")
    if enrollment.get("changes_review_status") == "pending_review":
        raise HTTPException(status_code=400, detail="Profile changes are already awaiting admin approval")
    if enrollment.get("edit_unlocked"):
        raise HTTPException(status_code=400, detail="You already have edit access — update and submit your changes")

    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "edit_request_status": "pending",
                "edit_request_message": body.message.strip(),
                "edit_request_at": now,
                "updated_at": now,
            }
        },
    )
    enrollment = await db.enrollments.find_one({"_id": enrollment["_id"]})
    await log_member_activity(db, user, "edit_request", body.message.strip()[:200], request)
    return serialize(enrollment)


@api.post("/enrollment/submit-changes")
async def submit_enrollment_changes(
    body: EnrollmentPayload,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    enrollment = await db.enrollments.find_one({"user_id": str(user["_id"])})
    if not enrollment or enrollment.get("status") != "approved":
        raise HTTPException(status_code=400, detail="No approved enrollment to update")
    if not enrollment.get("edit_unlocked"):
        raise HTTPException(status_code=403, detail="Edit access not granted. Request admin approval first.")

    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "pending_changes": body.data,
                "changes_review_status": "pending_review",
                "changes_submitted_at": now,
                "edit_unlocked": False,
                "updated_at": now,
            }
        },
    )
    enrollment = await db.enrollments.find_one({"_id": enrollment["_id"]})
    await log_member_activity(db, user, "profile_changes_submit", "Profile changes submitted", request)
    return serialize(enrollment)


@api.get("/enrollment/all")
async def list_enrollments(_: Annotated[dict[str, Any], Depends(require_admin)]):
    enrollments = await db.enrollments.find().sort("updated_at", -1).to_list(500)
    out = []
    for enrollment in enrollments:
        item = serialize(enrollment)
        user = await db.users.find_one({"_id": oid(enrollment["user_id"])})
        item["user_email"] = user["email"] if user else None
        item["user_name"] = user["name"] if user else None
        out.append(item)
    return out


@api.post("/enrollment/{enrollment_id}/approve")
async def approve_enrollment(enrollment_id: str, _: Annotated[dict[str, Any], Depends(require_admin)]):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    user = await db.users.find_one({"_id": oid(enrollment["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot approve administrator account")
    member_id = await finalize_member_approval(user, enrollment)
    return {"ok": True, "member_id": member_id}


@api.post("/admin/registrations/{user_id}/approve")
async def approve_registration(user_id: str, _: Annotated[dict[str, Any], Depends(require_admin)]):
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot approve administrator account")
    if user.get("enrollment_complete") and user.get("member_id"):
        return {"ok": True, "member_id": user["member_id"], "message": "Already approved as member"}
    enrollment = await ensure_enrollment_for_user(user)
    member_id = await finalize_member_approval(user, enrollment)
    return {"ok": True, "member_id": member_id, "message": "Registration approved — member signs in with the same email and password they chose at Enroll"}


@api.post("/admin/registrations/{user_id}/reject")
async def reject_registration(
    user_id: str,
    body: RejectIn,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot reject administrator account")
    now = utcnow()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"status": "rejected", "updated_at": now}},
    )
    enrollment = await db.enrollments.find_one({"user_id": str(user["_id"])})
    if enrollment:
        await db.enrollments.update_one(
            {"_id": enrollment["_id"]},
            {
                "$set": {
                    "status": "rejected",
                    "reject_reason": body.reason or "Rejected by administrator",
                    "updated_at": now,
                }
            },
        )
    return {"ok": True, "message": "Registration rejected — user cannot sign in"}


@api.post("/enrollment/{enrollment_id}/reject")
async def reject_enrollment(enrollment_id: str, body: RejectIn, _: Annotated[dict[str, Any], Depends(require_admin)]):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "status": body.status,
                "reject_reason": body.reason,
                "updated_at": now,
            }
        },
    )
    try:
        user = await db.users.find_one({"_id": oid(enrollment["user_id"])})
        if user and user.get("role") != "admin":
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"status": "rejected", "updated_at": now}},
            )
    except HTTPException:
        pass
    return {"ok": True}


@api.post("/admin/enrollments/{enrollment_id}/approve-edit-request")
async def approve_enrollment_edit_request(
    enrollment_id: str,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.get("edit_request_status") != "pending":
        raise HTTPException(status_code=400, detail="No pending edit request")
    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "edit_request_status": "approved",
                "edit_unlocked": True,
                "edit_approved_at": now,
                "pending_changes": enrollment.get("data"),
                "updated_at": now,
            }
        },
    )
    return {"ok": True, "message": "Member can now edit their profile"}


@api.post("/admin/enrollments/{enrollment_id}/reject-edit-request")
async def reject_enrollment_edit_request(
    enrollment_id: str,
    body: RejectIn,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.get("edit_request_status") != "pending":
        raise HTTPException(status_code=400, detail="No pending edit request")
    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "edit_request_status": "rejected",
                "edit_unlocked": False,
                "edit_reject_reason": body.reason or "Edit request denied",
                "updated_at": now,
            }
        },
    )
    return {"ok": True}


@api.post("/admin/enrollments/{enrollment_id}/approve-changes")
async def approve_enrollment_changes(
    enrollment_id: str,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.get("changes_review_status") != "pending_review":
        raise HTTPException(status_code=400, detail="No pending profile changes")
    pending = enrollment.get("pending_changes")
    if not pending:
        raise HTTPException(status_code=400, detail="No change data to approve")
    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "data": pending,
                "pending_changes": None,
                "changes_review_status": "approved",
                "changes_reviewed_at": now,
                "edit_unlocked": False,
                "edit_request_status": None,
                "updated_at": now,
            }
        },
    )
    return {"ok": True, "message": "Profile changes approved and saved"}


@api.post("/admin/enrollments/{enrollment_id}/reject-changes")
async def reject_enrollment_changes(
    enrollment_id: str,
    body: RejectIn,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.get("changes_review_status") != "pending_review":
        raise HTTPException(status_code=400, detail="No pending profile changes")
    now = utcnow()
    await db.enrollments.update_one(
        {"_id": enrollment["_id"]},
        {
            "$set": {
                "pending_changes": None,
                "changes_review_status": "rejected",
                "changes_reject_reason": body.reason or "Changes not approved",
                "changes_reviewed_at": now,
                "edit_unlocked": False,
                "updated_at": now,
            }
        },
    )
    return {"ok": True}


@api.get("/membership/card")
async def membership_card(user: Annotated[dict[str, Any], Depends(require_approved_member_account)]):
    card = await db.membership_cards.find_one({"user_id": str(user["_id"])})
    if not card:
        raise HTTPException(status_code=404, detail="Membership card not found")
    def _iso(val: Any) -> str:
        return val.isoformat() if isinstance(val, datetime) else str(val)

    return {
        "member_id": card["member_id"],
        "name": user["name"],
        "email": user["email"],
        "issued_at": _iso(card["issued_at"]),
        "expires_at": _iso(card["expires_at"]),
        "photo": None,
        "country": (user.get("member_id") or "")[:7],
    }


@api.get("/account/deletion-status")
async def account_deletion_status(user: Annotated[dict[str, Any], Depends(require_member)]):
    pending = await db.account_deletion_requests.find_one(
        {"user_id": str(user["_id"]), "status": "pending"}
    )
    if pending:
        return {"status": "pending", "requested_at": serialize(pending).get("created_at")}
    if user.get("status") == "deletion_requested":
        new_status = "active" if user.get("enrollment_complete") else "pending_approval"
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"status": new_status, "updated_at": utcnow()}},
        )
    held = await db.deleted_accounts.find_one({"user_id": str(user["_id"]), "stage": "held"})
    if held or user.get("status") == "deletion_hold":
        return {
            "status": "deletion_hold",
            "purge_at": serialize(held).get("purge_at") if held else None,
        }
    rejected = await db.account_deletion_requests.find_one(
        {"user_id": str(user["_id"]), "status": "rejected"},
        sort=[("created_at", -1)],
    )
    if rejected:
        return {"status": "rejected", "reason": rejected.get("reject_reason")}
    return {"status": "none"}


@api.post("/account/delete-request")
async def request_account_deletion(
    body: AccountDeletionRequestIn,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Confirm account deletion to continue")
    reason = body.message.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Please provide a reason for account deletion")
    if user.get("status") == "deletion_hold":
        raise HTTPException(status_code=400, detail="Account is already scheduled for deletion")
    existing = await db.account_deletion_requests.find_one(
        {"user_id": str(user["_id"]), "status": "pending"}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Deletion request already pending admin review")
    now = utcnow()
    await db.account_deletion_requests.insert_one(
        {
            "user_id": str(user["_id"]),
            "email": user.get("email"),
            "name": user.get("name"),
            "message": reason,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
        }
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"status": "deletion_requested", "updated_at": now}},
    )
    await log_member_activity(db, user, "delete_request", reason[:200], request)
    return {"ok": True, "message": "Deletion request sent to administrator"}


@api.get("/admin/deletion-requests")
async def admin_deletion_requests(_: Annotated[dict[str, Any], Depends(require_admin)]):
    items = await db.account_deletion_requests.find({"status": "pending"}).sort("created_at", -1).to_list(500)
    return [serialize(i) for i in items]


@api.get("/admin/deleted-accounts")
async def admin_deleted_accounts(
    _: Annotated[dict[str, Any], Depends(require_admin)],
    stage: str = "all",
):
    query: dict[str, Any] = {}
    if stage in ("held", "purged", "restored"):
        query["stage"] = stage
    items = await db.deleted_accounts.find(query).sort("approved_at", -1).to_list(500)
    out = []
    for item in items:
        row = serialize(item) or {}
        snap = sanitize_for_json(item.get("snapshot") or {})
        user = snap.get("user") or {}
        enrollment = snap.get("enrollment") or {}
        card = snap.get("membership_card") or {}
        row["stage"] = item.get("stage")
        row["snapshot"] = snap
        row["member_id"] = user.get("member_id") or card.get("member_id")
        row["enrollment_status"] = enrollment.get("status")
        row["enrollment_complete"] = user.get("enrollment_complete")
        row["applications_count"] = len(snap.get("applications") or [])
        contact = snapshot_contact_details(snap, item)
        row["contact"] = contact
        row["phone"] = contact.get("phone")
        row["church_name"] = contact.get("church_name")
        row["address"] = contact.get("address")
        purge_at = item.get("purge_at")
        if item.get("stage") == "held" and isinstance(purge_at, datetime):
            try:
                row["days_remaining"] = max(0, (as_utc(purge_at) - utcnow()).days)
            except (TypeError, ValueError):
                row["days_remaining"] = 0
        else:
            row["days_remaining"] = 0
        if item.get("purge_at") and isinstance(item["purge_at"], datetime):
            row["purge_at"] = item["purge_at"].isoformat()
        if item.get("purged_at") and isinstance(item["purged_at"], datetime):
            row["purged_at"] = item["purged_at"].isoformat()
        if item.get("restored_at") and isinstance(item["restored_at"], datetime):
            row["restored_at"] = item["restored_at"].isoformat()
        report = await db.deletion_reports.find_one(
            {"deleted_account_id": str(item["_id"])},
            sort=[("created_at", -1)],
        )
        if report:
            row["report_id"] = str(report["_id"])
            row["report_created_at"] = (
                report.get("created_at").isoformat()
                if isinstance(report.get("created_at"), datetime)
                else report.get("created_at")
            )
        out.append(row)
    return out


@api.post("/admin/deleted-accounts/{hold_id}/report")
async def generate_deleted_account_report(
    hold_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    record = await db.deleted_accounts.find_one({"_id": oid(hold_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Deleted account record not found")
    snapshot = record.get("snapshot") or {}
    if not snapshot:
        raise HTTPException(status_code=400, detail="No account snapshot available for this record")
    pdf_path = generate_deletion_pdf(record, snapshot)
    pdf_url = f"/uploads/deleted-reports/{pdf_path.name}"
    now = utcnow()
    user = snapshot.get("user") or {}
    report_doc = {
        "deleted_account_id": str(record["_id"]),
        "user_id": record.get("user_id"),
        "email": record.get("email"),
        "name": record.get("name"),
        "pdf_path": str(pdf_path),
        "pdf_url": pdf_url,
        "kind": "admin_generated",
        "created_at": now,
        "summary": {
            "member_id": user.get("member_id") or (snapshot.get("membership_card") or {}).get("member_id"),
            "approved_at": (
                record.get("approved_at").isoformat()
                if isinstance(record.get("approved_at"), datetime)
                else record.get("approved_at")
            ),
            "stage": record.get("stage"),
            "generated_at": now.isoformat(),
        },
    }
    result = await db.deletion_reports.insert_one(report_doc)
    report_doc["_id"] = result.inserted_id
    await log_admin_audit(
        db,
        admin,
        "deletion_report_generate",
        record.get("email") or record.get("name") or hold_id,
        request,
    )
    row = serialize(report_doc) or {}
    row["download_ready"] = True
    return row


@api.get("/admin/deletion-reports")
async def admin_deletion_reports(_: Annotated[dict[str, Any], Depends(require_admin)]):
    items = await db.deletion_reports.find().sort("created_at", -1).to_list(500)
    return [serialize(i) for i in items]


@api.get("/admin/deletion-reports/{report_id}/download")
async def admin_deletion_report_download(
    report_id: str,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    from fastapi.responses import FileResponse

    report = await db.deletion_reports.find_one({"_id": oid(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    pdf_path = Path(report.get("pdf_path") or "")
    if not pdf_path.is_file() and report.get("pdf_url"):
        pdf_path = Path(__file__).resolve().parent / "uploads" / "deleted-reports" / Path(report["pdf_url"]).name
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="Report file not found")
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)


@api.post("/admin/deletion-requests/{request_id}/approve")
async def approve_deletion_request(
    request_id: str,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    req = await db.account_deletion_requests.find_one({"_id": oid(request_id)})
    if not req or req.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Deletion request not found")
    user = await db.users.find_one({"_id": oid(req["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete administrator account")
    now = utcnow()
    purge_at = now + timedelta(days=DELETION_HOLD_DAYS)
    snapshot = await build_user_snapshot(db, user)
    hold = await db.deleted_accounts.insert_one(
        {
            "user_id": str(user["_id"]),
            "email": user.get("email"),
            "name": user.get("name"),
            "snapshot": snapshot,
            "request_id": request_id,
            "stage": "held",
            "approved_at": now,
            "approved_by": str(admin["_id"]),
            "purge_at": purge_at,
            "reactivation_requested": False,
            "created_at": now,
        }
    )
    await db.account_deletion_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "approved", "approved_at": now, "held_id": str(hold.inserted_id)}},
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"status": "deletion_hold", "updated_at": now}},
    )
    return {"ok": True, "message": "Account moved to 1-year deletion hold", "purge_at": purge_at.isoformat()}


@api.post("/admin/deletion-requests/{request_id}/reject")
async def reject_deletion_request(
    request_id: str,
    body: AccountDeletionRejectIn,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    req = await db.account_deletion_requests.find_one({"_id": oid(request_id)})
    if not req or req.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Deletion request not found")
    now = utcnow()
    await db.account_deletion_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "rejected", "reject_reason": body.reason, "updated_at": now}},
    )
    user = await db.users.find_one({"_id": oid(req["user_id"])})
    if user and user.get("status") == "deletion_requested":
        new_status = "active" if user.get("enrollment_complete") else "pending_approval"
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"status": new_status, "updated_at": now}},
        )
    return {"ok": True}


@api.post("/admin/deleted-accounts/{hold_id}/restore")
async def restore_deleted_account_endpoint(
    hold_id: str,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    record = await db.deleted_accounts.find_one({"_id": oid(hold_id)})
    if not record or record.get("stage") not in ("held", "purged"):
        raise HTTPException(status_code=404, detail="Deleted account record not found")
    await restore_deleted_account(db, record, restore_user_snapshot)
    return {"ok": True, "message": "Account restored to member"}


@api.get("/admin/account-restore-requests")
async def admin_account_restore_requests(_: Annotated[dict[str, Any], Depends(require_admin)]):
    items = await db.account_restore_requests.find().sort("created_at", -1).to_list(500)
    return [serialize_restore_request(item) for item in items]


@api.post("/admin/account-restore-requests/{request_id}/approve")
async def admin_approve_restore_request(
    request_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    req = await db.account_restore_requests.find_one({"_id": oid(request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Restore request not found")
    if req.get("status") in ("auto_restored", "approved"):
        raise HTTPException(status_code=400, detail="Request already processed")

    hold_id = req.get("deleted_account_id")
    record = None
    if hold_id:
        record = await db.deleted_accounts.find_one({"_id": oid(hold_id)})
    if not record:
        record = await db.deleted_accounts.find_one(
            {"email": req.get("email"), "stage": {"$in": ["held", "purged"]}}
        )
    if not record:
        raise HTTPException(status_code=404, detail="Deleted account record not found for this request")

    await restore_deleted_account(db, record, restore_user_snapshot)
    now = utcnow()
    await db.account_restore_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "approved", "processed_at": now, "updated_at": now}},
    )
    await log_admin_audit(
        db,
        admin,
        "account_restore_approved",
        req.get("email") or request_id,
        request,
    )
    return {"ok": True, "message": "Account restored"}


@api.post("/admin/account-restore-requests/{request_id}/reject")
async def admin_reject_restore_request(
    request_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    req = await db.account_restore_requests.find_one({"_id": oid(request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Restore request not found")
    now = utcnow()
    await db.account_restore_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "rejected", "processed_at": now, "updated_at": now}},
    )
    await log_admin_audit(
        db,
        admin,
        "account_restore_rejected",
        req.get("email") or request_id,
        request,
    )
    return {"ok": True}


@api.post("/admin/deleted-accounts/{hold_id}/purge")
async def purge_deleted_account_endpoint(
    hold_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    record = await db.deleted_accounts.find_one({"_id": oid(hold_id)})
    if not record or record.get("stage") != "held":
        raise HTTPException(status_code=404, detail="Held deleted account not found")
    pdf_url = await purge_single_deleted_account(db, record)
    await log_admin_audit(
        db,
        admin,
        "deleted_account_purge",
        record.get("email") or record.get("name") or hold_id,
        request,
    )
    return {"ok": True, "message": "Account permanently deleted. PDF report saved to My Reports.", "pdf_url": pdf_url}


@api.post("/admin/deleted-accounts/purge-expired")
async def purge_expired_deleted_accounts_endpoint(_: Annotated[dict[str, Any], Depends(require_admin)]):
    count = await purge_expired_deleted_accounts(db, restore_user_snapshot)
    return {"ok": True, "purged": count}


@api.get("/admin/stats")
async def admin_stats(_: Annotated[dict[str, Any], Depends(require_admin)]):
    approved_query = approved_member_query()
    total_users = await db.users.count_documents(approved_query)
    total_members = await db.users.count_documents(approved_query)
    total_applications = await db.applications.count_documents({})
    pending_applications = await db.applications.count_documents({"status": "received"})
    pending_enrollments = await db.enrollments.count_documents({"status": "pending_review"})
    pending_edit_requests = await db.enrollments.count_documents({"edit_request_status": "pending"})
    pending_profile_changes = await db.enrollments.count_documents({"changes_review_status": "pending_review"})
    pending_registrations = await db.users.count_documents(
        {"role": "member", "status": {"$in": ["pending_approval", "active"]}, "enrollment_complete": False}
    )
    pending_helps = await db.helps.count_documents({"status": "received"})
    pending_deletion_requests = await db.account_deletion_requests.count_documents({"status": "pending"})
    deleted_accounts_held = await db.deleted_accounts.count_documents({"stage": "held"})
    reactivation_requests = await db.deleted_accounts.count_documents(
        {"stage": "held", "reactivation_requested": True}
    )
    pending_restore_requests = await db.account_restore_requests.count_documents({"status": "pending"})
    deletion_reports_count = await db.deletion_reports.count_documents({})
    pipeline = [{"$group": {"_id": "$country", "count": {"$sum": 1}}}]
    geo = await db.applications.aggregate(pipeline).to_list(100)
    return {
        "total_users": total_users,
        "total_members": total_members,
        "total_applications": total_applications,
        "pending_applications": pending_applications,
        "pending_enrollments": pending_enrollments,
        "pending_edit_requests": pending_edit_requests,
        "pending_profile_changes": pending_profile_changes,
        "pending_registrations": pending_registrations,
        "pending_helps": pending_helps,
        "total_helps": await db.helps.count_documents({}),
        "recycle_bin_count": await db.recycle_bin.count_documents({}),
        "pending_deletion_requests": pending_deletion_requests,
        "deleted_accounts_held": deleted_accounts_held,
        "reactivation_requests": reactivation_requests,
        "pending_restore_requests": pending_restore_requests,
        "deletion_reports_count": deletion_reports_count,
        "member_activity_count": await db[MEMBER_ACTIVITY].count_documents({}),
        "geographic_distribution": [{"country": g["_id"], "count": g["count"]} for g in geo if g["_id"]],
    }


@api.get("/admin/member-activity")
async def admin_member_activity(
    _: Annotated[dict[str, Any], Depends(require_admin)],
    q: str | None = None,
    date: str | None = None,
    user_id: str | None = None,
):
    """Member actions only — each member is isolated; admin can review activity here."""
    query = build_member_activity_query(q=q, date=date, user_id=user_id)
    items = await db[MEMBER_ACTIVITY].find(query).sort("created_at", -1).to_list(500)
    return [serialize_activity_row(i) for i in items]


@api.post("/admin/member-activity")
async def add_member_activity_note(
    body: MemberActivityNoteIn,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    """Administrator adds a note to a member's private activity timeline."""
    user = await db.users.find_one({"_id": oid(body.user_id), "role": "member"})
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    now = utcnow()
    doc = {
        "user_id": str(user["_id"]),
        "email": user.get("email"),
        "name": user.get("name"),
        "action": "admin_note",
        "detail": body.detail.strip()[:500],
        "created_at": now,
        "added_by_admin": str(admin["_id"]),
        "visibility": "admin_only",
    }
    result = await db[MEMBER_ACTIVITY].insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_admin_audit(
        db,
        admin,
        "member_activity_note",
        f"{user.get('email')}: {body.detail.strip()[:200]}",
        request,
    )
    return serialize_activity_row(doc)


@api.get("/admin/security/audit")
async def admin_security_audit(
    _: Annotated[dict[str, Any], Depends(require_admin)],
    q: str | None = None,
    date: str | None = None,
):
    """Administrator audit trail — secured; members cannot access this data."""
    query = build_admin_audit_query(q=q, date=date)
    items = await db[ADMIN_AUDIT].find(query).sort("created_at", -1).to_list(500)
    admin_ids = {i.get("admin_id") for i in items if i.get("admin_id")}
    admins: dict[str, str] = {}
    if admin_ids:
        oids = [ObjectId(aid) for aid in admin_ids if ObjectId.is_valid(aid)]
        if oids:
            async for admin_user in db.users.find({"_id": {"$in": oids}}):
                admins[str(admin_user["_id"])] = admin_user.get("name") or "IAM Administrator"
    out = []
    for item in items:
        row = serialize_activity_row(item)
        row["admin_name"] = admins.get(item.get("admin_id"), "IAM Administrator")
        out.append(row)
    return out


@api.post("/helps")
async def submit_help(
    body: HelpIn,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_member)],
):
    doc = {
        **body.model_dump(),
        "email": body.email.lower(),
        "user_id": str(user["_id"]),
        "member_name": user.get("name") or body.name,
        "status": "received",
        "admin_notes": "",
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = await db.helps.insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_member_activity(db, user, "help_submission", f"Submitted {body.help_type} support offer", request)
    return serialize(doc)


@api.get("/helps/mine")
async def my_helps(user: Annotated[dict[str, Any], Depends(require_member)]):
    uid = str(user["_id"])
    email = (user.get("email") or "").lower()
    query: dict[str, Any] = {"$or": [{"user_id": uid}]}
    if email:
        query["$or"].append({"email": email})
    helps = await db.helps.find(query).sort("created_at", -1).to_list(100)
    return [serialize(h) for h in helps]


@api.get("/admin/requests")
async def admin_requests(_: Annotated[dict[str, Any], Depends(require_admin)]):
    items: list[dict[str, Any]] = []

    apps = await db.applications.find().sort("created_at", -1).to_list(500)
    for app in apps:
        details = serialize(app) or {}
        details["source_page"] = "/apply"
        items.append(
            {
                "folder": "application",
                "id": str(app["_id"]),
                "title": f"{app.get('first_name', '')} {app.get('last_name', '')}".strip(),
                "email": app.get("email"),
                "status": app.get("status"),
                "created_at": app.get("created_at"),
                "details": details,
            }
        )

    users = await db.users.find(
        {"role": "member", "status": {"$in": ["pending_approval", "active"]}, "enrollment_complete": False}
    ).sort("created_at", -1).to_list(500)
    for user in users:
        uid = str(user["_id"])
        enrollment = await db.enrollments.find_one({"user_id": uid})
        app = await db.applications.find_one({"email": user.get("email")})
        details = serialize(user) or {}
        details["source_page"] = "/enroll"
        attach_admin_password_info(details, user)
        if enrollment:
            details["enrollment"] = serialize(enrollment)
        if app:
            details["application"] = serialize(app)
        items.append(
            {
                "folder": "registration",
                "id": uid,
                "title": user.get("name"),
                "email": user.get("email"),
                "status": user.get("status"),
                "created_at": user.get("created_at"),
                "details": details,
            }
        )

    enrollments = await db.enrollments.find().sort("updated_at", -1).to_list(500)
    for enrollment in enrollments:
        if enrollment.get("status") == "approved":
            user = None
            try:
                user = await db.users.find_one({"_id": oid(enrollment["user_id"])})
            except HTTPException:
                user = None
            if enrollment.get("edit_request_status") == "pending":
                items.append(
                    {
                        "folder": "enrollment_edit",
                        "id": str(enrollment["_id"]),
                        "title": user.get("name") if user else "Unknown",
                        "email": user.get("email") if user else None,
                        "status": "edit_request_pending",
                        "created_at": enrollment.get("edit_request_at") or enrollment.get("updated_at"),
                        "details": {
                            **(serialize(enrollment) or {}),
                            "user_name": user.get("name") if user else None,
                            "user_email": user.get("email") if user else None,
                            "source_page": "/dashboard",
                        },
                    }
                )
            if enrollment.get("changes_review_status") == "pending_review":
                items.append(
                    {
                        "folder": "enrollment_changes",
                        "id": str(enrollment["_id"]),
                        "title": user.get("name") if user else "Unknown",
                        "email": user.get("email") if user else None,
                        "status": "changes_pending_review",
                        "created_at": enrollment.get("changes_submitted_at") or enrollment.get("updated_at"),
                        "details": {
                            **(serialize(enrollment) or {}),
                            "user_name": user.get("name") if user else None,
                            "user_email": user.get("email") if user else None,
                            "source_page": "/dashboard",
                        },
                    }
                )
            continue
        user = None
        try:
            user = await db.users.find_one({"_id": oid(enrollment["user_id"])})
        except HTTPException:
            user = None
        items.append(
            {
                "folder": "enrollment",
                "id": str(enrollment["_id"]),
                "title": user.get("name") if user else "Unknown",
                "email": user.get("email") if user else None,
                "status": enrollment.get("status"),
                "created_at": enrollment.get("created_at") or enrollment.get("updated_at"),
                "details": {
                    **(serialize(enrollment) or {}),
                    "user_name": user.get("name") if user else None,
                    "user_email": user.get("email") if user else None,
                    "source_page": "/enrollment",
                },
            }
        )

    deletion_reqs = await db.account_deletion_requests.find({"status": "pending"}).sort("created_at", -1).to_list(500)
    for req in deletion_reqs:
        details = serialize(req) or {}
        details["source_page"] = "/dashboard"
        items.append(
            {
                "folder": "account_deletion",
                "id": str(req["_id"]),
                "title": req.get("name") or "Member",
                "email": req.get("email"),
                "status": req.get("status"),
                "created_at": req.get("created_at"),
                "details": details,
            }
        )

    items.sort(key=lambda x: x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    for item in items:
        created = item.get("created_at")
        if isinstance(created, datetime):
            item["created_at"] = created.isoformat()
    return items


@api.get("/admin/users")
async def admin_users(_: Annotated[dict[str, Any], Depends(require_admin)]):
    """Approved members only — admin is not listed as a user."""
    users = await db.users.find(approved_member_query()).sort("created_at", -1).to_list(1000)
    out = []
    for user in users:
        item = serialize(user) or {}
        uid = str(user["_id"])
        enrollment = await db.enrollments.find_one({"user_id": uid})
        card = await db.membership_cards.find_one({"user_id": uid})
        app = await db.applications.find_one({"email": user.get("email")})
        if enrollment:
            item["enrollment"] = serialize(enrollment)
        if card:
            item["membership_card"] = {
                "member_id": card.get("member_id"),
                "issued_at": card.get("issued_at").isoformat() if isinstance(card.get("issued_at"), datetime) else card.get("issued_at"),
                "expires_at": card.get("expires_at").isoformat() if isinstance(card.get("expires_at"), datetime) else card.get("expires_at"),
            }
        if app:
            item["application"] = serialize(app)
        item.update(member_approval_info(user, enrollment))
        attach_admin_password_info(item, user)
        out.append(item)
    return out


@api.get("/admin/members")
async def admin_members(_: Annotated[dict[str, Any], Depends(require_admin)]):
    members = await db.users.find({"role": "member"}).sort("created_at", -1).to_list(1000)
    out = []
    for member in members:
        item = serialize(member) or {}
        enrollment = await db.enrollments.find_one({"user_id": str(member["_id"])})
        card = await db.membership_cards.find_one({"user_id": str(member["_id"])})
        app = await db.applications.find_one({"email": member.get("email")})
        if enrollment:
            item["enrollment"] = serialize(enrollment)
        if card:
            item["membership_card"] = {
                "member_id": card.get("member_id"),
                "issued_at": card.get("issued_at").isoformat() if isinstance(card.get("issued_at"), datetime) else card.get("issued_at"),
                "expires_at": card.get("expires_at").isoformat() if isinstance(card.get("expires_at"), datetime) else card.get("expires_at"),
            }
        if app:
            item["application"] = serialize(app)
        item.update(member_approval_info(member, enrollment))
        attach_admin_password_info(item, member)
        out.append(item)
    return out


@api.get("/admin/helps")
async def admin_helps(_: Annotated[dict[str, Any], Depends(require_admin)]):
    helps = await db.helps.find().sort("created_at", -1).to_list(500)
    return [serialize(h) for h in helps]


@api.patch("/admin/helps/{help_id}")
async def patch_help(help_id: str, body: HelpPatch, _: Annotated[dict[str, Any], Depends(require_admin)]):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = utcnow()
    result = await db.helps.find_one_and_update({"_id": oid(help_id)}, {"$set": update}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Help submission not found")
    return serialize(result)


@api.delete("/admin/applications/{app_id}")
async def delete_application(
    app_id: str,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    app = await db.applications.find_one({"_id": oid(app_id)})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    title = f"{app.get('first_name', '')} {app.get('last_name', '')}".strip() or "Application"
    await archive_to_recycle_bin(
        "application",
        app_id,
        title,
        app.get("email"),
        {"application": snapshot_doc(app)},
        admin,
    )
    await db.applications.delete_one({"_id": app["_id"]})
    return {"ok": True, "message": "Moved to Recycle Bin"}


@api.delete("/admin/members/{user_id}")
async def delete_member(
    user_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    assert_not_admin_target(user)
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin account")
    uid = str(user["_id"])
    enrollment = await db.enrollments.find_one({"user_id": uid})
    card = await db.membership_cards.find_one({"user_id": uid})
    apps = await db.applications.find({"email": user.get("email")}).to_list(100) if user.get("email") else []
    await archive_to_recycle_bin(
        "user",
        uid,
        user.get("name") or "User",
        user.get("email"),
        {
            "user": snapshot_doc(user),
            "enrollment": snapshot_doc(enrollment),
            "membership_card": snapshot_doc(card),
            "applications": [snapshot_doc(a) for a in apps],
        },
        admin,
    )
    await db.enrollments.delete_many({"user_id": uid})
    await db.membership_cards.delete_many({"user_id": uid})
    if user.get("email"):
        await db.applications.delete_many({"email": user["email"]})
    await db.users.delete_one({"_id": user["_id"]})
    await log_admin_audit(db, admin, "delete_member", user.get("email") or uid, request)
    return {"ok": True, "message": "Moved to Recycle Bin"}


@api.delete("/admin/enrollments/{enrollment_id}")
async def delete_enrollment(
    enrollment_id: str,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    enrollment = await db.enrollments.find_one({"_id": oid(enrollment_id)})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    user = None
    try:
        user = await db.users.find_one({"_id": oid(enrollment["user_id"])})
    except HTTPException:
        user = None
    title = user.get("name") if user else "Enrollment"
    email = user.get("email") if user else None
    await archive_to_recycle_bin(
        "enrollment",
        enrollment_id,
        title,
        email,
        {"enrollment": snapshot_doc(enrollment), "user_id": enrollment.get("user_id")},
        admin,
    )
    await db.enrollments.delete_one({"_id": enrollment["_id"]})
    return {"ok": True, "message": "Moved to Recycle Bin"}


@api.delete("/admin/helps/{help_id}")
async def delete_help(
    help_id: str,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    help_doc = await db.helps.find_one({"_id": oid(help_id)})
    if not help_doc:
        raise HTTPException(status_code=404, detail="Help submission not found")
    await archive_to_recycle_bin(
        "help",
        help_id,
        help_doc.get("name") or "Help Submission",
        help_doc.get("email"),
        {"help": snapshot_doc(help_doc)},
        admin,
    )
    await db.helps.delete_one({"_id": help_doc["_id"]})
    return {"ok": True, "message": "Moved to Recycle Bin"}


@api.get("/admin/recycle-bin")
async def list_recycle_bin(
    _: Annotated[dict[str, Any], Depends(require_admin)],
    q: str | None = None,
    date: str | None = None,
):
    query = build_recycle_bin_query(q=q, date=date)
    items = await db.recycle_bin.find(query).sort("deleted_at", -1).to_list(500)
    out = []
    for item in items:
        row = serialize(item) or {}
        row["item_type"] = item.get("item_type")
        row["item_label"] = RECYCLE_LABELS.get(item.get("item_type", ""), item.get("item_type"))
        row["title"] = item.get("title")
        row["email"] = item.get("email")
        row["snapshot"] = sanitize_for_json(item.get("snapshot"))
        deleted = item.get("deleted_at")
        if isinstance(deleted, datetime):
            row["deleted_at"] = deleted.isoformat()
        elif deleted:
            row["deleted_at"] = str(deleted)
        out.append(row)
    return out


@api.post("/admin/recycle-bin/{bin_id}/restore")
async def restore_recycle_item(bin_id: str, _: Annotated[dict[str, Any], Depends(require_admin)]):
    item = await db.recycle_bin.find_one({"_id": oid(bin_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Recycle bin item not found")
    item_type = item.get("item_type")
    snapshot = item.get("snapshot") or {}

    if item_type == "user":
        await restore_user_snapshot(snapshot)
    elif item_type == "application":
        app_doc = restore_doc(snapshot.get("application"))
        if not app_doc:
            raise HTTPException(status_code=400, detail="Invalid application snapshot")
        if await db.applications.find_one({"_id": app_doc["_id"]}):
            raise HTTPException(status_code=400, detail="Application already exists")
        await db.applications.insert_one(app_doc)
    elif item_type == "enrollment":
        enrollment_doc = restore_doc(snapshot.get("enrollment"))
        if not enrollment_doc:
            raise HTTPException(status_code=400, detail="Invalid enrollment snapshot")
        if await db.enrollments.find_one({"_id": enrollment_doc["_id"]}):
            raise HTTPException(status_code=400, detail="Enrollment already exists")
        await db.enrollments.insert_one(enrollment_doc)
    elif item_type == "help":
        help_doc = restore_doc(snapshot.get("help"))
        if not help_doc:
            raise HTTPException(status_code=400, detail="Invalid help snapshot")
        if await db.helps.find_one({"_id": help_doc["_id"]}):
            raise HTTPException(status_code=400, detail="Help submission already exists")
        await db.helps.insert_one(help_doc)
    else:
        raise HTTPException(status_code=400, detail="Unknown item type")

    await db.recycle_bin.delete_one({"_id": item["_id"]})
    return {"ok": True, "message": "Restored successfully"}


@api.delete("/admin/recycle-bin/{bin_id}")
async def purge_recycle_item(bin_id: str, _: Annotated[dict[str, Any], Depends(require_admin)]):
    result = await db.recycle_bin.delete_one({"_id": oid(bin_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recycle bin item not found")
    return {"ok": True, "message": "Permanently deleted"}


@api.patch("/admin/users/{user_id}")
async def patch_admin_user(
    user_id: str,
    body: AdminUserPatch,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot modify administrator account")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "email" in update:
        update["email"] = update["email"].lower()
        existing = await db.users.find_one({"email": update["email"], "_id": {"$ne": target["_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    update["updated_at"] = utcnow()
    result = await db.users.find_one_and_update({"_id": target["_id"]}, {"$set": update}, return_document=True)
    return serialize(result)


@api.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    body: AdminResetPasswordIn,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot reset administrator password here")
    await db.users.update_one(
        {"_id": target["_id"]},
        {
            "$set": {**member_password_hash_only(body.password), "updated_at": utcnow()},
            "$unset": {"login_password": ""},
        },
    )
    return {"ok": True, "message": "Password set. It is not stored for admin viewing."}


@api.delete("/admin/users/{user_id}/password")
async def delete_user_password(
    user_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete administrator password here")
    if not target.get("password") and not target.get("login_password"):
        raise HTTPException(status_code=400, detail="Member has no password on file")
    await db.users.update_one(
        {"_id": target["_id"]},
        {"$unset": {"password": "", "login_password": ""}, "$set": {"updated_at": utcnow()}},
    )
    await log_admin_audit(
        db,
        admin,
        "member_password_deleted",
        f"Deleted login password for {target.get('email') or user_id}",
        request,
    )
    return {"ok": True, "message": "Member password deleted. They cannot sign in until a new password is set."}


@api.get("/mission/feed")
async def mission_feed(user: Annotated[dict[str, Any], Depends(require_approved_member_account)]):
    posts = await db.mission_posts.find({"status": "published"}).sort("published_at", -1).to_list(100)
    uid = str(user["_id"])
    return [await enrich_post_for_member(db, p, uid) for p in posts]


@api.get("/mission/posts/{post_id}/comments")
async def mission_post_comments(
    post_id: str,
    user: Annotated[dict[str, Any], Depends(require_approved_member_account)],
):
    await get_published_post(db, post_id)
    uid = str(user["_id"])
    items = await db.mission_comments.find({"post_id": post_id}).sort("created_at", 1).to_list(500)
    out = []
    for c in items:
        row = serialize(c) or {}
        row["is_own"] = c.get("user_id") == uid
        row["parent_id"] = c.get("parent_id")
        out.append(row)
    return out


@api.post("/mission/posts/{post_id}/like")
async def mission_toggle_like(
    post_id: str,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_approved_member_account)],
):
    post = await get_published_post(db, post_id)
    pid = str(post["_id"])
    uid = str(user["_id"])
    existing = await db.mission_likes.find_one({"post_id": pid, "user_id": uid})
    if existing:
        await db.mission_likes.delete_one({"_id": existing["_id"]})
        await db.mission_posts.update_one({"_id": post["_id"]}, {"$inc": {"like_count": -1}})
        liked = False
    else:
        await db.mission_likes.insert_one(
            {"post_id": pid, "user_id": uid, "created_at": utcnow()}
        )
        await db.mission_posts.update_one({"_id": post["_id"]}, {"$inc": {"like_count": 1}})
        liked = True
    updated = await db.mission_posts.find_one({"_id": post["_id"]})
    await log_member_activity(db, user, "mission_like", pid, request)
    return {"liked": liked, "like_count": updated.get("like_count", 0) if updated else 0}


@api.post("/mission/posts/{post_id}/comments")
async def mission_add_comment(
    post_id: str,
    body: MissionCommentIn,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_approved_member_account)],
):
    post = await get_published_post(db, post_id)
    pid = str(post["_id"])
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    parent_id = None
    if body.parent_id:
        parent = await db.mission_comments.find_one({"_id": oid(body.parent_id), "post_id": pid})
        if not parent:
            raise HTTPException(status_code=404, detail="Comment to reply to was not found")
        parent_id = str(parent["_id"])
    now = utcnow()
    doc = {
        "post_id": pid,
        "user_id": str(user["_id"]),
        "user_name": user.get("name") or "Member",
        "body": text,
        "parent_id": parent_id,
        "created_at": now,
        "updated_at": None,
    }
    result = await db.mission_comments.insert_one(doc)
    await db.mission_posts.update_one({"_id": post["_id"]}, {"$inc": {"comment_count": 1}})
    doc["_id"] = result.inserted_id
    await log_member_activity(db, user, "mission_comment", pid, request)
    row = serialize(doc) or {}
    row["is_own"] = True
    row["parent_id"] = parent_id
    return row


async def _mission_comment_descendant_ids(post_id: str, root_id: str) -> list[str]:
    ids = [root_id]
    queue = [root_id]
    while queue:
        parent = queue.pop()
        children = await db.mission_comments.find({"post_id": post_id, "parent_id": parent}).to_list(200)
        for child in children:
            cid = str(child["_id"])
            ids.append(cid)
            queue.append(cid)
    return ids


@api.patch("/mission/posts/{post_id}/comments/{comment_id}")
async def mission_edit_comment(
    post_id: str,
    comment_id: str,
    body: MissionCommentPatch,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_approved_member_account)],
):
    await get_published_post(db, post_id)
    comment = await db.mission_comments.find_one({"_id": oid(comment_id), "post_id": post_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.get("user_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    now = utcnow()
    await db.mission_comments.update_one(
        {"_id": comment["_id"]},
        {"$set": {"body": text, "updated_at": now}},
    )
    updated = await db.mission_comments.find_one({"_id": comment["_id"]})
    await log_member_activity(db, user, "mission_comment_edit", post_id, request)
    row = serialize(updated) or {}
    row["is_own"] = True
    row["parent_id"] = updated.get("parent_id") if updated else None
    return row


@api.delete("/mission/posts/{post_id}/comments/{comment_id}")
async def mission_delete_comment(
    post_id: str,
    comment_id: str,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_approved_member_account)],
):
    post = await get_published_post(db, post_id)
    comment = await db.mission_comments.find_one({"_id": oid(comment_id), "post_id": post_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.get("user_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    remove_ids = await _mission_comment_descendant_ids(post_id, comment_id)
    object_ids = [oid(cid) for cid in remove_ids]
    result = await db.mission_comments.delete_many({"_id": {"$in": object_ids}})
    removed = result.deleted_count or 0
    if removed:
        await db.mission_posts.update_one({"_id": post["_id"]}, {"$inc": {"comment_count": -removed}})
    await log_member_activity(db, user, "mission_comment_delete", post_id, request)
    updated = await db.mission_posts.find_one({"_id": post["_id"]})
    return {
        "ok": True,
        "removed": removed,
        "comment_count": updated.get("comment_count", 0) if updated else 0,
    }


@api.post("/mission/posts/{post_id}/share")
async def mission_share_post(
    post_id: str,
    request: Request,
    user: Annotated[dict[str, Any], Depends(require_approved_member_account)],
):
    post = await get_published_post(db, post_id)
    await db.mission_posts.update_one({"_id": post["_id"]}, {"$inc": {"share_count": 1}})
    updated = await db.mission_posts.find_one({"_id": post["_id"]})
    await log_member_activity(db, user, "mission_share", str(post["_id"]), request)
    return {
        "ok": True,
        "share_count": updated.get("share_count", 0) if updated else 0,
        "heading": post.get("heading"),
        "share_text": post.get("heading", "IAM Mission"),
    }


@api.get("/admin/mission-posts")
async def admin_list_mission_posts(
    _: Annotated[dict[str, Any], Depends(require_admin)],
    status: str = "published",
):
    query: dict[str, Any] = {}
    if status in ("published", "archived"):
        query["status"] = status
    posts = await db.mission_posts.find(query).sort("updated_at", -1).to_list(200)
    return [serialize_post(p) for p in posts]


@api.get("/admin/mission-posts/{post_id}/engagement")
async def admin_mission_engagement(
    post_id: str,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    post = await db.mission_posts.find_one({"_id": oid(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Mission post not found")
    pid = str(post["_id"])
    likes_out = []
    for like in await db.mission_likes.find({"post_id": pid}).sort("created_at", -1).to_list(500):
        member = None
        try:
            member = await db.users.find_one({"_id": oid(like["user_id"])})
        except HTTPException:
            member = None
        row = serialize(like) or {}
        row["user_name"] = (member or {}).get("name") or "Member"
        row["email"] = (member or {}).get("email")
        row["member_id"] = (member or {}).get("member_id")
        likes_out.append(row)
    comments_out = []
    for comment in await db.mission_comments.find({"post_id": pid}).sort("created_at", 1).to_list(500):
        row = serialize(comment) or {}
        row["parent_id"] = comment.get("parent_id")
        comments_out.append(row)
    return {
        "like_count": post.get("like_count", 0),
        "comment_count": post.get("comment_count", 0),
        "share_count": post.get("share_count", 0),
        "likes": likes_out,
        "comments": comments_out,
    }


@api.post("/admin/mission/publish")
async def admin_mission_publish(
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
    heading: str = Form(...),
    body: str = Form(""),
    file: UploadFile | None = File(None),
):
    title = heading.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Heading is required")
    text = body.strip()
    media_url = None
    media_type = "none"
    if file:
        content = await file.read()
        if content:
            media_url, media_type = save_mission_media_file(file.filename or "upload.png", content)
    if not text and not media_url:
        raise HTTPException(status_code=400, detail="Add a message or upload an image")
    now = utcnow()
    doc = {
        "heading": title,
        "body": text,
        "media_url": media_url,
        "media_type": media_type,
        "status": "published",
        "like_count": 0,
        "comment_count": 0,
        "share_count": 0,
        "created_by": str(admin["_id"]),
        "created_at": now,
        "updated_at": now,
        "published_at": now,
    }
    result = await db.mission_posts.insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_admin_audit(db, admin, "mission_post_create", title, request)
    return serialize_post(doc)


@api.post("/admin/mission/upload")
async def admin_mission_upload(
    admin: Annotated[dict[str, Any], Depends(require_admin)],
    file: UploadFile = File(...),
):
    content = await file.read()
    url, mtype = save_mission_media_file(file.filename or "upload", content)
    return {"url": url, "media_type": mtype}


@api.post("/admin/mission/{post_id}/update")
async def admin_mission_update(
    post_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
    heading: str = Form(...),
    body: str = Form(""),
    file: UploadFile | None = File(None),
    remove_media: str = Form("false"),
):
    post = await db.mission_posts.find_one({"_id": oid(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Mission post not found")
    title = heading.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Heading is required")
    text = body.strip()
    media_url = post.get("media_url")
    media_type = post.get("media_type", "none")
    if remove_media.lower() == "true":
        media_url = None
        media_type = "none"
    if file:
        content = await file.read()
        if content:
            media_url, media_type = save_mission_media_file(file.filename or "upload.png", content)
    if not text and not media_url:
        raise HTTPException(status_code=400, detail="Add a message or upload an image")
    now = utcnow()
    await db.mission_posts.update_one(
        {"_id": post["_id"]},
        {
            "$set": {
                "heading": title,
                "body": text,
                "media_url": media_url,
                "media_type": media_type,
                "updated_at": now,
            }
        },
    )
    await log_admin_audit(db, admin, "mission_post_edit", title, request)
    updated = await db.mission_posts.find_one({"_id": post["_id"]})
    return serialize_post(updated)


@api.post("/admin/mission-posts")
async def admin_create_mission_post(
    body: MissionPostIn,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    now = utcnow()
    doc = {
        "heading": body.heading.strip(),
        "body": body.body.strip(),
        "media_url": body.media_url,
        "media_type": body.media_type,
        "status": "published",
        "like_count": 0,
        "comment_count": 0,
        "share_count": 0,
        "created_by": str(admin["_id"]),
        "created_at": now,
        "updated_at": now,
        "published_at": now,
    }
    result = await db.mission_posts.insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_admin_audit(db, admin, "mission_post_create", body.heading.strip(), request)
    return serialize_post(doc)


@api.patch("/admin/mission-posts/{post_id}")
async def admin_update_mission_post(
    post_id: str,
    body: MissionPostPatch,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    post = await db.mission_posts.find_one({"_id": oid(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Mission post not found")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "heading" in update:
        update["heading"] = update["heading"].strip()
    if "body" in update:
        update["body"] = update["body"].strip()
    update["updated_at"] = utcnow()
    await db.mission_posts.update_one({"_id": post["_id"]}, {"$set": update})
    await log_admin_audit(db, admin, "mission_post_edit", post.get("heading", ""), request)
    updated = await db.mission_posts.find_one({"_id": post["_id"]})
    return serialize_post(updated)


@api.post("/admin/mission-posts/{post_id}/archive")
async def admin_archive_mission_post(
    post_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    post = await db.mission_posts.find_one({"_id": oid(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Mission post not found")
    now = utcnow()
    await db.mission_posts.update_one(
        {"_id": post["_id"]},
        {"$set": {"status": "archived", "archived_at": now, "updated_at": now}},
    )
    await log_admin_audit(db, admin, "mission_post_archive", post.get("heading", ""), request)
    return {"ok": True}


@api.post("/admin/mission-posts/{post_id}/restore")
async def admin_restore_mission_post(
    post_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    post = await db.mission_posts.find_one({"_id": oid(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Mission post not found")
    now = utcnow()
    await db.mission_posts.update_one(
        {"_id": post["_id"]},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}, "$unset": {"archived_at": ""}},
    )
    await log_admin_audit(db, admin, "mission_post_restore", post.get("heading", ""), request)
    return {"ok": True}


@api.delete("/admin/mission-posts/{post_id}")
async def admin_delete_mission_post(
    post_id: str,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    post = await db.mission_posts.find_one({"_id": oid(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Mission post not found")
    pid = str(post["_id"])
    await db.mission_comments.delete_many({"post_id": pid})
    await db.mission_likes.delete_many({"post_id": pid})
    await db.mission_posts.delete_one({"_id": post["_id"]})
    await log_admin_audit(db, admin, "mission_post_delete", post.get("heading", ""), request)
    return {"ok": True}


@api.get("/admin/email-settings")
async def get_admin_email_settings(_: Annotated[dict[str, Any], Depends(require_admin)]):
    settings_doc = await get_email_settings(db)
    return admin_email_settings_response(settings_doc)


@api.put("/admin/email-settings")
async def update_admin_email_settings(
    body: EmailSettingsUpdate,
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    existing = await get_email_settings(db)
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "from_email" in update and update["from_email"]:
        update["from_email"] = str(update["from_email"]).lower()
    if "smtp_password" in update:
        pwd = (update.get("smtp_password") or "").strip()
        if not pwd or pwd == "********":
            update.pop("smtp_password", None)
        else:
            update["smtp_password"] = pwd
    if "site_url" in update and update["site_url"]:
        update["site_url"] = update["site_url"].strip().rstrip("/")
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    merged = {**existing, **update, "updated_at": utcnow()}
    await db.site_settings.update_one(
        {"_id": "email"},
        {"$set": {k: v for k, v in merged.items() if k != "_id"}},
        upsert=True,
    )
    await log_admin_audit(db, admin, "email_settings_update", "Password email settings saved", request)
    settings_doc = await get_email_settings(db)
    return admin_email_settings_response(settings_doc)


@api.post("/admin/email-settings/test")
async def test_admin_email_settings(
    request: Request,
    admin: Annotated[dict[str, Any], Depends(require_admin)],
):
    settings_doc = await get_email_settings(db)
    try:
        send_password_reset_email(
            settings_doc,
            to_email=admin["email"],
            member_name=admin.get("name") or "Administrator",
            new_password="(test — your password was not changed)",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await log_admin_audit(db, admin, "email_settings_test", f"Test email sent to {admin['email']}", request)
    return {"ok": True, "message": f"Test email sent to {admin['email']}"}


@api.get("/wallpaper")
async def get_wallpaper():
    doc = await get_wallpaper_doc()
    return wallpaper_response(doc)


@api.put("/admin/wallpaper")
async def update_wallpaper(body: WallpaperUpdate, _: Annotated[dict[str, Any], Depends(require_admin)]):
    existing = await get_wallpaper_doc()
    url = body.url if body.url is not None else existing.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="Wallpaper URL is required")
    if not (url.startswith("http") or url.startswith("/uploads/")):
        raise HTTPException(status_code=400, detail="Provide a valid image URL or uploaded file path")

    fit = body.fit if body.fit is not None else existing.get("fit", "cover")
    position_x = body.position_x if body.position_x is not None else existing.get("position_x", 50)
    position_y = body.position_y if body.position_y is not None else existing.get("position_y", 50)
    zoom = body.zoom if body.zoom is not None else existing.get("zoom", 100)
    now = utcnow()
    await db.site_settings.update_one(
        {"_id": "wallpaper"},
        {
            "$set": {
                "type": "image",
                "url": url,
                "source": "url" if body.url is not None else existing.get("source", "url"),
                "fit": fit,
                "position_x": position_x,
                "position_y": position_y,
                "zoom": zoom,
                "updated_at": now,
            }
        },
        upsert=True,
    )
    cleanup_wallpaper_uploads(url)
    doc = await get_wallpaper_doc()
    return wallpaper_response(doc)


@api.post("/admin/wallpaper/upload")
async def upload_wallpaper(
    _: Annotated[dict[str, Any], Depends(require_admin)],
    file: UploadFile = File(...),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix or 'unknown'}")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    filename = f"wallpaper-{uuid.uuid4().hex}{suffix}"
    target = WALLPAPER_DIR / filename
    target.write_bytes(content)
    url = f"/uploads/wallpapers/{filename}"
    existing = await get_wallpaper_doc()
    now = utcnow()
    await db.site_settings.update_one(
        {"_id": "wallpaper"},
        {
            "$set": {
                "type": "image",
                "url": url,
                "source": "upload",
                "fit": existing.get("fit", "cover"),
                "position_x": existing.get("position_x", 50),
                "position_y": existing.get("position_y", 50),
                "zoom": existing.get("zoom", 100),
                "updated_at": now,
            }
        },
        upsert=True,
    )
    cleanup_wallpaper_uploads(url)
    doc = await get_wallpaper_doc()
    return wallpaper_response(doc)


@api.delete("/admin/wallpaper")
async def remove_wallpaper(_: Annotated[dict[str, Any], Depends(require_admin)]):
    now = utcnow()
    await db.site_settings.update_one(
        {"_id": "wallpaper"},
        {
            "$set": {
                "type": "none",
                "url": "",
                "source": "removed",
                "fit": "cover",
                "position_x": 50,
                "position_y": 50,
                "zoom": 100,
                "updated_at": now,
            }
        },
        upsert=True,
    )
    cleanup_wallpaper_uploads(None)
    doc = await get_wallpaper_doc()
    return wallpaper_response(doc)


app.include_router(api)

uploads_root = Path(__file__).resolve().parent / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
for subdir_name in ("wallpapers", "mission", "docs"):
    subdir = uploads_root / subdir_name
    subdir.mkdir(parents=True, exist_ok=True)
    app.mount(
        f"/uploads/{subdir_name}",
        StaticFiles(directory=str(subdir)),
        name=f"uploads-{subdir_name}",
    )


@app.middleware("http")
async def block_private_upload_paths(request: Request, call_next):
    if request.url.path.startswith("/uploads/deleted-reports") or request.url.path.startswith(
        "/uploads/enrollment"
    ):
        raise HTTPException(status_code=403, detail="Admin access required")
    return await call_next(request)

frontend_root = Path(__file__).resolve().parent.parent / "frontend"
frontend_dist = frontend_root / "dist"


def _resolve_spa_index() -> Path | None:
    dist_index = frontend_dist / "index.html"
    if dist_index.is_file():
        return dist_index
    root_index = frontend_root / "index.html"
    if root_index.is_file():
        return root_index
    return None


from fastapi.responses import FileResponse, RedirectResponse

_assets_dir = frontend_dist / "assets"
if _assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="static-assets")


@app.get("/")
async def spa_root():
    index = _resolve_spa_index()
    if not index:
        raise HTTPException(
            status_code=503,
            detail="Frontend not built. Run: cd frontend && npm run build",
        )
    return FileResponse(index)


@app.get("/home")
@app.get("/index.html")
async def redirect_to_home():
    return RedirectResponse("/", status_code=302)


@app.get("/{spa_path:path}")
async def spa_fallback(spa_path: str):
    if spa_path.startswith("api") or spa_path.startswith("uploads") or spa_path in (
        "docs",
        "openapi.json",
        "redoc",
    ):
        raise HTTPException(status_code=404, detail="Not Found")
    index = _resolve_spa_index()
    if not index:
        raise HTTPException(
            status_code=503,
            detail="Frontend not built. Run: cd frontend && npm run build",
        )
    candidate = index.parent / spa_path
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(index)


if __name__ == "__main__":
    import uvicorn

    cfg = load_settings()
    # Single process only — avoids stacked reload workers on Windows when port 8001 is reused.
    uvicorn.run("server:app", host=cfg.api_host, port=cfg.api_port, reload=False)
