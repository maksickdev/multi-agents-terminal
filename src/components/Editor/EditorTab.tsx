import type { OpenFile } from "../../store/useStore";
import { X, Circle } from "lucide-react";

interface Props {
  file: OpenFile;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onClose: () => void;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  suppressClick: () => boolean;
}

export function EditorTab({
  file, isActive, isDragging, isDragOver,
  onSelect, onClose,
  onMouseDown, onMouseEnter, suppressClick,
}: Props) {
  const basename = file.path.split("/").pop() ?? file.path;

  const handleClick = () => {
    if (suppressClick()) return;
    onSelect();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
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
      {file.isDirty && (
        <Circle size={6} className="flex-shrink-0 fill-[var(--c-accent-yellow)] text-[var(--c-accent-yellow)]" />
      )}
      <span className="text-xs">{basename}</span>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-1 flex items-center text-[var(--c-muted)] hover:text-[var(--c-danger)] flex-shrink-0"
        title="Close"
      >
        <X size={12} />
      </button>
    </div>
  );
}
