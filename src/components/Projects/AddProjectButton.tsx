import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { pickFolder, saveProjects } from "../../lib/tauri";
import { useStore } from "../../store/useStore";
import { v4 as uuidv4 } from "uuid";
import { Download, FolderOpen, Plus } from "lucide-react";
import { ensureProjectHooks } from "../../lib/claudeHooks";
import { CloneRepoModal } from "./CloneRepoModal";

export function AddProjectButton() {
  const { addProject, projects } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [showClone, setShowClone] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick, true);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect() ?? null;
    setMenuRect(rect);
    setMenuOpen(true);
  };

  const handleAddLocal = async () => {
    setMenuOpen(false);
    try {
      const folderPath = await pickFolder();
      if (!folderPath) return;
      const name = folderPath.split("/").pop() || folderPath;
      const project = { id: uuidv4(), name, path: folderPath };
      addProject(project);
      await saveProjects([...projects, project]);
      ensureProjectHooks(project.path).catch((e) => console.warn("[hooks] add:", e));
    } catch (err) {
      console.error("Failed to add project:", err);
      alert(`Failed to add project: ${err}`);
    }
  };

  const handleCloneRemote = () => {
    setMenuOpen(false);
    setShowClone(true);
  };

  const menu = menuOpen && menuRect
    ? ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="fixed z-[600] min-w-[220px] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg shadow-2xl py-1"
          style={{
            left: menuRect.left,
            bottom: window.innerHeight - menuRect.top + 4,
            width: menuRect.width,
          }}
        >
          <button
            onClick={handleAddLocal}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text)] hover:bg-[var(--c-bg-elevated)] transition-colors text-left"
          >
            <FolderOpen size={14} className="text-[var(--c-text-dim)] flex-shrink-0" />
            <span>Open Local Folder</span>
          </button>
          <button
            onClick={handleCloneRemote}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text)] hover:bg-[var(--c-bg-elevated)] transition-colors text-left"
          >
            <Download size={14} className="text-[var(--c-text-dim)] flex-shrink-0" />
            <span>Clone Remote Repository…</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openMenu}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-accent)] hover:bg-[var(--c-bg-elevated)] rounded transition-colors"
      >
        <Plus size={15} />
        <span>Add Project</span>
      </button>
      {menu}
      {showClone && <CloneRepoModal onClose={() => setShowClone(false)} />}
    </>
  );
}
