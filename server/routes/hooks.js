// @ts-check
import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "multi-agents-terminal",
);
const EVENTS_FILE = path.join(CONFIG_DIR, "hook-events.jsonl");
const AGENTS_FILE = path.join(CONFIG_DIR, "agents.json");

/**
 * @typedef {{ id: string, project_id: string, name: string, cwd: string, session_id?: string|null }} AgentMeta
 */

/** @returns {AgentMeta[]} */
function loadAgents() {
  try {
    return JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Find the agent by exact agent_id (injected via MAT_AGENT_ID env var).
 * @param {string} agentId
 * @returns {{ agent_id: string, agent_name: string, project_id: string } | null}
 */
function resolveAgentById(agentId) {
  const agent = loadAgents().find((a) => a.id === agentId);
  if (!agent) return null;
  return { agent_id: agent.id, agent_name: agent.name, project_id: agent.project_id };
}

/**
 * Fallback: find the agent by matching session_id first, then cwd.
 * @param {Record<string, unknown>} parsed
 * @returns {{ agent_id: string, agent_name: string, project_id: string } | null}
 */
function resolveAgent(parsed) {
  const agents = loadAgents();
  if (!agents.length) return null;

  const sessionId = typeof parsed.session_id === "string" ? parsed.session_id : null;
  const cwd = typeof parsed.cwd === "string" ? parsed.cwd : null;

  let agent = sessionId
    ? agents.find((a) => a.session_id && a.session_id === sessionId)
    : null;

  if (!agent && cwd) {
    agent = agents.find((a) => a.cwd === cwd);
  }

  if (!agent) return null;

  return { agent_id: agent.id, agent_name: agent.name, project_id: agent.project_id };
}

/** @param {Record<string, unknown>} parsed */
function buildExtra(parsed) {
  const parts = [];
  if (parsed.cwd) parts.push(`cwd=${parsed.cwd}`);
  if (parsed.message) parts.push(`msg=${String(parsed.message).slice(0, 80)}`);
  if (parsed.subagent_id) parts.push(`subagent=${parsed.subagent_id}`);
  return parts.length ? " " + parts.join(" ") : "";
}

/** @param {import("http").IncomingMessage} req @param {import("http").ServerResponse} res */
function handleHook(req, res) {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "invalid JSON" }));
      return;
    }

    const event = parsed.hook_event_name ?? "unknown";
    const session = parsed.session_id ?? "-";
    const tool = parsed.tool_name ? ` tool=${parsed.tool_name}` : "";
    const extra = buildExtra(parsed);

    const agentInfo = parsed.mat_agent_id
      ? resolveAgentById(String(parsed.mat_agent_id))
      : resolveAgent(parsed);
    const agentLabel = agentInfo
      ? ` agent=${agentInfo.agent_name}(${agentInfo.agent_id.slice(0, 8)})`
      : "";

    console.log(`[hook] ${new Date().toISOString()} ${event} session=${session}${agentLabel}${tool}${extra}`);
    if (parsed.tool_input !== undefined) {
      console.log("       input:", JSON.stringify(parsed.tool_input));
    }
    if (parsed.tool_response !== undefined) {
      console.log("       response:", JSON.stringify(parsed.tool_response));
    }

    const line = JSON.stringify({ ...parsed, _received_at: Date.now(), ...(agentInfo ?? {}) }) + "\n";
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.appendFileSync(EVENTS_FILE, line, "utf8");
    } catch (e) {
      console.error("[hook] failed to write event:", e);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
}

export { handleHook };
