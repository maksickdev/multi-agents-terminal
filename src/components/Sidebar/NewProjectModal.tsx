import { useEffect, useRef, useState } from "react";
import { FolderPlus } from "lucide-react";
import { createDirAll, pickFolder, saveProjects } from "../../lib/tauri";
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
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

    // Sanitize: no slashes
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
      selectProject(project.id);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          width: 400,
          background: "var(--c-bg)",
          border: "1px solid var(--c-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[var(--c-border)]"
          style={{ background: "var(--c-bg-deep)" }}
        >
          <FolderPlus size={14} className="text-[var(--c-accent)]" />
          <span className="text-sm font-semibold text-[var(--c-text-bright)]">New Project</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          {/* Project name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">
              Project name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="my-project"
              className="px-3 py-1.5 text-sm rounded font-mono outline-none border border-[var(--c-border)] focus:border-[var(--c-accent)] transition-colors"
              style={{ background: "var(--c-bg-deep)", color: "var(--c-text)" }}
            />
          </div>

          {/* Parent folder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">
              Parent folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={parentFolder}
                onChange={(e) => { setParentFolder(e.target.value); setError(null); }}
                placeholder="/Users/you/Projects"
                className="flex-1 px-3 py-1.5 text-sm rounded font-mono outline-none border border-[var(--c-border)] focus:border-[var(--c-accent)] transition-colors"
                style={{ background: "var(--c-bg-deep)", color: "var(--c-text)" }}
              />
              <button
                onClick={handlePickFolder}
                title="Pick folder"
                className="px-2 py-1.5 rounded border border-[var(--c-border)] hover:border-[var(--c-accent)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
                style={{ background: "var(--c-bg-deep)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
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
        <div
          className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--c-border)]"
          style={{ background: "var(--c-bg-deep)" }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
            style={{ background: "var(--c-bg)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="px-3 py-1.5 text-sm rounded font-medium transition-colors disabled:opacity-40"
            style={{ background: "var(--c-accent)", color: "#000" }}
          >
            {loading ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
