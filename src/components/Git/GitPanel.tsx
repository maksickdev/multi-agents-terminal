import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import {
  gitStatus, gitDiff, gitStage, gitStageAll,
  gitUnstage, gitUnstageAll, gitDiscard, gitCommit, gitPull, gitPush,
  type GitFileStatus, type GitStatus,
} from "../../lib/tauri";
import { GitDiffView } from "./GitDiffView";
import {
  RefreshCw, Plus, Minus, GitCommit, CloudDownload, CloudUpload,
  ChevronDown, ChevronRight, RotateCcw,
} from "lucide-react";

// ── status helpers ────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  switch (s) {
    case "M": return "M";
    case "A": return "A";
    case "D": return "D";
    case "R": return "R";
    case "C": return "C";
    case "?": return "U"; // untracked
    case "U": return "!"; // conflict
    default:  return s;
  }
}

function statusColor(s: string): string {
  switch (s) {
    case "M": return "var(--c-accent-yellow)";
    case "A": return "var(--c-success)";
    case "D": return "var(--c-danger)";
    case "R": return "var(--c-accent-cyan)";
    case "?": return "var(--c-text-dim)";
    case "U": return "var(--c-danger)";
    default:  return "var(--c-text)";
  }
}

// ── file row ──────────────────────────────────────────────────────────────────

function FileRow({
  file, isSelected, isStaged, onSelect, onStage, onUnstage, onDiscard,
}: {
  file: GitFileStatus;
  isSelected: boolean;
  isStaged: boolean;
  onSelect: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
}) {
  const status = isStaged ? file.stagedStatus : file.unstagedStatus;
  const name = file.path.split("/").pop() ?? file.path;
  const dir  = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-1.5 px-2 py-0.5 cursor-pointer text-xs select-none transition-colors ${
        isSelected ? "bg-[var(--c-bg-selected)]" : "hover:bg-[var(--c-bg-elevated)]"
      }`}
    >
      {/* Status badge */}
      <span
        className="flex-shrink-0 w-4 text-center font-bold text-[10px]"
        style={{ color: statusColor(status) }}
      >
        {statusLabel(status)}
      </span>

      {/* Filename */}
      <span className="flex-1 truncate text-[var(--c-text)]" title={file.path}>
        {name}
        {dir && <span className="ml-1 text-[var(--c-text-dim)] text-[10px]">{dir}</span>}
      </span>

      {/* Action buttons — appear on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isStaged ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnstage(); }}
            title="Unstage"
            className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] rounded"
          >
            <Minus size={11} />
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onStage(); }}
              title="Stage"
              className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-success)] rounded"
            >
              <Plus size={11} />
            </button>
            {status !== "?" && (
              <button
                onClick={(e) => { e.stopPropagation(); onDiscard(); }}
                title="Discard changes"
                className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-danger)] rounded"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label, count, expanded, onToggle,
  onStageAll, onUnstageAll,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-1 px-2 py-1 cursor-pointer select-none hover:bg-[var(--c-bg-elevated)] transition-colors group"
    >
      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text-dim)] flex-1">
        {label} ({count})
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onStageAll && (
          <button
            onClick={(e) => { e.stopPropagation(); onStageAll(); }}
            title="Stage all"
            className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-success)] rounded"
          >
            <Plus size={11} />
          </button>
        )}
        {onUnstageAll && (
          <button
            onClick={(e) => { e.stopPropagation(); onUnstageAll(); }}
            title="Unstage all"
            className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-accent-yellow)] rounded"
          >
            <Minus size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── main panel ────────────────────────────────────────────────────────────────

export function GitPanel() {
  const { projects, selectedProjectId, gitPanelWidth, setGitPanelWidth, gitPanelOpen } = useStore();
  const project = projects.find((p) => p.id === selectedProjectId) ?? null;

  const [status, setStatus]           = useState<GitStatus | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [diff, setDiff]               = useState<string>("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [commitMsg, setCommitMsg]     = useState("");
  const [committing, setCommitting]   = useState(false);
  const [pulling, setPulling]         = useState(false);
  const [pushing, setPushing]         = useState(false);
  const [stagedExpanded, setStagedExpanded]   = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);

  // ── resize ──────────────────────────────────────────────────────────────────
  const resizingRef = useRef(false);
  const startXRef   = useRef(0);
  const startWRef   = useRef(0);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = gitPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setGitPanelWidth(startWRef.current + (ev.clientX - startXRef.current));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── fetch status ─────────────────────────────────────────────────────────
  // Ref so that manual "Refresh" button always calls the latest version
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!gitPanelOpen || !project) return;

    let cancelled = false;

    const run = () => {
      setLoading(true);
      setError(null);
      gitStatus(project.path)
        .then((s) => { if (!cancelled) { setStatus(s); setLoading(false); } })
        .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    };

    refreshRef.current = run;
    // Clear stale status immediately so we don't flash old project's data
    setStatus(null);
    setSelectedFile(null);
    run();

    return () => { cancelled = true; };
  }, [project?.id, project?.path, gitPanelOpen]);

  const refresh = () => refreshRef.current();

  // ── fetch diff ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFile || !project) { setDiff(""); return; }
    setDiffLoading(true);
    gitDiff(project.path, selectedFile.path, selectedFile.staged)
      .then(setDiff)
      .catch(() => setDiff(""))
      .finally(() => setDiffLoading(false));
  }, [selectedFile?.path, selectedFile?.staged, project?.path]);

  if (!project) {
    return (
      <div
        style={{ width: gitPanelOpen ? gitPanelWidth : 0, flexShrink: 0, overflow: "hidden" }}
        className="bg-[var(--c-bg-deep)] border-r border-[var(--c-border)]"
      />
    );
  }

  const stagedFiles   = status?.files.filter(f => f.stagedStatus !== " " && f.stagedStatus !== "?") ?? [];
  const unstagedFiles = status?.files.filter(f => f.unstagedStatus !== " " && f.unstagedStatus !== "?") ?? [];
  const untrackedFiles = status?.files.filter(f => f.stagedStatus === "?" && f.unstagedStatus === "?") ?? [];
  const allChanges    = [...unstagedFiles, ...untrackedFiles];

  const { branch } = status ?? { branch: { branch: "", ahead: 0, behind: 0, hasRemote: false } };

  const doCommit = async () => {
    if (!commitMsg.trim() || !project || stagedFiles.length === 0) return;
    setCommitting(true);
    try {
      await gitCommit(project.path, commitMsg.trim());
      setCommitMsg("");
      setSelectedFile(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  };

  const doPull = async () => {
    if (!project) return;
    setPulling(true);
    try { await gitPull(project.path); await refresh(); }
    catch (e) { setError(String(e)); }
    finally { setPulling(false); }
  };

  const doPush = async () => {
    if (!project) return;
    setPushing(true);
    try { await gitPush(project.path); await refresh(); }
    catch (e) { setError(String(e)); }
    finally { setPushing(false); }
  };

  // split the panel vertically: top = file list, bottom = diff
  return (
    <div
      style={{ width: gitPanelOpen ? gitPanelWidth : 0, flexShrink: 0, overflow: "hidden", position: "relative" }}
      className="flex flex-col bg-[var(--c-bg-deep)] border-r border-[var(--c-border)] h-full"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-2 h-8 border-b border-[var(--c-border)] flex-shrink-0 select-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text-dim)]">Git</span>
          {status?.isGitRepo && branch.branch && (
            <span className="text-xs text-[var(--c-accent)] truncate font-medium">{branch.branch}</span>
          )}
          {status?.isGitRepo && (branch.ahead > 0 || branch.behind > 0) && (
            <span className="text-[10px] text-[var(--c-text-dim)]">
              {branch.ahead > 0 && `↑${branch.ahead}`}{branch.behind > 0 && ` ↓${branch.behind}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {status?.isGitRepo && branch.hasRemote && (
            <>
              <button onClick={doPull} title="Pull" disabled={pulling}
                className="p-1 text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] disabled:opacity-40 rounded transition-colors">
                <CloudDownload size={13} />
              </button>
              <button onClick={doPush} title="Push" disabled={pushing}
                className="p-1 text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] disabled:opacity-40 rounded transition-colors">
                <CloudUpload size={13} />
              </button>
            </>
          )}
          <button onClick={refresh} title="Refresh" disabled={loading}
            className={`p-1 text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] rounded transition-colors ${loading ? "animate-spin" : ""}`}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Error shown regardless of git status so PATH / exec errors are visible */}
      {error && (
        <div className="flex-shrink-0 text-[var(--c-danger)] text-xs px-3 py-2 leading-relaxed border-b border-[var(--c-border)]">
          {error}
        </div>
      )}

      {!status?.isGitRepo ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--c-text-dim)] text-xs p-4 text-center gap-2">
          {status === null && !error ? (
            <span>Loading…</span>
          ) : (
            <>
              <span>Not a git repository</span>
              {project && (
                <span className="text-[10px] opacity-60 break-all">{project.path}</span>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* ── File lists (top half) ── */}
          <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: "50%" }}>

            {/* Staged */}
            <SectionHeader
              label="Staged"
              count={stagedFiles.length}
              expanded={stagedExpanded}
              onToggle={() => setStagedExpanded(v => !v)}
              onUnstageAll={stagedFiles.length > 0 ? () => gitUnstageAll(project.path).then(refresh) : undefined}
            />
            {stagedExpanded && stagedFiles.map(f => (
              <FileRow
                key={`staged-${f.path}`}
                file={f}
                isSelected={selectedFile?.path === f.path && selectedFile?.staged === true}
                isStaged={true}
                onSelect={() => setSelectedFile({ path: f.path, staged: true })}
                onStage={() => {}}
                onUnstage={() => gitUnstage(project.path, f.path).then(refresh)}
                onDiscard={() => {}}
              />
            ))}

            {/* Changes */}
            <SectionHeader
              label="Changes"
              count={allChanges.length}
              expanded={changesExpanded}
              onToggle={() => setChangesExpanded(v => !v)}
              onStageAll={allChanges.length > 0 ? () => gitStageAll(project.path).then(refresh) : undefined}
            />
            {changesExpanded && allChanges.map(f => (
              <FileRow
                key={`unstaged-${f.path}`}
                file={f}
                isSelected={selectedFile?.path === f.path && selectedFile?.staged === false}
                isStaged={false}
                onSelect={() => setSelectedFile({ path: f.path, staged: false })}
                onStage={() => gitStage(project.path, f.path).then(refresh)}
                onUnstage={() => {}}
                onDiscard={() => gitDiscard(project.path, f.path).then(refresh)}
              />
            ))}

            {status.files.length === 0 && (
              <div className="text-[var(--c-text-dim)] text-xs px-3 py-3 italic">
                No changes
              </div>
            )}
          </div>

          {/* ── Diff view (bottom half) ── */}
          <div className="flex-1 min-h-0 border-t border-[var(--c-border)] overflow-hidden">
            {diffLoading ? (
              <div className="flex items-center justify-center h-full text-[var(--c-text-dim)] text-xs">
                Loading diff…
              </div>
            ) : (
              <GitDiffView diff={diff} />
            )}
          </div>

          {/* ── Commit bar ── */}
          <div className="flex-shrink-0 border-t border-[var(--c-border)] p-2 flex flex-col gap-1.5">
            <textarea
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && e.metaKey) { e.preventDefault(); doCommit(); }
              }}
              placeholder="Commit message (⌘↵)"
              rows={2}
              className="w-full text-xs bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)] rounded px-2 py-1.5 outline-none resize-none placeholder:text-[var(--c-text-dim)] border border-[var(--c-border)] focus:border-[var(--c-accent)] transition-colors"
            />
            <button
              onClick={doCommit}
              disabled={!commitMsg.trim() || stagedFiles.length === 0 || committing}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30 disabled:cursor-not-allowed"
            >
              <GitCommit size={12} />
              {committing ? "Committing…" : `Commit${stagedFiles.length > 0 ? ` (${stagedFiles.length})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={onHandleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize hover:bg-[var(--c-accent)]/20 transition-colors"
      />
    </div>
  );
}
