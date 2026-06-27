"""Our Mission posts — admin publishes; members see headings with like, comment, share."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

MISSION_DIR = Path(__file__).resolve().parent / "uploads" / "mission"
MISSION_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".bmp", ".tif", ".tiff"}
VIDEO_EXT = {".mp4", ".webm", ".mov"}
DOC_EXT = {".pdf", ".doc", ".docx"}
ALLOWED_EXT = IMAGE_EXT | VIDEO_EXT | DOC_EXT


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def media_type_for_suffix(suffix: str) -> str:
    if suffix in IMAGE_EXT:
        return "image"
    if suffix in VIDEO_EXT:
        return "video"
    if suffix in DOC_EXT:
        return "document"
    return "file"


def save_mission_media_file(filename: str, content: bytes) -> tuple[str, str]:
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    suffix = Path(filename or "").suffix.lower()
    if not suffix:
        suffix = ".png"
    if suffix not in ALLOWED_EXT:
        allowed = ", ".join(sorted(ALLOWED_EXT))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Allowed: {allowed}",
        )
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    stored = f"mission-{uuid.uuid4().hex}{suffix}"
    target = MISSION_DIR / stored
    target.write_bytes(content)
    return f"/uploads/mission/{stored}", media_type_for_suffix(suffix)


def serialize_post(doc: dict[str, Any] | None) -> dict[str, Any] | None:
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


async def get_published_post(db: AsyncIOMotorDatabase, post_id: str) -> dict[str, Any]:
    post = await db.mission_posts.find_one({"_id": ObjectId(post_id), "status": "published"})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def enrich_post_for_member(
    db: AsyncIOMotorDatabase,
    post: dict[str, Any],
    user_id: str,
) -> dict[str, Any]:
    pid = str(post["_id"])
    liked = await db.mission_likes.find_one({"post_id": pid, "user_id": user_id})
    row = serialize_post(post) or {}
    row["liked"] = bool(liked)
    row["like_count"] = post.get("like_count", 0)
    row["comment_count"] = post.get("comment_count", 0)
    row["share_count"] = post.get("share_count", 0)
    return row
