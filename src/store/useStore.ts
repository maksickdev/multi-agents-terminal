import { create } from "zustand";
import type { AgentStatus, Project } from "../lib/tauri";

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  cwd: string;
  status: AgentStatus;
  exitCode?: number;
  createdAt: number;
}

interface AppStore {
  projects: Project[];
  agents: Record<string, Agent>;
  /** Ordered list of agent IDs per project — drives tab order. */
  agentOrder: Record<string, string[]>;
  selectedProjectId: string | null;
  activeAgentId: Record<string, string | null>;

  // Project actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;

  // Agent actions
  addAgent: (agent: Agent) => void;
  renameAgent: (agentId: string, name: string) => void;
  reorderAgents: (projectId: string, orderedIds: string[]) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus, exitCode?: number) => void;
  removeAgent: (agentId: string) => void;

  // UI actions
  selectProject: (projectId: string) => void;
  setActiveAgent: (projectId: string, agentId: string | null) => void;

  // Derived
  getProjectAgents: (projectId: string) => Agent[];
}

export const useStore = create<AppStore>((set, get) => ({
  projects: [],
  agents: {},
  agentOrder: {},
  selectedProjectId: null,
  activeAgentId: {},

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((s) => ({ projects: [...s.projects, project] })),

  removeProject: (projectId) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
      selectedProjectId:
        s.selectedProjectId === projectId ? null : s.selectedProjectId,
    })),

  addAgent: (agent) =>
    set((s) => ({
      agents: { ...s.agents, [agent.id]: agent },
      agentOrder: {
        ...s.agentOrder,
        [agent.projectId]: [
          ...(s.agentOrder[agent.projectId] ?? []),
          agent.id,
        ],
      },
      activeAgentId: { ...s.activeAgentId, [agent.projectId]: agent.id },
    })),

  renameAgent: (agentId, name) =>
    set((s) => {
      const agent = s.agents[agentId];
      if (!agent) return s;
      return { agents: { ...s.agents, [agentId]: { ...agent, name } } };
    }),

  reorderAgents: (projectId, orderedIds) =>
    set((s) => ({
      agentOrder: { ...s.agentOrder, [projectId]: orderedIds },
    })),

  updateAgentStatus: (agentId, status, exitCode) =>
    set((s) => {
      const agent = s.agents[agentId];
      if (!agent) return s;
      return {
        agents: {
          ...s.agents,
          [agentId]: { ...agent, status, exitCode: exitCode ?? agent.exitCode },
        },
      };
    }),

  removeAgent: (agentId) =>
    set((s) => {
      const agent = s.agents[agentId];
      const newAgents = { ...s.agents };
      delete newAgents[agentId];

      const newAgentOrder = { ...s.agentOrder };
      if (agent) {
        newAgentOrder[agent.projectId] = (
          newAgentOrder[agent.projectId] ?? []
        ).filter((id) => id !== agentId);
      }

      const newActiveAgentId = { ...s.activeAgentId };
      if (agent && newActiveAgentId[agent.projectId] === agentId) {
        const remaining = (newAgentOrder[agent.projectId] ?? [])
          .map((id) => newAgents[id])
          .filter(Boolean);
        newActiveAgentId[agent.projectId] =
          remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }

      return {
        agents: newAgents,
        agentOrder: newAgentOrder,
        activeAgentId: newActiveAgentId,
      };
    }),

  selectProject: (projectId) => set({ selectedProjectId: projectId }),

  setActiveAgent: (projectId, agentId) =>
    set((s) => ({
      activeAgentId: { ...s.activeAgentId, [projectId]: agentId },
    })),

  /** Returns agents in explicit tab order (agentOrder), not by createdAt. */
  getProjectAgents: (projectId) => {
    const { agents, agentOrder } = get();
    return (agentOrder[projectId] ?? [])
      .map((id) => agents[id])
      .filter(Boolean) as Agent[];
  },
}));
