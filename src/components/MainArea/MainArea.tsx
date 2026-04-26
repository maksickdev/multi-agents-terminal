import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { matchesHotkey } from "../../lib/hotkeys";
import { EmptyState } from "./EmptyState";
import { TabBar } from "./TabBar";
import { TerminalGrid } from "../Terminal/TerminalGrid";
import { BottomPanel } from "../BottomPanel/BottomPanel";

// Approximate character dimensions for JetBrains Mono 13px
const CHAR_W = 8;
const CHAR_H = 16;

export function MainArea() {
  // agentOrder is subscribed explicitly so MainArea re-renders when tabs
  // are reordered and getProjectAgents returns the updated sequence.
  const { projects, selectedProjectId, activeAgentId, getProjectAgents, agentOrder,
    bottomPanelOpen, setBottomPanelOpen, hotkeys } = useStore();
  void agentOrder;
  const terminalAreaRef = useRef<HTMLDivElement>(null);
  const [terminalFullscreen, setTerminalFullscreen] = useState(false);

  const getTerminalSize = (): { rows: number; cols: number } => {
    const el = terminalAreaRef.current;
    if (!el) return { rows: 24, cols: 80 };
    const { width, height } = el.getBoundingClientRect();
    return {
      rows: Math.max(10, Math.floor((height - 8) / CHAR_H)),
      cols: Math.max(40, Math.floor((width - 8) / CHAR_W)),
    };
  };

  // Toggle terminal (configurable, default Cmd+J); Escape exits terminal fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesHotkey(e, hotkeys.toggleTerminal)) {
        e.preventDefault();
        setBottomPanelOpen(!bottomPanelOpen);
      }
      if (e.key === "Escape" && terminalFullscreen) {
        setTerminalFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bottomPanelOpen, setBottomPanelOpen, terminalFullscreen, hotkeys.toggleTerminal]);

  const project = projects.find((p) => p.id === selectedProjectId);
  const allProjects = projects;

  return (
    <main className="flex-1 flex flex-col bg-[var(--c-bg-deep)] overflow-hidden min-w-0" style={{ marginTop: 4, marginRight: 4, marginBottom: 4, marginLeft: 4 }}>

      {!project ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1"><EmptyState /></div>
          <BottomPanel />
        </div>
      ) : (
        <>
          {/* Terminal panel — CSS fullscreen (no remount) via position:fixed */}
          <div
            className={terminalFullscreen
              ? "fixed z-50 flex flex-col bg-[var(--c-bg)]"
              : "flex flex-col overflow-hidden min-h-0 bg-[var(--c-bg)]"
            }
            style={terminalFullscreen
              ? { inset: 0, top: 32, marginLeft: 8, marginRight: 8, marginBottom: 8, borderRadius: 10, border: "1px solid var(--c-border)", overflow: "hidden" }
              : { flex: "1 1 0%", borderRadius: 10, overflow: "hidden", border: "1px solid var(--c-border)" }}
          >
            <TabBar
              project={project}
              agents={getProjectAgents(project.id)}
              activeAgentId={activeAgentId[project.id] ?? null}
              getTerminalSize={getTerminalSize}
              fullscreen={terminalFullscreen}
              onToggleFullscreen={() => setTerminalFullscreen((v) => !v)}
            />

            {/* Terminal area — keep ALL projects mounted to preserve xterm state */}
            <div ref={terminalAreaRef} className="flex-1 overflow-hidden relative min-h-0">
              {getProjectAgents(project.id).length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--c-text-dim)] text-sm">
                  Click <span className="mx-1 text-[var(--c-accent)]">+</span> to start a new agent
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
                    <TerminalGrid agents={pAgents} activeAgentId={pActiveId} isProjectActive={isActive} />
                  </div>
                );
              })}
            </div>
          </div>

          <BottomPanel />
        </>
      )}
    </main>
  );
}
