import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface Project {
  id: string;
  name: string;
  path: string;
}

/** Persisted agent metadata (stored in agents.json). */
export interface AgentMeta {
  id: string;
  project_id: string;
  name: string;
  cwd: string;
  created_at: number;
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

/** agentId is optional — pass it to restore a saved session with the same ID. */
export const spawnAgent = (
  projectId: string,
  cwd: string,
  rows?: number,
  cols?: number,
  agentId?: string,
) => invoke<string>("spawn_agent", { projectId, cwd, rows, cols, agentId });

export const spawnShell = (
  cwd: string,
  rows?: number,
  cols?: number,
  agentId?: string,
) => invoke<string>("spawn_shell", { cwd, rows, cols, agentId });

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

// Session-persistence commands
export const loadAgents = () => invoke<AgentMeta[]>("load_agents");

export const saveAgents = (agents: AgentMeta[]) =>
  invoke<void>("save_agents", { agents });

/** Returns base64-encoded raw PTY bytes, or "" if no scrollback file exists. */
export const loadScrollback = (agentId: string) =>
  invoke<string>("load_scrollback", { agentId });

export const deleteScrollback = (agentId: string) =>
  invoke<void>("delete_scrollback", { agentId });

export const saveProjects = (projects: Project[]) =>
  invoke<void>("save_projects", { projects });

export const pickFolder = () => invoke<string | null>("pick_folder");

// ── File manager ─────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export const readDir = (path: string) =>
  invoke<FileEntry[]>("read_dir", { path });

export const readFileText = (path: string) =>
  invoke<string>("read_file_text", { path });

export const writeFileText = (path: string, content: string) =>
  invoke<void>("write_file_text", { path, content });

export const deletePath = (path: string) =>
  invoke<void>("delete_path", { path });

export const createFile = (path: string) =>
  invoke<void>("create_file", { path });

export const createDirAll = (path: string) =>
  invoke<void>("create_dir_all", { path });

export const renamePath = (oldPath: string, newPath: string) =>
  invoke<void>("rename_path", { oldPath, newPath });

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
