import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { GitDiffView } from "./GitDiffView";

// ── types ─────────────────────────────────────────────────────────────────────

export interface SidebarFile {
  path: string;
  status: string;   // M, A, D, R, C, ?
  staged?: boolean; // undefined = commit file; true/false = working-tree file
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface Props {
  /** Flat list of files to show in the sidebar */
  files: SidebarFile[];
  /** Path of the initially active file */
  initialPath: string;
  /** For working-tree mode: which staged/unstaged entry is initially active */
  initialStaged?: boolean;
  /** Called to load diff content for a file */
  onLoadDiff: (file: SidebarFile) => Promise<string>;
  /** Present → commit mode header; absent → working-tree mode header */
  commitInfo?: CommitInfo;
  onClose: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  A: "var(--c-success)",
  M: "var(--c-accent-yellow)",
  D: "var(--c-danger)",
  R: "var(--c-accent-cyan)",
  C: "var(--c-accent-cyan)",
  "?": "var(--c-success)",
};

function fileKey(f: SidebarFile): string {
  return `${f.staged ?? "commit"}::${f.path}`;
}

// ── sidebar row ───────────────────────────────────────────────────────────────

function SidebarRow({
  file,
  isActive,
  onClick,
}: {
  file: SidebarFile;
  isActive: boolean;
  onClick: () => void;
}) {
  const name = file.path.split("/").pop() ?? file.path;
  const dir  = file.path.includes("/")
    ? file.path.substring(0, file.path.lastIndexOf("/"))
    : "";

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-[5px] cursor-pointer select-none transition-colors ${
        isActive ? "bg-[var(--c-bg-selected)]" : "hover:bg-[var(--c-bg-elevated)]"
      }`}
    >
      <span
        className="flex-shrink-0 w-3 text-center font-bold text-[9px]"
        style={{ color: STATUS_COLOR[file.status] ?? "var(--c-text-dim)" }}
      >
        {file.status}
      </span>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className="text-[11px] truncate leading-tight"
          style={{ color: isActive ? "var(--c-text-bright)" : "var(--c-text)" }}
        >
          {name}
        </span>
        {dir && (
          <span className="text-[9px] text-[var(--c-muted)] truncate leading-tight">{dir}</span>
        )}
      </div>
    </div>
  );
}

// ── section label ─────────────────────────────────────────────────────────────

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--c-text-dim)] border-b border-[var(--c-border)] select-none">
      {label}
    </div>
  );
}

// ── main modal ────────────────────────────────────────────────────────────────

export function GitDiffModal({
  files,
  initialPath,
  initialStaged,
  onLoadDiff,
  commitInfo,
  onClose,
}: Props) {
  const [activeFile, setActiveFile] = useState<SidebarFile>(() => {
    if (initialStaged !== undefined) {
      return (
        files.find(f => f.path === initialPath && f.staged === initialStaged) ??
        files.find(f => f.path === initialPath) ??
        files[0] ?? { path: "", status: "" }
      );
    }
    return files.find(f => f.path === initialPath) ?? files[0] ?? { path: "", status: "" };
  });

  const [diff, setDiff]       = useState("");
  const [loading, setLoading] = useState(true);

  // Keep a stable ref so the effect closure always calls the latest onLoadDiff
  const onLoadDiffRef = useRef(onLoadDiff);
  useEffect(() => { onLoadDiffRef.current = onLoadDiff; });

  // Load diff whenever the active file changes
  useEffect(() => {
    if (!activeFile.path) return;
    let cancelled = false;
    setLoading(true);
    setDiff("");
    onLoadDiffRef.current(activeFile)
      .then(d  => { if (!cancelled) { setDiff(d);  setLoading(false); } })
      .catch(() => { if (!cancelled) { setDiff(""); setLoading(false); } });
    return () => { cancelled = true; };
  }, [activeFile.path, activeFile.staged]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── derived ─────────────────────────────────────────────────────────────────
  const filename = activeFile.path.split("/").pop() ?? activeFile.path;
  const dir      = activeFile.path.includes("/")
    ? activeFile.path.substring(0, activeFile.path.lastIndexOf("/"))
    : "";

  const isWorkingTree = files.some(f => f.staged !== undefined);
  const stagedGroup   = isWorkingTree ? files.filter(f => f.staged === true)  : [];
  const unstagedGroup = isWorkingTree ? files.filter(f => f.staged === false) : [];
  const commitGroup   = isWorkingTree ? [] : files;

  const activeKey = fileKey(activeFile);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-lg shadow-2xl overflow-hidden"
        style={{
          width: "min(1000px, 92vw)",
          height: "min(700px, 85vh)",
          background: "var(--c-bg)",
          border: "1px solid var(--c-border)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 h-10 flex-shrink-0 gap-3"
          style={{ background: "var(--c-bg-deep)", borderBottom: "1px solid var(--c-border)" }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {commitInfo ? (
              /* Commit mode */
              <>
                <span className="text-[10px] font-mono text-[var(--c-muted)] flex-shrink-0">
                  {commitInfo.hash}
                </span>
                <span className="text-sm font-medium text-[var(--c-text-bright)] truncate flex-1">
                  {commitInfo.message}
                </span>
                <span className="text-[10px] text-[var(--c-text-dim)] flex-shrink-0 hidden sm:inline">
                  {commitInfo.author} · {commitInfo.date}
                </span>
              </>
            ) : (
              /* Working-tree mode */
              <>
                {activeFile.staged !== undefined && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                    style={{
                      background: activeFile.staged
                        ? "rgba(70,130,70,0.2)"
                        : "rgba(180,130,50,0.2)",
                      color: activeFile.staged ? "var(--c-success)" : "var(--c-accent-yellow)",
                    }}
                  >
                    {activeFile.staged ? "staged" : "unstaged"}
                  </span>
                )}
                <span className="text-sm font-medium text-[var(--c-text-bright)] truncate">{filename}</span>
                {dir && (
                  <span className="text-xs text-[var(--c-text-dim)] truncate hidden sm:block">{dir}</span>
                )}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] hover:bg-[var(--c-bg-elevated)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body: sidebar + diff ── */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div
            className="flex-shrink-0 overflow-y-auto border-r border-[var(--c-border)]"
            style={{ width: 200, background: "var(--c-bg-deep)" }}
          >
            {commitInfo ? (
              /* Commit file list — flat */
              <div className="py-1">
                {commitGroup.map(f => (
                  <SidebarRow
                    key={fileKey(f)}
                    file={f}
                    isActive={fileKey(f) === activeKey}
                    onClick={() => setActiveFile(f)}
                  />
                ))}
              </div>
            ) : (
              /* Working-tree — grouped by staged / unstaged */
              <>
                {stagedGroup.length > 0 && (
                  <>
                    <SidebarSection label="Staged" />
                    <div className="py-1">
                      {stagedGroup.map(f => (
                        <SidebarRow
                          key={fileKey(f)}
                          file={f}
                          isActive={fileKey(f) === activeKey}
                          onClick={() => setActiveFile(f)}
                        />
                      ))}
                    </div>
                  </>
                )}
                {unstagedGroup.length > 0 && (
                  <>
                    <SidebarSection label="Changes" />
                    <div className="py-1">
                      {unstagedGroup.map(f => (
                        <SidebarRow
                          key={fileKey(f)}
                          file={f}
                          isActive={fileKey(f) === activeKey}
                          onClick={() => setActiveFile(f)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Diff content */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
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
    </div>
  );
}
