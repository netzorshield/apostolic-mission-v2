import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Phone, ArrowLeft } from "lucide-react";
import { AuthLayout } from "../components/HeroPanel";
import DeletedAccountRestorePanel from "../components/DeletedAccountRestorePanel";
import { isApprovedMember } from "../components/ProtectedRoute";
import { useAuth } from "../lib/auth";
import { isAccountDeletedError, resolveLoginError } from "../lib/authErrors";
import { api } from "../lib/api";

const EMPTY_RESTORE_FORM = {
  email: "",
  name: "",
  phone: "",
  password: "",
  church_name: "",
  message: "",
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotForm, setForgotForm] = useState({
    email: "",
    name: "",
    phone: "",
  });
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreForm, setRestoreForm] = useState(EMPTY_RESTORE_FORM);
  const [restoreMsg, setRestoreMsg] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);

  const openRestorePanel = (creds) => {
    setRestoreOpen(true);
    setRestoreForm((prev) => ({
      ...prev,
      email: creds.email || prev.email,
      password: creds.password || prev.password,
    }));
    setRestoreMsg("");
    setRestoreError("");
  };

  const closeRestorePanel = () => {
    setRestoreOpen(false);
    setRestoreMsg("");
    setRestoreError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setRestoreOpen(false);
    setLoading(true);
    try {
      const signedIn = await login(email, password);
      if (signedIn.role === "admin") navigate("/admin");
      else if (isApprovedMember(signedIn)) navigate("/dashboard");
      else navigate("/enrollment");
    } catch (err) {
      if (isAccountDeletedError(err.message)) {
        openRestorePanel({ email, password });
      } else {
        setError(resolveLoginError(err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSubmit = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setRestoreMsg("");
    setRestoreError("");
    setRestoreLoading(true);
    try {
      const result = await api.accountRestoreRequest(restoreForm);
      setRestoreMsg(result.message);
      if (result.status === "auto_restored") {
        closeRestorePanel();
        setEmail(restoreForm.email);
        setPassword(restoreForm.password);
      }
    } catch (err) {
      setRestoreError(err.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  const updateRestoreField = (field) => (value) => {
    setRestoreForm((prev) => ({ ...prev, [field]: value }));
  };

  const openForgot = () => {
    setForgotOpen(true);
    setForgotForm((prev) => ({ ...prev, email: email || prev.email }));
    setForgotMsg("");
    setForgotError("");
    setError("");
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotMsg("");
    setForgotError("");

    setForgotLoading(true);
    try {
      const result = await api.forgotPassword({
        email: forgotForm.email,
        name: forgotForm.name,
        phone: forgotForm.phone,
      });
      setForgotMsg(
        result.message ||
          "If your email, full name, and phone number match our records, your new password has been sent to your email.",
      );
      setForgotForm({ email: "", name: "", phone: "" });
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  if (forgotOpen) {
    return (
      <AuthLayout
        title="Reset Password"
        subtitle="Enter your email, full name, and phone number from enrollment. A new password will be generated and emailed to you automatically."
      >
        <motion.form
          onSubmit={handleForgotSubmit}
          className="glass-panel relative p-8 pt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-iam-gold bg-iam-bg shadow-gold">
            <Lock className="h-6 w-6 text-iam-gold" />
          </div>

          <div className="mb-4">
            <label className="label-iam" htmlFor="forgot-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iam-muted/60" />
              <input
                id="forgot-email"
                type="email"
                className="input-iam pl-10"
                placeholder="name@example.com"
                value={forgotForm.email}
                onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="label-iam" htmlFor="forgot-name">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iam-muted/60" />
              <input
                id="forgot-name"
                type="text"
                className="input-iam pl-10"
                placeholder="As on your enrollment"
                value={forgotForm.name}
                onChange={(e) => setForgotForm({ ...forgotForm, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="label-iam" htmlFor="forgot-phone">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iam-muted/60" />
              <input
                id="forgot-phone"
                type="tel"
                className="input-iam pl-10"
                placeholder="As on your enrollment"
                value={forgotForm.phone}
                onChange={(e) => setForgotForm({ ...forgotForm, phone: e.target.value })}
                required
              />
            </div>
          </div>

          {forgotMsg && (
            <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center font-inter text-sm leading-relaxed text-emerald-200">
              {forgotMsg}
            </p>
          )}

          {forgotError && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center font-inter text-sm leading-relaxed text-red-200">
              {forgotError}
            </p>
          )}

          <button type="submit" className="btn-gold w-full" disabled={forgotLoading}>
            {forgotLoading ? "Sending request…" : "Send Request"}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="btn-ghost mt-4 w-full"
            onClick={() => {
              setForgotOpen(false);
              setForgotMsg("");
              setForgotError("");
            }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </motion.form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to your International Apostolic Mission account">
      <motion.form
        onSubmit={handleSubmit}
        className="glass-panel relative p-8 pt-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-iam-gold bg-iam-bg shadow-gold">
          <Lock className="h-6 w-6 text-iam-gold" />
        </div>

        <div className="mb-4">
          <label className="label-iam" htmlFor="email">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iam-muted/60" />
            <input
              id="email"
              type="email"
              className="input-iam pl-10"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="label-iam" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iam-muted/60" />
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className="input-iam pl-10 pr-10"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-iam-muted"
              onClick={() => setShowPw(!showPw)}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-iam-muted">
            <input type="checkbox" className="accent-iam-gold" /> Remember me
          </label>
          <button type="button" className="text-iam-gold hover:underline" onClick={openForgot}>
            Forgot Password?
          </button>
        </div>

        {user?.status === "pending_approval" && (
          <p className="mb-4 rounded-lg border border-iam-gold/30 bg-iam-gold/10 px-3 py-2 text-center text-sm text-iam-gold-light">
            <strong>{user.email}</strong> is awaiting admin approval and cannot sign in yet. Sign in below with a
            different account if you have one.
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center font-inter text-sm leading-relaxed text-red-200">
            {error}
          </p>
        )}

        {restoreOpen && (
          <DeletedAccountRestorePanel
            form={restoreForm}
            onChange={updateRestoreField}
            onSubmit={handleRestoreSubmit}
            onClose={closeRestorePanel}
            loading={restoreLoading}
            message={restoreMsg}
            error={restoreError}
          />
        )}

        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"} <ArrowRight className="h-4 w-4" />
        </button>

        <p className="mt-6 text-center font-inter text-sm text-iam-muted">
          <Link to="/enroll" className="font-semibold text-iam-gold hover:underline">
            Join Our Mission
          </Link>
        </p>
      </motion.form>
    </AuthLayout>
  );
}
