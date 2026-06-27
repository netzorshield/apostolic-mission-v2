import { useState, useEffect } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import BackLink from "../components/BackLink";
import { useAuth } from "../lib/auth";
import { readApplicationPrefill } from "../lib/enrollmentSteps";

export default function RegisterPage() {
  const { register, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefill = readApplicationPrefill();
    if (!prefill) return;
    setForm((f) => ({
      ...f,
      name: `${prefill.first_name || ""} ${prefill.last_name || ""}`.trim() || f.name,
      email: prefill.email || f.email,
    }));
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-iam-gold border-t-transparent" />
      </div>
    );
  }

  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.role === "member") return <Navigate to="/enrollment" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      navigate("/enrollment");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen text-white">
      <BackLink to="/" className="absolute left-6 top-6 z-20 lg:left-8 lg:top-8" />
      {/* Left — journey */}
      <aside className="relative hidden min-h-screen flex-col px-10 pb-14 pt-10 lg:flex lg:w-[55%] xl:px-16">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />

        <div className="relative z-10 mt-auto max-w-md">
          <p className="font-inter text-xs uppercase tracking-[0.3em] text-iam-gold">Begin Your Journey</p>
          <h1 className="mt-4 font-playfair text-4xl text-white md:text-5xl">Answer the call.</h1>
          <blockquote className="mt-8">
            <p className="font-cormorant text-xl italic leading-relaxed text-white/85 md:text-2xl">
              &ldquo;Whom shall I send, and who will go for us?&rdquo;
            </p>
            <cite className="mt-3 block font-inter text-[10px] uppercase tracking-widest text-iam-gold/90 not-italic">
              — Isaiah 6:8
            </cite>
          </blockquote>
        </div>
      </aside>

      {/* Right — create account form */}
      <main className="relative flex flex-1 flex-col justify-center px-6 py-10 lg:px-12 xl:px-16">

        <div className="mx-auto w-full max-w-sm lg:mr-[6%] xl:mr-[10%] lg:ml-auto">
          <h2 className="font-cinzel text-2xl font-semibold text-iam-gold-light">Enroll</h2>
          <p className="mt-3 font-inter text-sm leading-relaxed text-white/65">
            Create your account and complete enrollment. An administrator must approve your registration before you can sign in and access the IAM Member Portal.
          </p>
          <p className="mt-2 font-inter text-xs leading-relaxed text-iam-gold-light/90">
            The email and password you enter below are saved when you enroll. After approval, use that{" "}
            <strong className="text-iam-gold-light">same email and password</strong> on the Sign In page. IAM does not
            change your password when you are approved.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label-iam" htmlFor="name">Full Name</label>
              <input
                id="name"
                className="input-iam"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label-iam" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input-iam"
                placeholder="you@mission.org"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label-iam" htmlFor="password">Sign-in Password</label>
              <input
                id="password"
                type="password"
                minLength={6}
                className="input-iam"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <p className="mt-1.5 font-inter text-xs text-iam-muted">
                This is your Member Portal sign-in password — chosen once at Enroll and kept until you or an administrator
                changes it.
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button type="submit" className="btn-gold w-full" disabled={loading}>
              {loading ? "Enrolling…" : "Enroll"}
            </button>
          </form>

          <p className="mt-6 font-inter text-sm text-iam-muted">
            Already a member?{" "}
            <Link to="/login" className="font-semibold text-iam-gold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
