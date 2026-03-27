import { useProjectPersistence } from "./hooks/useProjectPersistence";
import { usePtyEvents } from "./hooks/usePty";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { MainArea } from "./components/MainArea/MainArea";

export function App() {
  useProjectPersistence();
  usePtyEvents();

  return (
    <div className="flex h-screen bg-[#1a1b26] text-[#c0caf5] overflow-hidden">
      <Sidebar />
      <MainArea />
    </div>
  );
}

export default App;
