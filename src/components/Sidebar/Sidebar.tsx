import { AddProjectButton } from "./AddProjectButton";
import { ProjectItem } from "./ProjectItem";
import { useStore } from "../../store/useStore";

export function Sidebar() {
  const { projects } = useStore();

  return (
    <aside className="flex flex-col w-56 min-w-[180px] bg-[#16161e] border-r border-[#1f2335] h-full select-none">
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
