import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import SiteNav from "../components/SiteNav";
import { SupportMissionHeader } from "../components/SupportMissionHeader";
import { HELP_TYPE_OPTIONS } from "../lib/helpTypes";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function HelpPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const initialType = HELP_TYPE_OPTIONS.some((t) => t.value === typeParam) ? typeParam : "volunteering";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    help_type: initialType,
    message: "",
    amount: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      email: prev.email || user.email || "",
    }));
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.submitHelp(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-white">
      <SiteNav />

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-16 pt-28">
        {submitted ? (
          <motion.div className="glass-panel p-8 text-center" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
            <h1 className="font-playfair text-2xl">Thank You</h1>
            <p className="mt-3 font-inter text-sm text-iam-muted">
              Your offer of help has been received. Our team will review it and reach out soon.
            </p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <SupportMissionHeader />

            <form onSubmit={handleSubmit} className="glass-panel space-y-4 p-6">
              <div>
                <label className="label-iam">Full Name</label>
                <input className="input-iam" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label-iam">Email</label>
                <input type="email" className="input-iam" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label-iam">Phone (optional)</label>
                <input className="input-iam" placeholder="+1 555 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label-iam">Country</label>
                <input className="input-iam" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <label className="label-iam">Type of Help</label>
                <select
                  className="input-iam"
                  value={form.help_type}
                  onChange={(e) => setForm({ ...form, help_type: e.target.value })}
                >
                  {HELP_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value} className="bg-iam-bg">
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 font-inter text-xs text-iam-muted">
                  {HELP_TYPE_OPTIONS.find((t) => t.value === form.help_type)?.description}
                </p>
              </div>
              {form.help_type === "financial" && (
                <div>
                  <label className="label-iam">Amount (optional)</label>
                  <input className="input-iam" placeholder="e.g. $500 or monthly pledge" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label-iam">How would you like to help?</label>
                <textarea
                  className="input-iam min-h-[100px]"
                  placeholder="Describe the support you wish to offer..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button type="submit" className="btn-gold w-full" disabled={loading}>
                <Send className="h-4 w-4" /> {loading ? "Submitting…" : "Submit Help Offer"}
              </button>
            </form>
          </motion.div>
        )}
      </main>
    </div>
  );
}
