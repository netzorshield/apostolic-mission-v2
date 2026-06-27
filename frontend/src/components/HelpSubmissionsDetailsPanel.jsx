import { Link } from "react-router-dom";
import { HELP_TYPE_OPTIONS } from "../lib/helpTypes";

const SITE = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8001";

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 border-b border-white/5 py-2 sm:grid-cols-[140px_1fr] sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-iam-muted">{label}</span>
      <span className="text-white/90">{value}</span>
    </div>
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

export default function HelpSubmissionsDetailsPanel({ compact = false, variant = "admin" }) {
  const isMember = variant === "member";

  return (
    <div className={`rounded-xl border border-white/10 bg-black/20 ${compact ? "p-4" : "p-5 md:p-6"}`}>
      <h3 className="font-playfair text-lg text-iam-gold">Help Submissions — full details</h3>
      <div className="mt-3 space-y-2 font-inter text-sm leading-relaxed text-white/85">
        <p>
          {isMember
            ? "Signed-in members use /help to offer support. Submissions appear in the Our Support sidebar tab under Help Submissions. Visitors without an account are sent to the login page."
            : "Signed-in members use /help to offer support. Submissions appear in this Our Support tab under Help Submissions. Visitors without an account are sent to the login page."}
        </p>

        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <DetailRow label="Member link" value={`${SITE}/help (sign in required)`} />
          <DetailRow label="Sign-in required" value="Yes — members only; not public" />
          <DetailRow label="Where it is stored" value="Database collection: helps" />
          <DetailRow label="Admin inbox" value="Our Support tab → Help Submissions section" />
          <DetailRow
            label="Badge on sidebar"
            value="Our Support shows count when new submissions wait (status: received)"
          />
        </div>

        <p className="mt-3 font-medium text-white">Form fields (what people fill in):</p>
        <BulletList
          items={[
            "Full Name — required",
            "Email — required",
            "Phone — optional",
            "Country — required",
            "Help Type — pick one from the list below",
            "Message — how they want to help — required",
            "Amount — only shown if they pick Financial Support",
          ]}
        />

        <p className="mt-3 font-medium text-white">Help types:</p>
        <div className="space-y-1">
          {HELP_TYPE_OPTIONS.map(({ label, description }) => (
            <DetailRow key={label} label={label} value={description} />
          ))}
        </div>

        {isMember && (
          <Link to="/help" className="btn-gold mt-6 inline-flex">
            Offer Support at /help
          </Link>
        )}

        {!compact && !isMember && (
          <>
            <p className="mt-3 font-medium text-white">Your actions on each submission:</p>
            <Step n="1" text="Open Our Support — Help Submissions section below." />
            <Step n="2" text="Click a person's name to expand full details." />
            <Step n="3" text='Click "Mark Reviewed" when you have read their message.' />
            <Step n="4" text='Click "Acknowledge" when you have replied or finished handling it.' />
            <Step n="5" text='Click "Move to Recycle Bin" to remove it. Restore later from Recycle Bin tab if needed.' />
            <p className="mt-3 font-medium text-white">Status meanings:</p>
            <DetailRow label="received" value="New — waiting for you to open and read." />
            <DetailRow label="reviewed" value="You have read the submission." />
            <DetailRow label="acknowledged" value="You have handled it or contacted the person." />
            <DetailRow label="closed" value="Finished and closed (can be set by admin)." />
          </>
        )}
      </div>
    </div>
  );
}
