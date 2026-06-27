"""Private enrollment document uploads — per member, not publicly served."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException

ENROLLMENT_DOCS_ROOT = Path(__file__).resolve().parent / "uploads" / "enrollment"
ENROLLMENT_DOCS_ROOT.mkdir(parents=True, exist_ok=True)

DOC_TYPES = frozenset({"profile_photo", "government_id", "address_proof", "church_recommendation"})

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".bmp"}
PDF_EXT = {".pdf"}
PROFILE_EXT = IMAGE_EXT
ID_PROOF_EXT = IMAGE_EXT | PDF_EXT

MAX_BYTES = 10 * 1024 * 1024


def allowed_suffix(doc_type: str, suffix: str) -> bool:
    if doc_type == "profile_photo":
        return suffix in PROFILE_EXT
    return suffix in ID_PROOF_EXT


def user_dir(user_id: str) -> Path:
    path = ENROLLMENT_DOCS_ROOT / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_enrollment_document(user_id: str, doc_type: str, filename: str, content: bytes) -> str:
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    suffix = Path(filename or "").suffix.lower()
    if not suffix:
        suffix = ".jpg"
    if not allowed_suffix(doc_type, suffix):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type for {doc_type.replace('_', ' ')}: {suffix or 'unknown'}",
        )
    stored = f"{doc_type}-{uuid.uuid4().hex}{suffix}"
    target = user_dir(user_id) / stored
    target.write_bytes(content)
    return stored


def resolve_enrollment_document(user_id: str, stored_name: str) -> Path:
    if not stored_name or ".." in stored_name or "/" in stored_name or "\\" in stored_name:
        raise HTTPException(status_code=400, detail="Invalid document reference")
    path = user_dir(user_id) / stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return path


def media_type_for_path(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix in IMAGE_EXT:
        return "image/jpeg" if suffix in {".jpg", ".jpeg"} else f"image/{suffix.lstrip('.')}"
    return "application/octet-stream"
