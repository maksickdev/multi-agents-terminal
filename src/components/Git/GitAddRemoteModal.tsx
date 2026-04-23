import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Globe, Loader2, X } from "lucide-react";
import { gitLsRemote } from "../../lib/tauri";

const GIT_REMOTE_URL_RE = /^(https?:\/\/.+|git@[\w.-]+:.+|ssh:\/\/.+|git:\/\/.+)/;

function validateUrl(raw: string): string | null {
  const u = raw.trim();
  if (!u) return "URL is required";
  if (!GIT_REMOTE_URL_RE.test(u))
    return "Invalid remote URL — expected https://, git@host:, ssh:// or git://";
  return null;
}

interface Props {
  defaultName?: string;
  loading: boolean;
  onConfirm: (name: string, url: string) => void;
  onCancel: () => void;
}

export function GitAddRemoteModal({ defaultName = "", loading, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(defaultName);
  const [url,  setUrl]  = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const urlRef  = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (name ? urlRef : nameRef).current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = async (force = false) => {
    const n = name.trim();
    const u = url.trim();
    if (!n || loading || checking) return;

    const fmtErr = validateUrl(u);
    if (fmtErr) { setUrlError(fmtErr); setUrlWarning(null); return; }

    if (force) { onConfirm(n, u); return; }

    setChecking(true);
    setUrlWarning(null);
    setUrlError(null);
    try {
      await gitLsRemote(u);
      onConfirm(n, u);
    } catch (e) {
      const msg = String(e);
      if (msg.startsWith("AUTH_REQUIRED:")) {
        onConfirm(n, u);
      } else {
        setUrlWarning("Could not reach the repository. It may be private or require authentication.");
      }
    } finally {
      setChecking(false);
    }
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
            <Globe size={14} className="text-[var(--c-accent)] flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--c-text)]">Add Remote</span>
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
            <label className="text-xs text-[var(--c-text-dim)]">Remote name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") urlRef.current?.focus(); }}
              placeholder="origin"
              spellCheck={false}
              className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--c-text-dim)]">URL</label>
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); setUrlWarning(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(false); }}
              placeholder="https://github.com/user/repo.git"
              spellCheck={false}
              className={`w-full bg-[var(--c-bg-deep)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none transition-colors font-mono border ${
                urlError ? "border-[var(--c-danger)]" : urlWarning ? "border-[var(--c-accent-yellow)]/50" : "border-[var(--c-border)] focus:border-[var(--c-accent)]"
              }`}
            />
            {urlError && (
              <p className="text-[10px] text-[var(--c-danger)] leading-tight">{urlError}</p>
            )}
            {urlWarning && (
              <div className="flex flex-col gap-1.5 rounded px-2 py-1.5 bg-[var(--c-accent-yellow)]/10 border border-[var(--c-accent-yellow)]/30">
                <p className="text-[10px] text-[var(--c-accent-yellow)] leading-tight">{urlWarning}</p>
                <button
                  onClick={() => submit(true)}
                  className="self-start text-[10px] font-medium text-[var(--c-accent-yellow)] hover:opacity-80 underline underline-offset-2 transition-opacity"
                >
                  Add anyway
                </button>
              </div>
            )}
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
            onClick={() => submit(false)}
            disabled={!name.trim() || !url.trim() || loading || checking}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checking ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
            {checking ? "Checking…" : loading ? "Adding…" : "Add Remote"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
