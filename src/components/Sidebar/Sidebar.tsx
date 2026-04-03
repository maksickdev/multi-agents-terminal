import { useRef } from "react";
import { AddProjectButton } from "./AddProjectButton";
import { ProjectItem } from "./ProjectItem";
import { useStore } from "../../store/useStore";

export function Sidebar() {
  const { projects, sidebarOpen, sidebarWidth, setSidebarWidth } = useStore();

  const resizingRef = useRef(false);
  const startXRef   = useRef(0);
  const startWRef   = useRef(0);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setSidebarWidth(startWRef.current + (ev.clientX - startXRef.current));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <aside
      style={{ width: sidebarOpen ? sidebarWidth : 0, flexShrink: 0, position: "relative", overflow: "hidden" }}
      className="flex flex-col bg-[var(--c-bg-deep)] border-r border-[var(--c-border)] h-full select-none"
    >
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

      {/* Right-side resize handle */}
      <div
        onMouseDown={onHandleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize hover:bg-[var(--c-accent)]/20 transition-colors"
      />
    </aside>
  );
}
