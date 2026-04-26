import { Pencil, Trash2, Play, Pause, Clock } from 'lucide-react';
import { useAutomationStore } from '../../store/useAutomationStore';
import type { Automation } from '../../types/automation';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function scheduleLabel(s: Automation['schedule']): string {
  if (s.type === 'interval') {
    return `Every ${s.value} ${s.unit}`;
  }
  const hh = String(s.hour).padStart(2, '0');
  const mm = String(s.minute).padStart(2, '0');
  const daysStr =
    s.days.length === 0
      ? 'daily'
      : s.days
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAY_LABELS[d])
          .join(', ');
  return `${hh}:${mm} — ${daysStr}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function nextRunLabel(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (diff <= 0) return 'soon';
  if (diff < 60) return `in ${diff}s`;
  if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `in ${Math.floor(diff / 3600)}h`;
  return `in ${Math.floor(diff / 86400)}d`;
}

interface Props {
  automations: Automation[];
  onEdit: (a: Automation) => void;
}

export function AutomationList({ automations, onEdit }: Props) {
  const { toggleAutomation, deleteAutomation } = useAutomationStore();

  if (automations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--c-text-dim)] select-none">
        <Clock size={28} className="opacity-30" />
        <span className="text-xs opacity-50">No automations yet</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {automations.map((a) => (
        <div
          key={a.id}
          className="px-3 py-2.5 border-b border-[var(--c-border)] hover:bg-[var(--c-bg-deep)]/50 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`text-sm font-medium truncate ${
                    a.enabled ? 'text-[var(--c-text)]' : 'text-[var(--c-text-dim)]'
                  }`}
                >
                  {a.name}
                </span>
                {!a.enabled && (
                  <span className="text-[10px] px-1 rounded bg-[var(--c-border)] text-[var(--c-text-dim)] flex-shrink-0">
                    paused
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--c-text-dim)] truncate">
                {scheduleLabel(a.schedule)}
              </div>
              <div className="flex gap-3 mt-1 text-[10px] text-[var(--c-text-dim)]">
                <span>Last: {relativeTime(a.lastRunAt)}</span>
                {a.enabled && <span>Next: {nextRunLabel(a.nextRunAt)}</span>}
                <span className="capitalize">{a.targetType === 'background' ? 'background' : 'agent'}</span>
              </div>
            </div>

            {/* Actions — visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => toggleAutomation(a.id)}
                title={a.enabled ? 'Pause' : 'Resume'}
                className="p-1 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
              >
                {a.enabled ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                onClick={() => onEdit(a)}
                title="Edit"
                className="p-1 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => deleteAutomation(a.id)}
                title="Delete"
                className="p-1 rounded text-[var(--c-text-dim)] hover:text-[var(--c-danger)] transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
