import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Mail, Send, Settings } from "lucide-react";
import { api } from "../lib/api";

const AUTO_FLOW_STEPS = [
  "Member opens your site → Sign In → Forgot Password?",
  "They enter email, full name, and phone number from enrollment.",
  "They click Send Request.",
  "Your website checks their details, generates a new password, saves it, and emails it automatically.",
  "You do not approve each request or copy passwords from the admin panel.",
];

const SETUP_STEPS = [
  "Turn on Enable automatic password reset emails (below).",
  "Add Gmail SMTP: smtp.gmail.com, port 587, and a Google App Password.",
  "Save Settings, then Send Test Email to confirm delivery.",
  "After that, every valid member reset on the login page is handled by the site.",
];

const IMPORTANT_NOTES = [
  "SMTP must be enabled — without it, the site cannot send emails.",
  "Details must match enrollment — wrong name or phone means no email (for security).",
  "Site URL should match your live website (e.g. https://yourdomain.com) so the sign-in link in emails is correct.",
  "Emails are sent by your server when the member clicks Send Request — not from their browser.",
];

export default function AdminPasswordSettingsPanel() {
  const [form, setForm] = useState({
    enabled: false,
    smtp_host: "",
    smtp_port: 587,
    smtp_use_tls: true,
    smtp_user: "",
    smtp_password: "",
    from_email: "",
    from_name: "International Apostolic Mission",
    site_url: window.location.origin,
  });
  const [passwordSet, setPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getEmailSettings()
      .then((data) => {
        setForm({
          enabled: Boolean(data.enabled),
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port || 587,
          smtp_use_tls: data.smtp_use_tls !== false,
          smtp_user: data.smtp_user || "",
          smtp_password: "",
          from_email: data.from_email || "",
          from_name: data.from_name || "International Apostolic Mission",
          site_url: data.site_url || window.location.origin,
        });
        setPasswordSet(Boolean(data.smtp_password_set));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body = { ...form };
      if (!body.smtp_password) {
        delete body.smtp_password;
      }
      const data = await api.updateEmailSettings(body);
      setPasswordSet(Boolean(data.smtp_password_set));
      setForm((prev) => ({ ...prev, smtp_password: "" }));
      setMessage(
        form.enabled
          ? "Settings saved. Member password resets on the sign-in page will be emailed automatically."
          : "Settings saved. Turn on automatic emails when you are ready.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const result = await api.testEmailSettings();
      setMessage(result.message || "Test email sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <p className="font-inter text-sm text-iam-muted">Loading password settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 md:p-8">
        <div className="mb-6 flex items-start gap-3">
          <Send className="mt-1 h-5 w-5 shrink-0 text-iam-gold" />
          <div>
            <h3 className="font-playfair text-xl text-white">Automatic Member Password Reset</h3>
            <p className="mt-2 font-inter text-sm leading-relaxed text-iam-muted">
              After a one-time setup below, new passwords are emailed automatically from your IAM website whenever a
              member submits a correct reset request. No manual approval is required.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="font-inter text-sm font-semibold uppercase tracking-wider text-iam-gold-light">
              What happens automatically
            </h4>
            <ol className="mt-3 space-y-2 font-inter text-sm leading-relaxed text-iam-muted">
              {AUTO_FLOW_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="shrink-0 font-medium text-iam-gold">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h4 className="font-inter text-sm font-semibold uppercase tracking-wider text-iam-gold-light">
              One-time setup (admin only)
            </h4>
            <ol className="mt-3 space-y-2 font-inter text-sm leading-relaxed text-iam-muted">
              {SETUP_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="shrink-0 font-medium text-iam-gold">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="mb-8 rounded-xl border border-iam-gold/20 bg-iam-gold/5 p-5">
          <h4 className="font-inter text-sm font-semibold uppercase tracking-wider text-iam-gold-light">
            Important notes
          </h4>
          <ul className="mt-3 space-y-2 font-inter text-sm leading-relaxed text-iam-muted">
            {IMPORTANT_NOTES.map((note) => (
              <li key={note} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-iam-gold" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mb-6 flex items-start gap-3 border-t border-white/10 pt-8">
          <Settings className="mt-1 h-5 w-5 shrink-0 text-iam-gold" />
          <div>
            <h3 className="font-playfair text-xl text-white">Password Email Settings</h3>
            <p className="mt-2 font-inter text-sm text-iam-muted">
              Configure Gmail SMTP so your website can send password reset emails automatically.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-center gap-3 font-inter text-sm text-iam-muted">
            <input
              type="checkbox"
              className="accent-iam-gold"
              checked={form.enabled}
              onChange={(e) => handleChange("enabled", e.target.checked)}
            />
            Enable automatic password reset emails
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-inter text-xs text-iam-muted">SMTP Host</label>
              <input
                className="input-iam w-full"
                placeholder="smtp.gmail.com"
                value={form.smtp_host}
                onChange={(e) => handleChange("smtp_host", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block font-inter text-xs text-iam-muted">SMTP Port</label>
              <input
                type="number"
                className="input-iam w-full"
                value={form.smtp_port}
                onChange={(e) => handleChange("smtp_port", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block font-inter text-xs text-iam-muted">SMTP Username</label>
              <input
                className="input-iam w-full"
                placeholder="yourname@gmail.com"
                value={form.smtp_user}
                onChange={(e) => handleChange("smtp_user", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block font-inter text-xs text-iam-muted">
                SMTP Password {passwordSet && !form.smtp_password ? "(saved — leave blank to keep)" : ""}
              </label>
              <input
                type="password"
                className="input-iam w-full"
                placeholder={passwordSet ? "••••••••" : "Google App Password"}
                value={form.smtp_password}
                onChange={(e) => handleChange("smtp_password", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block font-inter text-xs text-iam-muted">From Email</label>
              <input
                type="email"
                className="input-iam w-full"
                placeholder="yourname@gmail.com"
                value={form.from_email}
                onChange={(e) => handleChange("from_email", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block font-inter text-xs text-iam-muted">From Name</label>
              <input
                className="input-iam w-full"
                value={form.from_name}
                onChange={(e) => handleChange("from_name", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-inter text-xs text-iam-muted">Site URL (sign-in link in emails)</label>
            <input
              className="input-iam w-full"
              placeholder="https://yourdomain.com"
              value={form.site_url}
              onChange={(e) => handleChange("site_url", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-3 font-inter text-sm text-iam-muted">
            <input
              type="checkbox"
              className="accent-iam-gold"
              checked={form.smtp_use_tls}
              onChange={(e) => handleChange("smtp_use_tls", e.target.checked)}
            />
            Use TLS (recommended for port 587)
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" className="btn-gold" disabled={saving}>
              <KeyRound className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}
            </button>
            <button type="button" className="btn-ghost" onClick={handleTest} disabled={testing || !form.enabled}>
              <Mail className="h-4 w-4" /> {testing ? "Sending…" : "Send Test Email"}
            </button>
          </div>
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
    </div>
  );
}
