import { AddProjectButton } from "./AddProjectButton";
import { ProjectItem } from "./ProjectItem";
import { useStore } from "../../store/useStore";
import { Folder, SquareTerminal } from "lucide-react";

export function Sidebar() {
  const {
    projects,
    fileExplorerOpen,
    setFileExplorerOpen,
    bottomPanelOpen,
    setBottomPanelOpen,
  } = useStore();

  return (
    <aside className="flex flex-col w-56 min-w-[180px] bg-[#16161e] border-r border-[#1f2335] h-full select-none">
      {/* Icon toolbar */}
      <div className="flex items-center justify-center gap-1 px-2 h-8 border-b border-[#1f2335]">
        <button
          onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
          title="Файловый менеджер (⌘E)"
          className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
            fileExplorerOpen
              ? "text-[#7aa2f7] bg-[#1a1b26]"
              : "text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1a1b26]"
          }`}
        >
          <Folder size={18} />
        </button>

        <button
          onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
          title="Терминал"
          className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
            bottomPanelOpen
              ? "text-[#7aa2f7] bg-[#1a1b26]"
              : "text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1a1b26]"
          }`}
        >
          <SquareTerminal size={18} />
        </button>
      </div>

      {/* Projects label */}
      <div className="flex items-center px-4 h-8 border-b border-[#1f2335]">
        <h1 className="text-xs font-semibold text-[#565f89] uppercase tracking-widest">
          Projects
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {projects.length === 0 ? (
          <p className="text-xs text-[#565f89] px-1 py-2">No projects yet</p>
        ) : (
          projects.map((p) => <ProjectItem key={p.id} project={p} />)
        )}
      </div>

      <div className="border-t border-[#1f2335] p-2">
        <AddProjectButton />
      </div>
    </aside>
  );
}
