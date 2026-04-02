import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { usePtyEvents } from "./hooks/usePty";
import { useTheme } from "./hooks/useTheme";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { MainArea } from "./components/MainArea/MainArea";
import { FileExplorer } from "./components/FileExplorer/FileExplorer";

export function App() {
  useSessionPersistence();
  usePtyEvents();
  useTheme();

  return (
    <div className="flex flex-col h-screen bg-[var(--c-bg)] text-[var(--c-text-bright)] overflow-hidden">
      {/* macOS traffic-light area — full-width drag region */}
      <div
        data-tauri-drag-region
        className="flex-shrink-0 h-8 bg-[var(--c-bg-deep)] border-b border-[var(--c-border)]"
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <FileExplorer />
        <MainArea />
      </div>
    </div>
  );
}

export default App;
