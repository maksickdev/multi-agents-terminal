import { useEffect, useRef, useState } from "react";
import { killAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import * as ptyManager from "../../lib/ptyManager";

interface Props {
  agent: Agent;
  isActive: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

const statusColors: Record<Agent["status"], string> = {
  active: "bg-green-400",
  waiting: "bg-yellow-400",
  exited: "bg-red-400",
};

export function TabItem({
  agent,
  isActive,
  isDragOver,
  onSelect,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const { removeAgent } = useStore();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(agent.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep edit value in sync if name changes externally
  useEffect(() => {
    if (!editing) setEditValue(agent.name);
  }, [agent.name, editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(agent.name);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== agent.name) onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setEditing(false);
      setEditValue(agent.name);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await killAgent(agent.id).catch(() => {});
    ptyManager.dispose(agent.id);
    removeAgent(agent.id);
  };

  return (
    <div
      draggable={!editing}
      onClick={!editing ? onSelect : undefined}
      onDoubleClick={!editing ? startEdit : undefined}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        "group flex items-center gap-2 px-3 py-2 cursor-pointer border-b-2 transition-colors whitespace-nowrap select-none",
        isActive
          ? "border-[#7aa2f7] bg-[#1a1b26] text-[#c0caf5]"
          : "border-transparent bg-[#16161e] text-[#565f89] hover:bg-[#1a1b26] hover:text-[#a9b1d6]",
        isDragOver ? "border-l-2 border-l-[#7aa2f7]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[agent.status]}`}
      />

      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="text-sm bg-transparent border-b border-[#7aa2f7] outline-none w-24 text-[#c0caf5] caret-[#7aa2f7]"
        />
      ) : (
        <span className="text-sm">{agent.name}</span>
      )}

      {!editing && (
        <button
          onClick={handleClose}
          className="ml-1 opacity-0 group-hover:opacity-100 text-[#565f89] hover:text-[#f7768e] transition-opacity leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}
