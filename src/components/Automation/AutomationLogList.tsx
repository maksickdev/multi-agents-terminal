import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, SkipForward } from 'lucide-react';
import type { AutomationLog } from '../../types/automation';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusIcon({ status }: { status: AutomationLog['status'] }) {
  if (status === 'completed')
    return <CheckCircle2 size={12} className="text-[var(--c-success)] flex-shrink-0" />;
  if (status === 'failed')
    return <XCircle size={12} className="text-[var(--c-danger)] flex-shrink-0" />;
  if (status === 'skipped')
    return <SkipForward size={12} className="text-[var(--c-text-dim)] flex-shrink-0" />;
  return <Loader2 size={12} className="text-[var(--c-accent)] animate-spin flex-shrink-0" />;
}

interface Props {
  logs: AutomationLog[];
}

export function AutomationLogList({ logs }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex-shrink-0 border-t border-[var(--c-border)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 h-8 text-[10px] font-medium uppercase tracking-wider text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors select-none"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Run history
        <span className="ml-auto text-[var(--c-text-dim)] normal-case tracking-normal font-normal">
          {logs.length} entries
        </span>
      </button>

      {expanded && (
        <div className="max-h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-xs text-[var(--c-text-dim)] px-3 py-2">No runs yet.</p>
          ) : (
            logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-bg-deep)]/50"
              >
                <StatusIcon status={l.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--c-text)] truncate">{l.automationName}</div>
                  <div className="text-[10px] text-[var(--c-text-dim)]">
                    {formatTime(l.startedAt)}
                  </div>
                </div>
                <span
                  className={`text-[10px] capitalize flex-shrink-0 ${
                    l.status === 'completed'
                      ? 'text-[var(--c-success)]'
                      : l.status === 'failed'
                      ? 'text-[var(--c-danger)]'
                      : l.status === 'skipped'
                      ? 'text-[var(--c-text-dim)]'
                      : 'text-[var(--c-accent)]'
                  }`}
                >
                  {l.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
