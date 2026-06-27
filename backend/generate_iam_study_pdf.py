"""Generate a compact, readable IAM guide PDF — no emblem overlap, minimal empty space."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from account_deletion import EMBLEM_PATH, GOLD, MUTED, NAVY, PANEL_BG, TEXT, safe_pdf_text

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "docs"
OUTPUT_FILE = UPLOAD_DIR / "IAM-Website-Study-Guide.pdf"

# Header band — emblem left, text right, never overlap
EMBLEM_X, EMBLEM_Y, EMBLEM_W = 10, 7, 16
TEXT_X = 30
HEADER_LINE_Y = 28
BODY_START_Y = 31

ADMIN_PANELS = [
    ("Overview", "Stats, quick links, countries."),
    ("Approved Users", "Approved members — suspend, reset password, delete."),
    ("New Requests", "Applications, enrollments, edits, deletions to approve."),
    ("All Members", "Every member account."),
    ("Member Activity", "Action log + Recycle Bin."),
    ("Our Mission", "Publish posts; likes, comments, share."),
    ("Help Submissions", "Public help offers from /help."),
    ("Member Deleted Request", "Approve/reject delete requests."),
    ("Account Restore Request", "Restore deleted accounts."),
    ("Deleted Accounts", "1-year hold, restore, PDF, purge."),
    ("My Reports", "Deletion PDF reports."),
    ("Recycle Bin", "Restore or purge deleted items."),
    ("Security Audit", "Admin action log."),
    ("My Account", "Change name, email, password."),
    ("Password Settings", "Gmail SMTP for password emails."),
    ("Wallpaper", "Site background image."),
]


class IAMGuidePDF(FPDF):
    def __init__(self) -> None:
        super().__init__()
        self._body_top = BODY_START_Y

    def header(self) -> None:
        if self.page_no() == 1:
            if EMBLEM_PATH.exists():
                self.image(str(EMBLEM_PATH), x=EMBLEM_X, y=EMBLEM_Y, w=EMBLEM_W)
            self.set_xy(TEXT_X, 8)
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(*NAVY)
            self.cell(0, 5, safe_pdf_text("International Apostolic Mission"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_x(TEXT_X)
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(*GOLD)
            self.cell(0, 4, safe_pdf_text("Appostolic Mission — Easy Website Guide"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_x(TEXT_X)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*MUTED)
            ts = datetime.now(timezone.utc).strftime("%d %b %Y")
            self.cell(0, 4, safe_pdf_text(f"Admin Help Submissions  |  Updated {ts}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(*NAVY)
            self.set_xy(self.l_margin, 6)
            self.cell(self.epw * 0.7, 4, safe_pdf_text("Appostolic Mission — Website Guide"))
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*MUTED)
            self.cell(self.epw * 0.3, 4, safe_pdf_text(f"Page {self.page_no()}"), align="R")
            self._body_top = 14

        y_line = HEADER_LINE_Y if self.page_no() == 1 else 12
        self.set_draw_color(*GOLD)
        self.set_line_width(0.4)
        self.line(self.l_margin, y_line, self.w - self.r_margin, y_line)
        self.set_y(BODY_START_Y if self.page_no() == 1 else 14)

    def footer(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(-9)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*MUTED)
        self.cell(0, 3, safe_pdf_text("International Apostolic Mission"), align="C")

    def section_title(self, title: str) -> None:
        if self.get_y() > 275:
            self.add_page()
        self.set_fill_color(*NAVY)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 9)
        self.cell(self.epw, 5, safe_pdf_text(f"  {title}"), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*TEXT)

    def line_text(self, text: str, bold: bool = False) -> None:
        if self.get_y() > 280:
            self.add_page()
        self.set_font("Helvetica", "B" if bold else "", 8)
        self.multi_cell(self.epw, 3.8, safe_pdf_text(text))

    def bullet(self, text: str) -> None:
        self.line_text(f"• {text}")

    def step(self, n: int, text: str) -> None:
        self.line_text(f"{n}. {text}")

    def pair_row(self, label: str, value: str, fill: bool = False) -> None:
        if self.get_y() > 278:
            self.add_page()
        y0 = self.get_y()
        lw = 42
        if fill:
            self.set_fill_color(*PANEL_BG)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*MUTED)
        self.cell(lw, 4.2, safe_pdf_text(label), fill=fill)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*TEXT)
        self.multi_cell(self.epw - lw, 4.2, safe_pdf_text(value), fill=fill)
        if self.get_y() - y0 < 4.2:
            self.set_y(y0 + 4.2)

    def two_columns(self, items: list[tuple[str, str]]) -> None:
        col_w = (self.epw - 4) / 2
        mid = len(items) // 2 + len(items) % 2
        left, right = items[:mid], items[mid:]
        y_start = self.get_y()
        x_left = self.l_margin
        x_right = self.l_margin + col_w + 4

        for i, (name, detail) in enumerate(left):
            self.set_xy(x_left, y_start + i * 8)
            self.set_font("Helvetica", "B", 7.5)
            self.set_text_color(*NAVY)
            self.cell(col_w, 3.5, safe_pdf_text(name))
            self.set_xy(x_left, y_start + i * 8 + 3.5)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*TEXT)
            self.multi_cell(col_w, 3.2, safe_pdf_text(detail))

        for i, (name, detail) in enumerate(right):
            self.set_xy(x_right, y_start + i * 8)
            self.set_font("Helvetica", "B", 7.5)
            self.set_text_color(*NAVY)
            self.cell(col_w, 3.5, safe_pdf_text(name))
            self.set_xy(x_right, y_start + i * 8 + 3.5)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*TEXT)
            self.multi_cell(col_w, 3.2, safe_pdf_text(detail))

        rows = max(len(left), len(right))
        self.set_y(y_start + rows * 8 + 1)


def generate() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    pdf = IAMGuidePDF()
    pdf.set_auto_page_break(auto=True, margin=10)
    pdf.set_margins(10, BODY_START_Y, 10)
    pdf.add_page()

    pdf.line_text("Simple guide for administrators. Also readable in Admin Panel → Help Submissions.", bold=True)

    pdf.section_title("HELP SUBMISSIONS")
    pdf.pair_row("Public link", "http://127.0.0.1:8001/help — no sign-in needed", True)
    pdf.pair_row("Form fields", "Name, Email, Phone (optional), Country, Help Type, Message, Amount (financial only)")
    pdf.pair_row("Help types", "Financial | Volunteering | Prayer | Resources | Ministry | Other")
    pdf.pair_row("Statuses", "received = new | reviewed = read | acknowledged = handled")
    pdf.step(1, "Click a name in the list → see full details.")
    pdf.step(2, "Mark Reviewed when you have read it.")
    pdf.step(3, "Acknowledge when you have replied or finished.")
    pdf.step(4, "Move to Recycle Bin to remove; restore from Recycle Bin tab if needed.")

    pdf.section_title("ALL ADMIN PANELS (16 tabs)")
    pdf.two_columns(ADMIN_PANELS)

    pdf.section_title("PUBLIC PAGES")
    for path, name, detail in [
        ("/", "Home", "Welcome page"),
        ("/apply", "Apply", "First application"),
        ("/enroll", "Enroll", "Create account — waits for approval"),
        ("/login", "Login", "Sign in + forgot password"),
        ("/help", "Help", "Offer help → appears in Help Submissions"),
    ]:
        pdf.bullet(f"{name} ({path}): {detail}")

    pdf.section_title("MEMBER JOURNEY")
    pdf.step(1, "Apply at /apply")
    pdf.step(2, "Enroll at /enroll — admin approves in New Requests")
    pdf.step(3, "Complete 9-step enrollment at /enrollment")
    pdf.step(4, "Admin approves enrollment → member ID issued")
    pdf.step(5, "Member uses /dashboard — profile, ID card, mission feed")

    pdf.section_title("ENROLLMENT (9 STEPS)")
    steps = [
        "Personal Profile", "Address", "Identity", "Church", "Spiritual Background",
        "Mission Interest", "Emergency Contact", "Documents", "Agreement",
    ]
    pdf.line_text("  →  ".join(f"{i + 1}.{s}" for i, s in enumerate(steps)))
    pdf.bullet("Documents: Profile photo, Government ID, Address proof, Church letter (optional)")

    pdf.section_title("ACCOUNT DELETE & RESTORE")
    pdf.step(1, "Member requests delete from Dashboard")
    pdf.step(2, "You approve in Member Deleted Request → 1-year hold")
    pdf.step(3, "Deleted Accounts tab — restore, PDF report, or purge")
    pdf.step(4, "Deleted member signs in → restore form; auto-restore if details match")

    pdf.section_title("SIGN IN & PASSWORDS")
    pdf.pair_row("Admin login", "/login → /admin", True)
    pdf.pair_row("Member forgot password", "Email + full name + phone from enrollment → emailed via Gmail")
    pdf.pair_row("Admin password", "My Account tab while signed in")
    pdf.pair_row("Lockout", "5 wrong attempts = 15 minutes locked")
    pdf.pair_row("My Account tab", "Change admin name, email, password")
    pdf.pair_row("Password Settings", "smtp.gmail.com, port 587, Google App Password")

    pdf.section_title("PROJECT FOLDERS")
    folders = [
        ("frontend/src/pages/", "Website pages"),
        ("frontend/src/components/", "Admin panels & UI"),
        ("backend/server.py", "Main server"),
        ("backend/uploads/wallpapers/", "Background images"),
        ("backend/uploads/mission/", "Mission media"),
        ("backend/uploads/docs/", "This PDF"),
        (".env", "Settings & admin password"),
    ]
    for folder, detail in folders:
        pdf.bullet(f"{folder} {detail}")

    pdf.section_title("DATA STORED IN DATABASE")
    pdf.line_text(
        "users · applications · enrollments · helps · mission_posts · "
        "account_deletion_requests · deleted_accounts · account_restore_requests · "
        "recycle_bin · member_activity · admin_audit · site_settings · login_attempts"
    )

    pdf.section_title("START THE WEBSITE")
    pdf.bullet("PowerShell in project folder: .\\start.ps1")
    pdf.bullet("Open: http://127.0.0.1:8001/admin")
    pdf.bullet("Refresh browser: Ctrl+F5 if pages look old")

    pdf.output(str(OUTPUT_FILE))
    return OUTPUT_FILE


if __name__ == "__main__":
    print(f"Created: {generate()}")
