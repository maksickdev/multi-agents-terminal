import { create } from 'zustand';
import { getConfigDir, readFileText, writeFileText } from '../lib/tauri';
import type { Automation, AutomationLog, Schedule } from '../types/automation';

// ── Schedule utilities ────────────────────────────────────────────────────────

export function computeNextRunAt(schedule: Schedule, from = new Date()): string {
  if (schedule.type === 'interval') {
    const ms =
      schedule.unit === 'minutes' ? schedule.value * 60_000 :
      schedule.unit === 'hours'   ? schedule.value * 3_600_000 :
                                    schedule.value * 86_400_000;
    return new Date(from.getTime() + ms).toISOString();
  }
  return findNextTimeOccurrence(schedule.hour, schedule.minute, schedule.days, from);
}

function findNextTimeOccurrence(
  hour: number,
  minute: number,
  days: number[],
  from: Date,
): string {
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(
      from.getFullYear(), from.getMonth(), from.getDate() + i, hour, minute, 0, 0,
    );
    if (candidate <= from) continue;
    const dow = candidate.getDay();
    if (days.length === 0 || days.includes(dow)) return candidate.toISOString();
  }
  return new Date(from.getTime() + 7 * 86_400_000).toISOString();
}

export function shouldRun(automation: Automation, now: Date): boolean {
  if (!automation.enabled) return false;
  const { schedule, nextRunAt, lastRunAt } = automation;

  if (schedule.type === 'interval') {
    if (!nextRunAt) return false;
    return now >= new Date(nextRunAt);
  }

  // time schedule
  const { hour, minute, days } = schedule;
  if (now.getHours() !== hour || now.getMinutes() !== minute) return false;
  const dow = now.getDay();
  if (days.length > 0 && !days.includes(dow)) return false;

  // Prevent double-fire within the same minute
  if (lastRunAt) {
    const last = new Date(lastRunAt);
    const sameDay =
      last.getFullYear() === now.getFullYear() &&
      last.getMonth()    === now.getMonth()    &&
      last.getDate()     === now.getDate();
    if (sameDay && last.getHours() === hour && last.getMinutes() === minute) return false;
  }
  return true;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface AutomationStore {
  automations: Automation[];
  logs: AutomationLog[];
  configDir: string | null;

  init: () => Promise<void>;

  addAutomation: (a: Omit<Automation, 'id' | 'createdAt' | 'nextRunAt' | 'lastRunAt'>) => Promise<void>;
  updateAutomation: (id: string, updates: Partial<Automation>) => Promise<void>;
  deleteAutomation: (id: string) => Promise<void>;
  toggleAutomation: (id: string) => Promise<void>;
  markRun: (id: string, nextRunAt: string) => Promise<void>;

  addLog: (log: AutomationLog) => Promise<void>;
  updateLog: (id: string, updates: Partial<AutomationLog>) => Promise<void>;

  _persist: (automations: Automation[], logs: AutomationLog[], dir: string) => Promise<void>;
}

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  automations: [],
  logs: [],
  configDir: null,

  init: async () => {
    const dir = await getConfigDir();
    let automations: Automation[] = [];
    let logs: AutomationLog[] = [];
    try { automations = JSON.parse(await readFileText(`${dir}/automations.json`)); } catch {}
    try { logs = JSON.parse(await readFileText(`${dir}/automation-logs.json`)); } catch {}
    set({ automations, logs, configDir: dir });
  },

  addAutomation: async (a) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const now = new Date();
    const automation: Automation = {
      ...a,
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      lastRunAt: null,
      nextRunAt: computeNextRunAt(a.schedule, now),
    };
    const next = [...automations, automation];
    set({ automations: next });
    await get()._persist(next, logs, configDir);
  },

  updateAutomation: async (id, updates) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const next = automations.map((a) => {
      if (a.id !== id) return a;
      const updated = { ...a, ...updates };
      if (updates.schedule) updated.nextRunAt = computeNextRunAt(updates.schedule);
      return updated;
    });
    set({ automations: next });
    await get()._persist(next, logs, configDir);
  },

  deleteAutomation: async (id) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const next = automations.filter((a) => a.id !== id);
    set({ automations: next });
    await get()._persist(next, logs, configDir);
  },

  toggleAutomation: async (id) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const next = automations.map((a) => {
      if (a.id !== id) return a;
      const enabled = !a.enabled;
      return {
        ...a,
        enabled,
        nextRunAt: enabled ? computeNextRunAt(a.schedule) : a.nextRunAt,
      };
    });
    set({ automations: next });
    await get()._persist(next, logs, configDir);
  },

  markRun: async (id, nextRunAt) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const now = new Date().toISOString();
    const next = automations.map((a) =>
      a.id === id ? { ...a, lastRunAt: now, nextRunAt } : a,
    );
    set({ automations: next });
    await get()._persist(next, logs, configDir);
  },

  addLog: async (log) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const next = [log, ...logs].slice(0, 500);
    set({ logs: next });
    await get()._persist(automations, next, configDir);
  },

  updateLog: async (id, updates) => {
    const { automations, logs, configDir } = get();
    if (!configDir) return;
    const next = logs.map((l) => (l.id === id ? { ...l, ...updates } : l));
    set({ logs: next });
    await get()._persist(automations, next, configDir);
  },

  _persist: async (automations, logs, dir) => {
    await Promise.all([
      writeFileText(`${dir}/automations.json`, JSON.stringify(automations, null, 2)),
      writeFileText(`${dir}/automation-logs.json`, JSON.stringify(logs, null, 2)),
    ]);
  },
}));
