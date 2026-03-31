import { useEffect, useRef } from "react";
import { useStore } from "../../store/useStore";
import { EmptyState } from "./EmptyState";
import { TabBar } from "./TabBar";
import { TerminalGrid } from "../Terminal/TerminalGrid";
import { BottomPanel } from "../BottomPanel/BottomPanel";
import { EditorPane } from "../Editor/EditorPane";

// Approximate character dimensions for JetBrains Mono 13px
const CHAR_W = 8;
const CHAR_H = 16;

export function MainArea() {
  // agentOrder is subscribed explicitly so MainArea re-renders when tabs
  // are reordered and getProjectAgents returns the updated sequence.
  const { projects, selectedProjectId, activeAgentId, getProjectAgents, agentOrder,
    bottomPanelOpen, setBottomPanelOpen } = useStore();
  void agentOrder;
  const terminalAreaRef = useRef<HTMLDivElement>(null);

  const getTerminalSize = (): { rows: number; cols: number } => {
    const el = terminalAreaRef.current;
    if (!el) return { rows: 24, cols: 80 };
    const { width, height } = el.getBoundingClientRect();
    return {
      rows: Math.max(10, Math.floor((height - 8) / CHAR_H)),
      cols: Math.max(40, Math.floor((width - 8) / CHAR_W)),
    };
  };

  // Cmd+J toggles bottom panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "j" && e.metaKey) {
        e.preventDefault();
        setBottomPanelOpen(!bottomPanelOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bottomPanelOpen, setBottomPanelOpen]);

  const project = projects.find((p) => p.id === selectedProjectId);
  const allProjects = projects;

  return (
    <main className="flex-1 flex flex-col bg-[#1a1b26] overflow-hidden min-w-0">

      {!project ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1"><EmptyState /></div>
          <BottomPanel />
        </div>
      ) : (
        <>
          <TabBar
            project={project}
            agents={getProjectAgents(project.id)}
            activeAgentId={activeAgentId[project.id] ?? null}
            getTerminalSize={getTerminalSize}
          />

          {/* Terminal area — keep ALL projects mounted to preserve xterm state */}
          <div ref={terminalAreaRef} className="flex-1 overflow-hidden relative min-h-0">
            {getProjectAgents(project.id).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[#565f89] text-sm">
                Click <span className="mx-1 text-[#7aa2f7]">+</span> to start a new agent
              </div>
            )}

            {allProjects.map((p) => {
              const pAgents = getProjectAgents(p.id);
              if (pAgents.length === 0) return null;
              const pActiveId = activeAgentId[p.id] ?? null;
              const isActive = p.id === selectedProjectId;
              return (
                <div
                  key={p.id}
                  style={
                    isActive
                      ? { position: "absolute", inset: 0, display: "flex", flexDirection: "column" }
                      : { position: "absolute", inset: 0, display: "flex", flexDirection: "column", visibility: "hidden", pointerEvents: "none" }
                  }
                >
                  <TerminalGrid agents={pAgents} activeAgentId={pActiveId} />
                </div>
              );
            })}
          </div>

          {/* Editor pane — sits between terminal area and bottom shell panel */}
          <EditorPane />

          <BottomPanel />
        </>
      )}
    </main>
  );
}
