import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AlertTriangle, Download, FolderOpen, X } from "lucide-react";
import {
  gitClone,
  gitCloneWithPassphrase,
  pickFolder,
  saveProjects,
} from "../../lib/tauri";
import { ensureProjectHooks } from "../../lib/claudeHooks";
import { useStore } from "../../store/useStore";
import { v4 as uuidv4 } from "uuid";

interface Props {
  onClose: () => void;
}

function deriveNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const noTrailing = trimmed.replace(/\/+$/, "");
  const last = noTrailing.split(/[\/:]/).pop() ?? "";
  const cleaned = last.replace(/\.git$/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.includes("/") || cleaned.includes("\\")) return "";
  return cleaned;
}

export function CloneRepoModal({ onClose }: Props) {
  const { projectsFolder, addProject, projects, selectProject } = useStore();

  const [url, setUrl] = useState("");
  const [manualName, setManualName] = useState("");
  const [parentFolder, setParentFolder] = useState(projectsFolder);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  const urlInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setParentFolder(projectsFolder); }, [projectsFolder]);
  useEffect(() => { urlInputRef.current?.focus(); }, []);
  useEffect(() => {
    if (needsAuth) passInputRef.current?.focus();
  }, [needsAuth]);

  const derivedName = useMemo(() => deriveNameFromUrl(url), [url]);
  const needsManualName = url.trim().length > 0 && !derivedName;
  const effectiveName = derivedName || manualName.trim();

  useEffect(() => {
    if (needsManualName) nameInputRef.current?.focus();
  }, [needsManualName]);

  const handlePickFolder = async () => {
    const picked = await pickFolder();
    if (picked) setParentFolder(picked);
  };

  const runClone = async (withPassphrase?: string) => {
    const trimmedUrl = url.trim();
    const trimmedName = effectiveName.trim();

    if (!trimmedUrl) { setError("Repository URL is required"); return; }
    if (!trimmedName) {
      setError("Could not derive a project name from the URL — please enter one");
      return;
    }
    if (trimmedName.includes("/") || trimmedName.includes("\\")) {
      setError("Name must not contain slashes");
      return;
    }
    if (!parentFolder) { setError("Parent folder is not set"); return; }

    setLoading(true);
    setError(null);

    try {
      const finalPath = withPassphrase !== undefined
        ? await gitCloneWithPassphrase(trimmedUrl, parentFolder, trimmedName, withPassphrase)
        : await gitClone(trimmedUrl, parentFolder, trimmedName);

      const project = { id: uuidv4(), name: trimmedName, path: finalPath };
      addProject(project);
      await saveProjects([...projects, project]);
      ensureProjectHooks(project.path).catch((e) => console.warn("[hooks] clone:", e));
      selectProject(project.id);
      onClose();
    } catch (e) {
      const msg = String(e);
      if (msg.startsWith("AUTH_REQUIRED")) {
        setNeedsAuth(true);
        setError("Authentication required. Enter your SSH key passphrase or HTTPS token.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (loading) return;
    if (needsAuth) {
      void runClone(passphrase);
    } else {
      void runClone();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [url, manualName, parentFolder, needsAuth, passphrase, loading]);

  const previewPath =
    parentFolder && effectiveName.trim()
      ? `${parentFolder.replace(/\/+$/, "")}/${effectiveName.trim()}`
      : "";

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[460px] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-[var(--c-accent)] flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--c-text)]">Clone Remote Repository</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">Repository URL</label>
            <input
              ref={urlInputRef}
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); setNeedsAuth(false); }}
              placeholder="https://github.com/user/repo.git"
              disabled={loading}
              className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono disabled:opacity-50"
            />
          </div>

          {needsManualName && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 px-2 py-1.5 rounded border border-[var(--c-warning,#e0af68)]/40 bg-[var(--c-warning,#e0af68)]/10">
                <AlertTriangle size={14} className="text-[var(--c-warning,#e0af68)] mt-[1px] flex-shrink-0" />
                <p className="text-xs text-[var(--c-text)] leading-snug">
                  Could not derive a project name from this URL. Please enter one manually.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--c-text-dim)]">Project name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={manualName}
                  onChange={(e) => { setManualName(e.target.value); setError(null); }}
                  placeholder="my-project"
                  disabled={loading}
                  className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">Parent folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={parentFolder}
                onChange={(e) => { setParentFolder(e.target.value); setError(null); }}
                placeholder="/Users/you/Projects"
                disabled={loading}
                className="flex-1 bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono disabled:opacity-50"
              />
              <button
                onClick={handlePickFolder}
                title="Pick folder"
                disabled={loading}
                className="px-2 py-1.5 rounded border border-[var(--c-border)] bg-[var(--c-bg-deep)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:border-[var(--c-accent)] transition-colors disabled:opacity-50"
              >
                <FolderOpen size={14} />
              </button>
            </div>
            {previewPath && (
              <p className="text-[10px] font-mono text-[var(--c-text-dim)] truncate">
                {previewPath}
              </p>
            )}
          </div>

          {needsAuth && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--c-text-dim)]">
                SSH passphrase or HTTPS token
              </label>
              <input
                ref={passInputRef}
                type="password"
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setError(null); }}
                placeholder="••••••••"
                disabled={loading}
                className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono disabled:opacity-50"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-[var(--c-danger)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-[var(--c-border)]">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim() || !effectiveName.trim() || (needsAuth && !passphrase)}
            className="flex-1 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Cloning…" : needsAuth ? "Retry with credentials" : "Clone"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
