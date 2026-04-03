import { useState } from "react";
import { spawnAgent, killAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import type { Project } from "../../lib/tauri";
import { ConfirmModal } from "../shared/ConfirmModal";
import { ContextMenu, type ContextMenuItem } from "../FileExplorer/ContextMenu";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  project: Project;
}

export function ProjectItem({ project }: Props) {
  const { selectedProjectId, selectProject, addAgent, removeProject, getProjectAgents } =
    useStore();
  const isSelected = selectedProjectId === project.id;
  const agents = getProjectAgents(project.id);

  const [showConfirm, setShowConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleNewAgent = async () => {
    selectProject(project.id);
    try {
      const agentId = await spawnAgent(project.id, project.path);
      const agent: Agent = {
        id: agentId,
        projectId: project.id,
        name: `Agent ${agents.length + 1}`,
        cwd: project.path,
        status: "active",
        createdAt: Date.now(),
      };
      addAgent(agent);
    } catch (err) {
      console.error("Failed to spawn agent:", err);
      alert(`Failed to start agent: ${err}`);
    }
  };

  const doRemove = async () => {
    setShowConfirm(false);
    for (const agent of agents) {
      await killAgent(agent.id).catch(() => {});
    }
    removeProject(project.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextItems: ContextMenuItem[] = [
    {
      label: "New Agent",
      icon: Plus,
      onClick: handleNewAgent,
    },
    {
      label: "Remove Project",
      icon: Trash2,
      onClick: () => setShowConfirm(true),
      danger: true,
    },
  ];

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title="Remove project?"
          message={`Remove "${project.name}"?${agents.length > 0 ? ` ${agents.length} agent${agents.length > 1 ? "s" : ""} will be stopped.` : ""}`}
          confirmLabel="Remove"
          danger
          onConfirm={doRemove}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div
        onClick={() => selectProject(project.id)}
        onContextMenu={handleContextMenu}
        className={`flex flex-col px-3 py-2 rounded cursor-pointer transition-colors ${
          isSelected
            ? "bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)]"
            : "text-[var(--c-text)] hover:bg-[var(--c-bg)]"
        }`}
      >
        <div className="flex items-center justify-between min-w-0">
          <span className="text-sm font-medium truncate">{project.name}</span>
          {agents.length > 0 && (
            <span className="text-xs text-[var(--c-accent)] ml-2 flex-shrink-0">{agents.length}</span>
          )}
        </div>
        <span className="text-xs text-[var(--c-text-dim)] truncate">{project.path}</span>
      </div>
    </>
  );
}
