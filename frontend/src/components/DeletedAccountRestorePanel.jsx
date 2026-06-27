import { Send } from "lucide-react";

export default function DeletedAccountRestorePanel({
  form,
  onChange,
  onSubmit,
  onClose,
  loading,
  message,
  error,
}) {
  return (
    <div className="mb-4 rounded-lg border border-iam-gold/30 bg-iam-gold/10 p-4">
      <p className="font-inter text-sm leading-relaxed text-iam-gold-light">
        Sorry — this account was deleted. If you want your account back, send a message to the administrator with
        your account details below.
      </p>
      <div
        className="mt-4 space-y-3"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            onSubmit(e);
          }
        }}
      >
        <Field id="restore-email" label="Email Address" type="email" value={form.email} onChange={onChange("email")} />
        <Field id="restore-name" label="Full Name" value={form.name} onChange={onChange("name")} />
        <Field id="restore-phone" label="Phone Number" type="tel" value={form.phone} onChange={onChange("phone")} />
        <Field id="restore-church" label="Church Name" value={form.church_name} onChange={onChange("church_name")} />
        <Field
          id="restore-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={onChange("password")}
          minLength={6}
        />
        <div>
          <label className="label-iam" htmlFor="restore-message">
            Message to Admin
          </label>
          <textarea
            id="restore-message"
            className="input-iam min-h-[80px] w-full"
            placeholder="Optional — why you need your account restored"
            value={form.message}
            onChange={(e) => onChange("message")(e.target.value)}
          />
        </div>
        {message && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
            {error}
          </p>
        )}
        <button type="button" className="btn-gold w-full" disabled={loading} onClick={onSubmit}>
          {loading ? "Sending…" : "Send Restore Request to Admin"} <Send className="inline h-4 w-4" />
        </button>
        <button type="button" className="btn-ghost w-full text-xs" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", minLength }) {
  return (
    <div>
      <label className="label-iam" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="input-iam w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
      />
    </div>
  );
}
