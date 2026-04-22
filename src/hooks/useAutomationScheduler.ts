import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../store/useStore';
import { useAutomationStore, computeNextRunAt, shouldRun } from '../store/useAutomationStore';
import { spawnAgent, writeToAgent, killAgent, deleteScrollback } from '../lib/tauri';
import type { Automation } from '../types/automation';
import type { Agent } from '../store/useStore';
import type { Project } from '../lib/tauri';

const TICK_MS = 30_000;

async function runAutomation(
  automation: Automation,
  now: Date,
  agents: Record<string, Agent>,
  projects: Project[],
  actions: {
    addAgent: ReturnType<typeof useStore.getState>['addAgent'];
    removeAgent: ReturnType<typeof useStore.getState>['removeAgent'];
    markRun: (id: string, nextRunAt: string) => Promise<void>;
    addLog: (log: import('../types/automation').AutomationLog) => Promise<void>;
    updateLog: (id: string, updates: Partial<import('../types/automation').AutomationLog>) => Promise<void>;
  },
) {
  const nextRunAt = computeNextRunAt(automation.schedule, now);
  await actions.markRun(automation.id, nextRunAt);

  const logId = crypto.randomUUID();
  const startedAt = now.toISOString();

  const encodeTask = (task: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(task + '\r')));

  if (automation.targetType === 'agent' && automation.targetAgentId) {
    const agent = agents[automation.targetAgentId];

    // Agent doesn't exist or has exited — log as failed
    if (!agent || agent.status === 'exited') {
      await actions.addLog({
        id: logId,
        automationId: automation.id,
        automationName: automation.name,
        projectId: automation.projectId,
        agentId: automation.targetAgentId,
        startedAt,
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Agent is currently processing — skip this run
    if (agent.status === 'active') {
      await actions.addLog({
        id: logId,
        automationId: automation.id,
        automationName: automation.name,
        projectId: automation.projectId,
        agentId: automation.targetAgentId,
        startedAt,
        status: 'skipped',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    await actions.addLog({
      id: logId,
      automationId: automation.id,
      automationName: automation.name,
      projectId: automation.projectId,
      agentId: automation.targetAgentId,
      startedAt,
      status: 'running',
      completedAt: null,
    });

    try {
      await writeToAgent(agent.id, encodeTask(automation.task));
      await actions.updateLog(logId, { status: 'completed', completedAt: new Date().toISOString() });
    } catch {
      await actions.updateLog(logId, { status: 'failed', completedAt: new Date().toISOString() });
    }
    return;
  }

  // Background agent
  const project = projects.find((p) => p.id === automation.projectId);
  if (!project) return;

  const agentId = crypto.randomUUID();

  await actions.addLog({
    id: logId,
    automationId: automation.id,
    automationName: automation.name,
    projectId: automation.projectId,
    agentId,
    startedAt,
    status: 'running',
    completedAt: null,
  });

  try {
    await spawnAgent(project.id, project.path, 24, 80, agentId);
    actions.addAgent({
      id: agentId,
      projectId: project.id,
      name: `[Auto] ${automation.name}`,
      cwd: project.path,
      status: 'active',
      createdAt: Date.now(),
    });

    // Set up completion listeners before sending the task
    let unlistenStatus: (() => void) | null = null;
    let unlistenExited: (() => void) | null = null;
    let done = false;
    let sawActive = false;

    const finish = (status: 'completed' | 'failed') => {
      if (done) return;
      done = true;
      unlistenStatus?.();
      unlistenExited?.();
      // Kill the process if still running (Claude doesn't self-exit after finishing a task)
      killAgent(agentId).catch(() => {});
      deleteScrollback(agentId).catch(() => {});
      actions.removeAgent(agentId);
      actions.updateLog(logId, { status, completedAt: new Date().toISOString() });
    };

    // Claude finishes a task by going quiet (waiting) after being active.
    // agent-status: waiting fires after 2 s of silence in reader.rs.
    unlistenStatus = await listen<{ agent_id: string; status: string }>('agent-status', (e) => {
      if (e.payload.agent_id !== agentId) return;
      if (e.payload.status === 'active') sawActive = true;
      else if (e.payload.status === 'waiting' && sawActive) finish('completed');
    });

    // Fallback: process exited on its own (error or explicit exit)
    unlistenExited = await listen<{ agent_id: string }>('agent-exited', (e) => {
      if (e.payload.agent_id !== agentId) return;
      finish('completed');
    });

    await new Promise((r) => setTimeout(r, 1500));
    await writeToAgent(agentId, encodeTask(automation.task));
  } catch {
    actions.updateLog(logId, { status: 'failed', completedAt: new Date().toISOString() });
  }
}

export function useAutomationScheduler() {
  const automationsRef = useRef<Automation[]>([]);
  const agentsRef = useRef<Record<string, Agent>>({});
  const projectsRef = useRef<Project[]>([]);

  const { automations, markRun, addLog, updateLog } = useAutomationStore();
  const { agents, projects, addAgent, removeAgent } = useStore();

  useEffect(() => { automationsRef.current = automations; }, [automations]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Stable action refs so the interval closure never goes stale
  const actionsRef = useRef({ markRun, addLog, updateLog, addAgent, removeAgent });
  useEffect(() => {
    actionsRef.current = { markRun, addLog, updateLog, addAgent, removeAgent };
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      for (const automation of automationsRef.current) {
        if (!shouldRun(automation, now)) continue;
        runAutomation(
          automation,
          now,
          agentsRef.current,
          projectsRef.current,
          actionsRef.current,
        ).catch((e) => console.error('[automation] run error', e));
      }
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);
}
