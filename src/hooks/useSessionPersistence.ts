import { useEffect, useRef } from "react";
import type React from "react";
import {
  loadProjects,
  saveProjects,
  loadAgents,
  saveAgents,
  spawnAgent,
  type AgentMeta,
} from "../lib/tauri";
import { useStore, type Agent } from "../store/useStore";

/**
 * Handles full session persistence:
 *  - Loads projects and agents (in saved order) from disk on mount
 *  - Respawns each agent via `claude -r <session_id>` so Claude itself
 *    restores the conversation
 *  - Saves projects and agents (in tab order) whenever they change
 *
 * @param pausedRef  When `pausedRef.current === true` the auto-save is
 *                   suspended.  Set this before starting the close sequence so
 *                   status-change events cannot overwrite the final save.
 */
export function useSessionPersistence(pausedRef: React.MutableRefObject<boolean>) {
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

        // Spawn a fresh PTY reusing the same agent ID (and Claude session ID if saved)
        try {
          await spawnAgent(meta.project_id, meta.cwd, undefined, undefined, meta.id, meta.session_id);
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
          sessionId: meta.session_id ?? undefined,
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
    if (!restored.current || pausedRef.current) return;

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
            session_id: a.sessionId ?? null,
          });
        }
      }
    }

    saveAgents(metas).catch(console.error);
  }, [agents, agentOrder]);
}
