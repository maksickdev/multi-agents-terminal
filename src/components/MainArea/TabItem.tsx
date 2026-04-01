import { useEffect, useRef, useState } from "react";
import { killAgent } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import * as ptyManager from "../../lib/ptyManager";
import { ConfirmModal } from "../shared/ConfirmModal";

interface Props {
  agent: Agent;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  suppressClick: () => boolean;
}

const statusColors: Record<Agent["status"], string> = {
  active: "bg-green-400",
  waiting: "bg-yellow-400",
  exited: "bg-red-400",
};

export function TabItem({
  agent, isActive, isDragging, isDragOver,
  onSelect, onRename,
  onMouseDown, onMouseEnter, suppressClick,
}: Props) {
  const { removeAgent } = useStore();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(agent.name);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (e.key === "Escape") { setEditing(false); setEditValue(agent.name); }
  };

  const doClose = async () => {
    setShowConfirm(false);
    await killAgent(agent.id).catch(() => {});
    ptyManager.dispose(agent.id);
    removeAgent(agent.id);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleClick = (_e: React.MouseEvent) => {
    if (editing) return;
    if (suppressClick()) return; // mouse moved to another tab → it was a drag
    onSelect();
  };

  const borderStyle: React.CSSProperties = isDragOver
    ? { borderLeft: "2px solid #7aa2f7" }
    : {};

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title="Close agent?"
          message={`Close "${agent.name}"? The agent process will be stopped.`}
          confirmLabel="Close"
          danger
          onConfirm={doClose}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div
        onClick={handleClick}
        onDoubleClick={!editing ? startEdit : undefined}
        onMouseDown={!editing ? onMouseDown : undefined}
        onMouseEnter={onMouseEnter}
        style={{ ...borderStyle, opacity: isDragging ? 0.4 : 1, cursor: "pointer" }}
        className={[
          "group flex items-center gap-2 px-3 h-8 border-b-2 transition-colors whitespace-nowrap select-none",
          isActive
            ? "border-[#7aa2f7] bg-[#1a1b26] text-[#c0caf5]"
            : "border-transparent bg-[#16161e] text-[#565f89] hover:bg-[#1a1b26] hover:text-[#a9b1d6]",
        ].join(" ")}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[agent.status]}`} />

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
            onMouseDown={(e) => e.stopPropagation()} // prevent triggering drag on close btn
            className="ml-1 opacity-0 group-hover:opacity-100 text-[#565f89] hover:text-[#f7768e] transition-opacity leading-none"
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}
