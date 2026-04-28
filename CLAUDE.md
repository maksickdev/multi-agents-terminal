# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

All text in the codebase must be in **English only** — UI labels, button text, placeholder text, error messages, tooltips, comments, and commit messages. No Russian or other non-English text is allowed anywhere in source files.

## Git commit convention

All commits must follow the **Conventional Commits** specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

- **type** (required): `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `perf`, `build`, `ci`, `chore`
- **scope** (optional): area of the codebase in parentheses, e.g. `feat(git):`, `fix(editor):`
- **description**: short, lowercase, present tense, no period at end
- **body**: optional, more detail
- **footer**: optional, e.g. `Closes #123` or `BREAKING CHANGE:`

Examples:
```
feat(git): add graph view with branch lane visualization
fix(editor): prevent dirty flag on external content reload
refactor(git): expand history section to fill remaining panel space
chore: update dependencies
```

## Design System

All UI work must follow the unified design system documented in [`DESIGN.md`](./DESIGN.md).

**Before building or modifying any UI component:**
- Read the relevant section in `DESIGN.md` for the component type (panel, modal, button, input, etc.)
- Use only the CSS variables defined there (`var(--c-*)`) — never hardcode hex colors
- Match the exact spacing, font sizes, and border radius values from the spec

**Key rules at a glance:**
- All colors via CSS variables: `var(--c-bg)`, `var(--c-accent)`, `var(--c-danger)`, etc.
- The app has 3 switchable themes (Tokyo Night, Grid Mint, Dawn) — components must work in all three
- Panel headers are always `h-8` (32px); tab bars are always `h-8`
- Standard text sizes: `text-xs` (12px) for UI, `text-sm` (14px) for inputs/modals
- Icons from `lucide-react` only; sizes 13–20px depending on context
- Modals via `ReactDOM.createPortal` to `document.body`; context menus at `z-[9999]`
- No `display: none` on terminal-containing elements — use `visibility: hidden` or `height: 0`

## Commands

```bash
# Dev server (frontend only — Vite HMR)
npm run dev

# Full Tauri app (Rust + frontend together)
npm run tauri dev

# Type-check TypeScript
npx tsc --noEmit

# Check Rust (fast, no binary)
cargo check --manifest-path src-tauri/Cargo.toml

# Build for production
npm run tauri build
```

Config files live at `~/Library/Application Support/multi-agents-terminal/` (projects.json, agents.json, hook-events.jsonl). Conversation history is restored entirely by Claude itself via `claude -r <session_id>` — the app no longer persists raw PTY scrollback.

## Architecture

### Data flow

```
User keystroke
  → xterm.js onData (src/lib/ptyManager.ts)
  → useAgentInput (src/hooks/usePty.ts) — base64-encodes UTF-8 bytes
  → Tauri invoke("write_to_agent")
  → Rust PTY writer (src-tauri/src/pty/manager.rs)

PTY process output
  → Rust reader task (src-tauri/src/pty/reader.rs) — reads 4 KB chunks
  → emits "pty-output" Tauri event (base64)
  → usePtyEvents listener (src/hooks/usePty.ts) — writes to xterm
  → xterm.js renders
```

### Rust backend (`src-tauri/src/`)

- **`state/app_state.rs`** — `AppState` holds `Arc<Mutex<PtyManager>>` and the config path. All Tauri commands receive it via `State<'_, AppState>`.
- **`pty/session.rs`** — `AgentSession`: master PTY, writer, child process, atomic status (`STATUS_ACTIVE/WAITING/EXITED`), project_id, cwd.
- **`pty/manager.rs`** — `PtyManager`: `HashMap<agent_id, AgentSession>`. Methods: insert, remove, write, resize, kill, get_status_u8.
- **`pty/reader.rs`** — `spawn_reader()`: blocking task that reads PTY → emits `pty-output` event. Emits `agent-status: waiting` after 2 s silence, `agent-exited` on EOF/error. No on-disk persistence — output is only forwarded to xterm via Tauri events.
- **`commands/pty_commands.rs`** — all PTY Tauri commands. `spawn_agent` runs `claude` (or `claude -r <session_id>` for resume), located via `zsh -il`. Passes `MAT_AGENT_ID=<agent_id>` as env var to the PTY so Claude Code hooks can identify the originating agent. `spawn_shell` runs `$SHELL` with inherited `LANG`/`LC_ALL`/`LC_CTYPE`. Both accept optional `rows`/`cols` and `agent_id` (for session restore). Additional commands: `is_session_nonempty`, `get_agent_session_id`, `exit_app`.
- **`commands/project_commands.rs`** — load/save projects.json (atomic rename), folder picker.
- **`commands/file_commands.rs`** — FS commands: `read_dir`, `read_file_text`, `write_file_text`, `delete_path`, `create_file`, `create_dir_all`, `rename_path`, `copy_path`, `get_home_dir`, `set_executable`. `read_dir` sorts dirs first (alphabetical), then files.

Tauri 2 maps **camelCase JS parameters → snake_case Rust parameters** automatically.

### Frontend (`src/`)

**State — Zustand store (`src/store/useStore.ts`)**

- `projects: Project[]`
- `agents: Record<agentId, Agent>` — metadata only (name, status, projectId, cwd)
- `agentOrder: Record<projectId, agentId[]>` — explicit tab order per project. `addAgent` deduplicates before appending. `getProjectAgents` also deduplicates via `Set`.
- `activeAgentId: Record<projectId, agentId | null>` — which tab is active per project
- `bottomPanelOpen`, `bottomPanelHeight`, `shellAgentIds: Record<projectId, agentId>`
- `fileExplorerOpen`, `fileExplorerWidth`, `expandedDirs: Record<projectId, string[]>`
- `openFiles: OpenFile[]`, `activeFilePath: string | null`, `editorPaneHeight: number` — editor state. `OpenFile` has `path`, `projectId`, `content`, `isDirty`, `language`.
- `fileTreeVersion: number`, `bumpFileTree: () => void` — incremented after external file operations (e.g. drop copy) to trigger FileExplorer tree refresh.

**Layout (left → right, top → bottom)**

```
App
├── Sidebar          — project list + icon toolbar (Files, Terminal toggles)
├── FileExplorer     — toggleable file tree panel (width: 0 when closed)
└── MainArea
    ├── TabBar        — agent tabs for active project
    ├── TerminalArea  — flex-1, all project TerminalGrids mounted (visibility:hidden when inactive)
    ├── EditorPane    — file editor, shown only when files are open; resize handle at top
    └── BottomPanel   — shell panel, height: 0 when closed
```

All panel headers and tab bars are **32px tall** (`h-8`).

**File Explorer (`src/components/FileExplorer/`)**

- `FileExplorer.tsx` — outer panel with resize handle, header buttons (New File, New Folder, Refresh), Cmd+E shortcut.
- `FileTree.tsx` — loads one directory level via `readDir`, renders `FileTreeNode` entries.
- `FileTreeNode.tsx` — click opens file/expands folder, double-click triggers inline rename, right-click shows `ContextMenu`. Delete action shows `ConfirmModal` (replaced `window.confirm`). Uses `<FileIcon>` for files and lucide `<Folder>`/`<FolderOpen>` (color `#e0af68`) for dirs.
- `ContextMenu.tsx` — `ReactDOM.createPortal` to `document.body`, `position: fixed`, closes on outside click (capture phase) or Escape. Each item can have a `lucide-react` icon.
- `MoveConfirmModal.tsx` — confirmation modal shown when dragging a file/folder to a new folder.

**File drag (`src/lib/fileDrag.ts`)**

Mouse-based drag (not HTML5 DnD). Files/folders can be dragged to a different folder in the tree (shows `MoveConfirmModal`) or to a terminal pane (pastes path). Folders in the tree get a highlight class `file-drag-folder-hover` on hover. A drag threshold (mouse must move ≥5px) prevents accidental drags on click.

**External file drop (`src/hooks/useExternalFileDrop.ts`, `src/lib/externalDrop.ts`)**

Handles files dragged from Finder (or any OS file manager) into the app via Tauri's `onDragDropEvent` (DOM drag events don't fire for OS-level drags in WKWebView).

- Drop on a terminal/agent pane → inserts the file path(s) into PTY input.
- Drop on a FileExplorer folder → copies the file(s) into that folder via `copy_path` Rust command, then calls `bumpFileTree()` to refresh the tree.
- Highlights the drop target on hover (terminal outline, folder hover class).
- **Coordinate note**: `DragDropEvent.position` on macOS/WKWebView is already in logical (CSS) pixels relative to the window content area — no scale division or screen-offset subtraction needed. `document.elementsFromPoint(x, y)` is used directly to resolve the drop target.
- `data-agent-id` on terminal pane elements, `data-folder-path` / `data-parent-folder` on FileExplorer nodes are used for target resolution.

**File icons (`src/lib/fileIcons.tsx`)**

- `EXT_MAP` — 60+ extensions → `{ icon: LucideIcon, color }`. TypeScript = blue `#3178c6`, Rust = red `#ce422b`, JSON = yellow, etc.
- `NAME_MAP` — special filenames: `Dockerfile`, `package.json`, `tsconfig.json`, `vite.config.ts`, `Makefile`, `.env`, etc.
- `getFileIconDef(name)` — resolves by full name first, then dotfile key, then extension.
- `FileIcon` component: `<Icon size={size} style={{ color, flexShrink: 0 }} />`

**Shared components (`src/components/shared/`)**

- `ConfirmModal.tsx` — reusable modal with title, message, confirm/cancel buttons; `danger` prop for red confirm; closes on Escape, Enter confirms, click-outside cancels. Renders via `ReactDOM.createPortal` into `document.body` at `z-index: 500` so it always appears above fullscreen overlays. Keydown listener is deferred by one `requestAnimationFrame` to avoid immediately triggering confirm when opened by an Enter key press. Used for: agent kill, file close with unsaved changes, project removal, file move, file/tab rename, file delete.

**Editor Pane (`src/components/Editor/`)**

- `EditorPane.tsx` — tab bar with drag-to-reorder (same mouse-event pattern as agent TabBar), CodeEditor or RenderedPreview, status bar at bottom. Filters `openFiles` by `selectedProjectId` so only active project's files are shown. `Maximize2`/`Minimize2` button pinned left in the tab bar toggles fullscreen mode. In fullscreen, the entire pane (tabs + editor + status bar) is portaled to `document.body` via `ReactDOM.createPortal` at `z-50`. Escape exits fullscreen.
- `CodeEditor.tsx` — CodeMirror 6, Tokyo Night theme, language via `Compartment`. Supports: TypeScript, JavaScript, CSS, HTML, Rust, JSON, Markdown, Python, YAML, Ruby, Dockerfile, shell, `.env` (properties). Uses **ref pattern** for `onSave`/`onChange` callbacks to avoid stale closures in keymap and updateListener.
- `EditorTab.tsx` — drag props, dirty indicator (●), middle-click closes tab (`onAuxClick`). Double-click triggers inline rename (input with border-b styling); on commit shows `ConfirmModal` before calling `renamePath` + `renameOpenFile`.
- `RenderedPreview.tsx` — markdown rendered via `marked` + `DOMPurify`. RAW/RENDERED toggle in status bar for `.md` files only.

**xterm.js lifecycle (`src/lib/ptyManager.ts`)**

Module-level `Map<agentId, { terminal, fitAddon }>`. Key rules:
- `terminal.open(element)` can only be called **once** — guarded by `if (!entry.terminal.element)`.
- After `open()`, a capture-phase `keydown` listener is added to `.xterm-helper-textarea` calling `e.preventDefault()` for `altKey` events — this prevents WKWebView from processing Option+Delete/Arrow natively before xterm.
- `macOptionIsMeta: true` — Option key sends ESC+key meta sequences.
- `clearTerminal(agentId)` is called on the **first** PTY output chunk per agent to wipe xterm.js initialization garbage.
- Terminals are **never disposed** on project/tab switch — only on explicit agent kill.
- `getTerminal(agentId)` exported for external scrollbar access.

**Custom xterm scrollbar**

The native xterm scrollbar is hidden via CSS (`.xterm-viewport { scrollbar-width: none }`). Each `TerminalPane` renders a custom 6px scrollbar alongside the xterm container using **direct DOM refs** (`trackRef`, `thumbRef`) — no React state, no re-renders. Scroll position is synced via xterm's `onScroll` callback and a `wheel` event listener (with `requestAnimationFrame`) on the xterm element. The thumb supports drag interaction.

**Global scrollbar styles (`src/index.css`)**

All non-xterm scrollbars use Tokyo Night colors: `scrollbar-color: #414868 #16161e`, 6px width. The `.scrollbar-none` utility class hides scrollbars (used on the agent TabBar).

**TitleBar (top of `App.tsx`)**

32px drag region (`data-tauri-drag-region`) at the top of the window. Left side: panel toggle buttons (Layers, Files, SquareTerminal, GitBranch, FileCode2, Clock, ScrollText) — `w-7 h-7`, icon size 16px, rendered from a static array. Center: project name + `TitleBarGitInfo` (pointer-events-none). Right: `UsageButton` + Settings. `UsageButton` renders an icon-only button; the usage panel opens via `ReactDOM.createPortal` (position fixed, `z-index: 200`) positioned from `getBoundingClientRect()` of the trigger button.

> `src/components/Projects/ActivityBar.tsx` exists but is **not used** — all panel toggles are in the TitleBar.

**Terminal fullscreen (`src/components/MainArea/`)**

`MainArea` holds a `terminalFullscreen` boolean state. When true, the wrapper div containing `TabBar` + terminal area switches from `flex-1` to `position: fixed; inset: 0; top: 32px; z-index: 50`. This is a **CSS-only approach** — no portal, no remount — because xterm.js cannot be re-attached once opened. `TabBar` receives `fullscreen` + `onToggleFullscreen` props and renders `Maximize2`/`Minimize2` pinned left (before tabs, separated by border). Escape exits fullscreen.

**Avoiding xterm re-mount problems**

xterm cannot be re-opened once closed. Two patterns used:
1. **All project TerminalGrids stay mounted** in `MainArea` — inactive ones use `visibility: hidden; pointer-events: none` (not `display: none`, which breaks rendering).
2. **BottomPanel** stays mounted with `height: 0; overflow: hidden` when closed — so `ShellPane`/xterm never unmounts.
3. **EditorPane** stays mounted with `height: 0; overflow: hidden` when no files are open.
4. **Terminal fullscreen** uses CSS `position: fixed` on the existing container — never remounts the terminals.

**Session persistence (`src/hooks/useSessionPersistence.ts`)**

On mount: loads projects + agents.json → respawns each agent PTY reusing the saved `agent_id`; if `session_id` is present spawns as `claude -r <session_id>` so Claude itself restores the conversation → adds to store. Also calls `ensureDispatchScript()` (creates `~/.claude/hooks/mat-dispatch.sh`) and `ensureProjectHooks()` for every project (patches `.claude/settings.json` with all 29 hook events). On change: saves projects and agents (in tab order, excluding `exited`) to disk. Accepts a `pausedRef: MutableRefObject<boolean>` — when true, skips auto-save (used during the close sequence to prevent race conditions).

**Claude Code hook system (`src/lib/claudeHooks.ts`, `src/hooks/useHookEvents.ts`, `src-tauri/src/hook_server.rs`)**

All Claude Code hook events are forwarded to an axum HTTP server embedded in the Tauri process, listening on `127.0.0.1:27123`. It starts automatically in `setup()` — no separate process or `npm run server` needed.

- `ensureProjectHooks(projectPath)` — non-destructively patches `<project>/.claude/settings.json` to register `~/.claude/hooks/mat-dispatch.sh` for all 29 hook event types. Called on startup (for every loaded project) and when a project is added or created.
- `ensureDispatchScript()` — writes `~/.claude/hooks/mat-dispatch.sh` with `chmod 755` on startup. The script reads hook JSON from stdin, injects `mat_agent_id` via `sed` (from `$MAT_AGENT_ID` env var set by `spawn_agent`), then POSTs to the server non-blocking (`--max-time 3 &`). Pure bash — no Node.js dependency.
- `hook_server.rs` — embedded axum server. Receives `POST /hook`, resolves the agent by `mat_agent_id` (exact match) with fallback to `session_id`/`cwd` lookup in `agents.json`, appends enriched event to `hook-events.jsonl`.
- `useHookEvents(onEvent)` — React hook that polls `hook-events.jsonl` every 2 s via `readFileText` and calls `onEvent` for each new line. Mounted in `App.tsx`.
- **Agent identification**: `spawn_agent` sets `MAT_AGENT_ID=<agent_id>` in the PTY process env. This env var persists for the entire process lifetime regardless of session ID changes.

**Close sequence (App.tsx)**

X / Cmd+Q → Rust intercepts `CloseRequested` / `ExitRequested` → emits `"close-requested"` → frontend shows `ConfirmModal` → on confirm:
1. `savingRef.current = true` — pauses `useSessionPersistence` auto-save
2. Sends `/status\r` to each Claude agent in parallel, listens for `pty-output` events, strips ANSI, matches `Session\s*ID:\s*<uuid>` (5 s timeout)
3. Validates each UUID via `is_session_nonempty` — skips empty sessions Claude cannot resume
4. Saves `agents.json` with `session_id` fields
5. Calls `exit_app` → sets `confirmed_exit` flag → `app.exit(0)`

**PTY events (`src/hooks/usePty.ts`)**

`usePtyEvents()` registers three global Tauri listeners (`pty-output`, `agent-status`, `agent-exited`). Uses a `cancelled` ref + `register()` helper to safely clean up async listeners on unmount. `StrictMode` is disabled in `main.tsx` because Tauri listeners are async and double-invocation in StrictMode causes duplicate output.

**Input encoding**

`useAgentInput` encodes input as UTF-8 via `TextEncoder`, then base64 via `btoa`. The Rust side decodes base64 → writes raw bytes to PTY.

**Tab drag-and-drop**

Uses **mouse events** (not HTML5 DnD — unreliable in WKWebView). `draggingRef`/`dragOverRef`/`movedRef` + `window.addEventListener("mouseup", ...)`. `movedRef` suppresses click when mouse actually moved to another tab. Pattern used in both agent TabBar and editor EditorPane file tabs.

### Key gotchas

- `agentOrder` must be subscribed in any component that renders tab order — add it to `useStore()` destructuring to trigger re-renders on reorder (see `MainArea`).
- `spawn_agent` / `spawn_shell` both require PTY size at spawn time — measure the container before calling, otherwise Claude TUI wraps incorrectly.
- Shell PTY (`spawn_shell`) inherits `LANG`/`LC_ALL`/`LC_CTYPE` from environment so zsh ZLE handles multi-byte UTF-8 correctly.
- Conversation restore is handled entirely by Claude via `claude -r <session_id>` — the app does not store raw PTY scrollback, so on respawn the terminal starts empty until Claude redraws its UI.
- **Stale closure in CodeMirror**: keymap and updateListener are created once on mount. Always use `useRef` for `onSave`/`onChange` callbacks and update the ref via `useEffect` (no deps) — never pass callbacks directly into the keymap closure.
- **Vite HMR gotcha**: saving any file from `src/` or `index.html` via the editor triggers Vite HMR in dev mode, reloading the app. This does not affect production builds.
- `EditorPane` filters `openFiles` by `selectedProjectId` — only files of the active project are shown. All project files remain in the store and reappear when switching back.
- **xterm scrollbar**: WKWebView does not apply webkit-scrollbar CSS to xterm's `.xterm-viewport`. The native scrollbar is hidden with `display: none` and a custom React scrollbar renders alongside the container using direct DOM mutation (not setState) for performance.
- **xterm write queue**: xterm.js 5.x throws a hard `Error` (not a warning) when `_pendingData > 50 MB`. All writes go through a per-terminal queue using `terminal.write(data, callback)` so the next chunk is only enqueued after the previous one is consumed.
- **External drop coordinates**: Tauri `DragDropEvent.position` on macOS/WKWebView is in logical CSS pixels relative to the window content area — do NOT divide by `scaleFactor()` or subtract `innerPosition()`. Use the values directly with `document.elementsFromPoint()`.
