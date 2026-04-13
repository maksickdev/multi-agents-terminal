import { useRef, useState } from "react";
import type { OpenFile } from "../../store/useStore";
import { X, Circle } from "lucide-react";

interface Props {
  file: OpenFile;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (newName: string) => void;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  suppressClick: () => boolean;
}

export function EditorTab({
  file, isActive, isDragging, isDragOver,
  onSelect, onClose, onRename,
  onMouseDown, onMouseEnter, suppressClick,
}: Props) {
  const basename = file.path.split("/").pop() ?? file.path;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(basename);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(basename);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== basename) onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") { setEditing(false); setEditValue(basename); }
  };

  const handleClick = () => {
    if (editing) return;
    if (suppressClick()) return;
    onSelect();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editing) return;
    if (e.button === 1) { e.preventDefault(); return; }
    onMouseDown();
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) onClose();
  };

  const borderStyle: React.CSSProperties = isDragOver
    ? { borderLeft: "2px solid var(--c-accent)" }
    : {};

  return (
    <div
      onClick={handleClick}
      onDoubleClick={!editing ? startEdit : undefined}
      onMouseDown={handleMouseDown}
      onAuxClick={handleAuxClick}
      onMouseEnter={onMouseEnter}
      style={{ ...borderStyle, opacity: isDragging ? 0.4 : 1, cursor: "pointer" }}
      title={file.path}
      className={`flex items-center gap-1 px-3 h-full border-r border-[var(--c-border)] flex-shrink-0 select-none transition-colors ${
        isActive
          ? "bg-[var(--c-bg)] text-[var(--c-text-bright)]"
          : "bg-[var(--c-bg-deep)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
      }`}
    >
      {file.isDirty && !editing && (
        <Circle size={6} className="flex-shrink-0 fill-[var(--c-accent-yellow)] text-[var(--c-accent-yellow)]" />
      )}

      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="text-xs bg-transparent border-b border-[var(--c-accent)] outline-none w-28 text-[var(--c-text-bright)] caret-[var(--c-accent)]"
        />
      ) : (
        <span className="text-xs">{basename}</span>
      )}

      {!editing && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="ml-1 flex items-center text-[var(--c-muted)] hover:text-[var(--c-danger)] flex-shrink-0"
          title="Close"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
