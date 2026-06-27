import { useMemo, useState } from "react";
import { SupportMissionHeader } from "./SupportMissionHeader";
import HelpSubmissionList from "./HelpSubmissionList";
import HelpSubmissionsDetailsPanel from "./HelpSubmissionsDetailsPanel";
import { HELP_TYPE_OPTIONS } from "../lib/helpTypes";

export default function SupportOurMissionPanel({ helps, expanded, setExpanded, onUpdate, onDelete }) {
  const [typeFolder, setTypeFolder] = useState("all");

  const folderCounts = useMemo(() => {
    const counts = Object.fromEntries(HELP_TYPE_OPTIONS.map(({ value }) => [value, 0]));
    helps.forEach((h) => {
      if (counts[h.help_type] != null) counts[h.help_type] += 1;
    });
    return counts;
  }, [helps]);

  const filtered = typeFolder === "all" ? helps : helps.filter((h) => h.help_type === typeFolder);
  const typeLabel =
    typeFolder === "all"
      ? "All support types"
      : HELP_TYPE_OPTIONS.find((t) => t.value === typeFolder)?.label || typeFolder;

  return (
    <div className="space-y-6">
      <div className="border-b border-iam-gold/30 pb-4">
        <p className="font-cinzel text-xs uppercase tracking-[0.35em] text-iam-gold-light">International Apostolic Mission</p>
        <h2 className="mt-2 font-playfair text-3xl text-white">Our Support</h2>
        <p className="mt-2 font-inter text-sm text-iam-muted">
          Help Submissions details, support types, and incoming member offers.
        </p>
      </div>

      <HelpSubmissionsDetailsPanel />

      <SupportMissionHeader
        showFolders
        activeFolder={typeFolder}
        onSelectFolder={setTypeFolder}
        folderCounts={folderCounts}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 pt-2">
        <div>
          <p className="font-inter text-xs uppercase tracking-widest text-iam-gold">Help Submissions — inbox</p>
          <p className="mt-1 font-inter text-sm text-iam-muted">
            {typeLabel} — {filtered.length} submission{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="font-inter text-xs text-iam-muted">Members submit at /help after sign-in</p>
      </div>

      <HelpSubmissionList
        helps={filtered}
        expanded={expanded}
        setExpanded={setExpanded}
        onUpdate={onUpdate}
        onDelete={onDelete}
        emptyMessage="No offers in this support type yet. Members sign in and open /help to submit."
      />
    </div>
  );
}
