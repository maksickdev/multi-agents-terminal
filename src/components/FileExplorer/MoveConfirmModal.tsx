interface Props {
  sourcePath: string;
  targetFolder: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MoveConfirmModal({ sourcePath, targetFolder, onConfirm, onCancel }: Props) {
  const sourceName = sourcePath.split("/").pop() ?? sourcePath;
  const targetName = targetFolder.split("/").pop() ?? targetFolder;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--c-bg-elevated)] border border-[var(--c-muted)] rounded-lg shadow-2xl p-5 w-80 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[var(--c-text-bright)]">Move item</h2>
        <p className="text-xs text-[var(--c-text)] leading-relaxed">
          Move{" "}
          <span className="text-[var(--c-accent)] font-medium">"{sourceName}"</span>
          {" "}to{" "}
          <span className="text-[var(--c-accent)] font-medium">"{targetName}"</span>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded bg-[var(--c-bg-hover)] text-[var(--c-text)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-[var(--c-accent)] text-[var(--c-bg)] hover:opacity-90 transition-opacity font-medium"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
