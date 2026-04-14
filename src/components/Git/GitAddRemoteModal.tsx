import { useEffect, useRef, useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { gitLsRemote } from "../../lib/tauri";

/** Accepted git remote URL patterns:
 *  - https://github.com/user/repo.git
 *  - git@github.com:user/repo.git
 *  - ssh://git@github.com/user/repo.git
 *  - git://github.com/user/repo.git
 */
const GIT_REMOTE_URL_RE = /^(https?:\/\/.+|git@[\w.-]+:.+|ssh:\/\/.+|git:\/\/.+)/;

function validateUrl(raw: string): string | null {
  const u = raw.trim();
  if (!u) return "URL is required";
  if (!GIT_REMOTE_URL_RE.test(u))
    return "Invalid remote URL — expected https://, git@host:, ssh:// or git://";
  return null;
}

interface Props {
  /** Pre-fill name with "origin" when no remotes exist yet */
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
    // Focus name if empty, else url
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

    // If user confirmed despite the warning — add without re-checking
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
        // Clearly auth-gated — allow adding directly
        onConfirm(n, u);
      } else {
        // GitHub returns "not found" for private repos too — show warning, let user decide
        setUrlWarning("Could not reach the repository. It may be private or require authentication.");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="rounded-lg shadow-2xl overflow-hidden"
        style={{ width: 400, background: "var(--c-bg)", border: "1px solid var(--c-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[var(--c-border)]"
          style={{ background: "var(--c-bg-deep)" }}
        >
          <Globe size={14} className="text-[var(--c-accent)] flex-shrink-0" />
          <span className="text-sm font-semibold text-[var(--c-text-bright)]">Add Remote</span>
        </div>

        {/* Form */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--c-text-dim)]">
              Remote name
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") urlRef.current?.focus(); }}
              placeholder="origin"
              spellCheck={false}
              className="w-full text-xs bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)] rounded px-2 py-1.5 outline-none border border-[var(--c-border)] focus:border-[var(--c-accent)] placeholder:text-[var(--c-muted)] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--c-text-dim)]">
              URL
            </label>
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); setUrlWarning(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(false); }}
              placeholder="https://github.com/user/repo.git"
              spellCheck={false}
              className={`w-full text-xs bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)] rounded px-2 py-1.5 outline-none border placeholder:text-[var(--c-muted)] transition-colors font-mono ${
                urlError ? "border-[var(--c-danger)]" : urlWarning ? "border-yellow-500/50" : "border-[var(--c-border)] focus:border-[var(--c-accent)]"
              }`}
            />
            {urlError && (
              <p className="text-[10px] text-[var(--c-danger)] leading-tight">{urlError}</p>
            )}
            {urlWarning && (
              <div className="flex flex-col gap-1.5 rounded px-2 py-1.5 bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-[10px] text-yellow-400 leading-tight">{urlWarning}</p>
                <button
                  onClick={() => submit(true)}
                  className="self-start text-[10px] font-medium text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors"
                >
                  Add anyway
                </button>
              </div>
            )}
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
            onClick={() => submit(false)}
            disabled={!name.trim() || !url.trim() || loading || checking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30"
          >
            {checking
              ? <Loader2 size={11} className="animate-spin" />
              : <Globe size={11} />}
            {checking ? "Checking…" : loading ? "Adding…" : "Add Remote"}
          </button>
        </div>
      </div>
    </div>
  );
}
