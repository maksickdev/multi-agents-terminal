import { useEffect } from "react";
import { X } from "lucide-react";
import { GitDiffView } from "./GitDiffView";

interface Props {
  path: string;
  staged: boolean;
  diff: string;
  loading: boolean;
  onClose: () => void;
}

export function GitDiffModal({ path, staged, diff, loading, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filename = path.split("/").pop() ?? path;
  const dir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-lg shadow-2xl overflow-hidden"
        style={{
          width: "min(900px, 90vw)",
          height: "min(700px, 85vh)",
          background: "var(--c-bg)",
          border: "1px solid var(--c-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-10 flex-shrink-0"
          style={{ background: "var(--c-bg-deep)", borderBottom: "1px solid var(--c-border)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
              style={{
                background: staged ? "rgba(70,130,70,0.2)" : "rgba(180,130,50,0.2)",
                color: staged ? "var(--c-success)" : "var(--c-accent-yellow)",
              }}
            >
              {staged ? "staged" : "unstaged"}
            </span>
            <span className="text-sm font-medium text-[var(--c-text-bright)] truncate">{filename}</span>
            {dir && (
              <span className="text-xs text-[var(--c-text-dim)] truncate hidden sm:block">{dir}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] hover:bg-[var(--c-bg-elevated)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[var(--c-text-dim)] text-xs">
              Loading diff…
            </div>
          ) : (
            <GitDiffView diff={diff} />
          )}
        </div>
      </div>
    </div>
  );
}
