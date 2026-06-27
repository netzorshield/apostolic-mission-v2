"""Member account deletion requests, 1-year hold, PDF reports, and purge."""

from __future__ import annotations



import json

from datetime import datetime, timezone

from pathlib import Path

from typing import Any, Awaitable, Callable



from bson import ObjectId

from fastapi import HTTPException

from motor.motor_asyncio import AsyncIOMotorDatabase



DELETION_HOLD_DAYS = 365

REPORTS_DIR = Path(__file__).resolve().parent / "uploads" / "deleted-reports"

ASSETS_DIR = Path(__file__).resolve().parent / "assets"

EMBLEM_PATH = ASSETS_DIR / "iam-emblem.png"

WATERMARK_PATH = ASSETS_DIR / "iam-emblem-watermark.png"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)



# IAM report palette

GOLD = (201, 162, 39)

NAVY = (20, 33, 61)

TEXT = (35, 35, 35)

MUTED = (105, 105, 105)

PANEL_BG = (248, 246, 241)





def utcnow() -> datetime:

    return datetime.now(timezone.utc)





def safe_pdf_text(value: Any) -> str:

    text = str(value) if value is not None else ""

    return text.encode("latin-1", errors="replace").decode("latin-1")





def format_display_value(value: Any) -> str:

    if value is None or value == "":

        return "—"

    if isinstance(value, bool):

        return "Yes" if value else "No"

    if isinstance(value, datetime):

        return value.strftime("%d %B %Y, %H:%M UTC")

    text = str(value)

    if "T" in text and len(text) >= 19:

        try:

            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))

            if parsed.tzinfo is None:

                parsed = parsed.replace(tzinfo=timezone.utc)

            return parsed.strftime("%d %B %Y, %H:%M UTC")

        except ValueError:

            pass

    return safe_pdf_text(text)





def ensure_watermark_emblem() -> Path | None:

    if not EMBLEM_PATH.exists():

        return None

    try:

        from PIL import Image, ImageEnhance

    except ImportError:

        return EMBLEM_PATH

    try:

        emblem = Image.open(EMBLEM_PATH).convert("RGBA")

        width = 900

        height = int(emblem.height * width / emblem.width)

        emblem = emblem.resize((width, height), Image.Resampling.LANCZOS)

        emblem = ImageEnhance.Color(emblem).enhance(0.35)

        emblem = ImageEnhance.Brightness(emblem).enhance(1.25)

        pixels = emblem.load()

        for y in range(emblem.height):

            for x in range(emblem.width):

                r, g, b, a = pixels[x, y]

                pixels[x, y] = (r, g, b, int(a * 0.14))

        WATERMARK_PATH.parent.mkdir(parents=True, exist_ok=True)

        emblem.save(WATERMARK_PATH, "PNG")

        return WATERMARK_PATH

    except Exception:

        return EMBLEM_PATH





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





async def build_user_snapshot(db: AsyncIOMotorDatabase, user: dict[str, Any]) -> dict[str, Any]:

    uid = str(user["_id"])

    enrollment = await db.enrollments.find_one({"user_id": uid})

    card = await db.membership_cards.find_one({"user_id": uid})

    apps = (

        await db.applications.find({"email": user.get("email")}).to_list(100)

        if user.get("email")

        else []

    )

    return {

        "user": snapshot_doc(user),

        "enrollment": snapshot_doc(enrollment),

        "membership_card": snapshot_doc(card),

        "applications": [snapshot_doc(a) for a in apps if snapshot_doc(a)],

    }





def _report_sections(record: dict[str, Any], snapshot: dict[str, Any]) -> list[tuple[str, list[tuple[str, Any]]]]:

    user = snapshot.get("user") or {}

    enrollment = snapshot.get("enrollment") or {}

    card = snapshot.get("membership_card") or {}

    personal = (enrollment.get("data") or {}).get("personal") or {}

    address = (enrollment.get("data") or {}).get("address") or {}

    apps = snapshot.get("applications") or []



    sections: list[tuple[str, list[tuple[str, Any]]]] = [

        (

            "Report Summary",

            [

                ("Report generated", utcnow()),

                ("Report type", "Deleted Account Record"),

                ("Account stage", record.get("stage", "held")),

                ("Approved for deletion", record.get("approved_at")),

                ("Scheduled permanent purge", record.get("purge_at")),

            ],

        ),

        (

            "Member Account",

            [

                ("Full name", record.get("name") or user.get("name")),

                ("Email address", record.get("email") or user.get("email")),

                ("Member ID", user.get("member_id")),

                ("User ID", record.get("user_id") or user.get("id")),

                ("Account status", user.get("status")),

                ("Enrollment complete", user.get("enrollment_complete")),

                ("Registered on", user.get("created_at")),

                ("Last updated", user.get("updated_at")),

            ],

        ),

    ]



    if enrollment:

        sections.append(

            (

                "Enrollment Snapshot",

                [

                    ("Enrollment status", enrollment.get("status")),

                    ("Member ID", enrollment.get("member_id")),

                    ("Submitted", enrollment.get("submitted_at") or enrollment.get("updated_at")),

                    ("First name", personal.get("first_name") or personal.get("given_name")),

                    ("Last name", personal.get("last_name") or personal.get("surname")),

                    ("Mobile", personal.get("mobile") or personal.get("phone")),

                    ("Nationality", personal.get("nationality")),

                    ("Country of residence", address.get("country")),

                    ("City", address.get("city")),

                ],

            )

        )



    if card:

        sections.append(

            (

                "Membership Card",

                [

                    ("Member ID", card.get("member_id")),

                    ("Card issued", card.get("issued_at") or card.get("created_at")),

                    ("Valid until", card.get("valid_until")),

                ],

            )

        )



    for index, app in enumerate(apps, start=1):

        sections.append(

            (

                f"Application #{index}",

                [

                    ("Name", f"{app.get('first_name', '')} {app.get('last_name', '')}".strip()),

                    ("Email", app.get("email")),

                    ("Mobile", app.get("mobile")),

                    ("Country", app.get("country")),

                    ("Purpose", app.get("purpose")),

                    ("Tracking ID", app.get("tracking_id")),

                    ("Status", app.get("status")),

                    ("Submitted", app.get("created_at")),

                ],

            )

        )



    from deleted_account_details import contact_pdf_rows

    contact_rows = contact_pdf_rows(snapshot, record)

    if contact_rows:

        sections.insert(2, ("Contact Details", contact_rows))



    return sections





def generate_deletion_pdf(record: dict[str, Any], snapshot: dict[str, Any]) -> Path:

    from fpdf import FPDF

    from fpdf.enums import XPos, YPos



    filename = f"deleted-account-{record.get('user_id', 'unknown')}-{utcnow().strftime('%Y%m%d%H%M%S')}.pdf"

    target = REPORTS_DIR / filename



    safe_snapshot = json.loads(json.dumps(snapshot, default=str))

    user = safe_snapshot.get("user")

    if isinstance(user, dict):

        user.pop("password", None)



    watermark = ensure_watermark_emblem()

    sections = _report_sections(record, safe_snapshot)



    class IAMDeletionReportPDF(FPDF):

        def header(self) -> None:

            if watermark and watermark.exists():

                self.image(str(watermark), x=32, y=72, w=145)

            if EMBLEM_PATH.exists():

                self.image(str(EMBLEM_PATH), x=10, y=8, w=26)

            self.set_xy(40, 10)

            self.set_font("Helvetica", "B", 15)

            self.set_text_color(*NAVY)

            self.cell(0, 7, safe_pdf_text("International Apostolic Mission"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            self.set_x(40)

            self.set_font("Helvetica", "I", 10)

            self.set_text_color(*GOLD)

            self.cell(0, 5, safe_pdf_text("Making Room for God's Glory"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            self.set_x(40)

            self.set_font("Helvetica", "B", 12)

            self.set_text_color(*TEXT)

            self.cell(0, 7, safe_pdf_text("Deleted Account Report"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            self.set_font("Helvetica", "", 8)

            self.set_text_color(*MUTED)

            self.set_xy(self.w - self.r_margin - 52, 10)

            self.multi_cell(

                52,

                4,

                safe_pdf_text(f"Generated\n{format_display_value(utcnow())}"),

                align="R",

            )

            self.set_draw_color(*GOLD)

            self.set_line_width(0.6)

            self.line(10, 36, self.w - 10, 36)

            self.set_y(42)



        def footer(self) -> None:

            self.set_y(-14)

            self.set_draw_color(*GOLD)

            self.set_line_width(0.3)

            self.line(10, self.get_y(), self.w - 10, self.get_y())

            self.ln(2)

            self.set_font("Helvetica", "I", 8)

            self.set_text_color(*MUTED)

            self.cell(

                0,

                5,

                safe_pdf_text("Go therefore and make disciples of all nations. - Matthew 28:19"),

                align="C",

            )

            self.set_font("Helvetica", "", 7)

            self.cell(0, 4, safe_pdf_text(f"Page {self.page_no()}"), align="C")



    pdf = IAMDeletionReportPDF()

    pdf.set_auto_page_break(auto=True, margin=18)

    pdf.set_margins(12, 42, 12)

    pdf.add_page()



    pdf.set_font("Helvetica", "", 10)

    pdf.set_text_color(*TEXT)

    pdf.multi_cell(

        pdf.epw,

        5,

        safe_pdf_text(

            "This confidential report records a member account approved for deletion. "

            "Data below is preserved for the IAM 1-year retention period."

        ),

    )

    pdf.ln(4)



    def draw_section(title: str, rows: list[tuple[str, Any]]) -> None:

        if pdf.get_y() > 250:

            pdf.add_page()

        pdf.set_fill_color(*NAVY)

        pdf.set_text_color(255, 255, 255)

        pdf.set_font("Helvetica", "B", 11)

        pdf.set_x(pdf.l_margin)

        pdf.cell(pdf.epw, 8, safe_pdf_text(f"  {title}"), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        pdf.ln(1)

        fill = False

        for label, value in rows:

            if pdf.get_y() > 265:

                pdf.add_page()

            pdf.set_x(pdf.l_margin)

            pdf.set_fill_color(*PANEL_BG if fill else (255, 255, 255))

            pdf.set_font("Helvetica", "B", 10)

            pdf.set_text_color(*MUTED)

            label_width = 58

            pdf.cell(label_width, 8, safe_pdf_text(label), fill=True)

            pdf.set_font("Helvetica", "", 10)

            pdf.set_text_color(*TEXT)

            pdf.multi_cell(pdf.epw - label_width, 8, safe_pdf_text(format_display_value(value)), fill=True)

            fill = not fill

        pdf.ln(4)



    for title, rows in sections:

        draw_section(title, rows)



    if pdf.get_y() > 240:

        pdf.add_page()

    pdf.set_font("Helvetica", "I", 8)

    pdf.set_text_color(*MUTED)

    pdf.multi_cell(

        pdf.epw,

        4,

        safe_pdf_text(

            "International Apostolic Mission (IAM) — Administrator retention report. "

            "Unauthorized distribution is prohibited."

        ),

    )



    pdf.output(str(target))

    return target





async def flag_reactivation_attempt(db: AsyncIOMotorDatabase, email: str) -> None:

    await db.deleted_accounts.update_one(

        {"email": email.lower(), "stage": "held"},

        {"$set": {"reactivation_requested": True, "reactivation_at": utcnow()}},

    )





async def purge_expired_deleted_accounts(

    db: AsyncIOMotorDatabase,

    restore_user_snapshot: Callable[[dict[str, Any]], Awaitable[None]],

) -> int:

    now = utcnow()

    held = await db.deleted_accounts.find({"stage": "held", "purge_at": {"$lte": now}}).to_list(500)

    purged = 0

    for record in held:

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

                "created_at": now,

                "summary": {

                    "member_id": (snapshot.get("user") or {}).get("member_id"),

                    "approved_at": record.get("approved_at"),

                    "purged_at": now.isoformat(),

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

        purged += 1

    return purged





async def restore_deleted_account(

    db: AsyncIOMotorDatabase,

    record: dict[str, Any],

    restore_user_snapshot: Callable[[dict[str, Any]], Awaitable[None]],

) -> None:

    snapshot = record.get("snapshot")

    if not snapshot:

        raise HTTPException(status_code=400, detail="No snapshot available to restore")

    user_raw = snapshot.get("user")

    if not user_raw:

        raise HTTPException(status_code=400, detail="Invalid snapshot")

    email = (user_raw.get("email") or record.get("email") or "").lower()

    existing = await db.users.find_one({"email": email}) if email else None

    if existing and existing.get("status") != "deletion_hold":

        raise HTTPException(status_code=400, detail="Email already in use by another account")



    if existing and existing.get("status") == "deletion_hold":

        await db.users.delete_one({"_id": existing["_id"]})

        await db.enrollments.delete_many({"user_id": str(existing["_id"])})

        await db.membership_cards.delete_many({"user_id": str(existing["_id"])})



    await restore_user_snapshot(snapshot)

    user_doc = await db.users.find_one({"email": email}) if email else None

    if user_doc:

        prev_status = (snapshot.get("user") or {}).get("status")

        new_status = "active" if user_doc.get("enrollment_complete") else (prev_status or "pending_approval")

        if new_status in ("deletion_hold", "deletion_requested"):

            new_status = "active"

        await db.users.update_one(

            {"_id": user_doc["_id"]},

            {"$set": {"status": new_status, "updated_at": utcnow()}},

        )

    await db.deleted_accounts.update_one(

        {"_id": record["_id"]},

        {"$set": {"stage": "restored", "restored_at": utcnow(), "reactivation_requested": False}},

    )

    await db.account_deletion_requests.update_many(

        {"user_id": record.get("user_id"), "status": "approved"},

        {"$set": {"restored_at": utcnow()}},

    )


