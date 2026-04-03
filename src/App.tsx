import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { usePtyEvents } from "./hooks/usePty";
import { useTheme } from "./hooks/useTheme";
import { useStore } from "./store/useStore";
import { ActivityBar } from "./components/Sidebar/ActivityBar";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { MainArea } from "./components/MainArea/MainArea";
import { FileExplorer } from "./components/FileExplorer/FileExplorer";
import { GitPanel } from "./components/Git/GitPanel";
import { TitleBarGitInfo } from "./components/Git/TitleBarGitInfo";

export function App() {
  useSessionPersistence();
  usePtyEvents();
  useTheme();

  const { projects, selectedProjectId } = useStore();
  const activeProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-[var(--c-bg)] text-[var(--c-text-bright)] overflow-hidden">
      {/* macOS traffic-light area — full-width drag region */}
      <div
        data-tauri-drag-region
        className="flex-shrink-0 h-8 bg-[var(--c-bg-deep)] border-b border-[var(--c-border)] flex items-center justify-center"
      >
        {activeProject && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--c-text-dim)] pointer-events-none select-none">
              {activeProject.name}
            </span>
            <TitleBarGitInfo projectPath={activeProject.path} projectId={activeProject.id} />
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <Sidebar />
        <GitPanel />
        <FileExplorer />
        <MainArea />
      </div>
    </div>
  );
}

export default App;
