import { useEffect, useRef, useState } from "react";
import { Settings, FolderOpen, X } from "lucide-react";
import { pickFolder } from "../../lib/tauri";
import { useStore } from "../../store/useStore";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const { projectsFolder, setProjectsFolder } = useStore();
  const [folder, setFolder] = useState(projectsFolder);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handlePickFolder = async () => {
    const picked = await pickFolder();
    if (picked) setFolder(picked);
  };

  const handleSave = () => {
    setProjectsFolder(folder);
    onClose();
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
          width: 420,
          background: "var(--c-bg)",
          border: "1px solid var(--c-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]"
          style={{ background: "var(--c-bg-deep)" }}
        >
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[var(--c-accent)]" />
            <span className="text-sm font-semibold text-[var(--c-text-bright)]">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">
              Projects folder
            </label>
            <p className="text-xs text-[var(--c-text-dim)]">
              Default folder for creating new projects.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
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
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
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
            onClick={handleSave}
            className="px-3 py-1.5 text-sm rounded font-medium transition-colors"
            style={{ background: "var(--c-accent)", color: "#000" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
