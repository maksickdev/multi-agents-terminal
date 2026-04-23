import ReactDOM from "react-dom";

interface Props {
  sourcePath: string;
  targetFolder: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MoveConfirmModal({ sourcePath, targetFolder, onConfirm, onCancel }: Props) {
  const sourceName = sourcePath.split("/").pop() ?? sourcePath;
  const targetName = targetFolder.split("/").pop() ?? targetFolder;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg shadow-2xl p-5 w-80 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-[var(--c-text-bright)]">Move item</h2>
          <p className="text-xs text-[var(--c-text)] leading-relaxed">
            Move{" "}
            <span className="text-[var(--c-accent)] font-medium">"{sourceName}"</span>
            {" "}to{" "}
            <span className="text-[var(--c-accent)] font-medium">"{targetName}"</span>?
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded font-medium bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30 transition-colors"
          >
            Move
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
