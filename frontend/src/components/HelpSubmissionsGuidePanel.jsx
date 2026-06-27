import { BookOpen, Download } from "lucide-react";
import { ENROLLMENT_STEPS, ENROLLMENT_DOCUMENTS } from "../lib/enrollmentSteps";
import HelpSubmissionsDetailsPanel from "./HelpSubmissionsDetailsPanel";

const GUIDE_PDF = "/uploads/docs/IAM-Website-Study-Guide.pdf";

function GuideSection({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 md:p-5">
      <h4 className="font-playfair text-lg text-iam-gold">{title}</h4>
      <div className="mt-3 space-y-2 font-inter text-sm leading-relaxed text-white/85">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 border-b border-white/5 py-2 sm:grid-cols-[140px_1fr] sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-iam-muted">{label}</span>
      <span className="text-white/90">{value}</span>
    </div>
  );
}

function Step({ n, text }) {
  return (
    <p className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-iam-gold/20 text-xs font-semibold text-iam-gold">
        {n}
      </span>
      <span>{text}</span>
    </p>
  );
}

function BulletList({ items }) {
  return (
    <ul className="list-inside list-disc space-y-1.5 text-white/80">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

const ADMIN_PANELS = [
  {
    name: "Overview",
    use: "See total numbers at a glance — members, applications, help offers, pending requests. Click any card to jump to that section. Also shows countries where people applied from.",
  },
  {
    name: "Approved Users",
    use: "Members who finished enrollment and were approved. You can view full profile, suspend account, reset password, or delete.",
  },
  {
    name: "New Requests",
    use: "Inbox for everything waiting for your decision: Applications, Registrations, Enrollments, Edit Requests, Profile Changes, and Delete Account requests. Approve or reject each one.",
  },
  {
    name: "All Members",
    use: "Every member account — approved, pending, suspended, or in enrollment. Search and filter by status.",
  },
  {
    name: "Member Activity",
    use: "Log of what members did (sign in, password reset, etc.). Includes Recycle Bin sub-tab for soft-deleted activity items.",
  },
  {
    name: "Our Mission",
    use: "Publish news, photos, and updates for members. Members can like, comment, share, and download images.",
  },
  {
    name: "Our Support",
    use: "Support types and Help Submissions inbox — review member offers by type.",
  },
  {
    name: "About Us",
    use: "Full website guide — all panels, pages, folders, sign-in, and how to start.",
  },
  {
    name: "Member Deleted Request",
    use: "When a member asks to delete their account. Approve (account goes on 1-year hold) or reject (member keeps account).",
  },
  {
    name: "Account Restore Request",
    use: "Deleted members who sign in and ask to come back. Auto-restores if details match; otherwise you approve or reject manually.",
  },
  {
    name: "Deleted Accounts",
    use: "Accounts on 1-year hold after deletion. Restore, generate PDF report, or permanently purge.",
  },
  {
    name: "My Reports",
    use: "Download PDF reports about deleted accounts.",
  },
  {
    name: "Recycle Bin",
    use: "Soft-deleted users, applications, enrollments, and help submissions. Restore or permanently remove.",
  },
  {
    name: "Security Audit",
    use: "Record of all administrator actions — who did what and when.",
  },
  {
    name: "My Account",
    use: "Change your admin display name, Gmail/email, and password. Current password required to save.",
  },
  {
    name: "Password Settings",
    use: "One-time Gmail SMTP setup. After enabling, member Forgot Password requests generate and email new passwords automatically — no admin approval per request.",
  },
  {
    name: "Wallpaper",
    use: "Change the background image on the whole website — upload, URL, fit, position, and zoom.",
  },
];

const PUBLIC_PAGES = [
  { path: "/", name: "Home", detail: "Welcome page with mission info, stats, and links to Apply and Sign In." },
  { path: "/apply", name: "Apply", detail: "First application form — name, church, country, purpose, contact details." },
  { path: "/enroll", name: "Enroll", detail: "Create a member account with email and password. Waits for admin approval before sign-in." },
  { path: "/login", name: "Login", detail: "Sign in for members and admin. Forgot Password sends a reset request — new password emailed automatically when SMTP is configured." },
  { path: "/help", name: "Support Our Mission", detail: "Signed-in members only — offer help by type. Submissions appear in Our Support." },
];

const PROJECT_FOLDERS = [
  { folder: "frontend/src/pages/", detail: "Website pages — Home, Apply, Enroll, Login, Help, Enrollment, Member Dashboard, Admin Dashboard." },
  { folder: "frontend/src/components/", detail: "Reusable parts — admin panels, mission feed, wallpaper, navigation, guides." },
  { folder: "frontend/src/lib/", detail: "API calls (api.js), login session (auth.jsx), enrollment steps." },
  { folder: "backend/server.py", detail: "Main server — all website data and admin tools connect here." },
  { folder: "backend/uploads/wallpapers/", detail: "Background images for the site." },
  { folder: "backend/uploads/mission/", detail: "Photos and files for Our Mission posts." },
  { folder: "backend/uploads/docs/", detail: "This guide PDF — IAM-Website-Study-Guide.pdf." },
  { folder: "backend/uploads/deleted-reports/", detail: "PDF reports for deleted accounts (admin only)." },
  { folder: ".env", detail: "Settings — server port, database, admin email/password, security options." },
];

export default function HelpSubmissionsGuidePanel({
  title = "About Us",
  subtitle = "Full website guide — all panels, pages, folders, sign-in, PDF download, and how to start.",
  fullHeight = false,
}) {
  return (
    <div className="glass-panel mb-6 overflow-hidden">
      <div className="border-b border-white/10 bg-iam-gold/10 px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-1 h-5 w-5 shrink-0 text-iam-gold" />
            <div>
              <h3 className="font-playfair text-xl text-white">{title}</h3>
              <p className="mt-1 font-inter text-sm text-iam-muted">{subtitle}</p>
            </div>
          </div>
          <a
            href={GUIDE_PDF}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold inline-flex items-center gap-2 py-2 text-xs"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </div>
      </div>

      <div className={`space-y-4 overflow-y-auto p-5 md:p-6 ${fullHeight ? "max-h-none" : "max-h-[70vh]"}`}>
        <GuideSection title="What is in this guide">
          <BulletList
            items={[
              "All admin panels — what each sidebar tab does",
              "Public pages — Home, Apply, Enroll, Login, Support Our Mission (/help)",
              "Member journey — apply, enroll, approve, dashboard",
              "9 enrollment steps and required documents",
              "Account deletion and restore",
              "Sign in, passwords, and Gmail setup",
              "Project folders — where files live on your computer",
              "Database collections — where data is saved",
              "How to start — .\\start.ps1 steps",
              "Download PDF — same guide for printing or offline reading",
            ]}
          />
        </GuideSection>

        <HelpSubmissionsDetailsPanel />

        {/* ALL ADMIN PANELS */}
        <GuideSection title="All admin panels — full details">
          <p>Every tab in the left sidebar and what it does:</p>
          <div className="mt-2 space-y-3">
            {ADMIN_PANELS.map(({ name, use }) => (
              <div key={name} className="rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="font-medium text-iam-gold-light">{name}</p>
                <p className="mt-1 text-white/80">{use}</p>
              </div>
            ))}
          </div>
        </GuideSection>

        {/* PUBLIC PAGES */}
        <GuideSection title="Public pages (for visitors)">
          {PUBLIC_PAGES.map(({ path, name, detail }) => (
            <DetailRow key={path} label={`${name} (${path})`} value={detail} />
          ))}
        </GuideSection>

        {/* MEMBER JOURNEY */}
        <GuideSection title="Member journey — from apply to dashboard">
          <Step n="1" text="Visitor applies at /apply — application saved for admin review." />
          <Step n="2" text="Visitor enrolls at /enroll — creates account (status: pending approval)." />
          <Step n="3" text='You approve registration in New Requests — they can now sign in.' />
          <Step n="4" text="Member completes 9-step enrollment at /enrollment with documents." />
          <Step n="5" text="You approve enrollment in New Requests — member ID and digital card issued." />
          <Step n="6" text="Member uses /dashboard — profile, membership card, mission feed, account settings." />
        </GuideSection>

        {/* ENROLLMENT STEPS */}
        <GuideSection title="Enrollment steps (9 steps members complete)">
          <BulletList items={ENROLLMENT_STEPS.map((s, i) => `Step ${i + 1}: ${s.title}`)} />
          <p className="mt-3 font-medium text-white">Documents uploaded in Step 8:</p>
          <BulletList
            items={ENROLLMENT_DOCUMENTS.map((d) => `${d.label}${d.required ? " (required)" : " (optional)"}`)}
          />
        </GuideSection>

        {/* ACCOUNT DELETION & RESTORE */}
        <GuideSection title="Account deletion and restore">
          <Step n="1" text="Member requests deletion from their Dashboard → Account section." />
          <Step n="2" text='Request appears in Member Deleted Request tab — you Approve or Reject.' />
          <Step n="3" text="If approved: account snapshot saved, 1-year hold starts, member cannot sign in." />
          <Step n="4" text="Deleted account listed in Deleted Accounts — restore, PDF report, or permanent purge." />
          <Step n="5" text="If deleted member tries to sign in: restore form appears on login page." />
          <Step n="6" text="If details match exactly: auto-restore. Otherwise: Account Restore Request tab for your review." />
        </GuideSection>

        {/* SIGN IN & PASSWORDS */}
        <GuideSection title="Sign in, passwords, and security">
          <DetailRow label="Admin sign-in" value="/login → redirects to /admin" />
          <DetailRow label="Member sign-in" value="/login → /enrollment (if not finished) or /dashboard (if approved)" />
          <DetailRow label="Forgot password (member)" value="Login page — email + full name + phone from enrollment. New password emailed via Gmail SMTP." />
          <DetailRow label="Admin password" value="My Account tab while signed in — change name, email, and password." />
          <DetailRow label="Login lockout" value="5 wrong attempts = locked for 15 minutes" />
          <DetailRow label="My Account tab" value="Change admin name, email, password anytime" />
          <DetailRow label="Password Settings tab" value="Configure Gmail: smtp.gmail.com, port 587, Google App Password" />
        </GuideSection>

        {/* PROJECT FOLDERS */}
        <GuideSection title="Project folders and files">
          <p>Where things live on the computer (project folder: Appostolic Mission):</p>
          <div className="mt-2">
            {PROJECT_FOLDERS.map(({ folder, detail }) => (
              <DetailRow key={folder} label={folder} value={detail} />
            ))}
          </div>
        </GuideSection>

        {/* DATABASE — SIMPLE */}
        <GuideSection title="Where data is saved (database collections)">
          <BulletList
            items={[
              "users — member and admin accounts",
              "applications — /apply form submissions",
              "enrollments — member enrollment data and review status",
              "helps — Help Submissions from /help",
              "mission_posts — Our Mission posts, likes, comments",
              "account_deletion_requests — pending delete requests",
              "deleted_accounts — deleted snapshots (1-year hold)",
              "account_restore_requests — restore requests from login page",
              "recycle_bin — soft-deleted items",
              "member_activity — member action log",
              "admin_audit — administrator action log",
              "site_settings — wallpaper and email/SMTP settings",
              "login_attempts — login and forgot-password rate limiting",
            ]}
          />
        </GuideSection>

        {/* START SERVER */}
        <GuideSection title="How to start the website">
          <Step n="1" text='Open PowerShell in the project folder "Appostolic Mission".' />
          <Step n="2" text="Run: .\start.ps1" />
          <Step n="3" text="Open browser: http://127.0.0.1:8001/admin" />
          <Step n="4" text="To stop: Ctrl+C in the PowerShell window, or run .\stop.ps1" />
          <Step n="5" text="If pages look old: press Ctrl+F5 in the browser to refresh." />
        </GuideSection>
      </div>
    </div>
  );
}
