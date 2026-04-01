import { useEffect, useRef } from "react";
import { spawnShell, resizeAgent } from "../../lib/tauri";
import { useStore } from "../../store/useStore";
import type { Project } from "../../lib/tauri";
import * as ptyManager from "../../lib/ptyManager";
import { useAgentInput } from "../../hooks/usePty";

const CHAR_W = 8;
const CHAR_H = 16;

function shellId(projectId: string) {
  return `shell-${projectId}`;
}

// ── Per-project shell pane ────────────────────────────────────────────────────
function ShellPane({ agentId, isVisible, height }: {
  agentId: string;
  isVisible: boolean;
  height: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sendInput = useAgentInput(agentId);
  const inputListenerRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    ptyManager.attach(agentId, containerRef.current);

    const t = setTimeout(() => {
      inputListenerRef.current = ptyManager.onData(agentId, sendInput);
    }, 150);

    return () => {
      clearTimeout(t);
      inputListenerRef.current?.dispose();
      inputListenerRef.current = null;
    };
  }, [agentId]);

  // Re-fit only when actually visible
  useEffect(() => {
    if (!isVisible) return;
    requestAnimationFrame(() => {
      ptyManager.fit(agentId);
      const d = ptyManager.getDimensions(agentId);
      if (d) resizeAgent(agentId, d.rows, d.cols).catch(() => {});
    });
  }, [isVisible, height, agentId]);

  return (
    <div
      ref={containerRef}
      data-agent-id={agentId}
      style={
        isVisible
          ? { width: "100%", height: "100%", overflow: "hidden" }
          : { position: "absolute", inset: 0, visibility: "hidden", pointerEvents: "none", overflow: "hidden" }
      }
      className="p-1"
    />
  );
}

// ── Shell spawner ─────────────────────────────────────────────────────────────
function useShellForProject(project: Project | null, panelOpen: boolean) {
  const { shellAgentIds, setShellAgentId, bottomPanelHeight } = useStore();

  useEffect(() => {
    if (!panelOpen || !project) return;
    if (shellAgentIds[project.id]) return;

    const cols = Math.max(40, Math.floor((window.innerWidth - 224) / CHAR_W));
    const rows = Math.max(10, Math.floor((bottomPanelHeight - 40) / CHAR_H));
    const id = shellId(project.id);

    spawnShell(project.path, rows, cols, id)
      .then(() => setShellAgentId(project.id, id))
      .catch((e) => console.error("[BottomPanel] spawn_shell failed:", e));
  }, [panelOpen, project?.id]);
}

// ── Main component ────────────────────────────────────────────────────────────
export function BottomPanel() {
  const {
    projects, selectedProjectId,
    bottomPanelOpen, bottomPanelHeight,
    setBottomPanelOpen, setBottomPanelHeight,
    shellAgentIds,
  } = useStore();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  useShellForProject(selectedProject, bottomPanelOpen);

  const resizingRef = useRef(false);
  const startYRef   = useRef(0);
  const startHRef   = useRef(0);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = bottomPanelHeight;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setBottomPanelHeight(startHRef.current + (startYRef.current - ev.clientY));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const activeShells = projects.filter((p) => shellAgentIds[p.id]);

  // Always render — use height:0 + overflow:hidden when closed so
  // ShellPane never unmounts and xterm stays attached to its container.
  return (
    <div
      style={{
        height: bottomPanelOpen ? bottomPanelHeight : 0,
        flexShrink: 0,
        overflow: "hidden",
      }}
      className="relative flex flex-col bg-[#1a1b26]"
    >
      {/* Resize handle — only interactable when open */}
      <div
        onMouseDown={bottomPanelOpen ? onHandleMouseDown : undefined}
        className="absolute top-0 left-0 right-0 h-[6px] border-t border-[#1f2335] cursor-ns-resize hover:bg-[#7aa2f7]/20 transition-colors z-10 flex flex-col justify-center"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-7 bg-[#16161e] border-b border-[#1f2335] flex-shrink-0 select-none">
        <span className="text-xs font-semibold text-[#565f89] uppercase tracking-widest">
          Terminal
          {selectedProject && (
            <span className="ml-2 normal-case font-normal text-[#414868]">
              {selectedProject.name}
            </span>
          )}
        </span>
        <button
          onClick={() => setBottomPanelOpen(false)}
          className="text-[#565f89] hover:text-[#c0caf5] transition-colors text-base leading-none"
          title="Close panel (⌘J)"
        >
          ×
        </button>
      </div>

      {/* All shells mounted simultaneously; only active project is visible */}
      <div className="flex-1 overflow-hidden relative">
        {activeShells.map((p) => (
          <ShellPane
            key={p.id}
            agentId={shellAgentIds[p.id]}
            isVisible={p.id === selectedProjectId && bottomPanelOpen}
            height={bottomPanelHeight}
          />
        ))}
        {!selectedProject && (
          <div className="absolute inset-0 flex items-center justify-center text-[#565f89] text-sm">
            Select a project to open a terminal
          </div>
        )}
      </div>
    </div>
  );
}
