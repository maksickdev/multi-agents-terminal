# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Config files live at `~/.config/multi-agents-terminal/` (projects.json, agents.json, scrollback/).

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
- **`commands/pty_commands.rs`** — all PTY Tauri commands. `spawn_agent` runs `claude` (located via `zsh -il`). `spawn_shell` runs `$SHELL` with inherited `LANG`/`LC_ALL`/`LC_CTYPE`. Both accept optional `rows`/`cols` and `agent_id` (for session restore). Scrollback files are `{scrollback_dir}/{agent_id}.bin`.
- **`commands/project_commands.rs`** — load/save projects.json (atomic rename), folder picker.
- **`commands/file_commands.rs`** — 7 FS commands: `read_dir`, `read_file_text`, `write_file_text`, `delete_path`, `create_file`, `create_dir_all`, `rename_path`. `read_dir` sorts dirs first (alphabetical), then files.

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

**File Explorer (`src/components/FileExplorer/`)**

- `FileExplorer.tsx` — outer panel with resize handle, header buttons (New File, New Folder, Refresh), Cmd+E shortcut.
- `FileTree.tsx` — loads one directory level via `readDir`, renders `FileTreeNode` entries.
- `FileTreeNode.tsx` — click opens file/expands folder, double-click triggers inline rename, right-click shows `ContextMenu`.
- `ContextMenu.tsx` — `ReactDOM.createPortal` to `document.body`, `position: fixed`, closes on outside click (capture phase) or Escape.

**Editor Pane (`src/components/Editor/`)**

- `EditorPane.tsx` — tab bar with drag-to-reorder (same mouse-event pattern as agent TabBar), CodeEditor or RenderedPreview, status bar at bottom. Filters `openFiles` by `selectedProjectId` so only active project's files are shown.
- `CodeEditor.tsx` — CodeMirror 6, Tokyo Night theme, language via `Compartment`. Uses **ref pattern** for `onSave`/`onChange` callbacks (`onSaveRef`, `onChangeRef` updated each render via `useEffect`) to avoid stale closures in keymap and updateListener.
- `EditorTab.tsx` — drag props, dirty indicator (●), middle-click closes tab (`onAuxClick`).
- `RenderedPreview.tsx` — markdown rendered via `marked` + `DOMPurify`. RAW/RENDERED toggle in status bar for `.md` files only.

**xterm.js lifecycle (`src/lib/ptyManager.ts`)**

Module-level `Map<agentId, { terminal, fitAddon }>`. Key rules:
- `terminal.open(element)` can only be called **once** — guarded by `if (!entry.terminal.element)`.
- After `open()`, a capture-phase `keydown` listener is added to `.xterm-helper-textarea` calling `e.preventDefault()` for `altKey` events — this prevents WKWebView from processing Option+Delete/Arrow natively before xterm.
- `macOptionIsMeta: true` — Option key sends ESC+key meta sequences.
- `clearTerminal(agentId)` is called on the **first** PTY output chunk per agent to wipe xterm.js initialization garbage.
- Terminals are **never disposed** on project/tab switch — only on explicit agent kill.

**Avoiding xterm re-mount problems**

xterm cannot be re-opened once closed. Two patterns used:
1. **All project TerminalGrids stay mounted** in `MainArea` — inactive ones use `visibility: hidden; pointer-events: none` (not `display: none`, which breaks rendering).
2. **BottomPanel** stays mounted with `height: 0; overflow: hidden` when closed — so `ShellPane`/xterm never unmounts.
3. **EditorPane** stays mounted with `height: 0; overflow: hidden` when no files are open.

**Session persistence (`src/hooks/useSessionPersistence.ts`)**

On mount: loads projects + agents.json → stages scrollback via `ptyManager.setPendingScrollback()` → respawns each agent PTY reusing the saved `agent_id` → adds to store. On change: saves projects and agents (in tab order, excluding `exited`) to disk.

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
