import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Clock, FileCode2, Files, GitBranch, Layers, Loader2, ScrollText, Settings, SquareTerminal } from "lucide-react";
import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { usePtyEvents } from "./hooks/usePty";
import { useTheme } from "./hooks/useTheme";
import { useExternalFileDrop } from "./hooks/useExternalFileDrop";
import { useAutomationScheduler } from "./hooks/useAutomationScheduler";
import { useHookEvents } from "./hooks/useHookEvents";
import { useStore } from "./store/useStore";
import { useAutomationStore } from "./store/useAutomationStore";
import { ProjectsPanel } from "./components/Projects/ProjectsPanel";
import { MainArea } from "./components/MainArea/MainArea";
import { EditorPane } from "./components/Editor/EditorPane";
import { FileExplorer } from "./components/FileExplorer/FileExplorer";
import { GitPanel } from "./components/Git/GitPanel";
import { AutomationPanel } from "./components/Automation/AutomationPanel";
import { TitleBarGitInfo } from "./components/Git/TitleBarGitInfo";
import { ConfirmModal } from "./components/shared/ConfirmModal";
import { UsageButton } from "./components/Projects/UsageButton";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { matchesHotkey, formatHotkey } from "./lib/hotkeys";
import {
  saveAgents, exitApp, writeToAgent,
  isSessionNonempty,
  openExternal,
  type AgentMeta,
} from "./lib/tauri";

// Strip all ANSI/VT escape sequences from PTY output
const ANSI_RE = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|[@-Z\\-_]|\][^\x07]*\x07)/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

// Match "SessionID:" or "Session ID:" (with or without space) in cleaned PTY output
const SESSION_ID_RE = /Session\s*ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Sends `/status\r` to an agent's PTY, collects output for up to `timeoutMs`,
 * strips ANSI codes, and returns the first UUID found (= Claude session ID).
 * Returns null if nothing is found within the timeout.
 */
function getSessionIdViaStatus(agentId: string, timeoutMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    let unlistenFn: (() => void) | null = null;
    let collected = "";

    const finish = (result: string | null) => {
      if (done) return;
      done = true;
      unlistenFn?.();
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    // First register the listener, THEN send the command so we don't miss output
    listen<{ agent_id: string; data: string }>("pty-output", (e) => {
      if (e.payload.agent_id !== agentId || done) return;
      const bytes = Uint8Array.from(atob(e.payload.data), (c) => c.charCodeAt(0));
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const stripped = stripAnsi(text);
      collected += stripped;
      console.log(`[status] agent=${agentId} chunk=${JSON.stringify(stripped)}`);
      const m = collected.match(SESSION_ID_RE);
      if (m) {
        clearTimeout(timer);
        finish(m[1]);
      }
    }).then((fn) => {
      unlistenFn = fn;
      if (done) { fn(); return; }
      // Listener is registered — now safe to send /status
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode("/status\r")));
      writeToAgent(agentId, encoded).catch(() => finish(null));
    });
  });
}

type ClosePhase = "idle" | "confirming" | "saving";

export function App() {
  // Pauses useSessionPersistence auto-save during the close sequence so that
  // agent-status events cannot overwrite agents.json after we've saved session_ids.
  const savingRef = useRef(false);
  useSessionPersistence(savingRef);
  usePtyEvents();
  useTheme();
  useExternalFileDrop();
  useAutomationScheduler();
  const { addHookEvent, setAgentAttention, clearAgentAttention } = useStore();
  useHookEvents((event) => {
    addHookEvent(event);
    const agentId = typeof event.mat_agent_id === "string" ? event.mat_agent_id : null;
    if (!agentId) return;
    if (event.hook_event_name === "PermissionRequest") {
      setAgentAttention(agentId, "permission");
    } else if (event.hook_event_name === "Stop") {
      setAgentAttention(agentId, "notification");
    } else if (event.hook_event_name === "UserPromptSubmit") {
      clearAgentAttention(agentId);
    }
  });

  const { init: initAutomations } = useAutomationStore();
  useEffect(() => { initAutomations(); }, []);

  const {
    projects, selectedProjectId, agents, agentOrder, shellAgentIds,
    sidebarOpen, setSidebarOpen,
    fileExplorerOpen, setFileExplorerOpen,
    editorPanelOpen, setEditorPanelOpen,
    bottomPanelOpen, setBottomPanelOpen,
    gitPanelOpen, setGitPanelOpen,
    automationPanelOpen, setAutomationPanelOpen,
    logsPanelOpen, setLogsPanelOpen,
    hotkeys,
  } = useStore();
  const activeProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closePhase, setClosePhase] = useState<ClosePhase>("idle");
  // Prevents triggering the modal twice if close fires multiple times
  const closingRef = useRef(false);

  // ── Sidebar + git panel keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchesHotkey(e, hotkeys.toggleSidebar)) {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      if (matchesHotkey(e, hotkeys.toggleEditorPanel)) {
        e.preventDefault();
        setEditorPanelOpen(!editorPanelOpen);
      }
      if (matchesHotkey(e, hotkeys.toggleGitPanel)) {
        e.preventDefault();
        setGitPanelOpen(!gitPanelOpen);
      }
      if (matchesHotkey(e, hotkeys.toggleAutomationPanel)) {
        e.preventDefault();
        setAutomationPanelOpen(!automationPanelOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen, setSidebarOpen, editorPanelOpen, setEditorPanelOpen, gitPanelOpen, setGitPanelOpen, automationPanelOpen, setAutomationPanelOpen, hotkeys]);

  // ── Intercept clicks on <a href="http(s)://..."> and open in default browser ──
  // WKWebView has no notion of "new window", so a plain anchor click navigates
  // the WebView itself and replaces the app. We delegate at document level so
  // every link (markdown preview, future UI) is covered.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return;
      e.preventDefault();
      openExternal(href);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Listen for OS window-close request (intercepted by Rust) ─────────────
  useEffect(() => {
    const p = listen("close-requested", () => {
      if (!closingRef.current) {
        setClosePhase("confirming");
      }
    });
    return () => { p.then((fn) => fn()); };
  }, []);

  // ── User cancelled close ──────────────────────────────────────────────────
  function handleCancelClose() {
    setClosePhase("idle");
  }

  // ── User confirmed close: collect session IDs via /status then exit ─────────
  async function handleConfirmClose() {
    closingRef.current = true;
    savingRef.current = true; // pause useSessionPersistence — we own agents.json from here
    setClosePhase("saving");

    // Only Claude agents that are still running (exclude shell agents)
    const shellIds = new Set(Object.values(shellAgentIds));
    const agentList = Object.values(agents).filter(
      (a) => a.status !== "exited" && !shellIds.has(a.id)
    );

    // Send /status to every agent in parallel, parse session UUIDs.
    const sessionIdResults = await Promise.all(
      agentList.map(async (a) => {
        const sid = await getSessionIdViaStatus(a.id).catch(() => null);
        // Validate — don't save a session_id for an empty session (Claude
        // can't resume it and the agent would exit immediately with red status).
        const valid = sid
          ? await isSessionNonempty(sid, a.cwd).catch(() => false)
          : false;
        const finalSid = valid ? sid : null;
        console.log(`[close] agent=${a.id} session_id=${finalSid} (raw=${sid}, valid=${valid})`);
        return { id: a.id, sessionId: finalSid };
      })
    );

    const sessionIdMap = new Map(
      sessionIdResults.map((r) => [r.id, r.sessionId])
    );

    // Build metas preserving tab order
    const metas: AgentMeta[] = [];
    for (const ids of Object.values(agentOrder)) {
      for (const id of ids) {
        const a = agents[id];
        if (!a || a.status === "exited") continue;
        metas.push({
          id: a.id,
          project_id: a.projectId,
          name: a.name,
          cwd: a.cwd,
          created_at: a.createdAt,
          session_id: sessionIdMap.get(a.id) ?? null,
        });
      }
    }

    try {
      await saveAgents(metas);
    } catch (e) {
      console.error("[close] failed to save agents", e);
    }

    await exitApp();
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--c-bg-deep)] text-[var(--c-text-bright)] overflow-hidden">
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* macOS traffic-light area — full-width drag region */}
      <div
        data-tauri-drag-region
        className="relative flex-shrink-0 h-8 bg-[var(--c-bg-deep)] flex items-center"
      >
        {/* Left: navigation buttons */}
        <div className="flex items-center gap-0.5 ml-[90px]">
          {(
            [
              { icon: Layers, active: sidebarOpen, onClick: () => setSidebarOpen(!sidebarOpen), title: `Projects (${formatHotkey(hotkeys.toggleSidebar)})` },
              { icon: Files, active: fileExplorerOpen, onClick: () => setFileExplorerOpen(!fileExplorerOpen), title: `File Explorer (${formatHotkey(hotkeys.toggleFileExplorer)})` },
              { icon: SquareTerminal, active: bottomPanelOpen, onClick: () => setBottomPanelOpen(!bottomPanelOpen), title: `Terminal (${formatHotkey(hotkeys.toggleTerminal)})` },
              { icon: GitBranch, active: gitPanelOpen, onClick: () => setGitPanelOpen(!gitPanelOpen), title: `Git (${formatHotkey(hotkeys.toggleGitPanel)})` },
              { icon: FileCode2, active: editorPanelOpen, onClick: () => setEditorPanelOpen(!editorPanelOpen), title: `Editor (${formatHotkey(hotkeys.toggleEditorPanel)})` },
              { icon: Clock, active: automationPanelOpen, onClick: () => setAutomationPanelOpen(!automationPanelOpen), title: `Automation (${formatHotkey(hotkeys.toggleAutomationPanel)})` },
              { icon: ScrollText, active: logsPanelOpen, onClick: () => setLogsPanelOpen(!logsPanelOpen), title: "Agent Logs" },
            ] as const
          ).map(({ icon: Icon, active, onClick, title }) => (
            <button
              key={title}
              onClick={onClick}
              title={title}
              className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                active
                  ? "text-[var(--c-accent)]"
                  : "text-[var(--c-text-dim)] hover:text-[var(--c-text)]"
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        {/* Center: project name + git info */}
        <div className="absolute inset-x-0 flex items-center justify-center gap-2 pointer-events-none select-none">
          {activeProject && (
            <>
              <span className="text-xs text-[var(--c-text-dim)]">{activeProject.name}</span>
              <TitleBarGitInfo projectPath={activeProject.path} projectId={activeProject.id} />
            </>
          )}
        </div>

        {/* Right: usage + settings */}
        <div className="ml-auto flex items-center gap-0.5 pr-1">
          <UsageButton />
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="flex items-center justify-center w-7 h-7 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ marginBottom: 4, marginLeft: 4, marginRight: 4 }}>
        <ProjectsPanel />
        <GitPanel />
        <FileExplorer />
        <MainArea />
        <EditorPane />
        <AutomationPanel />
      </div>

      {/* ── Close confirmation modal ───────────────────────────────────────── */}
      {closePhase === "confirming" && (
        <ConfirmModal
          title="Close application?"
          message="All agent sessions will be saved and can be resumed when you reopen the app."
          confirmLabel="Close"
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
        />
      )}

      {/* ── Saving sessions preloader ─────────────────────────────────────── */}
      {closePhase === "saving" && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[var(--c-accent)]" />
          <span className="text-sm text-[var(--c-text)]">Saving sessions…</span>
        </div>
      )}
    </div>
  );
}

export default App;
