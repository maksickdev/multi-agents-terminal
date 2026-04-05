import { useEffect, useRef, useState } from "react";
import { GitBranch } from "lucide-react";

interface Props {
  /** Pre-fill the "from" field (e.g. a commit hash from the graph) */
  fromRef?: string;
  loading: boolean;
  onConfirm: (name: string, fromRef?: string) => void;
  onCancel: () => void;
}

export function GitNewBranchModal({ fromRef, loading, onConfirm, onCancel }: Props) {
  const [name, setName]   = useState("");
  const [from, setFrom]   = useState(fromRef ?? "");
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="rounded-lg shadow-2xl overflow-hidden"
        style={{ width: 360, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[var(--c-border)]"
          style={{ background: "var(--c-bg-deep)" }}
        >
          <GitBranch size={14} className="text-[var(--c-accent)] flex-shrink-0" />
          <span className="text-sm font-semibold text-[var(--c-text-bright)]">Create Branch</span>
        </div>

        {/* Form */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--c-text-dim)]">
              Branch name
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="feature/my-branch"
              spellCheck={false}
              className="w-full text-xs bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)] rounded px-2 py-1.5 outline-none border border-[var(--c-border)] focus:border-[var(--c-accent)] placeholder:text-[var(--c-muted)] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--c-text-dim)]">
              From <span className="normal-case font-normal text-[var(--c-muted)]">(branch, tag, or commit — defaults to HEAD)</span>
            </label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="HEAD"
              spellCheck={false}
              className="w-full text-xs bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)] rounded px-2 py-1.5 outline-none border border-[var(--c-border)] focus:border-[var(--c-accent)] placeholder:text-[var(--c-muted)] transition-colors font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--c-border)]"
          style={{ background: "var(--c-bg-deep)" }}
        >
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] hover:bg-[var(--c-bg-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30"
          >
            <GitBranch size={11} />
            {loading ? "Creating…" : "Create Branch"}
          </button>
        </div>
      </div>
    </div>
  );
}
