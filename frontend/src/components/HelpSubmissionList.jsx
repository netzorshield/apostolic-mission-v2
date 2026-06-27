import { ChevronRight, HandHeart } from "lucide-react";
import { helpTypeLabel } from "../lib/helpTypes";

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/5 py-2 text-sm">
      <span className="w-28 shrink-0 text-iam-muted">{label}</span>
      <span className="flex-1 text-white/90">{value}</span>
    </div>
  );
}

function HelpDetails({ help, onUpdate, onDelete }) {
  return (
    <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
      <DetailRow label="Type" value={helpTypeLabel(help.help_type)} />
      <DetailRow label="Email" value={help.email} />
      <DetailRow label="Phone" value={help.phone} />
      <DetailRow label="Country" value={help.country} />
      <DetailRow label="Amount" value={help.amount} />
      <DetailRow label="Message" value={help.message} />
      <DetailRow label="Submitted" value={help.created_at} />
      {help.status === "received" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-gold py-2 text-xs" onClick={() => onUpdate(help.id, { status: "reviewed" })}>
            Mark Reviewed
          </button>
          <button type="button" className="btn-ghost py-2 text-xs" onClick={() => onUpdate(help.id, { status: "acknowledged" })}>
            Acknowledge
          </button>
        </div>
      )}
      <button
        type="button"
        className="mt-3 flex items-center gap-2 font-inter text-xs text-red-300 hover:text-red-200"
        onClick={onDelete}
      >
        Move to Recycle Bin
      </button>
    </div>
  );
}

export default function HelpSubmissionList({ helps, expanded, setExpanded, onUpdate, onDelete, emptyMessage }) {
  if (helps.length === 0) {
    return <p className="font-inter text-sm text-iam-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {helps.map((help) => (
        <div key={help.id} className="glass-panel overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
            onClick={() => setExpanded(expanded === help.id ? null : help.id)}
          >
            <HandHeart className="h-5 w-5 shrink-0 text-iam-gold" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{help.name}</p>
              <p className="text-sm text-iam-muted">{helpTypeLabel(help.help_type)}</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">{help.status}</span>
            <ChevronRight className={`h-4 w-4 text-iam-muted transition ${expanded === help.id ? "rotate-90" : ""}`} />
          </button>
          {expanded === help.id && (
            <div className="border-t border-white/10 px-4 pb-4">
              <HelpDetails help={help} onUpdate={onUpdate} onDelete={() => onDelete(help.id)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
