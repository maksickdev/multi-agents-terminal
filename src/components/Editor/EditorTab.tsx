import type { OpenFile } from "../../store/useStore";

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

  const borderStyle: React.CSSProperties = isDragOver
    ? { borderLeft: "2px solid #7aa2f7" }
    : {};

  return (
    <div
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      style={{ ...borderStyle, opacity: isDragging ? 0.4 : 1, cursor: "pointer" }}
      title={file.path}
      className={`flex items-center gap-1 px-3 h-full border-r border-[#1f2335] flex-shrink-0 select-none transition-colors ${
        isActive
          ? "bg-[#1a1b26] text-[#c0caf5]"
          : "bg-[#16161e] text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1a1b26]"
      }`}
    >
      {file.isDirty && (
        <span className="text-[#e0af68] text-xs leading-none flex-shrink-0">●</span>
      )}
      <span className="text-xs">{basename}</span>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-1 text-[#414868] hover:text-[#f7768e] leading-none text-sm flex-shrink-0"
        title="Close"
      >
        ×
      </button>
    </div>
  );
}
