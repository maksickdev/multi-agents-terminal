import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { gitCommitFiles, type CommitFile, type GitLogEntry } from "../../lib/tauri";

const STATUS_COLOR: Record<string, string> = {
  A: "var(--c-success)",
  M: "var(--c-accent-yellow)",
  D: "var(--c-danger)",
  R: "var(--c-accent-cyan)",
  C: "var(--c-accent-cyan)",
};

const STATUS_LABEL: Record<string, string> = {
  A: "A", M: "M", D: "D", R: "R", C: "C", "?": "?",
};

interface Props {
  commit: GitLogEntry;
  projectPath: string;
  anchorRect: DOMRect;
  panelRect: DOMRect;
}

export function GitCommitTooltip({ commit, projectPath, anchorRect, panelRect }: Props) {
  const [files, setFiles] = useState<CommitFile[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    gitCommitFiles(projectPath, commit.hash)
      .then((f) => { if (!cancelled) setFiles(f); })
      .catch(() => { if (!cancelled) setFiles([]); });
    return () => { cancelled = true; };
  }, [commit.hash, projectPath]);

  // Position: prefer right of panel, fall back to left
  const TOOLTIP_W = 300;
  const TOOLTIP_MAX_H = 360;
  const GAP = 6;

  // Try to place to the right of the panel
  let left = panelRect.right + GAP;
  if (left + TOOLTIP_W > window.innerWidth) {
    // No room on right — place to the left of the panel
    left = panelRect.left - TOOLTIP_W - GAP;
  }

  // Vertically align with the hovered row, clamp to viewport
  let top = anchorRect.top - 4;
  const maxTop = window.innerHeight - TOOLTIP_MAX_H - 8;
  if (top > maxTop) top = maxTop;
  if (top < 8) top = 8;

  return ReactDOM.createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top,
        left,
        width: TOOLTIP_W,
        maxHeight: TOOLTIP_MAX_H,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="flex flex-col bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--c-border)] flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-[var(--c-muted)]">{commit.shortHash}</span>
          {commit.refs.map((r) => (
            <span
              key={r}
              className="text-[9px] px-1 rounded font-mono"
              style={{
                background: "color-mix(in srgb, var(--c-accent) 15%, transparent)",
                color: "var(--c-accent)",
                border: "1px solid color-mix(in srgb, var(--c-accent) 30%, transparent)",
              }}
            >
              {r}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-[var(--c-text-bright)] font-medium leading-snug line-clamp-2">
          {commit.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-[var(--c-text-dim)]">{commit.author}</span>
          <span className="text-[10px] text-[var(--c-muted)]">·</span>
          <span className="text-[10px] text-[var(--c-text-dim)]">{commit.date}</span>
        </div>
      </div>

      {/* File list */}
      <div className="overflow-y-auto flex-1">
        {files === null ? (
          <div className="px-3 py-3 text-[10px] text-[var(--c-text-dim)]">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-3 py-3 text-[10px] text-[var(--c-text-dim)] italic">No file changes</div>
        ) : (
          <div className="py-1">
            {files.map((f, i) => {
              const name = f.path.split("/").pop() ?? f.path;
              const dir  = f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "";
              return (
                <div key={i} className="flex items-center gap-1.5 px-3 py-[3px]">
                  <span
                    className="text-[9px] font-bold w-3 text-center flex-shrink-0"
                    style={{ color: STATUS_COLOR[f.status] ?? "var(--c-text-dim)" }}
                  >
                    {STATUS_LABEL[f.status] ?? f.status}
                  </span>
                  <span className="text-[10px] text-[var(--c-text)] truncate flex-1">{name}</span>
                  {dir && (
                    <span className="text-[9px] text-[var(--c-muted)] truncate flex-shrink-0 max-w-[80px]">
                      {dir}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: total files */}
      {files && files.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[var(--c-border)] flex-shrink-0">
          <span className="text-[9px] text-[var(--c-muted)]">
            {files.length} file{files.length !== 1 ? "s" : ""} changed
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}
