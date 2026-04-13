# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Config files live at `~/Library/Application Support/multi-agents-terminal/` (projects.json, agents.json, scrollback/).

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

- **`state/app_state.rs`** — `AppState` holds `Arc<Mutex<PtyManager>>`, config path, scrollback dir. All Tauri commands receive it via `State<'_, AppState>`.
- **`pty/session.rs`** — `AgentSession`: master PTY, writer, child process, atomic status (`STATUS_ACTIVE/WAITING/EXITED`), project_id, cwd.
- **`pty/manager.rs`** — `PtyManager`: `HashMap<agent_id, AgentSession>`. Methods: insert, remove, write, resize, kill, get_status_u8.
- **`pty/reader.rs`** — `spawn_reader()`: blocking task that reads PTY → appends to scrollback file → emits `pty-output` event. Emits `agent-status: waiting` after 2 s silence, `agent-exited` on EOF/error.
- **`commands/pty_commands.rs`** — all PTY Tauri commands. `spawn_agent` runs `claude` (or `claude -r <session_id>` for resume), located via `zsh -il`. `spawn_shell` runs `$SHELL` with inherited `LANG`/`LC_ALL`/`LC_CTYPE`. Both accept optional `rows`/`cols` and `agent_id` (for session restore). Scrollback files are `{scrollback_dir}/{agent_id}.bin`. Additional commands: `get_scrollback_size`, `truncate_scrollback`, `is_session_nonempty`, `get_agent_session_id`, `exit_app`.
- **`commands/project_commands.rs`** — load/save projects.json (atomic rename), folder picker.
- **`commands/file_commands.rs`** — 8 FS commands: `read_dir`, `read_file_text`, `write_file_text`, `delete_path`, `create_file`, `create_dir_all`, `rename_path`, `copy_path`. `read_dir` sorts dirs first (alphabetical), then files.

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

**Activity Bar (`src/components/Sidebar/ActivityBar.tsx`)**

Icon-only vertical toolbar (w-12) on the far left. Top section: sidebar toggle, file explorer, terminal, git. Bottom section: `UsageButton` (above) and Settings (below). `UsageButton` renders an icon-only button; the usage panel opens via `ReactDOM.createPortal` (position fixed, `z-index: 200`) to the right of the ActivityBar, positioned from `getBoundingClientRect()` of the trigger button.

**Terminal fullscreen (`src/components/MainArea/`)**

`MainArea` holds a `terminalFullscreen` boolean state. When true, the wrapper div containing `TabBar` + terminal area switches from `flex-1` to `position: fixed; inset: 0; top: 32px; z-index: 50`. This is a **CSS-only approach** — no portal, no remount — because xterm.js cannot be re-attached once opened. `TabBar` receives `fullscreen` + `onToggleFullscreen` props and renders `Maximize2`/`Minimize2` pinned left (before tabs, separated by border). Escape exits fullscreen.

**Avoiding xterm re-mount problems**

xterm cannot be re-opened once closed. Two patterns used:
1. **All project TerminalGrids stay mounted** in `MainArea` — inactive ones use `visibility: hidden; pointer-events: none` (not `display: none`, which breaks rendering).
2. **BottomPanel** stays mounted with `height: 0; overflow: hidden` when closed — so `ShellPane`/xterm never unmounts.
3. **EditorPane** stays mounted with `height: 0; overflow: hidden` when no files are open.
4. **Terminal fullscreen** uses CSS `position: fixed` on the existing container — never remounts the terminals.

**Session persistence (`src/hooks/useSessionPersistence.ts`)**

On mount: loads projects + agents.json → stages scrollback via `ptyManager.setPendingScrollback()` → respawns each agent PTY reusing the saved `agent_id`; if `session_id` is present spawns as `claude -r <session_id>` to resume the conversation → adds to store. On change: saves projects and agents (in tab order, excluding `exited`) to disk. Accepts a `pausedRef: MutableRefObject<boolean>` — when true, skips auto-save (used during the close sequence to prevent race conditions).

**Close sequence (App.tsx)**

X / Cmd+Q → Rust intercepts `CloseRequested` / `ExitRequested` → emits `"close-requested"` → frontend shows `ConfirmModal` → on confirm:
1. `savingRef.current = true` — pauses `useSessionPersistence` auto-save
2. Records scrollback file sizes for all active Claude agents
3. Sends `/status\r` to each agent in parallel, listens for `pty-output` events, strips ANSI, matches `Session\s*ID:\s*<uuid>` (5 s timeout)
4. Validates each UUID via `is_session_nonempty` — skips empty sessions Claude cannot resume
5. Truncates each scrollback file back to the pre-`/status` size (removes the `/status` I/O so it doesn't replay on next launch)
6. Saves `agents.json` with `session_id` fields
7. Calls `exit_app` → sets `confirmed_exit` flag → `app.exit(0)`

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
- Scrollback files are raw PTY bytes (not text) — replayed through xterm for session restore.
- **Stale closure in CodeMirror**: keymap and updateListener are created once on mount. Always use `useRef` for `onSave`/`onChange` callbacks and update the ref via `useEffect` (no deps) — never pass callbacks directly into the keymap closure.
- **Vite HMR gotcha**: saving any file from `src/` or `index.html` via the editor triggers Vite HMR in dev mode, reloading the app. This does not affect production builds.
- `EditorPane` filters `openFiles` by `selectedProjectId` — only files of the active project are shown. All project files remain in the store and reappear when switching back.
- **xterm scrollbar**: WKWebView does not apply webkit-scrollbar CSS to xterm's `.xterm-viewport`. The native scrollbar is hidden with `display: none` and a custom React scrollbar renders alongside the container using direct DOM mutation (not setState) for performance.
- **xterm write queue**: xterm.js 5.x throws a hard `Error` (not a warning) when `_pendingData > 50 MB`. All writes go through a per-terminal queue using `terminal.write(data, callback)` so the next chunk is only enqueued after the previous one is consumed.
- **External drop coordinates**: Tauri `DragDropEvent.position` on macOS/WKWebView is in logical CSS pixels relative to the window content area — do NOT divide by `scaleFactor()` or subtract `innerPosition()`. Use the values directly with `document.elementsFromPoint()`.
