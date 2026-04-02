import { useCallback, useRef, useState } from "react";
import { spawnAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import { TabItem } from "./TabItem";
import type { Project } from "../../lib/tauri";
import { isDraggingFile } from "../../lib/fileDrag";

interface Props {
  project: Project;
  agents: Agent[];
  activeAgentId: string | null;
  getTerminalSize?: () => { rows: number; cols: number };
}

export function TabBar({ project, agents, activeAgentId, getTerminalSize }: Props) {
  const { addAgent, setActiveAgent, getProjectAgents, renameAgent, reorderAgents } = useStore();

  // Refs hold the live values; state drives rendering
  const draggingRef = useRef<string | null>(null);
  const dragOverRef  = useRef<string | null>(null);
  const movedRef     = useRef(false);           // did the mouse actually move to another tab?

  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [dragOverId, setDragOverId]   = useState<string | null>(null);

  // ── Reorder helper ─────────────────────────────────────────────────────────
  const doReorder = useCallback((fromId: string, toId: string) => {
    const ids = agents.map((a) => a.id);
    const from = ids.indexOf(fromId);
    const to   = ids.indexOf(toId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    reorderAgents(project.id, next);
  }, [agents, project.id, reorderAgents]);

  // ── Drag start (mousedown on a tab) ────────────────────────────────────────
  const startDrag = useCallback((agentId: string) => {
    draggingRef.current = agentId;
    dragOverRef.current = null;
    movedRef.current    = false;
    setDraggingId(agentId);
    setDragOverId(null);

    const onMouseUp = () => {
      const from = draggingRef.current;
      const to   = dragOverRef.current;
      if (from && to && from !== to) doReorder(from, to);

      draggingRef.current = null;
      dragOverRef.current = null;
      movedRef.current    = false;
      setDraggingId(null);
      setDragOverId(null);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mouseup", onMouseUp);
  }, [doReorder]);

  // ── Hover over a tab while dragging ────────────────────────────────────────
  const enterTab = useCallback((agentId: string) => {
    // File drag over tab → activate it so the terminal is ready to receive the drop
    if (isDraggingFile()) {
      setActiveAgent(project.id, agentId);
      return;
    }
    // Normal agent tab reorder
    if (!draggingRef.current || draggingRef.current === agentId) return;
    movedRef.current    = true;
    dragOverRef.current = agentId;
    setDragOverId(agentId);
  }, [project.id, setActiveAgent]);

  // ── New agent ──────────────────────────────────────────────────────────────
  const handleNewAgent = async () => {
    const existingCount = getProjectAgents(project.id).length;
    try {
      const size = getTerminalSize?.() ?? { rows: 24, cols: 80 };
      const agentId = await spawnAgent(project.id, project.path, size.rows, size.cols);
      addAgent({
        id: agentId,
        projectId: project.id,
        name: `Agent ${existingCount + 1}`,
        cwd: project.path,
        status: "active",
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("[TabBar] Failed to spawn agent:", err);
      alert(`Failed to start agent: ${err}`);
    }
  };

  return (
    <div className="flex items-center h-8 bg-[#16161e] border-b border-[#1f2335] overflow-x-auto scrollbar-none">
      {agents.map((agent) => (
        <TabItem
          key={agent.id}
          agent={agent}
          isActive={agent.id === activeAgentId}
          isDragging={agent.id === draggingId}
          isDragOver={agent.id === dragOverId}
          onSelect={() => setActiveAgent(project.id, agent.id)}
          onRename={(name) => renameAgent(agent.id, name)}
          onMouseDown={() => startDrag(agent.id)}
          onMouseEnter={() => enterTab(agent.id)}
          // Suppress click if the mouse actually moved to another tab
          suppressClick={() => movedRef.current}
        />
      ))}

      <button
        onClick={handleNewAgent}
        className="flex-shrink-0 px-3 h-full text-[#565f89] hover:text-[#7aa2f7] hover:bg-[#1a1b26] transition-colors text-lg leading-none"
        title="New agent"
      >
        +
      </button>
    </div>
  );
}
