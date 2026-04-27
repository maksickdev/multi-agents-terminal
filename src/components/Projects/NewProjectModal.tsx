import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FolderOpen, FolderPlus, X } from "lucide-react";
import { createDirAll, pickFolder, saveProjects } from "../../lib/tauri";
import { ensureProjectHooks } from "../../lib/claudeHooks";
import { useStore } from "../../store/useStore";
import { v4 as uuidv4 } from "uuid";

interface Props {
  onClose: () => void;
}

export function NewProjectModal({ onClose }: Props) {
  const { projectsFolder, addProject, projects, selectProject } = useStore();
  const [name, setName] = useState("");
  const [parentFolder, setParentFolder] = useState(projectsFolder);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setParentFolder(projectsFolder); }, [projectsFolder]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") handleCreate();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [name, parentFolder]);

  const handlePickFolder = async () => {
    const picked = await pickFolder();
    if (picked) setParentFolder(picked);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Project name is required"); return; }
    if (!parentFolder) { setError("Projects folder is not set"); return; }
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      setError("Name must not contain slashes");
      return;
    }

    const newPath = `${parentFolder}/${trimmed}`;
    setLoading(true);
    setError(null);

    try {
      await createDirAll(newPath);
      const project = { id: uuidv4(), name: trimmed, path: newPath };
      addProject(project);
      await saveProjects([...projects, project]);
      ensureProjectHooks(project.path).catch((e) => console.warn("[hooks] new:", e));
      selectProject(project.id);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[420px] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-2">
            <FolderPlus size={14} className="text-[var(--c-accent)] flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--c-text)]">New Project</span>
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
            <label className="text-xs text-[var(--c-text-dim)]">Project name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="my-project"
              className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">Parent folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={parentFolder}
                onChange={(e) => { setParentFolder(e.target.value); setError(null); }}
                placeholder="/Users/you/Projects"
                className="flex-1 bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono"
              />
              <button
                onClick={handlePickFolder}
                title="Pick folder"
                className="px-2 py-1.5 rounded border border-[var(--c-border)] bg-[var(--c-bg-deep)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:border-[var(--c-accent)] transition-colors"
              >
                <FolderOpen size={14} />
              </button>
            </div>
            {parentFolder && name.trim() && (
              <p className="text-[10px] font-mono text-[var(--c-text-dim)]">
                {parentFolder}/{name.trim()}
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-[var(--c-danger)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-[var(--c-border)]">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="flex-1 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
