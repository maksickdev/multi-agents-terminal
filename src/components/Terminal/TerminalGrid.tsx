import type { Agent } from "../../store/useStore";
import { TerminalPane } from "./TerminalPane";

interface Props {
  agents: Agent[];
  activeAgentId: string | null;
  isProjectActive: boolean;
}

export function TerminalGrid({ agents, activeAgentId, isProjectActive }: Props) {
  return (
    <div className="relative flex-1 overflow-hidden">
      {agents.map((agent) => (
        <div
          key={agent.id}
          style={
            agent.id === activeAgentId
              ? { position: "absolute", inset: 0 }
              : {
                  position: "absolute",
                  inset: 0,
                  visibility: "hidden",
                  pointerEvents: "none",
                }
          }
        >
          <TerminalPane
            agentId={agent.id}
            isVisible={isProjectActive && agent.id === activeAgentId}
          />
        </div>
      ))}
    </div>
  );
}
