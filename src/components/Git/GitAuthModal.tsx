import { useEffect, useRef, useState } from "react";
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    if (value.trim()) onConfirm(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="flex flex-col gap-4 rounded-lg p-5 w-80 shadow-xl"
        style={{ background: "var(--c-bg-elevated)", border: "1px solid var(--c-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--c-text-bright)]">
            <KeyRound size={15} />
            <span className="text-sm font-semibold">Git authentication</span>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--c-text-dim)] leading-relaxed">
          Git requires authentication for <strong className="text-[var(--c-text)]">git {operation}</strong>.
          Enter your SSH key passphrase or a personal access token (HTTPS).
        </p>

        {/* Input */}
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Passphrase or token…"
          className="w-full text-sm rounded px-3 py-1.5 outline-none"
          style={{
            background: "var(--c-bg-deep)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text-bright)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--c-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--c-border)")}
        />

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
            style={{ border: "1px solid var(--c-border)" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="px-3 py-1.5 text-xs rounded font-medium transition-colors disabled:opacity-40"
            style={{
              background: "var(--c-accent)",
              color: "var(--c-bg-deep)",
            }}
          >
            {operation === "push" ? "Push" : "Pull"}
          </button>
        </div>
      </div>
    </div>
  );
}
