import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { KeyRound, X } from "lucide-react";

interface Props {
  operation: "push" | "pull";
  onConfirm: (passphrase: string) => void;
  onCancel: () => void;
}

export function GitAuthModal({ operation, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    if (value.trim()) onConfirm(value);
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-[420px] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-[var(--c-accent)] flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--c-text)]">Git Authentication</span>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-[var(--c-text-dim)] leading-relaxed">
            Git requires authentication for{" "}
            <strong className="text-[var(--c-text)]">git {operation}</strong>.
            Enter your SSH key passphrase or a personal access token (HTTPS).
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">Passphrase or token</label>
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Passphrase or token…"
              className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-[var(--c-border)]">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="flex-1 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {operation === "push" ? "Push" : "Pull"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
