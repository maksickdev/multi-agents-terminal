import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import {
  gitStatus, gitDiff, gitStage, gitStageAll,
  gitUnstage, gitUnstageAll, gitDiscard, gitCommit,
  gitInit, gitPull, gitPush,
  gitPullWithPassphrase, gitPushWithPassphrase,
  gitLog, gitCommitFiles, gitCommitFileDiff,
  gitBranches, gitCheckout, gitCreateBranch,
  gitRemotes, gitAddRemote, gitRemoveRemote, gitPushUpstream,
  readFileText,
  type GitFileStatus, type GitStatus, type GitLogEntry, type GitBranchEntry, type GitRemote,
} from "../../lib/tauri";
import { GitAuthModal } from "./GitAuthModal";
import { ConfirmModal } from "../shared/ConfirmModal";
import { GitDiffModal, type SidebarFile } from "./GitDiffModal";
import { GitGraphView } from "./GitGraphView";
import { GitNewBranchModal } from "./GitNewBranchModal";
import { GitAddRemoteModal } from "./GitAddRemoteModal";
import { ContextMenu } from "../FileExplorer/ContextMenu";
import { detectLanguage } from "../../lib/languageDetect";
import {
  RefreshCw, Plus, Minus, GitCommit, CloudDownload, CloudUpload,
  ChevronDown, ChevronRight, RotateCcw, Trash2, FolderOpen,
  GitBranch, Check, Globe, X,
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
            <button
              onClick={(e) => { e.stopPropagation(); onDiscard(); }}
              title={status === "?" ? "Delete file" : "Discard changes"}
              className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-danger)] rounded"
            >
              {status === "?" ? <Trash2 size={11} /> : <RotateCcw size={11} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label, count, expanded, onToggle,
  onStageAll, onUnstageAll, onDiscardAll, onAdd,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onDiscardAll?: () => void;
  onAdd?: () => void;
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
        {onAdd && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            title="New branch"
            className="p-0.5 text-[var(--c-text-dim)] hover:text-[var(--c-accent)] rounded"
          >
            <Plus size={11} />
          </button>
        )}
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

// ── branch row ────────────────────────────────────────────────────────────────

function BranchRow({
  branch,
  checkingOut,
  onCheckout,
}: {
  branch: GitBranchEntry;
  checkingOut: boolean;
  onCheckout: () => void;
}) {
  return (
    <div
      onClick={() => { if (!branch.isCurrent && !checkingOut) onCheckout(); }}
      className={`group flex items-center gap-1.5 px-2 py-0.5 text-xs select-none transition-colors ${
        branch.isCurrent
          ? "cursor-default"
          : "cursor-pointer hover:bg-[var(--c-bg-elevated)]"
      }`}
    >
      {/* Current indicator */}
      <span className="flex-shrink-0 w-3.5 flex items-center justify-center">
        {branch.isCurrent
          ? <Check size={10} className="text-[var(--c-accent)]" />
          : <GitBranch size={10} className="text-[var(--c-text-dim)]" />
        }
      </span>

      {/* Name */}
      <span
        className="flex-1 truncate font-mono text-[11px] leading-relaxed"
        style={{ color: branch.isCurrent ? "var(--c-accent)" : "var(--c-text)" }}
      >
        {branch.name}
      </span>

      {/* Ahead/behind */}
      {(branch.ahead > 0 || branch.behind > 0) && (
        <span className="text-[10px] text-[var(--c-text-dim)] flex-shrink-0 tabular-nums">
          {branch.ahead > 0 && `↑${branch.ahead}`}
          {branch.behind > 0 && ` ↓${branch.behind}`}
        </span>
      )}

      {/* Checkout button shown on hover for non-current branches */}
      {!branch.isCurrent && (
        <button
          onClick={(e) => { e.stopPropagation(); onCheckout(); }}
          disabled={checkingOut}
          title={`Switch to ${branch.name}`}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--c-text-dim)] hover:text-[var(--c-accent)] disabled:opacity-30"
        >
          {checkingOut
            ? <span className="text-[9px] leading-none">…</span>
            : <Check size={11} />
          }
        </button>
      )}
    </div>
  );
}

// ── remote row ────────────────────────────────────────────────────────────────

function RemoteRow({
  remote,
  onRemove,
}: {
  remote: GitRemote;
  onRemove: () => void;
}) {
  // Display only the host+path part of the URL, strip credentials
  let displayUrl = remote.url;
  try {
    const u = new URL(remote.url);
    displayUrl = u.host + u.pathname;
  } catch {
    // not a valid URL (e.g. git@github.com:user/repo.git) — show as-is
  }

  return (
    <div className="group flex items-center gap-1.5 px-2 py-0.5 text-xs select-none">
      <Globe size={10} className="flex-shrink-0 text-[var(--c-text-dim)]" />

      {/* Name */}
      <span className="flex-shrink-0 text-[11px] font-medium text-[var(--c-text)]">
        {remote.name}
      </span>

      {/* URL */}
      <span
        className="flex-1 truncate text-[10px] text-[var(--c-text-dim)] font-mono"
        title={remote.url}
      >
        {displayUrl}
      </span>

      {/* Remove */}
      <button
        onClick={onRemove}
        title={`Remove remote ${remote.name}`}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--c-text-dim)] hover:text-[var(--c-danger)]"
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ── diff modal state ──────────────────────────────────────────────────────────

interface DiffModalState {
  files: SidebarFile[];
  initialPath: string;
  initialStaged?: boolean;
  onLoadDiff: (file: SidebarFile) => Promise<string>;
  commitInfo?: { hash: string; message: string; author: string; date: string };
}

// ── main panel ────────────────────────────────────────────────────────────────

export function GitPanel() {
  const { projects, selectedProjectId, gitPanelWidth, setGitPanelWidth, gitPanelOpen, bumpGitStatus, openFiles, reloadFileContent, openFile, editorPanelOpen, setEditorPanelOpen } = useStore();
  const project = projects.find((p) => p.id === selectedProjectId) ?? null;

  const [status, setStatus]           = useState<GitStatus | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [diffModal, setDiffModal] = useState<DiffModalState | null>(null);
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
  const [graphNonce, setGraphNonce]     = useState(0);
  const [branches, setBranches]               = useState<GitBranchEntry[]>([]);
  const [branchesExpanded, setBranchesExpanded] = useState(true);
  const [checkingOut, setCheckingOut]           = useState<string | null>(null);
  const [newBranchModal, setNewBranchModal]     = useState<{ fromRef?: string } | null>(null);
  const [creatingBranch, setCreatingBranch]     = useState(false);
  const [remotes, setRemotes]                     = useState<GitRemote[]>([]);
  const [remotesExpanded, setRemotesExpanded]     = useState(true);
  const [addRemoteModal, setAddRemoteModal]       = useState(false);
  const [addingRemote, setAddingRemote]           = useState(false);
  const [removeRemoteConfirm, setRemoveRemoteConfirm] = useState<GitRemote | null>(null);
  const [commitAreaHeight, setCommitAreaHeight] = useState(80);

  // ── resize ──────────────────────────────────────────────────────────────────
  const panelRef    = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startXRef   = useRef(0);
  const startWRef   = useRef(0);

  const commitResizingRef = useRef(false);
  const commitStartYRef   = useRef(0);
  const commitStartHRef   = useRef(0);

  const onCommitHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    commitResizingRef.current = true;
    commitStartYRef.current = e.clientY;
    commitStartHRef.current = commitAreaHeight;
    const onMove = (ev: MouseEvent) => {
      if (!commitResizingRef.current) return;
      const delta = commitStartYRef.current - ev.clientY;
      setCommitAreaHeight(Math.max(52, Math.min(400, commitStartHRef.current + delta)));
    };
    const onUp = () => {
      commitResizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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

  const refresh = () => {
    refreshRef.current();
    setGraphNonce(n => n + 1);
  };

  // ── load graph when history section is expanded ───────────────────────────
  useEffect(() => {
    if (!historyExpanded || !project || !status?.isGitRepo) return;
    let cancelled = false;
    setGraphLoading(true);
    gitLog(project.path, 200)
      .then((commits) => { if (!cancelled) { setGraphCommits(commits); setGraphLoading(false); } })
      .catch(() => { if (!cancelled) setGraphLoading(false); });
    return () => { cancelled = true; };
  }, [historyExpanded, project?.id, project?.path, status?.isGitRepo, graphNonce]);

  // ── load remotes after any refresh (needed for push/pull button visibility) ─
  useEffect(() => {
    if (!project || !status?.isGitRepo) return;
    let cancelled = false;
    gitRemotes(project.path)
      .then((r) => { if (!cancelled) setRemotes(r); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [project?.id, project?.path, status?.isGitRepo, graphNonce]);

  // ── load branches whenever expanded or after any refresh ─────────────────
  useEffect(() => {
    if (!branchesExpanded || !project || !status?.isGitRepo) return;
    let cancelled = false;
    gitBranches(project.path)
      .then((b) => { if (!cancelled) setBranches(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [branchesExpanded, project?.id, project?.path, status?.isGitRepo, graphNonce]);

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

  // ── file lists (computed early — needed in openDiff) ──────────────────────
  const stagedFiles    = status?.files.filter(f => f.stagedStatus !== " " && f.stagedStatus !== "?") ?? [];
  // git2 returns stagedStatus=" " unstagedStatus="?" for untracked files
  const unstagedFiles  = status?.files.filter(f => f.unstagedStatus !== " " && f.unstagedStatus !== "?") ?? [];
  const untrackedFiles = status?.files.filter(f => f.unstagedStatus === "?") ?? [];
  const allChanges     = [...unstagedFiles, ...untrackedFiles];

  // ── open diff modal (working-tree) ────────────────────────────────────────
  const openDiff = (path: string, staged: boolean) => {
    if (!project) return;
    const sidebarFiles: SidebarFile[] = [
      ...stagedFiles.map(f  => ({ path: f.path, status: f.stagedStatus,   staged: true  as const })),
      ...allChanges.map(f   => ({ path: f.path, status: f.unstagedStatus, staged: false as const })),
    ];
    const projectPath = project.path;
    setDiffModal({
      files: sidebarFiles,
      initialPath: path,
      initialStaged: staged,
      onLoadDiff: (file: SidebarFile) => gitDiff(projectPath, file.path, file.staged ?? false),
    });
  };

  // ── open diff modal (commit) ──────────────────────────────────────────────
  const openCommitDiff = async (commit: GitLogEntry) => {
    if (!project) return;
    const projectPath = project.path;
    try {
      const commitFiles = await gitCommitFiles(projectPath, commit.hash);
      if (commitFiles.length === 0) return;
      const files: SidebarFile[] = commitFiles.map(f => ({ path: f.path, status: f.status }));
      setDiffModal({
        files,
        initialPath: files[0].path,
        onLoadDiff: (file: SidebarFile) => gitCommitFileDiff(projectPath, commit.hash, file.path),
        commitInfo: { hash: commit.shortHash, message: commit.message, author: commit.author, date: commit.date },
      });
    } catch (e) {
      setError(String(e));
    }
  };

  // ── add/remove remote ────────────────────────────────────────────────────
  const doAddRemote = async (name: string, url: string) => {
    if (!project) return;
    setAddingRemote(true);
    setError(null);
    try {
      await gitAddRemote(project.path, name, url);
      setAddRemoteModal(false);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setAddingRemote(false);
    }
  };

  const doRemoveRemote = async (name: string) => {
    if (!project) return;
    setRemoveRemoteConfirm(null);
    setError(null);
    try {
      await gitRemoveRemote(project.path, name);
      refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  // ── checkout branch ───────────────────────────────────────────────────────
  const doCheckout = async (branchName: string) => {
    if (!project || checkingOut) return;
    setCheckingOut(branchName);
    setError(null);
    try {
      await gitCheckout(project.path, branchName);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setCheckingOut(null);
    }
  };

  // ── create branch ─────────────────────────────────────────────────────────
  const doCreateBranch = async (name: string, fromRef?: string) => {
    if (!project) return;
    setCreatingBranch(true);
    setError(null);
    try {
      await gitCreateBranch(project.path, name, fromRef);
      setNewBranchModal(null);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreatingBranch(false);
    }
  };

  if (!project) {
    return (
      <div
        style={{ width: gitPanelOpen ? gitPanelWidth : 0, flexShrink: 0, overflow: "hidden", ...(gitPanelOpen ? { borderRadius: 10, marginTop: 4, marginBottom: 4, marginLeft: 4, border: "1px solid var(--c-border)" } : {}) }}
        className="bg-[var(--c-bg)]"
      />
    );
  }

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
      // If no upstream tracking branch but remotes exist, set upstream on first push
      if (!branch.hasRemote && remotes.length > 0 && !passphrase) {
        const remoteName  = remotes[0].name;
        const branchName  = branch.branch;
        await gitPushUpstream(project.path, remoteName, branchName);
      } else {
        await (passphrase
          ? gitPushWithPassphrase(project.path, passphrase)
          : gitPush(project.path));
      }
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
      if (!editorPanelOpen) setEditorPanelOpen(true);
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
          ...(!ctxMenu.isStaged
            ? [{
                label: ctxMenu.file.unstagedStatus === "?" ? "Delete file" : "Discard changes",
                icon: ctxMenu.file.unstagedStatus === "?" ? Trash2 : RotateCcw,
                danger: true as const,
                onClick: () => setDiscardConfirm({ file: ctxMenu.file }),
              }]
            : []),
          { label: "Open file", icon: FolderOpen, onClick: () => openFileInEditor(ctxMenu.file.path) },
        ]}
      />
    )}
    {discardConfirm && (
      <ConfirmModal
        title={discardConfirm.file.unstagedStatus === "?" ? "Delete File" : "Discard Changes"}
        message={
          discardConfirm.file.unstagedStatus === "?"
            ? `Delete untracked file "${discardConfirm.file.path.split("/").pop()}"? This cannot be undone.`
            : `Discard all changes in "${discardConfirm.file.path.split("/").pop()}"? This cannot be undone.`
        }
        confirmLabel={discardConfirm.file.unstagedStatus === "?" ? "Delete" : "Discard"}
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
        {...diffModal}
        onClose={() => setDiffModal(null)}
      />
    )}
    {newBranchModal && (
      <GitNewBranchModal
        fromRef={newBranchModal.fromRef}
        loading={creatingBranch}
        onConfirm={doCreateBranch}
        onCancel={() => setNewBranchModal(null)}
      />
    )}
    {addRemoteModal && (
      <GitAddRemoteModal
        defaultName={remotes.length === 0 ? "origin" : ""}
        loading={addingRemote}
        onConfirm={doAddRemote}
        onCancel={() => setAddRemoteModal(false)}
      />
    )}
    {removeRemoteConfirm && (
      <ConfirmModal
        title="Remove Remote"
        message={`Remove remote "${removeRemoteConfirm.name}" (${removeRemoteConfirm.url})? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => doRemoveRemote(removeRemoteConfirm.name)}
        onCancel={() => setRemoveRemoteConfirm(null)}
      />
    )}
    <div
      ref={panelRef}
      data-git-panel
      style={{ width: gitPanelOpen ? gitPanelWidth : 0, flexShrink: 0, overflow: "hidden", position: "relative", ...(gitPanelOpen ? { borderRadius: 10, marginTop: 4, marginBottom: 4, marginLeft: 4, border: "1px solid var(--c-border)" } : {}) }}
      className="flex flex-col bg-[var(--c-bg)]"
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
          {status?.isGitRepo && (branch.hasRemote || remotes.length > 0) && (
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
          {/* ── Staged + Changes + Branches — fixed area, scrolls if many items ── */}
          <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: "55%" }}>
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

            {/* ── Branches ── */}
            <div className="border-t border-[var(--c-border)]">
              <SectionHeader
                label="Branches"
                count={branches.length}
                expanded={branchesExpanded}
                onToggle={() => setBranchesExpanded(v => !v)}
                onAdd={() => setNewBranchModal({})}
              />
              {branchesExpanded && (
                <div className="pb-1">
                  {branches.map(b => (
                    <BranchRow
                      key={b.name}
                      branch={b}
                      checkingOut={checkingOut === b.name}
                      onCheckout={() => doCheckout(b.name)}
                    />
                  ))}
                  {branches.length === 0 && (
                    <div className="text-[var(--c-text-dim)] text-xs px-3 py-1.5 italic">
                      No local branches
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Remotes ── */}
            <div className="border-t border-[var(--c-border)]">
              <SectionHeader
                label="Remotes"
                count={remotes.length}
                expanded={remotesExpanded}
                onToggle={() => setRemotesExpanded(v => !v)}
                onAdd={() => setAddRemoteModal(true)}
              />
              {remotesExpanded && (
                <div className="pb-1">
                  {remotes.map(r => (
                    <RemoteRow
                      key={r.name}
                      remote={r}
                      onRemove={() => setRemoveRemoteConfirm(r)}
                    />
                  ))}
                  {remotes.length === 0 && (
                    <div className="flex flex-col gap-1.5 px-2 py-2">
                      <span className="text-[var(--c-text-dim)] text-xs italic">No remotes configured</span>
                      <button
                        onClick={() => setAddRemoteModal(true)}
                        className="self-start flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors text-[var(--c-accent)] bg-[var(--c-accent)]/10 hover:bg-[var(--c-accent)]/20"
                      >
                        <Globe size={10} />
                        Connect remote
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                <GitGraphView
                  commits={graphCommits}
                  loading={graphLoading}
                  projectPath={project.path}
                  onCommitClick={openCommitDiff}
                />
              </div>
            )}
          </div>

          {/* ── Commit bar ── */}
          <div className="flex-shrink-0 border-t border-[var(--c-border)] flex flex-col" style={{ height: commitAreaHeight + 56 }}>
            {/* Top resize handle */}
            <div
              onMouseDown={onCommitHandleMouseDown}
              className="flex-shrink-0 h-[4px] cursor-ns-resize hover:bg-[var(--c-accent)]/20 transition-colors"
            />
            <div className="flex flex-col gap-1.5 p-2 flex-1 min-h-0">
            <textarea
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && e.metaKey) { e.preventDefault(); doCommit(); }
              }}
              placeholder="Commit message (⌘↵)"
              style={{ height: commitAreaHeight }}
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
