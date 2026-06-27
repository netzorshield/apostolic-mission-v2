import { FolderOpen, HandHeart } from "lucide-react";
import { HELP_TYPE_OPTIONS, SUPPORT_MISSION_TITLE } from "../lib/helpTypes";

export function SupportMissionHeader({ showFolders = false, activeFolder = "all", onSelectFolder, folderCounts = {} }) {
  return (
    <div className="mb-6">
      <div className="border-b border-iam-gold/30 pb-5">
        <p className="font-cinzel text-xs uppercase tracking-[0.35em] text-iam-gold-light">International Apostolic Mission</p>
        <h2 className="mt-2 font-playfair text-3xl text-white md:text-4xl">{SUPPORT_MISSION_TITLE}</h2>
        <p className="mt-2 font-inter text-sm text-iam-muted md:text-base">
          Choose how you want to help the mission — financial, service, prayer, resources, ministry, or other support.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_TYPE_OPTIONS.map(({ value, label, description }) => (
          <div
            key={value}
            className={`rounded-xl border p-4 transition ${
              showFolders && activeFolder === value
                ? "border-iam-gold/50 bg-iam-gold/10"
                : "border-white/10 bg-black/20"
            } ${showFolders ? "cursor-pointer hover:border-iam-gold/40 hover:bg-white/5" : ""}`}
            onClick={showFolders && onSelectFolder ? () => onSelectFolder(value) : undefined}
            onKeyDown={
              showFolders && onSelectFolder
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectFolder(value);
                    }
                  }
                : undefined
            }
            role={showFolders ? "button" : undefined}
            tabIndex={showFolders ? 0 : undefined}
          >
            <div className="flex items-start gap-2">
              {showFolders ? (
                <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-iam-gold" />
              ) : (
                <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-iam-gold" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-playfair text-base text-iam-gold-light">{label}</p>
                <p className="mt-1 font-inter text-xs leading-relaxed text-white/75">{description}</p>
                {showFolders && folderCounts[value] != null && (
                  <p className="mt-2 font-inter text-[10px] uppercase tracking-wider text-iam-muted">
                    {folderCounts[value]} submission{folderCounts[value] === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showFolders && onSelectFolder && (
        <button
          type="button"
          onClick={() => onSelectFolder("all")}
          className={`mt-4 rounded-lg border px-4 py-2 font-inter text-xs uppercase tracking-widest transition ${
            activeFolder === "all"
              ? "border-iam-gold/50 bg-iam-gold/15 text-iam-gold-light"
              : "border-white/10 text-iam-muted hover:border-white/20 hover:text-white"
          }`}
        >
          All folders ({Object.values(folderCounts).reduce((a, b) => a + b, 0)})
        </button>
      )}
    </div>
  );
}
