import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import {
  gitStatus, gitDiff, gitStage, gitStageAll,
  gitUnstage, gitUnstageAll, gitDiscard, gitCommit,
  gitInit, gitPull, gitPush,
  gitPullWithPassphrase, gitPushWithPassphrase,
  readFileText,
  type GitFileStatus, type GitStatus,
} from "../../lib/tauri";
import { GitAuthModal } from "./GitAuthModal";
import { ConfirmModal } from "../shared/ConfirmModal";
import { GitDiffModal } from "./GitDiffModal";
import { GitGraphView } from "./GitGraphView";
import { ContextMenu } from "../FileExplorer/ContextMenu";
import { detectLanguage } from "../../lib/languageDetect";
import {
  gitLog, type GitLogEntry,
} from "../../lib/tauri";
import {
  RefreshCw, Plus, Minus, GitCommit, CloudDownload, CloudUpload,
  ChevronDown, ChevronRight, RotateCcw, Trash2, FolderOpen,
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
    case "?": return "var(--c-success)";
    case "U": return "var(--c-danger)";
    default:  return "var(--c-text)";
  }
}

// ── file row ──────────────────────────────────────────────────────────────────

function FileRow({
  file, isSelected, isStaged, onSelect, onStage, onUnstage, onDiscard, onContextMenu,
}: {
  file: GitFileStatus;
  isSelected: boolean;
  isStaged: boolean;
  onSelect: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const status = isStaged ? file.stagedStatus : file.unstagedStatus;
  const name = file.path.split("/").pop() ?? file.path;
  const dir  = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";

  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
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
  onStageAll, onUnstageAll, onDiscardAll,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onDiscardAll?: () => void;
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
        {onDiscardAll && (
          <button
            onClick={(e) => { e.stopPropagation(); onDiscardAll(); }}
            title="Discard all changes"
            className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-danger)] rounded"
          >
            <Trash2 size={11} />
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
  const { projects, selectedProjectId, gitPanelWidth, setGitPanelWidth, gitPanelOpen, bumpGitStatus, openFiles, reloadFileContent, openFile } = useStore();
  const project = projects.find((p) => p.id === selectedProjectId) ?? null;

  const [status, setStatus]           = useState<GitStatus | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [diffModal, setDiffModal] = useState<{ path: string; staged: boolean; diff: string; loading: boolean } | null>(null);
  const [commitMsg, setCommitMsg]     = useState("");
  const [committing, setCommitting]   = useState(false);
  const [pulling, setPulling]         = useState(false);
  const [pushing, setPushing]         = useState(false);
  const [authModal, setAuthModal]     = useState<{ operation: "push" | "pull" } | null>(null);
  const [stagedExpanded, setStagedExpanded]   = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [discardConfirm, setDiscardConfirm]   = useState<{ file: GitFileStatus } | null>(null);
  const [discardAllConfirm, setDiscardAllConfirm] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; file: GitFileStatus; isStaged: boolean } | null>(null);
  const [graphCommits, setGraphCommits] = useState<GitLogEntry[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);

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
        .then((s) => { if (!cancelled) { setStatus(s); setLoading(false); bumpGitStatus(); } })
        .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    };

    refreshRef.current = run;
    // Clear stale status immediately so we don't flash old project's data
    setStatus(null);
    setDiffModal(null);
    run();

    return () => { cancelled = true; };
  }, [project?.id, project?.path, gitPanelOpen]);

  const refresh = () => refreshRef.current();

  // ── load graph when history section is expanded ───────────────────────────
  useEffect(() => {
    if (!historyExpanded || !project || !status?.isGitRepo) return;
    let cancelled = false;
    setGraphLoading(true);
    gitLog(project.path, 200)
      .then((commits) => { if (!cancelled) { setGraphCommits(commits); setGraphLoading(false); } })
      .catch(() => { if (!cancelled) setGraphLoading(false); });
    return () => { cancelled = true; };
  }, [historyExpanded, project?.id, project?.path, status?.isGitRepo]);

  // ── auto-refresh: every 5 s when panel open + on window focus ────────────
  useEffect(() => {
    if (!gitPanelOpen) return;
    const interval = setInterval(() => refresh(), 5000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [gitPanelOpen]);

  // ── reload editor if file is open after external change ──────────────────
  const reloadIfOpen = (relativePath: string) => {
    if (!project) return;
    const fullPath = `${project.path}/${relativePath}`;
    if (openFiles.some((f) => f.path === fullPath)) {
      readFileText(fullPath)
        .then((content) => reloadFileContent(fullPath, content))
        .catch(() => {});
    }
  };

  // ── open diff modal ───────────────────────────────────────────────────────
  const openDiff = (path: string, staged: boolean) => {
    if (!project) return;
    setDiffModal({ path, staged, diff: "", loading: true });
    gitDiff(project.path, path, staged)
      .then((d) => setDiffModal((m) => m && m.path === path ? { ...m, diff: d, loading: false } : m))
      .catch(() => setDiffModal((m) => m && m.path === path ? { ...m, loading: false } : m));
  };

  if (!project) {
    return (
      <div
        style={{ width: gitPanelOpen ? gitPanelWidth : 0, flexShrink: 0, overflow: "hidden" }}
        className="bg-[var(--c-bg-deep)] border-r border-[var(--c-border)]"
      />
    );
  }

  const stagedFiles   = status?.files.filter(f => f.stagedStatus !== " " && f.stagedStatus !== "?") ?? [];
  // git2 returns stagedStatus=" " unstagedStatus="?" for untracked files
  const unstagedFiles  = status?.files.filter(f => f.unstagedStatus !== " " && f.unstagedStatus !== "?") ?? [];
  const untrackedFiles = status?.files.filter(f => f.unstagedStatus === "?") ?? [];
  const allChanges     = [...unstagedFiles, ...untrackedFiles];

  const { branch } = status ?? { branch: { branch: "", ahead: 0, behind: 0, hasRemote: false } };

  const doCommit = async () => {
    if (!commitMsg.trim() || !project || stagedFiles.length === 0) return;
    setCommitting(true);
    try {
      await gitCommit(project.path, commitMsg.trim());
      setCommitMsg("");
      setDiffModal(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  };

  const AUTH_PREFIX = "AUTH_REQUIRED:";

  const doPull = async (passphrase?: string) => {
    if (!project) return;
    setPulling(true);
    setError(null);
    try {
      await (passphrase
        ? gitPullWithPassphrase(project.path, passphrase)
        : gitPull(project.path));
      await refresh();
    } catch (e) {
      const msg = String(e);
      if (msg.startsWith(AUTH_PREFIX)) {
        setAuthModal({ operation: "pull" });
      } else {
        setError(msg);
      }
    } finally {
      setPulling(false);
    }
  };

  const doPush = async (passphrase?: string) => {
    if (!project) return;
    setPushing(true);
    setError(null);
    try {
      await (passphrase
        ? gitPushWithPassphrase(project.path, passphrase)
        : gitPush(project.path));
      await refresh();
    } catch (e) {
      const msg = String(e);
      if (msg.startsWith(AUTH_PREFIX)) {
        setAuthModal({ operation: "push" });
      } else {
        setError(msg);
      }
    } finally {
      setPushing(false);
    }
  };

  const handleAuthConfirm = (passphrase: string) => {
    const op = authModal?.operation;
    setAuthModal(null);
    if (op === "push") doPush(passphrase);
    else if (op === "pull") doPull(passphrase);
  };

  const doDiscard = async (file: GitFileStatus) => {
    if (!project) return;
    setDiscardConfirm(null);
    try {
      await gitDiscard(project.path, file.path);
      refresh();
      reloadIfOpen(file.path);
    } catch (e) {
      setError(String(e));
    }
  };

  const openFileInEditor = async (relativePath: string) => {
    if (!project) return;
    // Capture synchronously before any await — avoids stale closure after re-render
    const projectId   = project.id;
    const projectPath = project.path;
    const fileName    = relativePath.split("/").pop() ?? relativePath;
    const fullPath    = `${projectPath}/${relativePath}`;
    try {
      const content = await readFileText(fullPath);
      openFile({ path: fullPath, projectId, content, isDirty: false, language: detectLanguage(fileName) });
    } catch (e) {
      console.error("[openFileInEditor] failed:", fullPath, e);
      setError(String(e));
    }
  };

  const doDiscardAll = async () => {
    if (!project) return;
    setDiscardAllConfirm(false);
    // Discard all modified tracked files (not untracked)
    try {
      for (const f of unstagedFiles) {
        await gitDiscard(project.path, f.path);
        reloadIfOpen(f.path);
      }
      refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  // split the panel vertically: top = file list, bottom = diff
  return (
    <>
    {authModal && (
      <GitAuthModal
        operation={authModal.operation}
        onConfirm={handleAuthConfirm}
        onCancel={() => setAuthModal(null)}
      />
    )}
    {ctxMenu && (
      <ContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        onClose={() => setCtxMenu(null)}
        items={[
          ctxMenu.isStaged
            ? { label: "Unstage", icon: Minus, onClick: () => gitUnstage(project!.path, ctxMenu.file.path).then(refresh) }
            : { label: "Stage", icon: Plus, onClick: () => gitStage(project!.path, ctxMenu.file.path).then(refresh) },
          ...(!ctxMenu.isStaged && ctxMenu.file.unstagedStatus !== "?"
            ? [{ label: "Discard changes", icon: RotateCcw, danger: true as const, onClick: () => setDiscardConfirm({ file: ctxMenu.file }) }]
            : []),
          { label: "Open file", icon: FolderOpen, onClick: () => openFileInEditor(ctxMenu.file.path) },
        ]}
      />
    )}
    {discardConfirm && (
      <ConfirmModal
        title="Discard Changes"
        message={`Discard all changes in "${discardConfirm.file.path.split("/").pop()}"? This cannot be undone.`}
        confirmLabel="Discard"
        danger
        onConfirm={() => doDiscard(discardConfirm.file)}
        onCancel={() => setDiscardConfirm(null)}
      />
    )}
    {discardAllConfirm && (
      <ConfirmModal
        title="Discard All Changes"
        message={`Discard changes in all ${unstagedFiles.length} modified file${unstagedFiles.length !== 1 ? "s" : ""}? This cannot be undone.`}
        confirmLabel="Discard All"
        danger
        onConfirm={doDiscardAll}
        onCancel={() => setDiscardAllConfirm(false)}
      />
    )}
    {diffModal && (
      <GitDiffModal
        path={diffModal.path}
        staged={diffModal.staged}
        diff={diffModal.diff}
        loading={diffModal.loading}
        onClose={() => setDiffModal(null)}
      />
    )}
    <div
      data-git-panel
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
              <button onClick={() => doPull()} title="Pull" disabled={pulling}
                className="p-1 text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] disabled:opacity-40 rounded transition-colors">
                <CloudDownload size={13} />
              </button>
              <button onClick={() => doPush()} title="Push" disabled={pushing}
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
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-3">
          {status === null && !error ? (
            <span className="text-xs text-[var(--c-text-dim)]">Loading…</span>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--c-text-dim)]">Not a git repository</span>
                {project && (
                  <span className="text-[10px] text-[var(--c-text-dim)] opacity-50 break-all">{project.path}</span>
                )}
              </div>
              <button
                onClick={async () => {
                  if (!project) return;
                  try {
                    await gitInit(project.path);
                    refresh();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: "var(--c-accent)/15",
                  backgroundColor: "color-mix(in srgb, var(--c-accent) 15%, transparent)",
                  color: "var(--c-accent)",
                  border: "1px solid color-mix(in srgb, var(--c-accent) 30%, transparent)",
                }}
              >
                Initialize Repository
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">

          {/* ── File lists + History ── */}
          {/* ── Staged + Changes — fixed area, scrolls if many files ── */}
          <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: "45%" }}>
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
                isSelected={false}
                isStaged={true}
                onSelect={() => openDiff(f.path, true)}
                onStage={() => {}}
                onUnstage={() => gitUnstage(project.path, f.path).then(refresh)}
                onDiscard={() => {}}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, file: f, isStaged: true }); }}
              />
            ))}

            {/* Changes */}
            <SectionHeader
              label="Changes"
              count={allChanges.length}
              expanded={changesExpanded}
              onToggle={() => setChangesExpanded(v => !v)}
              onStageAll={allChanges.length > 0 ? () => gitStageAll(project.path).then(refresh) : undefined}
              onDiscardAll={unstagedFiles.length > 0 ? () => setDiscardAllConfirm(true) : undefined}
            />
            {changesExpanded && allChanges.map(f => (
              <FileRow
                key={`unstaged-${f.path}`}
                file={f}
                isSelected={false}
                isStaged={false}
                onSelect={() => openDiff(f.path, false)}
                onStage={() => gitStage(project.path, f.path).then(refresh)}
                onUnstage={() => {}}
                onDiscard={() => setDiscardConfirm({ file: f })}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, file: f, isStaged: false }); }}
              />
            ))}

            {status.files.length === 0 && (
              <div className="text-[var(--c-text-dim)] text-xs px-3 py-3 italic">
                No changes
              </div>
            )}
          </div>

          {/* ── History — fills all remaining space ── */}
          <div className="flex flex-col flex-1 min-h-0 border-t border-[var(--c-border)]">
            <SectionHeader
              label="History"
              count={graphCommits.length}
              expanded={historyExpanded}
              onToggle={() => setHistoryExpanded(v => !v)}
            />
            {historyExpanded && (
              <div className="flex-1 min-h-0">
                <GitGraphView commits={graphCommits} loading={graphLoading} projectPath={project.path} />
              </div>
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
    </>
  );
}
