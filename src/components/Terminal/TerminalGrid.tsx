import type { Agent } from "../../store/useStore";
import { TerminalPane } from "./TerminalPane";

interface Props {
  agents: Agent[];
  activeAgentId: string | null;
}

export function TerminalGrid({ agents, activeAgentId }: Props) {
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
            isVisible={agent.id === activeAgentId}
          />
        </div>
      ))}
    </div>
  );
}
