import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, HandHeart } from "lucide-react";
import { SupportMissionHeader } from "./SupportMissionHeader";
import { HELP_TYPE_OPTIONS, helpTypeLabel } from "../lib/helpTypes";
import { api } from "../lib/api";

const STATUS_LABELS = {
  received: "Submitted — waiting for admin review",
  reviewed: "Reviewed by admin",
  acknowledged: "Acknowledged by admin",
  closed: "Closed",
};

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/5 py-2 text-sm">
      <span className="w-32 shrink-0 text-iam-muted">{label}</span>
      <span className="flex-1 text-white/90">{value}</span>
    </div>
  );
}

function MemberHelpDetail({ help }) {
  return (
    <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-black/20 p-4">
      <DetailRow label="Type" value={helpTypeLabel(help.help_type)} />
      <DetailRow label="Name" value={help.name} />
      <DetailRow label="Email" value={help.email} />
      <DetailRow label="Phone" value={help.phone} />
      <DetailRow label="Country" value={help.country} />
      <DetailRow label="Amount" value={help.amount} />
      <DetailRow label="Message" value={help.message} />
      <DetailRow label="Status" value={STATUS_LABELS[help.status] || help.status} />
      <DetailRow label="Submitted" value={help.created_at} />
    </div>
  );
}

export default function MemberSupportSection() {
  const [helps, setHelps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFolder, setTypeFolder] = useState("all");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api
      .myHelps()
      .then(setHelps)
      .catch(() => setHelps([]))
      .finally(() => setLoading(false));
  }, []);

  const folderCounts = useMemo(() => {
    const counts = Object.fromEntries(HELP_TYPE_OPTIONS.map(({ value }) => [value, 0]));
    helps.forEach((h) => {
      if (counts[h.help_type] != null) counts[h.help_type] += 1;
    });
    return counts;
  }, [helps]);

  const filtered = typeFolder === "all" ? helps : helps.filter((h) => h.help_type === typeFolder);
  const activeType = HELP_TYPE_OPTIONS.find((t) => t.value === typeFolder);

  return (
    <div className="space-y-6">
      <SupportMissionHeader
        showFolders
        activeFolder={typeFolder}
        onSelectFolder={(id) => {
          setTypeFolder(id);
          setExpanded(null);
        }}
        folderCounts={folderCounts}
      />

      <div className="border-b border-white/10 pb-3">
        <p className="font-inter text-xs uppercase tracking-widest text-iam-gold">
          {typeFolder === "all" ? "All your submissions" : activeType?.label || typeFolder}
        </p>
        <p className="mt-1 font-inter text-sm text-iam-muted">
          {loading ? "Loading…" : `${filtered.length} submission${filtered.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-center">
          <p className="font-inter text-sm text-iam-muted">
            {typeFolder === "all"
              ? "You have not submitted any support offers yet."
              : `No ${activeType?.label || "support"} submissions yet.`}
          </p>
          <Link
            to={typeFolder === "all" ? "/help" : `/help?type=${typeFolder}`}
            className="btn-gold mt-4 inline-flex"
          >
            Submit Support Offer
          </Link>
        </div>
      )}

      {filtered.map((help) => (
        <div key={help.id} className="glass-panel overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
            onClick={() => setExpanded(expanded === help.id ? null : help.id)}
          >
            <HandHeart className="h-5 w-5 shrink-0 text-iam-gold" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{helpTypeLabel(help.help_type)}</p>
              <p className="text-sm text-iam-muted line-clamp-1">{help.message}</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">{help.status}</span>
            <ChevronRight className={`h-4 w-4 text-iam-muted transition ${expanded === help.id ? "rotate-90" : ""}`} />
          </button>
          {expanded === help.id && <div className="border-t border-white/10 px-4 pb-4"><MemberHelpDetail help={help} /></div>}
        </div>
      ))}

      {filtered.length > 0 && (
        <Link
          to={typeFolder === "all" ? "/help" : `/help?type=${typeFolder}`}
          className="btn-gold inline-flex"
        >
          Submit another offer
        </Link>
      )}
    </div>
  );
}
