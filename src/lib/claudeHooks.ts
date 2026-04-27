import { readFileText, writeFileText, createDirAll, getHomeDir, setExecutable } from "./tauri";

const HOOK_COMMAND = "~/.claude/hooks/mat-dispatch.sh";

const REQUIRED_EVENTS = [
  // Session
  "SessionStart",
  "SessionEnd",
  "InstructionsLoaded",
  // Per-turn
  "UserPromptSubmit",
  "UserPromptExpansion",
  "Stop",
  "StopFailure",
  // Tool execution
  "PreToolUse",
  "PermissionRequest",
  "PermissionDenied",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  // Agent & task
  "SubagentStart",
  "SubagentStop",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  // Configuration & environment
  "ConfigChange",
  "CwdChanged",
  "FileChanged",
  // Compaction
  "PreCompact",
  "PostCompact",
  // Notification & interaction
  "Notification",
  "Elicitation",
  "ElicitationResult",
  // Worktree
  "WorktreeCreate",
  "WorktreeRemove",
] as const;

const DISPATCH_SCRIPT = `#!/usr/bin/env bash
INPUT=$(cat)
PAYLOAD=$(node -e "
const d = JSON.parse(process.argv[1]);
if (process.env.MAT_AGENT_ID) d.mat_agent_id = process.env.MAT_AGENT_ID;
console.log(JSON.stringify(d));
" "$INPUT" 2>/dev/null || echo "$INPUT")
curl -s --max-time 3 -X POST \\
  -H "Content-Type: application/json" \\
  -d "$PAYLOAD" \\
  "http://127.0.0.1:27123/hook" &>/dev/null &
`;

interface HookEntry {
  type: "command";
  command: string;
}

interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

function hasDispatchHook(matchers: HookMatcher[]): boolean {
  return matchers.some((m) =>
    m.hooks?.some((h) => h.command === HOOK_COMMAND)
  );
}

export async function ensureProjectHooks(projectPath: string): Promise<void> {
  try {
    const settingsPath = `${projectPath}/.claude/settings.json`;

    let settings: ClaudeSettings = {};
    try {
      const text = await readFileText(settingsPath);
      settings = JSON.parse(text) as ClaudeSettings;
    } catch {
      // File missing or unreadable — start fresh
    }

    if (typeof settings !== "object" || settings === null) {
      console.warn(`[hooks] settings.json at ${settingsPath} is not an object, skipping`);
      return;
    }

    if (!settings.hooks || typeof settings.hooks !== "object") {
      settings.hooks = {};
    }

    let needsWrite = false;

    for (const event of REQUIRED_EVENTS) {
      const matchers = settings.hooks[event];
      if (!Array.isArray(matchers) || !hasDispatchHook(matchers)) {
        settings.hooks[event] = [
          ...(Array.isArray(matchers) ? matchers : []),
          { matcher: "", hooks: [{ type: "command", command: HOOK_COMMAND }] },
        ];
        needsWrite = true;
      }
    }

    if (needsWrite) {
      await createDirAll(`${projectPath}/.claude`);
      await writeFileText(settingsPath, JSON.stringify(settings, null, 2));
    }
  } catch (e) {
    console.warn(`[hooks] ensureProjectHooks(${projectPath}):`, e);
  }
}

export async function ensureDispatchScript(): Promise<void> {
  try {
    const home = await getHomeDir();
    const hooksDir = `${home}/.claude/hooks`;
    const scriptPath = `${hooksDir}/mat-dispatch.sh`;

    try {
      const existing = await readFileText(scriptPath);
      if (existing.includes("MAT_AGENT_ID")) return;
    } catch {
      // File missing — will create it
    }

    await createDirAll(hooksDir);
    await writeFileText(scriptPath, DISPATCH_SCRIPT);
    await setExecutable(scriptPath);
  } catch (e) {
    console.warn("[hooks] ensureDispatchScript:", e);
  }
}
