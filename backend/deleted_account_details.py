"""Contact fields and admin purge helpers for deleted account records."""
from __future__ import annotations

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from account_deletion import generate_deletion_pdf, utcnow


def format_postal_address(address: dict[str, Any] | None) -> str:
    if not address:
        return ""
    parts = [
        address.get("street"),
        address.get("city"),
        address.get("district") or address.get("state"),
        address.get("country"),
        address.get("postal_code"),
    ]
    return ", ".join(str(part).strip() for part in parts if part)


def snapshot_contact_details(
    snapshot: dict[str, Any],
    record: dict[str, Any] | None = None,
) -> dict[str, Any]:
    user = snapshot.get("user") or {}
    enrollment = snapshot.get("enrollment") or {}
    data = enrollment.get("data") or {}
    personal = data.get("personal") or {}
    address = data.get("address") or {}
    church = data.get("church") or {}
    emergency = data.get("emergency") or {}
    apps = snapshot.get("applications") or []
    app = apps[0] if apps else {}

    phone = (
        personal.get("mobile")
        or personal.get("phone")
        or app.get("mobile")
        or emergency.get("mobile")
    )
    email = (record or {}).get("email") or user.get("email") or app.get("email")
    church_name = church.get("church_name") or church.get("name") or ""
    formatted_address = format_postal_address(address)

    return {
        "phone": phone or None,
        "email": email or None,
        "church_name": church_name or None,
        "address": formatted_address or None,
        "city": address.get("city") or None,
        "country": address.get("country") or personal.get("nationality") or app.get("country") or None,
    }


def contact_pdf_rows(snapshot: dict[str, Any], record: dict[str, Any]) -> list[tuple[str, Any]]:
    contact = snapshot_contact_details(snapshot, record)
    rows = [
        ("Phone number", contact.get("phone")),
        ("Email address", contact.get("email")),
        ("Church name", contact.get("church_name")),
        ("Address", contact.get("address")),
        ("City", contact.get("city")),
        ("Country", contact.get("country")),
    ]
    return [(label, value) for label, value in rows if value not in (None, "", "—")]


async def purge_single_deleted_account(db: AsyncIOMotorDatabase, record: dict[str, Any]) -> str:
    """Permanently purge one held account: PDF report, remove user data, mark purged."""
    if record.get("stage") != "held":
        raise ValueError("Only held accounts can be purged")

    now = utcnow()
    snapshot = record.get("snapshot") or {}
    pdf_path = generate_deletion_pdf(record, snapshot)
    pdf_url = f"/uploads/deleted-reports/{pdf_path.name}"

    await db.deletion_reports.insert_one(
        {
            "deleted_account_id": str(record["_id"]),
            "user_id": record.get("user_id"),
            "email": record.get("email"),
            "name": record.get("name"),
            "pdf_path": str(pdf_path),
            "pdf_url": pdf_url,
            "kind": "admin_purge",
            "created_at": now,
            "summary": {
                "member_id": (snapshot.get("user") or {}).get("member_id"),
                "approved_at": record.get("approved_at"),
                "purged_at": now.isoformat(),
                "stage": "purged",
            },
        }
    )

    uid = record.get("user_id")
    if uid:
        try:
            user_oid = ObjectId(uid)
        except Exception:
            user_oid = None
        if user_oid:
            await db.enrollments.delete_many({"user_id": uid})
            await db.membership_cards.delete_many({"user_id": uid})
            user_doc = await db.users.find_one({"_id": user_oid})
            if user_doc and user_doc.get("email"):
                await db.applications.delete_many({"email": user_doc["email"]})
            await db.users.delete_one({"_id": user_oid})

    await db.deleted_accounts.update_one(
        {"_id": record["_id"]},
        {"$set": {"stage": "purged", "purged_at": now, "pdf_url": pdf_url}},
    )
    return pdf_url
