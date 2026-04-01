import { useState } from "react";
import { spawnAgent, killAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import type { Project } from "../../lib/tauri";
import { ConfirmModal } from "../shared/ConfirmModal";

interface Props {
  project: Project;
}

export function ProjectItem({ project }: Props) {
  const { selectedProjectId, selectProject, addAgent, removeProject, getProjectAgents } =
    useStore();
  const isSelected = selectedProjectId === project.id;
  const agents = getProjectAgents(project.id);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleNewAgent = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

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

      <div
        onClick={() => selectProject(project.id)}
        className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
          isSelected
            ? "bg-[#1f2335] text-[#c0caf5]"
            : "text-[#a9b1d6] hover:bg-[#1a1b26]"
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium truncate">{project.name}</span>
          <span className="text-xs text-[#565f89] truncate">{project.path}</span>
        </div>

        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {agents.length > 0 && (
            <span className="text-xs text-[#7aa2f7] px-1">{agents.length}</span>
          )}
          <button
            onClick={handleNewAgent}
            title="New agent"
            className="p-1 text-[#7aa2f7] hover:text-[#c0caf5] rounded hover:bg-[#292e42]"
          >
            +
          </button>
          <button
            onClick={handleRemove}
            title="Remove project"
            className="p-1 text-[#565f89] hover:text-[#f7768e] rounded hover:bg-[#292e42]"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
