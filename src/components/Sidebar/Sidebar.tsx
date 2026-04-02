import { useState } from "react";
import { AddProjectButton } from "./AddProjectButton";
import { ProjectItem } from "./ProjectItem";
import { useStore } from "../../store/useStore";
import { Folder, SquareTerminal, Settings } from "lucide-react";
import { SettingsModal } from "../Settings/SettingsModal";

export function Sidebar() {
  const {
    projects,
    fileExplorerOpen,
    setFileExplorerOpen,
    bottomPanelOpen,
    setBottomPanelOpen,
  } = useStore();

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <aside className="flex flex-col w-56 min-w-[180px] bg-[var(--c-bg-deep)] border-r border-[var(--c-border)] h-full select-none">
        {/* Icon toolbar */}
        <div className="flex items-center justify-center gap-1 px-2 h-8 border-b border-[var(--c-border)]">
          <button
            onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
            title="Файловый менеджер (⌘E)"
            className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
              fileExplorerOpen
                ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
                : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
            }`}
          >
            <Folder size={18} />
          </button>

          <button
            onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
            title="Терминал"
            className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
              bottomPanelOpen
                ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
                : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
            }`}
          >
            <SquareTerminal size={18} />
          </button>
        </div>

        {/* Projects label */}
        <div className="flex items-center px-4 h-8 border-b border-[var(--c-border)]">
          <h1 className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
            Projects
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {projects.length === 0 ? (
            <p className="text-xs text-[var(--c-text-dim)] px-1 py-2">No projects yet</p>
          ) : (
            projects.map((p) => <ProjectItem key={p.id} project={p} />)
          )}
        </div>

        <div className="border-t border-[var(--c-border)] p-2">
          <AddProjectButton />
        </div>

        {/* Settings button */}
        <div className="border-t border-[var(--c-border)] p-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elevated)] rounded transition-colors"
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}
