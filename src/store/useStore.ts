import { create } from "zustand";
import type { AgentStatus, Project } from "../lib/tauri";
import type { ThemeId } from "../lib/themes";

export interface OpenFile {
  /** Absolute path — used as a unique key. */
  path: string;
  projectId: string;
  content: string;
  isDirty: boolean;
  /** Derived from file extension: "typescript", "rust", "json", "markdown", "css", "html", "" */
  language: string;
}

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

  // Bottom panel
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  shellAgentIds: Record<string, string>; // projectId → shellAgentId
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelHeight: (height: number) => void;
  setShellAgentId: (projectId: string, agentId: string) => void;

  // File explorer
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  // Git panel
  gitPanelOpen: boolean;
  setGitPanelOpen: (open: boolean) => void;
  gitPanelWidth: number;
  setGitPanelWidth: (width: number) => void;
  gitStatusVersion: number;
  bumpGitStatus: () => void;

  fileExplorerOpen: boolean;
  fileExplorerWidth: number;
  /** projectId → array of expanded absolute dir paths */
  expandedDirs: Record<string, string[]>;
  setFileExplorerOpen: (open: boolean) => void;
  setFileExplorerWidth: (width: number) => void;
  toggleExpandedDir: (projectId: string, dirPath: string) => void;

  // Editor pane
  openFiles: OpenFile[];
  activeFilePath: string | null;
  editorPaneHeight: number;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string) => void;
  setEditorPaneHeight: (height: number) => void;
  reorderOpenFiles: (orderedPaths: string[]) => void;

  // Theme
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;

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
  bottomPanelOpen: false,
  bottomPanelHeight: 220,
  shellAgentIds: {},

  sidebarOpen: true,
  sidebarWidth: 192,
  gitPanelOpen: false,
  gitPanelWidth: 280,
  gitStatusVersion: 0,

  fileExplorerOpen: false,
  fileExplorerWidth: 240,
  expandedDirs: {},

  openFiles: [],
  activeFilePath: null,
  editorPaneHeight: 300,
  theme: (localStorage.getItem("theme") as ThemeId | null) ?? "dark",

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
    set((s) => {
      const existing = s.agentOrder[agent.projectId] ?? [];
      // Guard: skip appending to agentOrder if this ID is already tracked
      const newOrder = existing.includes(agent.id)
        ? existing
        : [...existing, agent.id];
      return {
        agents: { ...s.agents, [agent.id]: agent },
        agentOrder: { ...s.agentOrder, [agent.projectId]: newOrder },
        activeAgentId: { ...s.activeAgentId, [agent.projectId]: agent.id },
      };
    }),

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

  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(100, Math.min(height, 600)) }),
  setShellAgentId: (projectId, agentId) =>
    set((s) => ({ shellAgentIds: { ...s.shellAgentIds, [projectId]: agentId } })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(140, Math.min(width, 480)) }),
  setGitPanelOpen: (open) => set({ gitPanelOpen: open }),
  setGitPanelWidth: (width) => set({ gitPanelWidth: Math.max(220, Math.min(width, 600)) }),
  bumpGitStatus: () => set((s) => ({ gitStatusVersion: s.gitStatusVersion + 1 })),

  setFileExplorerOpen: (open) => set({ fileExplorerOpen: open }),
  setFileExplorerWidth: (width) => set({ fileExplorerWidth: Math.max(160, Math.min(width, 600)) }),
  toggleExpandedDir: (projectId, dirPath) =>
    set((s) => {
      const current = s.expandedDirs[projectId] ?? [];
      const next = current.includes(dirPath)
        ? current.filter((p) => p !== dirPath)
        : [...current, dirPath];
      return { expandedDirs: { ...s.expandedDirs, [projectId]: next } };
    }),

  openFile: (file) =>
    set((s) => {
      const exists = s.openFiles.some((f) => f.path === file.path);
      return {
        openFiles: exists ? s.openFiles : [...s.openFiles, file],
        activeFilePath: file.path,
      };
    }),

  closeFile: (path) =>
    set((s) => {
      const idx = s.openFiles.findIndex((f) => f.path === path);
      if (idx === -1) return s;
      const next = s.openFiles.filter((f) => f.path !== path);
      let active = s.activeFilePath;
      if (active === path) {
        active = next.length > 0
          ? (next[idx] ?? next[next.length - 1]).path
          : null;
      }
      return { openFiles: next, activeFilePath: active };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    })),

  markFileSaved: (path) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty: false } : f
      ),
    })),

  setEditorPaneHeight: (height) =>
    set({ editorPaneHeight: Math.max(100, Math.min(height, 700)) }),

  reorderOpenFiles: (orderedPaths) =>
    set((s) => {
      const map = new Map(s.openFiles.map((f) => [f.path, f]));
      const next = orderedPaths.map((p) => map.get(p)).filter(Boolean) as typeof s.openFiles;
      return { openFiles: next };
    }),

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },

  selectProject: (projectId) => set({ selectedProjectId: projectId }),

  setActiveAgent: (projectId, agentId) =>
    set((s) => ({
      activeAgentId: { ...s.activeAgentId, [projectId]: agentId },
    })),

  /** Returns agents in explicit tab order (agentOrder), not by createdAt. */
  getProjectAgents: (projectId) => {
    const { agents, agentOrder } = get();
    return [...new Set(agentOrder[projectId] ?? [])]
      .map((id) => agents[id])
      .filter(Boolean) as Agent[];
  },
}));
