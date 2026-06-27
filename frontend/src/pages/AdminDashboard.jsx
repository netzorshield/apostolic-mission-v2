import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Users,
  UserCircle,
  FileText,
  Globe,
  LogOut,
  FolderOpen,
  HandHeart,
  ChevronRight,
  Mail,
  Trash2,
  Ban,
  KeyRound,
  Pencil,
  Recycle,
  RotateCcw,
  UserX,
  FileBarChart,
  Shield,
  Activity,
  Megaphone,
  Search,
  Bell,
  Inbox,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import AdminWallpaperPanel from "../components/AdminWallpaperPanel";
import AdminPasswordSettingsPanel from "../components/AdminPasswordSettingsPanel";
import AdminAccountSettingsPanel from "../components/AdminAccountSettingsPanel";
import AdminMissionPanel from "../components/AdminMissionPanel";
import SupportOurMissionPanel from "../components/SupportOurMissionPanel";
import AboutUsTab from "../components/AboutUsTab";
import { helpTypeLabel } from "../lib/helpTypes";
import EnrollmentDetails from "../components/EnrollmentDetails";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { runDeleteAction } from "../lib/safeDelete";

const NAV = [
  { id: "overview", label: "Overview", icon: Globe },
  { id: "users", label: "Approved Users", icon: UserCircle },
  { id: "requests", label: "New Requests", icon: FolderOpen },
  { id: "members", label: "All Members", icon: Users },
  { id: "member-activity", label: "Member Activity", icon: Activity },
  { id: "our-mission", label: "Our Mission", icon: Megaphone },
  { id: "our-support", label: "Our Support", icon: HandHeart },
  { id: "about-us", label: "About Us", icon: BookOpen },
  { id: "deletion-requests", label: "Member Deleted Request", icon: UserX },
  { id: "restore-requests", label: "Account Restore Request", icon: Inbox },
  { id: "deleted-accounts", label: "Deleted Accounts", icon: Ban },
  { id: "my-reports", label: "My Reports", icon: FileBarChart },
  { id: "recycle", label: "Recycle Bin", icon: Recycle },
  { id: "security", label: "Security Audit", icon: Shield },
  { id: "my-account", label: "My Account", icon: UserCircle },
  { id: "password-settings", label: "Password Settings", icon: KeyRound },
  { id: "wallpaper", label: "Wallpaper", icon: FileText },
];

const APPROVAL_STYLES = {
  "User & Member": "bg-emerald-500/20 text-emerald-300",
  "Pending Approval": "bg-iam-gold/20 text-iam-gold-light",
  Approved: "bg-emerald-500/20 text-emerald-300",
  "Pending Review": "bg-iam-gold/20 text-iam-gold-light",
  Rejected: "bg-red-500/20 text-red-300",
  "In Progress": "bg-white/10 text-white/60",
  Registered: "bg-white/10 text-white/60",
  Administrator: "bg-iam-gold/15 text-iam-gold",
};

function ApprovalBadge({ label }) {
  const style = APPROVAL_STYLES[label] || "bg-white/10 text-white/60";
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}

const FOLDER_LABELS = {
  application: "Application",
  registration: "New Registration",
  enrollment: "Enrollment",
  enrollment_edit: "Edit Request",
  enrollment_changes: "Profile Changes",
  account_deletion: "Delete Account",
};

const ACTION_LABELS = {
  register: "Registered account",
  login: "Signed in",
  enrollment_save: "Saved enrollment",
  enrollment_submit: "Submitted enrollment",
  enrollment_document_upload: "Uploaded document",
  edit_request: "Requested profile edit",
  profile_changes_submit: "Submitted profile changes",
  delete_request: "Requested account deletion",
  mission_like: "Liked mission post",
  mission_comment: "Commented on mission post",
  mission_comment_edit: "Edited mission comment",
  mission_comment_delete: "Deleted mission comment",
  mission_share: "Shared mission post",
  admin_note: "Administrator note",
};

function formatActivityDate(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length >= 10) return text.slice(0, 10);
  return text;
}

function ActivitySearchBar({
  search,
  date,
  memberId,
  members,
  onSearchChange,
  onDateChange,
  onMemberChange,
  onSearch,
  onClear,
  searching,
  showMemberSelect = true,
}) {
  return (
    <div className="glass-panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iam-muted" />
          <input
            type="search"
            placeholder="Search name, email, action, or detail…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-10 pr-3 font-inter text-sm text-white placeholder:text-iam-muted focus:border-iam-gold/40 focus:outline-none"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          title="Filter by date"
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-inter text-sm text-white focus:border-iam-gold/40 focus:outline-none"
        />
        {showMemberSelect && (
          <select
            value={memberId}
            onChange={(e) => onMemberChange(e.target.value)}
            className="min-w-[180px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-inter text-sm text-white focus:border-iam-gold/40 focus:outline-none"
          >
            <option value="">All members</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-gold py-2 text-xs" onClick={onSearch} disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2 text-sm">
      <span className="text-iam-muted">{label}</span>
      <span className="max-w-[60%] break-words text-right text-white">{String(value)}</span>
    </div>
  );
}

function resolveMemberId(record, card) {
  return (
    record?.member_id ||
    card?.member_id ||
    record?.approved_member_id ||
    record?.membership_card?.member_id ||
    null
  );
}

function MemberIdHighlight({ memberId, name }) {
  if (!memberId) {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
        <p className="font-inter text-[10px] uppercase tracking-widest text-iam-muted">Member ID</p>
        <p className="mt-1 font-inter text-sm text-iam-muted">Not assigned yet</p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-iam-gold/30 bg-iam-gold/10 px-4 py-4">
      <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">Digital Membership ID</p>
      {name && <p className="mt-2 font-playfair text-lg text-white">{name}</p>}
      <p className="mt-1 font-mono text-base text-iam-gold-light">{memberId}</p>
    </div>
  );
}

function PersonalProfileSection({ personal }) {
  if (!personal || !Object.values(personal).some(Boolean)) return null;
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-gold">Personal Profile</p>
      {Object.entries(personal).map(([key, val]) => (
        <DetailRow
          key={key}
          label={key.replace(/_/g, " ")}
          value={Array.isArray(val) ? val.join(", ") : val}
        />
      ))}
    </div>
  );
}

function AccountStatusBadge({ status }) {
  const suspended = status === "suspended";
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
        suspended ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
      }`}
    >
      {suspended ? "Stopped" : "Active"}
    </span>
  );
}

function EditUserForm({ user, onSaved, onCancel }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {};
      if (name.trim() !== user.name) body.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
      if (Object.keys(body).length === 0) {
        onCancel();
        return;
      }
      await api.patchUser(user.id, body);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-3 rounded-lg border border-iam-gold/20 bg-black/20 p-4">
      <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">Edit User</p>
      <div>
        <label className="mb-1 block font-inter text-xs text-iam-muted">Name</label>
        <input
          className="input-iam w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div>
        <label className="mb-1 block font-inter text-xs text-iam-muted">Email</label>
        <input
          type="email"
          className="input-iam w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-gold py-2 text-xs" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SetPasswordForm({ user, onSaved, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.resetUserPassword(user.id, password);
      setSuccess("New password set. It is not stored for admin viewing.");
      setPassword("");
      setConfirm("");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not set password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-3 rounded-lg border border-iam-gold/20 bg-black/20 p-4">
      <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">Set New Password</p>
      <p className="font-inter text-xs text-iam-muted">
        Assign a new Member Portal sign-in password for {user.name || user.email}. You cannot view this password after
        saving — only the Enroll password (if unchanged) is visible above.
      </p>
      <div>
        <label className="mb-1 block font-inter text-xs text-iam-muted">New Password</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            className="input-iam w-full pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            placeholder="At least 6 characters"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-iam-muted"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password while typing"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1 block font-inter text-xs text-iam-muted">Confirm Password</label>
        <input
          type={showPw ? "text" : "password"}
          className="input-iam w-full"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={6}
          required
        />
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {success && <p className="text-xs text-emerald-300">{success}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-gold py-2 text-xs" disabled={saving}>
          {saving ? "Saving..." : "Set New Password"}
        </button>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MemberPasswordPanel({ user, onReload }) {
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleDelete = async () => {
    const label = user.name || user.email || "this member";
    if (
      !window.confirm(
        `Delete the login password for ${label}? They will not be able to sign in until you set a new password.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await api.deleteUserPassword(user.id);
      setMessage("Password deleted.");
      setShowPassword(false);
      onReload();
    } catch (err) {
      setError(err.message || "Could not delete password");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-iam-gold/20 bg-black/20 p-4">
      <p className="font-inter text-[10px] uppercase tracking-widest text-iam-gold">Member Sign-in Password</p>
      <p className="mt-1 font-inter text-xs text-iam-muted">
        Password chosen at Enroll. Approval does not change it — the member uses this email and password to sign in.
      </p>
      <DetailRow
        label="Password Status"
        value={user.has_password ? "Set — member can sign in after approval" : "Not set — member cannot sign in"}
      />
      {user.has_password && user.login_password ? (
        <div className="mt-2">
          <p className="font-inter text-[10px] uppercase tracking-widest text-iam-muted">Enroll / Sign-in Password</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="rounded bg-black/40 px-2 py-1 font-mono text-sm text-iam-gold-light">
              {showPassword ? user.login_password : "••••••••"}
            </code>
            <button
              type="button"
              className="btn-ghost py-1.5 text-xs"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      ) : user.has_password ? (
        <p className="mt-2 font-inter text-xs text-iam-muted">
          Password is set but not visible to admin (changed via admin reset or member forgot-password).
        </p>
      ) : null}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
      {user.has_password && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 font-inter text-xs uppercase tracking-wider text-red-300 transition hover:bg-red-500/10"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "Deleting…" : "Delete Password"}
        </button>
      )}
    </div>
  );
}

function AccountActions({ user, onReload, onDelete }) {
  const isAdmin = user.role === "admin";
  const isSuspended = user.status === "suspended";
  const [editing, setEditing] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  const handleSuspendToggle = async () => {
    const msg = isSuspended
      ? `Activate account for ${user.name}?`
      : `Stop account for ${user.name}? They will not be able to sign in.`;
    if (!window.confirm(msg)) return;
    await api.patchUser(user.id, { status: isSuspended ? "active" : "suspended" });
    onReload();
  };

  if (isAdmin) return null;

  if (editing) {
    return (
      <EditUserForm
        user={user}
        onSaved={() => {
          setEditing(false);
          onReload();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (settingPassword) {
    return (
      <SetPasswordForm
        user={user}
        onSaved={() => {
          setSettingPassword(false);
          onReload();
        }}
        onCancel={() => setSettingPassword(false)}
      />
    );
  }

  return (
    <>
      <MemberPasswordPanel user={user} onReload={onReload} />
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button type="button" className="btn-ghost py-2 text-xs" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Edit User
        </button>
        <button type="button" className="btn-ghost py-2 text-xs" onClick={() => setSettingPassword(true)}>
          <KeyRound className="h-3.5 w-3.5" /> Set New Password
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-inter text-xs uppercase tracking-wider transition ${
            isSuspended
              ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
          }`}
          onClick={handleSuspendToggle}
        >
          <Ban className="h-3.5 w-3.5" />
          {isSuspended ? "Activate Account" : "Stop Account"}
        </button>
        {onDelete && <DeleteButton label="Move to Recycle Bin" onDelete={onDelete} />}
      </div>
    </>
  );
}

function DeleteButton({ label, onDelete }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 font-inter text-xs uppercase tracking-wider text-red-300 transition hover:bg-red-500/10"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RequestDetails({ item, onAction, onDelete, onReload }) {
  const d = item.details || {};
  if (item.folder === "application") {
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Page" value="/apply" />
        <DetailRow label="First Name" value={d.first_name} />
        <DetailRow label="Last Name" value={d.last_name} />
        <DetailRow label="Email" value={d.email} />
        <DetailRow label="Tracking ID" value={d.tracking_id} />
        <DetailRow label="Mobile" value={d.mobile} />
        <DetailRow label="Country" value={d.country} />
        <DetailRow label="Purpose" value={d.purpose} />
        <DetailRow label="Status" value={d.status} />
        <DetailRow label="Submitted" value={d.created_at} />
        <div className="mt-4 flex flex-wrap gap-2">
          {d.status === "received" && (
            <button className="btn-gold py-2 text-xs" onClick={() => onAction("review-app", item.id)}>
              Mark Reviewed
            </button>
          )}
          <DeleteButton label="Move to Recycle Bin" onDelete={() => onDelete("application", item.id)} />
        </div>
      </div>
    );
  }
  if (item.folder === "registration") {
    const personal = d.enrollment?.data?.personal || {};
    const app = d.application || {};
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Registration Page" value={d.source_page || "/enroll"} />
        <DetailRow label="Name" value={d.name} />
        <DetailRow label="Email" value={d.email} />
        <DetailRow label="Account Status" value={d.status} />
        <DetailRow label="Registered" value={d.created_at} />
        <DetailRow label="Enrollment Complete" value={d.enrollment_complete ? "Yes" : "No"} />
        <DetailRow label="Enrollment Status" value={d.enrollment?.status} />
        {app.tracking_id && <DetailRow label="Application ID" value={app.tracking_id} />}
        {app.country && <DetailRow label="Application Country" value={app.country} />}
        <PersonalProfileSection personal={personal} />
        <MemberPasswordPanel
          user={{
            id: item.id,
            name: d.name,
            email: d.email,
            has_password: d.has_password,
            login_password: d.login_password,
          }}
          onReload={onReload}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {!d.enrollment_complete && d.status !== "rejected" && (
            <>
              <button className="btn-gold py-2 text-xs" onClick={() => onAction("approve-registration", item.id, d.name)}>
                <Check className="h-4 w-4" /> Approve as Member
              </button>
              <button className="btn-ghost py-2 text-xs" onClick={() => onAction("reject-registration", item.id, d.name)}>
                <X className="h-4 w-4" /> Reject
              </button>
            </>
          )}
          <DeleteButton
            label="Move to Recycle Bin"
            onDelete={() => onDelete("registration", item.id)}
          />
        </div>
      </div>
    );
  }
  if (item.folder === "enrollment_edit") {
    const current = d.data || {};
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Member" value={d.user_name} />
        <DetailRow label="Email" value={d.user_email} />
        <DetailRow label="Request Message" value={d.edit_request_message} />
        <DetailRow label="Requested" value={d.edit_request_at} />
        <EnrollmentDetails data={current} enrollmentId={item.id} className="mt-4" />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-gold py-2 text-xs" onClick={() => onAction("approve-edit-request", item.id, d.user_name)}>
            <Check className="h-4 w-4" /> Approve Edit Access
          </button>
          <button className="btn-ghost py-2 text-xs" onClick={() => onAction("reject-edit-request", item.id, d.user_name)}>
            <X className="h-4 w-4" /> Reject Request
          </button>
        </div>
      </div>
    );
  }
  if (item.folder === "account_deletion") {
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Page" value={d.source_page || "/dashboard"} />
        <DetailRow label="Name" value={d.name} />
        <DetailRow label="Email" value={d.email} />
        <DetailRow label="Reason" value={d.message || "—"} />
        <DetailRow label="Requested" value={d.created_at} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-gold py-2 text-xs" onClick={() => onAction("approve-deletion", item.id, d.name)}>
            <Check className="h-4 w-4" /> Approve (1-year hold)
          </button>
          <button className="btn-ghost py-2 text-xs" onClick={() => onAction("reject-deletion", item.id, d.name)}>
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
    );
  }
  if (item.folder === "enrollment_changes") {
    const current = d.data || {};
    const proposed = d.pending_changes || {};
    return (
      <div className="mt-4 space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Member" value={d.user_name} />
        <DetailRow label="Email" value={d.user_email} />
        <DetailRow label="Submitted" value={d.changes_submitted_at} />
        <div>
          <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-muted">Current Profile</p>
          <EnrollmentDetails data={current} enrollmentId={item.id} />
        </div>
        <div>
          <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-gold">Proposed Changes</p>
          <EnrollmentDetails data={proposed} enrollmentId={item.id} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-gold py-2 text-xs" onClick={() => onAction("approve-changes", item.id, d.user_name)}>
            <Check className="h-4 w-4" /> Approve Changes
          </button>
          <button className="btn-ghost py-2 text-xs" onClick={() => onAction("reject-changes", item.id, d.user_name)}>
            <X className="h-4 w-4" /> Reject Changes
          </button>
        </div>
      </div>
    );
  }
  const data = d.data || {};
  const personal = data.personal || {};
  const address = data.address || {};
  return (
    <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
      <DetailRow label="Enrollment Page" value={d.source_page || "/enrollment"} />
      <DetailRow label="User" value={d.user_name} />
      <DetailRow label="Email" value={d.user_email} />
      <DetailRow label="Status" value={d.status} />
      <DetailRow label="Country" value={address.country || personal.nationality} />
      <DetailRow label="Submitted" value={d.submitted_at || d.updated_at} />
      <EnrollmentDetails data={data} enrollmentId={item.id} className="mt-4" />
      <div className="mt-4 flex flex-wrap gap-2">
        {d.status === "pending_review" && (
          <>
            <button className="btn-gold py-2 text-xs" onClick={() => onAction("approve-enrollment", item.id, d.user_name)}>
              <Check className="h-4 w-4" /> Approve as Member
            </button>
            <button className="btn-ghost py-2 text-xs" onClick={() => onAction("reject-enrollment", item.id, d.user_name)}>
              <X className="h-4 w-4" /> Reject
            </button>
          </>
        )}
        <DeleteButton label="Move to Recycle Bin" onDelete={() => onDelete("enrollment", item.id)} />
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="mb-2 mt-5 border-t border-white/10 pt-4 font-inter text-[10px] uppercase tracking-widest text-iam-gold">
      {children}
    </p>
  );
}

function MemberFullDetails({ user, onDelete, onReload }) {
  const enrollmentRecord = user.enrollment || {};
  const enrollment = enrollmentRecord.data || {};
  const personal = enrollment.personal || {};
  const address = enrollment.address || {};
  const card = user.membership_card || {};
  const app = user.application || {};
  const memberId = resolveMemberId(user, card);
  const phone = address.phone || app.mobile;
  const hasEnrollmentData = Object.keys(enrollment).length > 0;
  const hasApplication = Boolean(
    app && (app.email || app.tracking_id || app.first_name || app.last_name || app.mobile),
  );

  return (
    <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
      <MemberIdHighlight memberId={memberId} name={user.name} />

      <SectionTitle>Account</SectionTitle>
      <DetailRow label="Full Name" value={user.name} />
      <DetailRow label="Email" value={user.email} />
      <DetailRow label="Phone Number" value={phone} />
      <DetailRow label="Role" value={user.role} />
      <DetailRow
        label="Account Status"
        value={user.status === "suspended" ? "Stopped" : user.status === "active" ? "Active" : user.status}
      />
      <DetailRow label="Approval" value={user.approval_label} />
      <DetailRow label="Approved On" value={user.approved_at} />
      <DetailRow label="Member ID" value={memberId} />
      <DetailRow label="Registered" value={user.created_at} />
      <DetailRow label="Last Updated" value={user.updated_at} />
      <DetailRow label="Enrollment Complete" value={user.enrollment_complete ? "Yes" : "No"} />
      <DetailRow label="Enrollment Status" value={enrollmentRecord.status} />
      <DetailRow label="Membership Card Issued" value={card.issued_at} />
      <DetailRow label="Membership Card Expires" value={card.expires_at} />
      <DetailRow label="Country" value={address.country || personal.nationality || app.country} />

      {hasApplication && (
        <>
          <SectionTitle>Enroll / Application</SectionTitle>
          <DetailRow label="First Name" value={app.first_name} />
          <DetailRow label="Last Name" value={app.last_name} />
          <DetailRow label="Application Email" value={app.email} />
          <DetailRow label="Mobile" value={app.mobile} />
          <DetailRow label="Country" value={app.country} />
          <DetailRow label="Purpose" value={app.purpose} />
          <DetailRow label="Tracking ID" value={app.tracking_id} />
          <DetailRow label="Application Status" value={app.status} />
          <DetailRow label="Submitted" value={app.created_at} />
        </>
      )}

      {hasEnrollmentData ? (
        <>
          <SectionTitle>Full Enrollment — All Details Given</SectionTitle>
          <DetailRow label="Enrollment Submitted" value={enrollmentRecord.submitted_at} />
          <DetailRow label="Enrollment Approved" value={enrollmentRecord.approved_at} />
          <EnrollmentDetails data={enrollment} enrollmentId={enrollmentRecord.id} className="mt-2" />
        </>
      ) : (
        <>
          <SectionTitle>Enrollment</SectionTitle>
          <p className="font-inter text-sm text-iam-muted">No enrollment profile submitted yet.</p>
        </>
      )}

      <MemberPasswordPanel user={user} onReload={onReload} />
      <AccountActions user={user} onReload={onReload} onDelete={onDelete} />
    </div>
  );
}

function MemberDetails({ member, onDelete, onReload }) {
  return <MemberFullDetails user={member} onDelete={onDelete} onReload={onReload} />;
}

function UserDetails({ user, onDelete, onReload }) {
  return (
    <MemberFullDetails
      user={user}
      onDelete={user.role === "member" ? onDelete : null}
      onReload={onReload}
    />
  );
}

function RecycleBinDetails({ item }) {
  const snap = item.snapshot || {};

  if (item.item_type === "user") {
    const user = snap.user || {};
    const enrollment = snap.enrollment || {};
    const personal = enrollment.data?.personal || {};
    const app = (snap.applications || [])[0] || {};
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Name" value={user.name || item.title} />
        <DetailRow label="Email" value={user.email || item.email} />
        <DetailRow label="Role" value={user.role} />
        <DetailRow label="Member ID" value={user.member_id} />
        <DetailRow label="Account Status" value={user.status} />
        <DetailRow label="Enrollment Complete" value={user.enrollment_complete ? "Yes" : "No"} />
        <DetailRow label="Registered" value={user.created_at} />
        <DetailRow label="Country" value={personal.nationality || app.country} />
        <DetailRow label="Mobile" value={personal.mobile || app.mobile} />
        <PersonalProfileSection personal={personal} />
      </div>
    );
  }

  if (item.item_type === "application") {
    const app = snap.application || {};
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="First Name" value={app.first_name} />
        <DetailRow label="Last Name" value={app.last_name} />
        <DetailRow label="Email" value={app.email} />
        <DetailRow label="Mobile" value={app.mobile} />
        <DetailRow label="Country" value={app.country} />
        <DetailRow label="Purpose" value={app.purpose} />
        <DetailRow label="Tracking ID" value={app.tracking_id} />
        <DetailRow label="Status" value={app.status} />
        <DetailRow label="Submitted" value={app.created_at} />
      </div>
    );
  }

  if (item.item_type === "enrollment") {
    const enrollment = snap.enrollment || {};
    const personal = enrollment.data?.personal || {};
    const address = enrollment.data?.address || {};
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Status" value={enrollment.status} />
        <DetailRow label="Country" value={address.country || personal.nationality} />
        <DetailRow label="Submitted" value={enrollment.submitted_at || enrollment.updated_at} />
        <PersonalProfileSection personal={personal} />
      </div>
    );
  }

  if (item.item_type === "help") {
    const help = snap.help || {};
    return (
      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Name" value={help.name} />
        <DetailRow label="Email" value={help.email} />
        <DetailRow label="Phone" value={help.phone} />
        <DetailRow label="Country" value={help.country} />
        <DetailRow label="Type" value={helpTypeLabel(help.help_type)} />
        <DetailRow label="Message" value={help.message} />
        <DetailRow label="Submitted" value={help.created_at} />
      </div>
    );
  }

  return null;
}

function RecycleBinList({ items, expanded, setExpanded, onRestore, onPurge }) {
  if (items.length === 0) {
    return <p className="font-inter text-sm text-iam-muted">Recycle Bin is empty.</p>;
  }
  return items.map((item) => (
    <div key={item.id} className="glass-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
      >
        <Recycle className="h-5 w-5 shrink-0 text-iam-gold" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">{item.title}</p>
          <p className="text-sm text-iam-muted">{item.email || "No email"}</p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">
          {item.item_label || item.item_type}
        </span>
        <span className="text-[10px] text-iam-muted">{formatActivityDate(item.deleted_at)}</span>
        <ChevronRight
          className={`h-4 w-4 text-iam-muted transition ${expanded === item.id ? "rotate-90" : ""}`}
        />
      </button>
      {expanded === item.id && (
        <div className="border-t border-white/10 px-4 pb-4">
          <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
            <DetailRow label="Type" value={item.item_label || item.item_type} />
            <DetailRow label="Deleted At" value={item.deleted_at} />
          </div>
          <RecycleBinDetails item={item} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-gold py-2 text-xs" onClick={() => onRestore(item.id)}>
              <RotateCcw className="h-3.5 w-3.5" /> Restore
            </button>
            <DeleteButton label="Delete Forever" onDelete={() => onPurge(item.id)} />
          </div>
        </div>
      )}
    </div>
  ));
}

function deletedAccountContact(item) {
  const snap = item.snapshot || {};
  const user = snap.user || {};
  const data = snap.enrollment?.data || {};
  const personal = data.personal || {};
  const address = data.address || {};
  const church = data.church || {};
  const app = (snap.applications || [])[0] || {};
  const parts = [address.street, address.city, address.district || address.state, address.country, address.postal_code].filter(Boolean);
  return {
    phone: item.phone || personal.mobile || personal.phone || app.mobile || data.emergency?.mobile || null,
    email: item.email || user.email || app.email || null,
    churchName: item.church_name || church.church_name || null,
    address: item.address || (parts.length ? parts.join(", ") : null),
  };
}

function DeletedAccountDetails({ item, onRestore, onPurge, onGenerateReport, generatingReport }) {
  const snap = item.snapshot || {};
  const user = snap.user || {};
  const enrollmentData = snap.enrollment?.data || null;
  const apps = snap.applications || [];
  const contact = deletedAccountContact(item);
  const stageLabel =
    item.stage === "held"
      ? "On hold (1 year)"
      : item.stage === "purged"
        ? "Permanently deleted"
        : item.stage === "restored"
          ? "Restored"
          : item.stage || "Unknown";

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
        <DetailRow label="Status" value={stageLabel} />
        <DetailRow label="Name" value={item.name || user.name} />
        <DetailRow label="Email" value={contact.email} />
        <DetailRow label="Phone number" value={contact.phone} />
        <DetailRow label="Church name" value={contact.churchName} />
        <DetailRow label="Address" value={contact.address} />
        <DetailRow label="Member ID" value={item.member_id || user.member_id || "—"} />
        <DetailRow label="Enrollment" value={item.enrollment_complete ? "Complete" : "Incomplete"} />
        <DetailRow label="Enrollment Status" value={item.enrollment_status || snap.enrollment?.status || "—"} />
        <DetailRow label="Applications on file" value={item.applications_count ?? apps.length} />
        <DetailRow label="Approved for deletion" value={item.approved_at} />
        <DetailRow label="Auto-delete on" value={item.purge_at} />
        {item.stage === "held" && <DetailRow label="Days remaining" value={item.days_remaining} />}
        {item.purged_at && <DetailRow label="Purged on" value={item.purged_at} />}
        {item.restored_at && <DetailRow label="Restored on" value={item.restored_at} />}
        {item.reactivation_requested && (
          <DetailRow label="Re-applied with same email" value={item.reactivation_at || "Yes"} />
        )}
      </div>

      {enrollmentData && (
        <div>
          <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-gold">Enrollment snapshot</p>
          <EnrollmentDetails data={enrollmentData} className="rounded-lg border border-white/10 bg-black/20 p-4" />
        </div>
      )}

      {apps.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="mb-2 font-inter text-[10px] uppercase tracking-widest text-iam-muted">Applications</p>
          {apps.map((app) => (
            <div key={app.id} className="mb-3 border-b border-white/5 pb-3 last:mb-0 last:border-0 last:pb-0">
              <DetailRow label="Name" value={`${app.first_name || ""} ${app.last_name || ""}`.trim()} />
              <DetailRow label="Email" value={app.email} />
              <DetailRow label="Phone" value={app.mobile} />
              <DetailRow label="Country" value={app.country} />
              <DetailRow label="Tracking ID" value={app.tracking_id} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {item.stage === "held" && (
          <button type="button" className="btn-gold py-2 text-xs" onClick={() => onRestore(item.id, item.name)}>
            <RotateCcw className="h-3.5 w-3.5" /> Restore Account
          </button>
        )}
        <button
          type="button"
          className="btn-gold py-2 text-xs"
          disabled={generatingReport}
          onClick={() => onGenerateReport(item.id)}
        >
          <FileBarChart className="h-3.5 w-3.5" /> {generatingReport ? "Generating…" : "Generate PDF Report"}
        </button>
        {item.report_id && (
          <button
            type="button"
            className="btn-ghost py-2 text-xs"
            onClick={() => api.downloadDeletionReport(item.report_id).catch(() => {})}
          >
            <FileBarChart className="h-3.5 w-3.5" /> Download PDF Report
          </button>
        )}
        {item.stage === "held" && onPurge && (
          <DeleteButton
            label="Delete Permanently"
            onDelete={() => onPurge(item.id, item.name || contact.email)}
          />
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [helps, setHelps] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [restoreRequests, setRestoreRequests] = useState([]);
  const [deletedAccounts, setDeletedAccounts] = useState([]);
  const [deletionReports, setDeletionReports] = useState([]);
  const [memberActivity, setMemberActivity] = useState([]);
  const [securityAudit, setSecurityAudit] = useState([]);
  const [tab, setTab] = useState("overview");
  const [expanded, setExpanded] = useState(null);
  const [requestFilter, setRequestFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [deletedStageFilter, setDeletedStageFilter] = useState("all");
  const [generatingReportId, setGeneratingReportId] = useState(null);
  const [activitySubTab, setActivitySubTab] = useState("activity");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityMemberId, setActivityMemberId] = useState("");
  const [activitySearching, setActivitySearching] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [recycleSearch, setRecycleSearch] = useState("");
  const [recycleDate, setRecycleDate] = useState("");
  const [recycleSearching, setRecycleSearching] = useState(false);
  const [securitySearch, setSecuritySearch] = useState("");
  const [securityDate, setSecurityDate] = useState("");
  const [securitySearching, setSecuritySearching] = useState(false);

  const buildFilterParams = (search, date, userId) => {
    const params = {};
    if (search.trim()) params.q = search.trim();
    if (date) params.date = date;
    if (userId) params.user_id = userId;
    return params;
  };

  const loadMemberActivity = (overrides = {}) => {
    const params = buildFilterParams(
      overrides.q ?? activitySearch,
      overrides.date ?? activityDate,
      overrides.user_id ?? activityMemberId
    );
    setActivitySearching(true);
    return api
      .adminMemberActivity(params)
      .then(setMemberActivity)
      .catch(() => setMemberActivity([]))
      .finally(() => setActivitySearching(false));
  };

  const loadRecycleBinFiltered = (overrides = {}) => {
    const params = buildFilterParams(overrides.q ?? recycleSearch, overrides.date ?? recycleDate);
    setRecycleSearching(true);
    return api
      .adminRecycleBin(params)
      .then(setRecycleBin)
      .catch(() => setRecycleBin([]))
      .finally(() => setRecycleSearching(false));
  };

  const loadSecurityAuditFiltered = (overrides = {}) => {
    const params = buildFilterParams(overrides.q ?? securitySearch, overrides.date ?? securityDate);
    setSecuritySearching(true);
    return api
      .adminSecurityAudit(params)
      .then(setSecurityAudit)
      .catch(() => setSecurityAudit([]))
      .finally(() => setSecuritySearching(false));
  };

  const loadDeletedAccounts = (stage = deletedStageFilter) => {
    api.adminDeletedAccounts(stage).then(setDeletedAccounts).catch(() => setDeletedAccounts([]));
  };

  const load = () => {
    api.adminStats().then(setStats);
    api.adminUsers().then(setUsers);
    api.adminRequests().then(setRequests);
    api.adminMembers().then(setMembers);
    api.adminHelps().then(setHelps);
    api.adminRecycleBin().then(setRecycleBin).catch(() => setRecycleBin([]));
    api.adminDeletionRequests().then(setDeletionRequests).catch(() => setDeletionRequests([]));
    api.adminRestoreRequests().then(setRestoreRequests).catch(() => setRestoreRequests([]));
    api.adminDeletedAccounts(deletedStageFilter).then(setDeletedAccounts).catch(() => setDeletedAccounts([]));
    api.adminDeletionReports().then(setDeletionReports).catch(() => setDeletionReports([]));
    loadMemberActivity({ q: "", date: "", user_id: "" });
    loadSecurityAuditFiltered({ q: "", date: "" });
  };

  useEffect(load, []);

  useEffect(() => {
    if (tab === "deletion-requests") {
      api.adminDeletionRequests().then(setDeletionRequests).catch(() => setDeletionRequests([]));
    }
    if (tab === "restore-requests") {
      api.adminRestoreRequests().then(setRestoreRequests).catch(() => setRestoreRequests([]));
    }
    if (tab === "deleted-accounts") {
      loadDeletedAccounts(deletedStageFilter);
      api.adminDeletionReports().then(setDeletionReports).catch(() => setDeletionReports([]));
    }
    if (tab === "member-activity" || tab === "recycle") {
      if (tab === "recycle" || activitySubTab === "recycle") {
        loadRecycleBinFiltered();
      }
      if (tab === "member-activity" && activitySubTab === "activity") {
        loadMemberActivity();
      }
    }
    if (tab === "security") {
      loadSecurityAuditFiltered();
    }
  }, [tab, activitySubTab, deletedStageFilter]);

  const handleGenerateDeletedReport = async (id) => {
    setGeneratingReportId(id);
    try {
      const report = await api.generateDeletedAccountReport(id);
      window.alert("PDF report generated. Download it below or from My Reports.");
      loadDeletedAccounts(deletedStageFilter);
      api.adminDeletionReports().then(setDeletionReports).catch(() => setDeletionReports([]));
      if (report?.id) {
        await api.downloadDeletionReport(report.id);
      }
    } catch (err) {
      window.alert(err.message || "Could not generate report");
    } finally {
      setGeneratingReportId(null);
    }
  };
  const handleRequestAction = async (action, id, name) => {
    if (action === "review-app") await api.patchApplication(id, { status: "reviewed" });
    if (action === "approve-registration") {
      const result = await api.approveRegistration(id);
      window.alert(`${name || "Member"} approved — they can now sign in and use the Member Portal.${result.member_id ? ` ID: ${result.member_id}` : ""}`);
    }
    if (action === "reject-registration") {
      await api.rejectRegistration(id, "Registration rejected by administrator");
      window.alert(`${name || "Member"} rejected — they cannot sign in or access the Member Portal.`);
    }
    if (action === "approve-enrollment") {
      const result = await api.approveEnrollment(id);
      window.alert(`${name || "Member"} approved — now a user and member.${result.member_id ? ` ID: ${result.member_id}` : ""}`);
    }
    if (action === "reject-enrollment") await api.rejectEnrollment(id, "Incomplete");
    if (action === "approve-edit-request") {
      await api.approveEditRequest(id);
      window.alert(`${name || "Member"} can now edit their profile.`);
    }
    if (action === "reject-edit-request") {
      const reason = window.prompt("Reason for rejecting edit request (optional):") || "Edit request denied";
      await api.rejectEditRequest(id, reason);
    }
    if (action === "approve-changes") {
      await api.approveProfileChanges(id);
      window.alert(`${name || "Member"} profile changes approved.`);
    }
    if (action === "reject-changes") {
      const reason = window.prompt("Reason for rejecting changes (optional):") || "Changes not approved";
      await api.rejectProfileChanges(id, reason);
    }
    if (action === "approve-deletion") {
      if (
        !window.confirm(
          `Approve deletion for ${name}? Account enters a 1-year hold before permanent removal and PDF report.`
        )
      )
        return;
      await api.approveDeletionRequest(id);
      window.alert(`${name || "Member"} moved to Deleted Accounts (1-year hold).`);
    }
    if (action === "reject-deletion") {
      const reason = window.prompt(`Reason for rejecting deletion request for ${name} (optional):`) || "";
      await api.rejectDeletionRequest(id, reason);
    }
    setExpanded(null);
    load();
  };

  const confirmApprove = (name) =>
    window.confirm(`Approve ${name} as a full member? They will get a Member ID and digital card.`);

  const handleQuickApprove = (e, item) => {
    e.stopPropagation();
    if (!confirmApprove(item.title || item.email)) return;
    const action = item.folder === "registration" ? "approve-registration" : "approve-enrollment";
    handleRequestAction(action, item.id, item.title);
  };

  const handleQuickReject = (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Reject ${item.title || item.email}? They will not be able to sign in.`)) return;
    handleRequestAction("reject-registration", item.id, item.title);
  };

  const confirmDelete = (message) => window.confirm(message);

  const handleDeleteRequest = async (folder, id) => {
    const labels = {
      application: "Move this application to the Recycle Bin?",
      registration: "Move this registration and member account to the Recycle Bin?",
      enrollment: "Move this enrollment record to the Recycle Bin?",
      enrollment_edit: "This is an edit request on an approved member — use Approve/Reject instead.",
      enrollment_changes: "This is a profile change review — use Approve/Reject instead.",
    };
    if (folder === "enrollment_edit" || folder === "enrollment_changes") return;
    if (!confirmDelete(labels[folder] || "Move to Recycle Bin?")) return;
    await runDeleteAction(async () => {
      if (folder === "application") await api.deleteApplication(id);
      if (folder === "registration") await api.deleteMember(id);
      if (folder === "enrollment") await api.deleteEnrollment(id);
      setExpanded(null);
      load();
    }, navigate);
  };

  const handleDeleteMember = async (id) => {
    if (!confirmDelete("Move this user to the Recycle Bin? You can restore them later.")) return;
    await runDeleteAction(async () => {
      await api.deleteMember(id);
      setExpanded(null);
      load();
    }, navigate);
  };

  const handleDeleteHelp = async (id) => {
    if (!confirmDelete("Move this help submission to the Recycle Bin?")) return;
    await runDeleteAction(async () => {
      await api.deleteHelp(id);
      setExpanded(null);
      load();
    }, navigate);
  };

  const handleRestoreRecycle = async (id) => {
    if (!window.confirm("Restore this item?")) return;
    await api.restoreRecycleItem(id);
    setExpanded(null);
    load();
    if (tab === "member-activity" || tab === "recycle") {
      loadRecycleBinFiltered();
    }
  };

  const handlePurgeRecycle = async (id) => {
    if (!window.confirm("Permanently delete this item? This cannot be undone.")) return;
    await runDeleteAction(async () => {
      await api.purgeRecycleItem(id);
      setExpanded(null);
      load();
      if (tab === "member-activity" || tab === "recycle") {
        loadRecycleBinFiltered();
      }
    }, navigate);
  };

  const handleAddActivityNote = async () => {
    if (!activityMemberId) {
      window.alert("Select a member first.");
      return;
    }
    const detail = adminNote.trim();
    if (!detail) return;
    setAddingNote(true);
    try {
      await api.addMemberActivityNote(activityMemberId, detail);
      setAdminNote("");
      await loadMemberActivity();
      window.alert("Administrator note added to member activity.");
    } catch (err) {
      window.alert(err.message || "Could not add note");
    } finally {
      setAddingNote(false);
    }
  };

  const clearActivityFilters = () => {
    setActivitySearch("");
    setActivityDate("");
    setActivityMemberId("");
    loadMemberActivity({ q: "", date: "", user_id: "" });
  };

  const clearRecycleFilters = () => {
    setRecycleSearch("");
    setRecycleDate("");
    loadRecycleBinFiltered({ q: "", date: "" });
  };

  const clearSecurityFilters = () => {
    setSecuritySearch("");
    setSecurityDate("");
    loadSecurityAuditFiltered({ q: "", date: "" });
  };

  const activeActivityView = tab === "recycle" ? "recycle" : activitySubTab;

  const handleApproveDeletion = async (id, name) => {
    if (
      !window.confirm(
        `Approve deletion for ${name}? Account enters a 1-year hold before permanent removal and PDF report.`
      )
    )
      return;
    await api.approveDeletionRequest(id);
    window.alert(`${name || "Member"} moved to Deleted Accounts (1-year hold).`);
    setExpanded(null);
    load();
  };

  const handleRejectDeletion = async (id, name) => {
    const reason = window.prompt(`Reason for rejecting deletion request for ${name} (optional):`) || "";
    await api.rejectDeletionRequest(id, reason);
    setExpanded(null);
    load();
  };

  const handleApproveRestore = async (id, name) => {
    if (!window.confirm(`Restore account for ${name}? They can sign in again.`)) return;
    await api.approveRestoreRequest(id);
    window.alert(`${name || "Member"} account restored.`);
    setExpanded(null);
    load();
  };

  const handleRejectRestore = async (id, name) => {
    if (!window.confirm(`Reject restore request for ${name}?`)) return;
    await api.rejectRestoreRequest(id);
    setExpanded(null);
    load();
  };

  const handleRestoreDeleted = async (id, name) => {
    if (!window.confirm(`Restore account for ${name}? They can sign in again.`)) return;
    await api.restoreDeletedAccount(id);
    window.alert(`${name || "Member"} account restored.`);
    setExpanded(null);
    load();
  };

  const handlePurgeDeleted = async (id, name) => {
    if (
      !window.confirm(
        `Permanently delete ${name}? This removes the member account now, generates a PDF report, and cannot be undone.`
      )
    )
      return;
    await runDeleteAction(async () => {
      await api.purgeDeletedAccount(id);
      window.alert(`${name || "Member"} permanently deleted. PDF report saved to My Reports.`);
      setExpanded(null);
      loadDeletedAccounts(deletedStageFilter);
      api.adminDeletionReports().then(setDeletionReports).catch(() => setDeletionReports([]));
      load();
    }, navigate);
  };

  const itemKey = (item) => `${item.folder}-${item.id}`;

  const filteredRequests =
    requestFilter === "all" ? requests : requests.filter((r) => r.folder === requestFilter);

  const filteredMembers = members.filter((m) => {
    if (memberFilter === "approved") return m.approval_status === "approved" || m.enrollment_complete;
    if (memberFilter === "pending") return m.approval_status !== "approved" && !m.enrollment_complete;
    return true;
  });

  const overviewCards = stats
    ? [
        {
          icon: FolderOpen,
          label: "New Requests",
          val:
            (stats.pending_applications || 0) +
            (stats.pending_enrollments || 0) +
            (stats.pending_registrations || 0) +
            (stats.pending_edit_requests || 0) +
            (stats.pending_profile_changes || 0) +
            (stats.pending_deletion_requests || 0),
          tab: "requests",
          filter: "registration",
        },
        { icon: Users, label: "All Members", val: stats.total_members, tab: "members", filter: "all" },
        { icon: HandHeart, label: "Our Support", val: stats.pending_helps || stats.total_helps || 0, tab: "our-support" },
        { icon: BookOpen, label: "About Us", val: "Guide", tab: "about-us" },
        { icon: UserCircle, label: "Approved Users", val: stats.total_users, tab: "users" },
        { icon: FileText, label: "Applications", val: stats.total_applications, tab: "requests", filter: "application" },
        { icon: Globe, label: "Countries", val: stats.geographic_distribution?.length || 0, tab: "countries" },
        {
          icon: UserX,
          label: "Member Deleted Request",
          val: stats.pending_deletion_requests || 0,
          tab: "deletion-requests",
        },
        {
          icon: Inbox,
          label: "Account Restore Request",
          val: stats.pending_restore_requests || 0,
          tab: "restore-requests",
        },
        {
          icon: Ban,
          label: "Deleted Accounts",
          val: stats.deleted_accounts_held || 0,
          tab: "deleted-accounts",
        },
        {
          icon: FileBarChart,
          label: "My Reports",
          val: stats.deletion_reports_count || 0,
          tab: "my-reports",
        },
        { icon: Recycle, label: "Recycle Bin", val: stats.recycle_bin_count || 0, tab: "recycle" },
      ]
    : [];

  const openOverviewCard = (cardTab, filter) => {
    setTab(cardTab);
    setExpanded(null);
    if (cardTab === "recycle") setActivitySubTab("recycle");
    if (cardTab === "member-activity") setActivitySubTab("activity");
    if (filter) setRequestFilter(filter);
    if (cardTab === "members" && filter) setMemberFilter(filter);
  };

  const tabTitle =
    tab === "countries"
      ? "Countries"
      : NAV.find((n) => n.id === tab)?.label || tab;

  const countryApplications = (country) =>
    requests.filter((r) => r.folder === "application" && r.details?.country === country);

  const countryMembers = (country) =>
    members.filter((m) => {
      const personal = m.enrollment?.data?.personal || {};
      const address = m.enrollment?.data?.address || {};
      return (
        m.application?.country === country ||
        address.country === country ||
        personal.nationality === country
      );
    });

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-iam-bg/80 p-6 backdrop-blur-md">
        <h1 className="font-cinzel text-sm uppercase tracking-widest text-iam-gold-light">IAM Admin</h1>
        <p className="mt-1 font-inter text-[10px] text-iam-muted">Control Center</p>

        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <div key={id}>
              {id === "deletion-requests" && (
                <p className="mb-2 mt-3 px-4 font-inter text-[10px] uppercase tracking-widest text-iam-muted/80">
                  Deleted accounts
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setTab(id);
                  setExpanded(null);
                  if (id === "recycle") setActivitySubTab("recycle");
                  if (id === "member-activity") setActivitySubTab("activity");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left font-inter text-sm leading-snug transition ${
                  tab === id || (id === "member-activity" && tab === "recycle")
                    ? "bg-iam-gold/20 text-iam-gold-light"
                    : "text-iam-muted hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{label}</span>
              {id === "requests" && stats?.pending_applications > 0 && (
                <span className="ml-auto rounded-full bg-iam-gold/30 px-2 text-[10px] text-iam-gold">
                  {(stats.pending_applications || 0) + (stats.pending_enrollments || 0) + (stats.pending_registrations || 0)}
                </span>
              )}
              {id === "our-support" && stats?.pending_helps > 0 && (
                <span className="ml-auto rounded-full bg-iam-gold/30 px-2 text-[10px] text-iam-gold">
                  {stats.pending_helps}
                </span>
              )}
              {id === "our-support" && stats?.pending_helps === 0 && stats?.total_helps > 0 && (
                <span className="ml-auto rounded-full bg-white/10 px-2 text-[10px] text-white/70">
                  {stats.total_helps}
                </span>
              )}
              {id === "recycle" && stats?.recycle_bin_count > 0 && (
                <span className="ml-auto rounded-full bg-red-500/20 px-2 text-[10px] text-red-300">
                  {stats.recycle_bin_count}
                </span>
              )}
              {id === "deletion-requests" && stats?.pending_deletion_requests > 0 && (
                <span className="ml-auto rounded-full bg-red-500/20 px-2 text-[10px] text-red-300">
                  {stats.pending_deletion_requests}
                </span>
              )}
              {id === "restore-requests" && stats?.pending_restore_requests > 0 && (
                <span className="ml-auto rounded-full bg-iam-gold/30 px-2 text-[10px] text-iam-gold">
                  {stats.pending_restore_requests}
                </span>
              )}
              {id === "deleted-accounts" && stats?.reactivation_requests > 0 && (
                <span className="ml-auto rounded-full bg-iam-gold/30 px-2 text-[10px] text-iam-gold">
                  {stats.reactivation_requests}
                </span>
              )}
              </button>
            </div>
          ))}
        </nav>

        <button type="button" onClick={() => logout()} className="btn-ghost mt-6 w-full text-xs">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-playfair text-2xl capitalize text-white">{tabTitle}</h2>
          <span className="text-sm text-iam-muted">{user?.name}</span>
        </div>

        {tab === "overview" && stats && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {overviewCards.map(({ icon: Icon, label, val, tab: cardTab, filter }) => (
              <motion.button
                key={label}
                type="button"
                disabled={!cardTab}
                onClick={() => cardTab && openOverviewCard(cardTab, filter)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-panel p-6 text-left transition ${cardTab ? "hover:border-iam-gold/40 cursor-pointer" : "cursor-default"}`}
              >
                <Icon className="mb-3 h-6 w-6 text-iam-gold" />
                <p className="font-inter text-xs uppercase tracking-wider text-iam-muted">{label}</p>
                <p className="mt-1 font-cinzel text-3xl text-white">{val}</p>
                {cardTab && <p className="mt-2 font-inter text-[10px] text-iam-gold/80">Click to view full details</p>}
              </motion.button>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              Members you have approved. Expand any member to see full account, enrollment, and sign-in details. The
              administrator account is not listed here.
            </p>
            {users.length === 0 && <p className="font-inter text-sm text-iam-muted">No approved users yet.</p>}
            {users.map((u) => {
              const memberId = resolveMemberId(u, u.membership_card);
              const phone = u.enrollment?.data?.address?.phone || u.application?.mobile;
              return (
              <div key={u.id} className="glass-panel overflow-hidden">
                <button
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
                  onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                >
                  <UserCircle className="h-5 w-5 shrink-0 text-iam-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{u.name}</p>
                    <p className="text-sm text-iam-muted">{u.email}</p>
                    {phone && <p className="text-sm text-iam-muted">{phone}</p>}
                    {memberId && (
                      <p className="mt-1 font-mono text-xs text-iam-gold-light">{memberId}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] capitalize text-white/70">{u.role}</span>
                  <AccountStatusBadge status={u.status} />
                  <ApprovalBadge label={u.approval_label} />
                  <ChevronRight className={`h-4 w-4 text-iam-muted transition ${expanded === u.id ? "rotate-90" : ""}`} />
                </button>
                {expanded === u.id && (
                  <div className="border-t border-white/10 px-4 pb-4">
                    <UserDetails
                      user={u}
                      onDelete={() => handleDeleteMember(u.id)}
                      onReload={load}
                    />
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}

        {tab === "requests" && (
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {[
                { id: "all", label: "All" },
                { id: "application", label: "Applications" },
                { id: "registration", label: "New Registrations", count: stats?.pending_registrations },
                { id: "enrollment", label: "Enrollments", count: stats?.pending_enrollments },
                { id: "enrollment_edit", label: "Edit Requests", count: stats?.pending_edit_requests },
                { id: "enrollment_changes", label: "Profile Changes", count: stats?.pending_profile_changes },
                { id: "account_deletion", label: "Delete Requests", count: stats?.pending_deletion_requests },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRequestFilter(f.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-inter text-xs uppercase tracking-wider transition ${
                    requestFilter === f.id ? "bg-iam-gold/25 text-iam-gold-light" : "bg-white/5 text-iam-muted hover:text-white"
                  }`}
                >
                  {f.label}
                  {f.count > 0 && (
                    <span className="rounded-full bg-iam-gold/30 px-1.5 text-[10px] text-iam-gold">{f.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredRequests.length === 0 && (
                <p className="font-inter text-sm text-iam-muted">No requests in this folder.</p>
              )}
              {filteredRequests.map((item) => {
                const canApproveRegistration =
                  item.folder === "registration" && !item.details?.enrollment_complete && item.details?.status !== "rejected";
                const canRejectRegistration =
                  item.folder === "registration" && !item.details?.enrollment_complete && item.details?.status !== "rejected";
                const canApproveEnrollment =
                  item.folder === "enrollment" && item.status === "pending_review";
                const canApproveDeletion = item.folder === "account_deletion";

                return (
                <div key={`${item.folder}-${item.id}`} className="glass-panel overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-4 text-left transition hover:opacity-90"
                      onClick={() => setExpanded(expanded === itemKey(item) ? null : itemKey(item))}
                    >
                      <FolderOpen className="h-5 w-5 shrink-0 text-iam-gold" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="flex items-center gap-2 text-sm text-iam-muted">
                          <Mail className="h-3 w-3" /> {item.email}
                        </p>
                      </div>
                      <span className="rounded-full bg-iam-gold/15 px-2 py-1 text-[10px] uppercase text-iam-gold">
                        {FOLDER_LABELS[item.folder]}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">{item.status}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-iam-muted transition ${expanded === itemKey(item) ? "rotate-90" : ""}`} />
                    </button>
                    {(canApproveRegistration || canApproveEnrollment || canApproveDeletion) && (
                      <button
                        type="button"
                        className="btn-gold shrink-0 py-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canApproveDeletion) {
                            handleRequestAction("approve-deletion", item.id, item.title);
                            return;
                          }
                          handleQuickApprove(e, item);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {canRejectRegistration && (
                      <button
                        type="button"
                        className="btn-ghost shrink-0 border border-red-500/30 py-2 text-xs text-red-300"
                        onClick={(e) => handleQuickReject(e, item)}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    )}
                  </div>
                  {expanded === itemKey(item) && (
                    <div className="border-t border-white/10 px-4 pb-4">
                      <RequestDetails item={item} onAction={handleRequestAction} onDelete={handleDeleteRequest} onReload={load} />
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        )}

        {tab === "members" && (
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Members" },
                { id: "approved", label: "Approved" },
                { id: "pending", label: "Not Approved" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMemberFilter(f.id)}
                  className={`rounded-full px-4 py-1.5 font-inter text-xs uppercase tracking-wider transition ${
                    memberFilter === f.id ? "bg-iam-gold/25 text-iam-gold-light" : "bg-white/5 text-iam-muted hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
            {filteredMembers.length === 0 && <p className="font-inter text-sm text-iam-muted">No members in this list.</p>}
            {filteredMembers.map((member) => {
              const memberId = resolveMemberId(member, member.membership_card);
              const phone = member.enrollment?.data?.address?.phone || member.application?.mobile;
              return (
              <div key={member.id} className="glass-panel overflow-hidden">
                <button
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
                  onClick={() => setExpanded(expanded === member.id ? null : member.id)}
                >
                  <Users className="h-5 w-5 shrink-0 text-iam-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{member.name}</p>
                    <p className="text-sm text-iam-muted">{member.email}</p>
                    {phone && <p className="text-sm text-iam-muted">{phone}</p>}
                    {memberId && (
                      <p className="mt-1 font-mono text-xs text-iam-gold-light">{memberId}</p>
                    )}
                  </div>
                  <ApprovalBadge label={member.approval_label || (member.enrollment_complete ? "User & Member" : "In Progress")} />
                  <AccountStatusBadge status={member.status} />
                  <ChevronRight className={`h-4 w-4 text-iam-muted transition ${expanded === member.id ? "rotate-90" : ""}`} />
                </button>
                {expanded === member.id && (
                  <div className="border-t border-white/10 px-4 pb-4">
                    <MemberDetails member={member} onDelete={() => handleDeleteMember(member.id)} onReload={load} />
                  </div>
                )}
              </div>
            );
            })}
            </div>
          </div>
        )}

        {tab === "our-support" && (
          <SupportOurMissionPanel
            helps={helps}
            expanded={expanded}
            setExpanded={setExpanded}
            onUpdate={(id, body) => api.patchHelp(id, body).then(load)}
            onDelete={handleDeleteHelp}
          />
        )}

        {tab === "about-us" && <AboutUsTab />}

        {tab === "countries" && stats && (
          <div className="space-y-3">
            {(stats.geographic_distribution || []).length === 0 && (
              <p className="font-inter text-sm text-iam-muted">No country data yet.</p>
            )}
            {(stats.geographic_distribution || []).map(({ country, count }) => (
              <div key={country} className="glass-panel overflow-hidden">
                <button
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
                  onClick={() => setExpanded(expanded === country ? null : country)}
                >
                  <Globe className="h-5 w-5 shrink-0 text-iam-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{country}</p>
                    <p className="text-sm text-iam-muted">{count} application{count === 1 ? "" : "s"}</p>
                  </div>
                  <span className="rounded-full bg-iam-gold/15 px-2 py-1 text-[10px] text-iam-gold">
                    {countryMembers(country).length} member{countryMembers(country).length === 1 ? "" : "s"}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-iam-muted transition ${expanded === country ? "rotate-90" : ""}`} />
                </button>
                {expanded === country && (
                  <div className="border-t border-white/10 px-4 pb-4">
                    <p className="mt-4 font-inter text-[10px] uppercase tracking-widest text-iam-gold">Applications</p>
                    {countryApplications(country).length === 0 ? (
                      <p className="py-2 text-sm text-iam-muted">No applications from this country.</p>
                    ) : (
                      countryApplications(country).map((item) => (
                        <div key={item.id} className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
                          <DetailRow label="Name" value={item.title} />
                          <DetailRow label="Email" value={item.email} />
                          <DetailRow label="Mobile" value={item.details?.mobile} />
                          <DetailRow label="Purpose" value={item.details?.purpose} />
                          <DetailRow label="Status" value={item.status} />
                          <DetailRow label="Tracking ID" value={item.details?.tracking_id} />
                          <DetailRow label="Submitted" value={item.details?.created_at} />
                        </div>
                      ))
                    )}
                    <p className="mt-6 font-inter text-[10px] uppercase tracking-widest text-iam-gold">Members</p>
                    {countryMembers(country).length === 0 ? (
                      <p className="py-2 text-sm text-iam-muted">No registered members from this country.</p>
                    ) : (
                      countryMembers(country).map((member) => (
                        <div key={member.id} className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
                          <DetailRow label="Name" value={member.name} />
                          <DetailRow label="Email" value={member.email} />
                          <DetailRow label="Member ID" value={member.member_id} />
                          <DetailRow label="Approval" value={member.approval_label} />
                          <DetailRow label="Account" value={member.status === "suspended" ? "Stopped" : "Active"} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "recycle" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              Deleted members, applications, enrollments, and help submissions. Restore or permanently remove items.
            </p>
            <ActivitySearchBar
              search={recycleSearch}
              date={recycleDate}
              memberId=""
              members={[]}
              onSearchChange={setRecycleSearch}
              onDateChange={setRecycleDate}
              onMemberChange={() => {}}
              onSearch={() => loadRecycleBinFiltered()}
              onClear={clearRecycleFilters}
              searching={recycleSearching}
              showMemberSelect={false}
            />
            <RecycleBinList
              items={recycleBin}
              expanded={expanded}
              setExpanded={setExpanded}
              onRestore={handleRestoreRecycle}
              onPurge={handlePurgeRecycle}
            />
          </div>
        )}

        {tab === "deletion-requests" && (
          <div className="space-y-3">
            {deletionRequests.length === 0 && (
              <p className="font-inter text-sm text-iam-muted">No pending member deletion requests.</p>
            )}
            {deletionRequests.map((item) => (
              <div key={item.id} className="glass-panel overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <UserX className="h-5 w-5 shrink-0 text-red-300" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{item.name || "Member"}</p>
                    <p className="text-sm text-iam-muted">{item.email}</p>
                  </div>
                  <span className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] text-red-300">
                    Deletion Request
                  </span>
                  <span className="text-[10px] text-iam-muted">{item.created_at}</span>
                  <ChevronRight
                    className={`h-4 w-4 text-iam-muted transition ${expanded === item.id ? "rotate-90" : ""}`}
                  />
                </button>
                {expanded === item.id && (
                  <div className="border-t border-white/10 px-4 pb-4">
                    <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
                      <DetailRow label="Name" value={item.name} />
                      <DetailRow label="Email" value={item.email} />
                      <DetailRow label="Message" value={item.message || "—"} />
                      <DetailRow label="Requested" value={item.created_at} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-gold py-2 text-xs"
                        onClick={() => handleApproveDeletion(item.id, item.name)}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve (1-year hold)
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 font-inter text-xs text-red-300 hover:bg-red-500/10"
                        onClick={() => handleRejectDeletion(item.id, item.name)}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "restore-requests" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              Members whose accounts were deleted can request restoration here. If all details match enrollment,
              the account is restored automatically; otherwise review and restore manually.
            </p>
            {restoreRequests.length === 0 && (
              <p className="font-inter text-sm text-iam-muted">No account restore requests yet.</p>
            )}
            {restoreRequests.map((item) => {
              const v = item.verification || {};
              const statusLabel =
                item.status === "auto_restored"
                  ? "Auto restored"
                  : item.status === "approved"
                    ? "Restored"
                    : item.status === "rejected"
                      ? "Rejected"
                      : "Pending";
              return (
                <div key={item.id} className="glass-panel overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  >
                    <Inbox className="h-5 w-5 shrink-0 text-iam-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{item.name || "Member"}</p>
                      <p className="text-sm text-iam-muted">{item.email}</p>
                      {(item.phone || item.church_name) && (
                        <p className="mt-1 text-xs text-iam-muted">
                          {[item.phone, item.church_name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {item.message && (
                        <p className="mt-2 line-clamp-2 text-xs italic text-iam-gold-light/90">
                          “{item.message}”
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                        item.status === "pending"
                          ? "bg-iam-gold/20 text-iam-gold-light"
                          : item.status === "rejected"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 text-iam-muted transition ${expanded === item.id ? "rotate-90" : ""}`}
                    />
                  </button>
                  {expanded === item.id && (
                    <div className="border-t border-white/10 px-4 pb-4">
                      <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
                        <DetailRow label="Name" value={item.name} />
                        <DetailRow label="Email" value={item.email} />
                        <DetailRow label="Phone" value={item.phone} />
                        <DetailRow label="Church" value={item.church_name} />
                        <DetailRow label="Message" value={item.message || "—"} />
                        <DetailRow label="Requested" value={item.created_at} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {["email", "name", "phone", "password", "church_name"].map((key) => (
                          <span
                            key={key}
                            className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                              v[key] ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {v[key] ? "✓" : "✗"} {key.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                      {item.status === "pending" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-gold py-2 text-xs"
                            onClick={() => handleApproveRestore(item.id, item.name)}
                          >
                            <Check className="h-3.5 w-3.5" /> Restore Account
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 font-inter text-xs text-red-300 hover:bg-red-500/10"
                            onClick={() => handleRejectRestore(item.id, item.name)}
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "deleted-accounts" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              View deleted member accounts on hold, permanently purged, or restored. Expand any record for full
              details and generate a PDF report for your records.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: "all", label: "All" },
                { id: "held", label: "On Hold" },
                { id: "purged", label: "Purged" },
                { id: "restored", label: "Restored" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDeletedStageFilter(f.id)}
                  className={`rounded-full px-4 py-1.5 font-inter text-xs uppercase tracking-wider transition ${
                    deletedStageFilter === f.id
                      ? "bg-iam-gold/25 text-iam-gold-light"
                      : "bg-white/5 text-iam-muted hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {deletedAccounts.length === 0 && (
              <p className="font-inter text-sm text-iam-muted">
                No deleted accounts in this list. Approve a member deletion request to add an account on hold.
              </p>
            )}
            {deletedAccounts.map((item) => (
              <div key={item.id} className="glass-panel overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <Ban className="h-5 w-5 shrink-0 text-iam-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{item.name || "Member"}</p>
                    <p className="text-sm text-iam-muted">{item.email}</p>
                    {(item.phone || item.church_name) && (
                      <p className="mt-1 text-xs text-iam-muted">
                        {[item.phone, item.church_name].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {item.member_id && (
                      <p className="mt-1 font-mono text-xs text-iam-gold-light">{item.member_id}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                      item.stage === "held"
                        ? "bg-iam-gold/20 text-iam-gold-light"
                        : item.stage === "purged"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {item.stage === "held" ? "On hold" : item.stage === "purged" ? "Purged" : "Restored"}
                  </span>
                  {item.reactivation_requested && (
                    <span className="rounded-full bg-iam-gold/30 px-2 py-1 text-[10px] text-iam-gold">
                      Re-applied
                    </span>
                  )}
                  {item.stage === "held" && (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">
                      {item.days_remaining ?? "—"} days left
                    </span>
                  )}
                  <ChevronRight
                    className={`h-4 w-4 text-iam-muted transition ${expanded === item.id ? "rotate-90" : ""}`}
                  />
                </button>
                {expanded === item.id && (
                  <div className="border-t border-white/10 px-4 pb-4">
                    <DeletedAccountDetails
                      item={item}
                      onRestore={handleRestoreDeleted}
                      onPurge={handlePurgeDeleted}
                      onGenerateReport={handleGenerateDeletedReport}
                      generatingReport={generatingReportId === item.id}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "my-reports" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              PDF reports for deleted accounts — generated when you click Generate PDF Report or after the 1-year
              hold expires.
            </p>
            {deletionReports.length === 0 && (
              <p className="font-inter text-sm text-iam-muted">No deletion reports yet.</p>
            )}
            {deletionReports.map((report) => (
              <div key={report.id} className="glass-panel overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <FileBarChart className="h-5 w-5 shrink-0 text-iam-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{report.name || report.email || "Deleted Account"}</p>
                    <p className="text-sm text-iam-muted">{report.email}</p>
                    <p className="mt-1 text-xs text-iam-muted">Generated {report.created_at}</p>
                    {report.summary?.member_id && (
                      <p className="font-mono text-xs text-iam-gold-light">{report.summary.member_id}</p>
                    )}
                    {report.summary?.stage && (
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-iam-muted">
                        Stage: {report.summary.stage}
                      </p>
                    )}
                  </div>
                  {report.id && (
                    <>
                      {report.deleted_account_id && (
                        <button
                          type="button"
                          disabled={generatingReportId === report.deleted_account_id}
                          onClick={() => handleGenerateDeletedReport(report.deleted_account_id)}
                          className="btn-ghost py-2 text-xs"
                        >
                          <FileBarChart className="h-3.5 w-3.5" />{" "}
                          {generatingReportId === report.deleted_account_id
                            ? "Generating…"
                            : "Generate PDF Report"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => api.downloadDeletionReport(report.id).catch(() => {})}
                        className="btn-gold py-2 text-xs"
                      >
                        <FileBarChart className="h-3.5 w-3.5" /> Download PDF Report
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "member-activity" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              Member accounts are private and isolated. Only administrators can review member activity here.
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {[
                { id: "activity", label: "Activity & Notifications" },
                { id: "recycle", label: "Recycle Bin" },
              ].map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    setActivitySubTab(view.id);
                    setExpanded(null);
                  }}
                  className={`rounded-full px-4 py-1.5 font-inter text-xs uppercase tracking-wider transition ${
                    activeActivityView === view.id
                      ? "bg-iam-gold/25 text-iam-gold-light"
                      : "bg-white/5 text-iam-muted hover:text-white"
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {activeActivityView === "activity" && (
              <>
                <ActivitySearchBar
                  search={activitySearch}
                  date={activityDate}
                  memberId={activityMemberId}
                  members={members}
                  onSearchChange={setActivitySearch}
                  onDateChange={setActivityDate}
                  onMemberChange={setActivityMemberId}
                  onSearch={() => loadMemberActivity()}
                  onClear={clearActivityFilters}
                  searching={activitySearching}
                />
                {activityMemberId && (
                  <div className="glass-panel space-y-3 p-4">
                    <p className="font-inter text-sm text-iam-muted">
                      Add an administrator note to this member&apos;s private activity timeline.
                    </p>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Write a note visible only to administrators…"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-inter text-sm text-white placeholder:text-iam-muted focus:border-iam-gold/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      className="btn-gold py-2 text-xs"
                      disabled={addingNote || !adminNote.trim()}
                      onClick={handleAddActivityNote}
                    >
                      {addingNote ? "Adding…" : "Add Administrator Note"}
                    </button>
                  </div>
                )}
                {(activitySearch || activityDate || activityMemberId) && (
                  <p className="font-inter text-xs text-iam-muted">
                    Showing filtered activity
                    {activityMemberId
                      ? ` for ${members.find((m) => m.id === activityMemberId)?.name || "selected member"}`
                      : ""}
                    {activityDate ? ` on ${activityDate}` : ""}
                    {activitySearch ? ` matching “${activitySearch}”` : ""}.
                  </p>
                )}
                {memberActivity.length === 0 && (
                  <p className="font-inter text-sm text-iam-muted">No member activity found for these filters.</p>
                )}
                {memberActivity.map((row) => (
                  <div key={row.id} className="glass-panel flex flex-wrap items-center gap-4 p-4">
                    <Bell className="h-5 w-5 shrink-0 text-iam-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{row.name || row.email || "Member"}</p>
                      <p className="text-sm text-iam-gold-light">
                        {ACTION_LABELS[row.action] || row.action?.replace(/_/g, " ")}
                      </p>
                      {row.detail && <p className="text-xs text-iam-muted">{row.detail}</p>}
                      {row.email && row.name && (
                        <p className="mt-1 text-[10px] text-iam-muted">{row.email}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-iam-muted">{formatActivityDate(row.created_at)}</span>
                  </div>
                ))}
              </>
            )}

            {activeActivityView === "recycle" && (
              <>
                <ActivitySearchBar
                  search={recycleSearch}
                  date={recycleDate}
                  memberId=""
                  members={[]}
                  onSearchChange={setRecycleSearch}
                  onDateChange={setRecycleDate}
                  onMemberChange={() => {}}
                  onSearch={() => loadRecycleBinFiltered()}
                  onClear={clearRecycleFilters}
                  searching={recycleSearching}
                  showMemberSelect={false}
                />
                <RecycleBinList
                  items={recycleBin}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  onRestore={handleRestoreRecycle}
                  onPurge={handlePurgeRecycle}
                />
              </>
            )}
          </div>
        )}

        {tab === "our-mission" && <AdminMissionPanel />}

        {tab === "security" && (
          <div className="space-y-3">
            <p className="font-inter text-sm text-iam-muted">
              IAM Administrator — administrator actions are strongly secured. Members cannot access this audit trail.
            </p>
            <ActivitySearchBar
              search={securitySearch}
              date={securityDate}
              memberId=""
              members={[]}
              onSearchChange={setSecuritySearch}
              onDateChange={setSecurityDate}
              onMemberChange={() => {}}
              onSearch={() => loadSecurityAuditFiltered()}
              onClear={clearSecurityFilters}
              searching={securitySearching}
              showMemberSelect={false}
            />
            {(securitySearch || securityDate) && (
              <p className="font-inter text-xs text-iam-muted">
                Showing audit entries
                {securityDate ? ` on ${securityDate}` : ""}
                {securitySearch ? ` matching “${securitySearch}”` : ""}.
              </p>
            )}
            {securityAudit.length === 0 && (
              <p className="font-inter text-sm text-iam-muted">No administrator audit entries for these filters.</p>
            )}
            {securityAudit.map((row) => (
              <div key={row.id} className="glass-panel flex flex-wrap items-center gap-4 p-4">
                <Shield className="h-5 w-5 shrink-0 text-iam-gold" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{row.admin_name || "IAM Administrator"}</p>
                  <p className="text-sm capitalize text-iam-gold-light">{row.action?.replace(/_/g, " ")}</p>
                  {row.detail && <p className="text-xs text-iam-muted">{row.detail}</p>}
                </div>
                <span className="text-[10px] text-iam-muted">{formatActivityDate(row.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "wallpaper" && <AdminWallpaperPanel />}

        {tab === "my-account" && <AdminAccountSettingsPanel />}

        {tab === "password-settings" && <AdminPasswordSettingsPanel />}
      </main>
    </div>
  );
}
