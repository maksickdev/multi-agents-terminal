import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { themes } from "../../lib/themes";
import { X, FolderOpen } from "lucide-react";
import { pickFolder } from "../../lib/tauri";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const { theme, setTheme, projectsFolder, setProjectsFolder } = useStore();
  const [folderInput, setFolderInput] = useState(projectsFolder);

  const handlePickFolder = async () => {
    const picked = await pickFolder();
    if (picked) setFolderInput(picked);
  };

  const handleFolderBlur = () => {
    setProjectsFolder(folderInput);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-xl shadow-2xl w-[480px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--c-border)]">
          <span className="text-sm font-semibold text-[var(--c-text-bright)]">Settings</span>
          <button
            onClick={onClose}
            className="text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4">

          {/* Projects folder */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
              Projects folder
            </span>
            <p className="text-xs text-[var(--c-text-dim)]">
              Default folder for creating new projects.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onBlur={handleFolderBlur}
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

          {/* Theme section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
              Theme
            </span>

            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative flex flex-col gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                      isActive
                        ? "border-[var(--c-accent)]"
                        : "border-[var(--c-border)] hover:border-[var(--c-muted)]"
                    }`}
                    style={{ background: t.vars.bg }}
                  >
                    {/* Miniature color swatch */}
                    <div className="flex gap-1">
                      {[t.vars.bgDeep, t.vars.bgElevated, t.vars.accent, t.vars.accentYellow, t.vars.danger].map(
                        (color, i) => (
                          <div
                            key={i}
                            style={{ background: color, width: 12, height: 12, borderRadius: 3, flexShrink: 0 }}
                          />
                        )
                      )}
                    </div>

                    {/* Theme name */}
                    <span
                      className="text-xs font-medium"
                      style={{ color: t.vars.textBright }}
                    >
                      {t.name}
                    </span>

                    {/* Active indicator */}
                    {isActive && (
                      <div
                        className="absolute top-2 right-2 w-2 h-2 rounded-full"
                        style={{ background: t.vars.accent }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-[var(--c-border)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded bg-[var(--c-bg-hover)] text-[var(--c-text)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
