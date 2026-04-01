import { useEffect } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[#1f2335] border border-[#414868] rounded-lg shadow-2xl p-5 w-80 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[#c0caf5]">{title}</span>
          <span className="text-xs text-[#a9b1d6] leading-relaxed">{message}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded bg-[#292e42] text-[#a9b1d6] hover:bg-[#343a52] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              danger
                ? "bg-[#f7768e]/20 text-[#f7768e] hover:bg-[#f7768e]/30"
                : "bg-[#7aa2f7]/20 text-[#7aa2f7] hover:bg-[#7aa2f7]/30"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
