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
 *  - Loads projects and agents (in saved order) from disk on mount
 *  - Replays scrollback into each terminal before the new PTY starts
 *  - Saves projects and agents (in tab order) whenever they change
 */
export function useSessionPersistence() {
  const { projects, agents, agentOrder, setProjects, addAgent } = useStore();
  const restored = useRef(false);

  // ── Restore on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      const savedProjects = await loadProjects();
      setProjects(savedProjects);

      const projectIds = new Set(savedProjects.map((p) => p.id));
      const savedAgents = await loadAgents(); // array order = tab order

      for (const meta of savedAgents) {
        if (!projectIds.has(meta.project_id)) continue;

        // Stage scrollback so it replays when the terminal mounts
        try {
          const b64 = await loadScrollback(meta.id);
          if (b64) {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            ptyManager.setPendingScrollback(meta.id, bytes);
          }
        } catch (e) {
          console.warn("[session] failed to load scrollback for", meta.id, e);
        }

        // Spawn a fresh PTY reusing the same agent ID
        try {
          await spawnAgent(meta.project_id, meta.cwd, undefined, undefined, meta.id);
        } catch (e) {
          console.warn("[session] failed to respawn agent", meta.id, e);
          continue;
        }

        // Add to store — addAgent appends to agentOrder, preserving array order
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

  // ── Persist projects ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!restored.current) return;
    saveProjects(projects).catch(console.error);
  }, [projects]);

  // ── Persist agents in tab order ────────────────────────────────────────────
  // Watch both `agents` (name / status changes) and `agentOrder` (reorder / rename)
  useEffect(() => {
    if (!restored.current) return;

    const metas: AgentMeta[] = [];
    for (const [, ids] of Object.entries(agentOrder)) {
      for (const id of ids) {
        const a = agents[id];
        if (a && a.status !== "exited") {
          metas.push({
            id: a.id,
            project_id: a.projectId,
            name: a.name,
            cwd: a.cwd,
            created_at: a.createdAt,
          });
        }
      }
    }

    saveAgents(metas).catch(console.error);
  }, [agents, agentOrder]);
}
