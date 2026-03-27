import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface Project {
  id: string;
  name: string;
  path: string;
}

export type AgentStatus = "active" | "waiting" | "exited";

export interface PtyOutputPayload {
  agent_id: string;
  data: string; // base64
}

export interface AgentExitedPayload {
  agent_id: string;
  exit_code: number | null;
}

export interface AgentStatusPayload {
  agent_id: string;
  status: AgentStatus;
}

// PTY commands — Tauri 2 maps camelCase JS params → snake_case Rust params
export const spawnAgent = (projectId: string, cwd: string, rows?: number, cols?: number) =>
  invoke<string>("spawn_agent", { projectId, cwd, rows, cols });

export const writeToAgent = (agentId: string, data: string) =>
  invoke<void>("write_to_agent", { agentId, data });

export const resizeAgent = (agentId: string, rows: number, cols: number) =>
  invoke<void>("resize_agent", { agentId, rows, cols });

export const killAgent = (agentId: string) =>
  invoke<void>("kill_agent", { agentId });

export const restartAgent = (agentId: string, cwd: string, projectId: string, rows?: number, cols?: number) =>
  invoke<void>("restart_agent", { agentId, cwd, projectId, rows, cols });

// Project commands
export const loadProjects = () => invoke<Project[]>("load_projects");

export const saveProjects = (projects: Project[]) =>
  invoke<void>("save_projects", { projects });

export const pickFolder = () => invoke<string | null>("pick_folder");

// Event listeners
export const onPtyOutput = (
  cb: (payload: PtyOutputPayload) => void
): Promise<UnlistenFn> =>
  listen<PtyOutputPayload>("pty-output", (e) => cb(e.payload));

export const onAgentExited = (
  cb: (payload: AgentExitedPayload) => void
): Promise<UnlistenFn> =>
  listen<AgentExitedPayload>("agent-exited", (e) => cb(e.payload));

export const onAgentStatus = (
  cb: (payload: AgentStatusPayload) => void
): Promise<UnlistenFn> =>
  listen<AgentStatusPayload>("agent-status", (e) => cb(e.payload));
