import { AddProjectButton } from "./AddProjectButton";
import { ProjectItem } from "./ProjectItem";
import { useStore } from "../../store/useStore";

export function Sidebar() {
  const { projects } = useStore();

  return (
    <aside className="flex flex-col w-48 min-w-[160px] bg-[var(--c-bg-deep)] border-r border-[var(--c-border)] h-full select-none">
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
    </aside>
  );
}
