import { AddProjectButton } from "./AddProjectButton";
import { ProjectItem } from "./ProjectItem";
import { useStore } from "../../store/useStore";

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
      <div className="flex items-center justify-center gap-1 px-2 py-1.5 border-b border-[#1f2335]">
        <button
          onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
          title="Файловый менеджер (⌘E)"
          className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
            fileExplorerOpen
              ? "text-[#7aa2f7] bg-[#1a1b26]"
              : "text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1a1b26]"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
          </svg>
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
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3zm9.5 5.5h-3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm-6.354-.354a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2a.5.5 0 1 0-.708.708L4.793 6.5 3.146 8.146z"/>
          </svg>
        </button>
      </div>

      {/* Projects label */}
      <div className="px-4 py-2 border-b border-[#1f2335]">
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
