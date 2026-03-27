import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { usePtyEvents } from "./hooks/usePty";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { MainArea } from "./components/MainArea/MainArea";

export function App() {
  useSessionPersistence();
  usePtyEvents();

  return (
    <div className="flex flex-col h-screen bg-[#1a1b26] text-[#c0caf5] overflow-hidden">
      {/* macOS traffic-light area — full-width drag region */}
      <div
        data-tauri-drag-region
        className="flex-shrink-0 h-8 bg-[#16161e] border-b border-[#1f2335]"
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainArea />
      </div>
    </div>
  );
}

export default App;
