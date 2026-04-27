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
    console.log(`[hook] ${new Date().toISOString()} ${event} session=${session}${tool}${extra}`);
    if (parsed.tool_input !== undefined) {
      console.log("       input:", JSON.stringify(parsed.tool_input));
    }
    if (parsed.tool_response !== undefined) {
      console.log("       response:", JSON.stringify(parsed.tool_response));
    }

    const line = JSON.stringify({ ...parsed, _received_at: Date.now() }) + "\n";
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
