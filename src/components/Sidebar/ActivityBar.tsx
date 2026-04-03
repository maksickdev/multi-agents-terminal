import { useState, useEffect } from "react";
import { Folder, SquareTerminal, Settings, PanelLeft, GitBranch } from "lucide-react";
import { useStore } from "../../store/useStore";
import { SettingsModal } from "../Settings/SettingsModal";

export function ActivityBar() {
  const {
    sidebarOpen, setSidebarOpen,
    fileExplorerOpen, setFileExplorerOpen,
    bottomPanelOpen, setBottomPanelOpen,
    gitPanelOpen, setGitPanelOpen,
  } = useStore();

  const [settingsOpen, setSettingsOpen] = useState(false);

  // ⌘B — toggle sidebar (matches VS Code convention)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <div className="flex flex-col items-center w-12 flex-shrink-0 bg-[var(--c-bg-deep)] border-r border-[var(--c-border)] h-full select-none">
        {/* Top actions */}
        <div className="flex flex-col items-center gap-1 pt-2 flex-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle sidebar (⌘B)"
            className={`flex items-center justify-center w-9 h-9 rounded transition-colors ${
              sidebarOpen
                ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
                : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
            }`}
          >
            <PanelLeft size={20} />
          </button>

          <button
            onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
            title="Файловый менеджер (⌘E)"
            className={`flex items-center justify-center w-9 h-9 rounded transition-colors ${
              fileExplorerOpen
                ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
                : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
            }`}
          >
            <Folder size={20} />
          </button>

          <button
            onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
            title="Терминал (⌘J)"
            className={`flex items-center justify-center w-9 h-9 rounded transition-colors ${
              bottomPanelOpen
                ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
                : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
            }`}
          >
            <SquareTerminal size={20} />
          </button>

          <button
            onClick={() => setGitPanelOpen(!gitPanelOpen)}
            title="Git"
            className={`flex items-center justify-center w-9 h-9 rounded transition-colors ${
              gitPanelOpen
                ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
                : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
            }`}
          >
            <GitBranch size={20} />
          </button>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1 pb-2">
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="flex items-center justify-center w-9 h-9 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)] transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
