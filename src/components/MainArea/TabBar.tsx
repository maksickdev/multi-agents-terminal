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
  const { addAgent, setActiveAgent, getProjectAgents } = useStore();

  const handleNewAgent = async () => {
    const existingCount = getProjectAgents(project.id).length;
    console.log("[TabBar] + clicked, project=", project.id, project.path);
    try {
      const size = getTerminalSize?.() ?? { rows: 24, cols: 80 };
      console.log("[TabBar] calling spawnAgent with size", size);
      const agentId = await spawnAgent(project.id, project.path, size.rows, size.cols);
      console.log("[TabBar] spawnAgent returned agentId=", agentId);
      const agent: Agent = {
        id: agentId,
        projectId: project.id,
        name: `Agent ${existingCount + 1}`,
        cwd: project.path,
        status: "active",
        createdAt: Date.now(),
      };
      addAgent(agent);
      console.log("[TabBar] agent added to store");
    } catch (err) {
      console.error("[TabBar] Failed to spawn agent:", err);
      alert(`Failed to start agent: ${err}`);
    }
  };

  return (
    <div className="flex items-center bg-[#16161e] border-b border-[#1f2335] overflow-x-auto">
      {agents.map((agent) => (
        <TabItem
          key={agent.id}
          agent={agent}
          isActive={agent.id === activeAgentId}
          onSelect={() => setActiveAgent(project.id, agent.id)}
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
