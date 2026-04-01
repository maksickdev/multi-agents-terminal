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
      <div className="bg-[#1f2335] border border-[#414868] rounded-lg shadow-2xl p-5 w-80 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[#c0caf5]">Move item</h2>
        <p className="text-xs text-[#a9b1d6] leading-relaxed">
          Move{" "}
          <span className="text-[#7aa2f7] font-medium">"{sourceName}"</span>
          {" "}to{" "}
          <span className="text-[#7aa2f7] font-medium">"{targetName}"</span>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded bg-[#292e42] text-[#a9b1d6] hover:bg-[#414868] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-[#7aa2f7] text-[#1a1b26] hover:bg-[#89b4fa] transition-colors font-medium"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
