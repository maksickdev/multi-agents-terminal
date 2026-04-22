export type IntervalUnit = 'minutes' | 'hours' | 'days';

export interface IntervalSchedule {
  type: 'interval';
  value: number;
  unit: IntervalUnit;
}

export interface TimeSchedule {
  type: 'time';
  hour: number;    // 0–23
  minute: number;  // 0–59
  days: number[];  // 0=Sun … 6=Sat; empty = every day
}

export type Schedule = IntervalSchedule | TimeSchedule;

export interface Automation {
  id: string;
  projectId: string;
  name: string;
  task: string;
  targetType: 'agent' | 'background';
  targetAgentId: string | null;
  schedule: Schedule;
  enabled: boolean;
  createdAt: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  automationName: string;
  projectId: string;
  agentId: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  completedAt: string | null;
}
