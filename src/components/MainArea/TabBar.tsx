import { useState } from "react";
import { spawnAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import { TabItem } from "./TabItem";
import type { Project } from "../../lib/tauri";

interface Props {
  project: Project;
  agents: Agent[];
  activeAgentId: string | null;
  getTerminalSize?: () => { rows: number; cols: number };
}

export function TabBar({ project, agents, activeAgentId, getTerminalSize }: Props) {
  const { addAgent, setActiveAgent, getProjectAgents, renameAgent, reorderAgents } = useStore();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── New agent ──────────────────────────────────────────────────────────────
  const handleNewAgent = async () => {
    const existingCount = getProjectAgents(project.id).length;
    try {
      const size = getTerminalSize?.() ?? { rows: 24, cols: 80 };
      const agentId = await spawnAgent(project.id, project.path, size.rows, size.cols);
      const agent: Agent = {
        id: agentId,
        projectId: project.id,
        name: `Agent ${existingCount + 1}`,
        cwd: project.path,
        status: "active",
        createdAt: Date.now(),
      };
      addAgent(agent);
    } catch (err) {
      console.error("[TabBar] Failed to spawn agent:", err);
      alert(`Failed to start agent: ${err}`);
    }
  };

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (agentId: string) => {
    setDraggedId(agentId);
  };

  const handleDragOver = (e: React.DragEvent, agentId: string) => {
    e.preventDefault();
    if (agentId !== draggedId) setDragOverId(agentId);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;

    const ids = agents.map((a) => a.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;

    const newOrder = [...ids];
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggedId);
    reorderAgents(project.id, newOrder);

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div
      className="flex items-center bg-[#16161e] border-b border-[#1f2335] overflow-x-auto"
      onDragOver={(e) => e.preventDefault()}
    >
      {agents.map((agent) => (
        <TabItem
          key={agent.id}
          agent={agent}
          isActive={agent.id === activeAgentId}
          isDragOver={agent.id === dragOverId}
          onSelect={() => setActiveAgent(project.id, agent.id)}
          onRename={(name) => renameAgent(agent.id, name)}
          onDragStart={() => handleDragStart(agent.id)}
          onDragOver={(e) => handleDragOver(e, agent.id)}
          onDrop={() => handleDrop(agent.id)}
          onDragEnd={handleDragEnd}
        />
      ))}

      <button
        onClick={handleNewAgent}
        className="flex-shrink-0 px-3 py-2 text-[#565f89] hover:text-[#7aa2f7] hover:bg-[#1a1b26] transition-colors text-lg leading-none"
        title="New agent"
      >
        +
      </button>
    </div>
  );
}
