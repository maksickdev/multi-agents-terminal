import { useEffect, useRef } from "react";
import { ScrollText, Trash2, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { HookEvent } from "../../store/useStore";

// ── Event badge colors ────────────────────────────────────────────────────────

function eventColor(name: string): string {
  if (name.startsWith("Pre") || name.startsWith("Post")) return "var(--c-accent)";
  if (name === "Stop" || name === "SubagentStop" || name === "SessionEnd") return "#9ece6a";
  if (name === "Notification" || name === "UserPromptSubmit") return "#e0af68";
  if (name.includes("Failure") || name.includes("Denied") || name.includes("Error")) return "var(--c-danger)";
  if (name === "SessionStart") return "#73daca";
  return "var(--c-text-dim)";
}

// ── Single log entry ──────────────────────────────────────────────────────────

function LogEntry({ event, agentName }: { event: HookEvent; agentName: string | null }) {
  const time = new Date(event._received_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const color = eventColor(event.hook_event_name);

  const inputPreview = event.tool_input
    ? JSON.stringify(event.tool_input).slice(0, 120)
    : null;

  return (
    <div className="flex flex-col gap-0.5 px-3 py-1.5 border-b border-[var(--c-border)] hover:bg-[var(--c-bg-hover)] transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-[var(--c-text-dim)] font-mono flex-shrink-0">{time}</span>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color }}>
          {event.hook_event_name}
        </span>
        {event.tool_name && (
          <span className="text-[11px] text-[var(--c-text-dim)] flex-shrink-0">
            {event.tool_name}
          </span>
        )}
        {agentName && (
          <span className="text-[10px] text-[var(--c-text-dim)] truncate ml-auto flex-shrink-0">
            {agentName}
          </span>
        )}
      </div>
      {inputPreview && (
        <div className="text-[10px] font-mono text-[var(--c-text-dim)] truncate pl-[72px]">
          {inputPreview}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LogsPanel() {
  const {
    logsPanelOpen, logsPanelHeight, setLogsPanelOpen, setLogsPanelHeight,
    hookEvents, clearHookEvents,
    agents, selectedProjectId, activeAgentId,
  } = useStore();

  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Active agent for the selected project
  const activeId = selectedProjectId ? activeAgentId[selectedProjectId] ?? null : null;

  // Filter: show only events from the active agent (if known), else all
  const visibleEvents = activeId
    ? hookEvents.filter((e) => !e.mat_agent_id || e.mat_agent_id === activeId)
    : hookEvents;

  // Resolve agent name from mat_agent_id for display
  const agentName = (event: HookEvent) => {
    if (!event.mat_agent_id) return null;
    return agents[event.mat_agent_id]?.name ?? event.mat_agent_id.slice(0, 8);
  };

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (!logsPanelOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleEvents.length, logsPanelOpen]);

  // Resize handle
  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = logsPanelHeight;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setLogsPanelHeight(startHRef.current + (startYRef.current - ev.clientY));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col relative overflow-hidden bg-[var(--c-bg)]"
      style={{
        height: logsPanelOpen ? logsPanelHeight : 0,
        overflow: "hidden",
        ...(logsPanelOpen
          ? { borderRadius: 10, border: "1px solid var(--c-border)", marginTop: 4 }
          : {}),
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={logsPanelOpen ? onHandleMouseDown : undefined}
        className="absolute top-0 left-0 right-0 h-[6px] border-t border-[var(--c-border)] cursor-ns-resize hover:bg-[var(--c-accent)]/20 transition-colors z-10"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 bg-[var(--c-bg)] border-b border-[var(--c-border)] flex-shrink-0 select-none">
        <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
          Agent Logs
          {visibleEvents.length > 0 && (
            <span className="ml-2 normal-case font-normal text-[var(--c-muted)]">
              {visibleEvents.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHookEvents}
            title="Clear logs"
            className="flex items-center text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setLogsPanelOpen(false)}
            title="Close panel"
            className="flex items-center text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--c-text-dim)]">
            <ScrollText size={20} />
            <span className="text-xs">No hook events yet</span>
          </div>
        ) : (
          visibleEvents.map((event, i) => (
            <LogEntry key={i} event={event} agentName={activeId ? null : agentName(event)} />
          ))
        )}
      </div>
    </div>
  );
}
