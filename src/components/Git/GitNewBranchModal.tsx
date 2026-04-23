import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { GitBranch, X } from "lucide-react";

interface Props {
  fromRef?: string;
  loading: boolean;
  onConfirm: (name: string, fromRef?: string) => void;
  onCancel: () => void;
}

export function GitNewBranchModal({ fromRef, loading, onConfirm, onCancel }: Props) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(fromRef ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || loading) return;
    onConfirm(trimmed, from.trim() || undefined);
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
            <GitBranch size={14} className="text-[var(--c-accent)] flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--c-text)]">Create Branch</span>
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
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">Branch name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="feature/my-branch"
              spellCheck={false}
              className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">
              From{" "}
              <span className="text-[var(--c-muted)]">(branch, tag, or commit — defaults to HEAD)</span>
            </label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="HEAD"
              spellCheck={false}
              className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors font-mono"
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
            disabled={!name.trim() || loading}
            className="flex-1 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create Branch"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
