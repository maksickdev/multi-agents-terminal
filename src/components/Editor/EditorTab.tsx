import type { OpenFile } from "../../store/useStore";

interface Props {
  file: OpenFile;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function EditorTab({ file, isActive, onSelect, onClose }: Props) {
  const basename = file.path.split("/").pop() ?? file.path;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-1 px-3 h-full border-r border-[#1f2335] cursor-pointer flex-shrink-0 select-none transition-colors ${
        isActive
          ? "bg-[#1a1b26] text-[#c0caf5]"
          : "bg-[#16161e] text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1a1b26]"
      }`}
      title={file.path}
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
