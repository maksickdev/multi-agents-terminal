import { useEffect, useRef } from "react";
import {
  loadProjects,
  saveProjects,
  loadAgents,
  saveAgents,
  loadScrollback,
  spawnAgent,
  type AgentMeta,
} from "../lib/tauri";
import { useStore, type Agent } from "../store/useStore";
import * as ptyManager from "../lib/ptyManager";

/**
 * Handles full session persistence:
 *  - Loads projects and agents from disk on mount
 *  - Replays scrollback into each terminal before the new PTY starts
 *  - Saves projects and agents whenever they change
 */
export function useSessionPersistence() {
  const {
    projects,
    agents,
    setProjects,
    addAgent,
  } = useStore();

  const restored = useRef(false);

  // ── Restore on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      // 1. Load projects
      const savedProjects = await loadProjects();
      setProjects(savedProjects);

      const projectIds = new Set(savedProjects.map((p) => p.id));

      // 2. Load persisted agents
      const savedAgents = await loadAgents();

      // 3. Restore each agent whose project still exists
      for (const meta of savedAgents) {
        if (!projectIds.has(meta.project_id)) continue;

        // 3a. Load and stage scrollback before the terminal mounts
        try {
          const b64 = await loadScrollback(meta.id);
          if (b64) {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            ptyManager.setPendingScrollback(meta.id, bytes);
          }
        } catch (e) {
          console.warn("[session] failed to load scrollback for", meta.id, e);
        }

        // 3b. Spawn a fresh PTY with the same agent ID
        try {
          await spawnAgent(meta.project_id, meta.cwd, undefined, undefined, meta.id);
        } catch (e) {
          console.warn("[session] failed to respawn agent", meta.id, e);
          continue;
        }

        // 3c. Add agent to store (triggers TerminalPane mount → scrollback replayed)
        const agent: Agent = {
          id: meta.id,
          projectId: meta.project_id,
          name: meta.name,
          cwd: meta.cwd,
          status: "waiting",
          createdAt: meta.created_at,
        };
        addAgent(agent);
      }

      restored.current = true;
    }

    restore().catch(console.error);
  }, []);

  // ── Persist projects on change ────────────────────────────────────────────
  useEffect(() => {
    if (!restored.current) return;
    saveProjects(projects).catch(console.error);
  }, [projects]);

  // ── Persist agents on change ──────────────────────────────────────────────
  useEffect(() => {
    if (!restored.current) return;

    const metas: AgentMeta[] = Object.values(agents)
      .filter((a) => a.status !== "exited") // don't persist dead agents
      .map((a) => ({
        id: a.id,
        project_id: a.projectId,
        name: a.name,
        cwd: a.cwd,
        created_at: a.createdAt,
      }));

    saveAgents(metas).catch(console.error);
  }, [agents]);
}
