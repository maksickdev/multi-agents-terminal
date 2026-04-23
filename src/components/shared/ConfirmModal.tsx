import { useEffect } from "react";
import ReactDOM from "react-dom";

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
    // Defer activation by one frame so the keydown event that opened the modal
    // (e.g. Enter in an input) doesn't immediately trigger onConfirm.
    let active = false;
    const raf = requestAnimationFrame(() => { active = true; });
    const handler = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", handler); };
  }, [onConfirm, onCancel]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: 500 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg shadow-2xl p-5 w-80 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[var(--c-text-bright)]">{title}</span>
          <span className="text-xs text-[var(--c-text)] leading-relaxed">{message}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              danger
                ? "bg-[var(--c-danger)]/20 text-[var(--c-danger)] hover:bg-[var(--c-danger)]/30"
                : "bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
