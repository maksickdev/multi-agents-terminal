import { create } from "zustand";
import type { AgentStatus, Project } from "../lib/tauri";

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  status: AgentStatus;
  exitCode?: number;
  createdAt: number;
}

interface AppStore {
  projects: Project[];
  agents: Record<string, Agent>;
  selectedProjectId: string | null;
  activeAgentId: Record<string, string | null>;

  // Project actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;

  // Agent actions
  addAgent: (agent: Agent) => void;
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
      activeAgentId: { ...s.activeAgentId, [agent.projectId]: agent.id },
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

      const newActiveAgentId = { ...s.activeAgentId };
      if (agent && newActiveAgentId[agent.projectId] === agentId) {
        const remaining = Object.values(newAgents).filter(
          (a) => a.projectId === agent.projectId
        );
        newActiveAgentId[agent.projectId] =
          remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }

      return { agents: newAgents, activeAgentId: newActiveAgentId };
    }),

  selectProject: (projectId) => set({ selectedProjectId: projectId }),

  setActiveAgent: (projectId, agentId) =>
    set((s) => ({
      activeAgentId: { ...s.activeAgentId, [projectId]: agentId },
    })),

  getProjectAgents: (projectId) =>
    Object.values(get().agents)
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => a.createdAt - b.createdAt),
}));
