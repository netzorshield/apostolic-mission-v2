import { useEffect, useState } from "react";
import { UserCircle, Mail, KeyRound } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function AdminAccountSettingsPanel() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", current_password: "", new_password: "", confirm: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getAdminAccount()
      .then((data) => {
        setForm((prev) => ({
          ...prev,
          name: data.name || "",
          email: data.email || "",
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.current_password.trim()) {
      setError("Enter your current password to save changes.");
      return;
    }
    if (form.new_password && form.new_password !== form.confirm) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        current_password: form.current_password,
      };
      if (form.new_password) body.new_password = form.new_password;

      const result = await api.updateAdminAccount(body);
      setMessage(result.message || "Your administrator account was updated.");
      setForm((prev) => ({
        ...prev,
        name: result.account?.name || prev.name,
        email: result.account?.email || prev.email,
        current_password: "",
        new_password: "",
        confirm: "",
      }));
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="font-inter text-sm text-iam-muted">Loading your account…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 md:p-8">
        <div className="mb-6 flex items-start gap-3">
          <UserCircle className="mt-1 h-5 w-5 shrink-0 text-iam-gold" />
          <div>
            <h3 className="font-playfair text-xl text-white">My Administrator Account</h3>
            <p className="mt-2 font-inter text-sm text-iam-muted">
              Edit your display name, Gmail address, and password. Signed in as{" "}
              <strong className="text-white/90">{user?.email}</strong>.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          <div>
            <label className="mb-1 block font-inter text-xs text-iam-muted">Display Name</label>
            <input
              className="input-iam w-full"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Appostolic Mission"
              required
            />
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs text-iam-muted">Gmail / Email Address</label>
            <input
              type="email"
              className="input-iam w-full"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="yourname@gmail.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs text-iam-muted">Current Password (required to save)</label>
            <input
              type="password"
              className="input-iam w-full"
              value={form.current_password}
              onChange={(e) => handleChange("current_password", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs text-iam-muted">New Password (optional)</label>
            <input
              type="password"
              className="input-iam w-full"
              value={form.new_password}
              onChange={(e) => handleChange("new_password", e.target.value)}
              minLength={6}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs text-iam-muted">Confirm New Password</label>
            <input
              type="password"
              className="input-iam w-full"
              value={form.confirm}
              onChange={(e) => handleChange("confirm", e.target.value)}
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-gold" disabled={saving}>
            {saving ? "Saving…" : "Save My Account"}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-inter text-sm text-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-inter text-sm text-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="glass-panel p-6">
        <p className="font-inter text-sm text-iam-muted">
          <KeyRound className="mr-2 inline h-4 w-4 text-iam-gold" />
          <strong className="text-white/90">Forgot password?</strong> Change it here in{" "}
          <strong className="text-white/90">My Account</strong> while signed in. If you are locked out, contact your IAM
          server administrator.
        </p>
        <p className="mt-3 font-inter text-sm text-iam-muted">
          <Mail className="mr-2 inline h-4 w-4 text-iam-gold" />
          Member password resets use the sign-in page and require email, full name, and phone from enrollment (configure
          Gmail SMTP in Password Settings first).
        </p>
      </div>
    </div>
  );
}
