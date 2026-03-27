import { killAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import * as ptyManager from "../../lib/ptyManager";

interface Props {
  agent: Agent;
  isActive: boolean;
  onSelect: () => void;
}

const statusColors: Record<Agent["status"], string> = {
  active: "bg-green-400",
  waiting: "bg-yellow-400",
  exited: "bg-red-400",
};

export function TabItem({ agent, isActive, onSelect }: Props) {
  const { removeAgent } = useStore();

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await killAgent(agent.id).catch(() => {});
    ptyManager.dispose(agent.id);
    removeAgent(agent.id);
  };

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
        isActive
          ? "border-[#7aa2f7] bg-[#1a1b26] text-[#c0caf5]"
          : "border-transparent bg-[#16161e] text-[#565f89] hover:bg-[#1a1b26] hover:text-[#a9b1d6]"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[agent.status]}`}
      />
      <span className="text-sm">{agent.name}</span>
      <button
        onClick={handleClose}
        className="ml-1 opacity-0 group-hover:opacity-100 text-[#565f89] hover:text-[#f7768e] transition-opacity leading-none"
      >
        ×
      </button>
    </div>
  );
}
