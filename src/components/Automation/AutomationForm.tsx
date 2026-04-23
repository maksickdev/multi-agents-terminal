import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAutomationStore } from '../../store/useAutomationStore';
import type { Automation, IntervalUnit, Schedule } from '../../types/automation';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Props {
  projectId: string;
  automation?: Automation | null;
  onClose: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function AutomationForm({ projectId, automation, onClose }: Props) {
  const { agents, agentOrder } = useStore();
  const { addAutomation, updateAutomation } = useAutomationStore();

  const projectAgentIds = agentOrder[projectId] ?? [];
  const projectAgents = projectAgentIds.map((id) => agents[id]).filter(Boolean);

  const [name, setName] = useState(automation?.name ?? '');
  const [task, setTask] = useState(automation?.task ?? '');
  const [targetType, setTargetType] = useState<'agent' | 'background'>(
    automation?.targetType ?? 'background',
  );
  const [targetAgentId, setTargetAgentId] = useState<string>(
    automation?.targetAgentId ?? projectAgents[0]?.id ?? '',
  );
  const [scheduleType, setScheduleType] = useState<'interval' | 'time'>(
    automation?.schedule.type ?? 'interval',
  );
  const [intervalValue, setIntervalValue] = useState(
    automation?.schedule.type === 'interval' ? automation.schedule.value : 30,
  );
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    automation?.schedule.type === 'interval' ? automation.schedule.unit : 'minutes',
  );
  const [timeHour, setTimeHour] = useState(
    automation?.schedule.type === 'time' ? automation.schedule.hour : 9,
  );
  const [timeMinute, setTimeMinute] = useState(
    automation?.schedule.type === 'time' ? automation.schedule.minute : 0,
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(
    automation?.schedule.type === 'time' ? automation.schedule.days : [],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggleDay(dow: number) {
    setSelectedDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !task.trim()) return;

    const schedule: Schedule =
      scheduleType === 'interval'
        ? { type: 'interval', value: Math.max(1, intervalValue), unit: intervalUnit }
        : { type: 'time', hour: timeHour, minute: timeMinute, days: selectedDays };

    const payload = {
      projectId,
      name: name.trim(),
      task: task.trim(),
      targetType,
      targetAgentId: targetType === 'agent' ? targetAgentId || null : null,
      schedule,
      enabled: automation?.enabled ?? true,
    };

    if (automation) {
      await updateAutomation(automation.id, payload);
    } else {
      await addAutomation(payload);
    }
    onClose();
  }

  const label = 'text-xs text-[var(--c-text-dim)] mb-1 block';
  const input =
    'w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition-colors';
  const segBtn = (active: boolean) =>
    `flex-1 py-1 text-xs rounded transition-colors ${
      active
        ? 'bg-[var(--c-accent)] text-[var(--c-bg-deep)] font-medium'
        : 'text-[var(--c-text-dim)] hover:text-[var(--c-text)]'
    }`;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-[420px] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
          <span className="text-sm font-medium text-[var(--c-text)]">
            {automation ? 'Edit Automation' : 'New Automation'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {/* Name */}
          <div>
            <label className={label}>Name</label>
            <input
              ref={inputRef}
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily standup reminder"
            />
          </div>

          {/* Task */}
          <div>
            <label className={label}>Task</label>
            <textarea
              className={`${input} resize-none`}
              rows={3}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Generate a summary of today's work and commit it..."
            />
          </div>

          {/* Target */}
          <div>
            <label className={label}>Run in</label>
            <div className="flex gap-1 bg-[var(--c-bg-deep)] rounded p-0.5">
              <button
                type="button"
                className={segBtn(targetType === 'background')}
                onClick={() => setTargetType('background')}
              >
                Background (new agent)
              </button>
              <button
                type="button"
                className={segBtn(targetType === 'agent')}
                onClick={() => setTargetType('agent')}
              >
                Existing agent
              </button>
            </div>
          </div>

          {targetType === 'agent' && (
            <div>
              <label className={label}>Agent</label>
              {projectAgents.length === 0 ? (
                <p className="text-xs text-[var(--c-text-dim)]">No agents in this project.</p>
              ) : (
                <select
                  className={input}
                  value={targetAgentId}
                  onChange={(e) => setTargetAgentId(e.target.value)}
                >
                  {projectAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Schedule type */}
          <div>
            <label className={label}>Schedule</label>
            <div className="flex gap-1 bg-[var(--c-bg-deep)] rounded p-0.5 mb-3">
              <button
                type="button"
                className={segBtn(scheduleType === 'interval')}
                onClick={() => setScheduleType('interval')}
              >
                Interval
              </button>
              <button
                type="button"
                className={segBtn(scheduleType === 'time')}
                onClick={() => setScheduleType('time')}
              >
                Specific time
              </button>
            </div>

            {scheduleType === 'interval' ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={label}>Every</label>
                  <input
                    type="number"
                    min={1}
                    className={input}
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                  />
                </div>
                <div className="flex-1">
                  <label className={label}>Unit</label>
                  <select
                    className={input}
                    value={intervalUnit}
                    onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={label}>Hour (0–23)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      className={input}
                      value={timeHour}
                      onChange={(e) =>
                        setTimeHour(Math.min(23, Math.max(0, Number(e.target.value))))
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <label className={label}>Minute (0–59)</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      className={input}
                      value={timeMinute}
                      onChange={(e) =>
                        setTimeMinute(Math.min(59, Math.max(0, Number(e.target.value))))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className={label}>
                    Days of week{' '}
                    <span className="text-[var(--c-text-dim)]">(empty = every day)</span>
                  </label>
                  <div className="flex gap-1">
                    {DAY_LABELS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`flex-1 py-1 text-xs rounded border transition-colors ${
                          selectedDays.includes(i)
                            ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/20 text-[var(--c-accent)]'
                            : 'border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[var(--c-text-dim)]">
                  Fires at {pad(timeHour)}:{pad(timeMinute)} on{' '}
                  {selectedDays.length === 0
                    ? 'every day'
                    : selectedDays.sort().map((d) => DAY_LABELS[d]).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-[var(--c-border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !task.trim()}
            className="flex-1 py-1.5 text-sm rounded bg-[var(--c-accent)] text-[var(--c-bg-deep)] font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {automation ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
