# Multi-Agent Terminal

A macOS desktop app built with Tauri 2 + React + TypeScript for running and managing multiple Claude AI agents simultaneously in persistent terminal sessions.

## Features

- **Multiple agents per project** — spawn and manage Claude CLI sessions as tabbed terminal panes
- **Session persistence** — on close, each agent's Claude session ID is captured via `/status` and saved to `agents.json`; on next launch agents resume with `claude -r <session_id>`, continuing the exact same conversation
- **File manager** — split-pane file explorer with per-extension color icons (60+ types); drag files/folders to reorder or move
- **In-app editor** — CodeMirror 6 with syntax highlighting for TypeScript, JavaScript, Rust, CSS, HTML, JSON, Markdown, Python, Ruby, YAML, Dockerfile, shell, `.env`
- **Auto-reload editor files** — open files reload automatically when changed externally (e.g. by an agent), dirty files are never overwritten
- **Markdown preview** — RAW/RENDERED toggle for `.md` files (via `marked` + `DOMPurify`)
- **Fullscreen mode** — both the editor pane and the agent terminal panel can be expanded to fill the entire window; Escape or the minimize button exits
- **Shell panel** — persistent bottom panel with a zsh shell per project
- **Drag-to-reorder** — both agent tabs and file editor tabs support mouse-based drag reorder
- **Drag-to-terminal** — drag files/folders from the explorer to a terminal to paste the path
- **External file drop** — drag files from Finder into the app: drop on a terminal to insert the path, drop on an Explorer folder to copy the file there
- **Tab management** — rename on double-click (with confirmation), close on middle-click, dirty indicator for unsaved files
- **Confirmation modals** — shown before killing an agent, closing an unsaved file, removing a project, moving or deleting a file, renaming a file tab
- **Usage monitor** — Claude Code usage limits panel accessible from the ActivityBar (icon-only button above Settings)
- **Themed scrollbars** — Tokyo Night styled scrollbars everywhere; custom scrollbar in xterm terminals (native one hidden)

## Tech stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Zustand, xterm.js 5, CodeMirror 6, lucide-react
- **Backend**: Tauri 2, Rust, `portable-pty`
- **Editor deps**: `marked`, `dompurify`

## Dev setup

```bash
npm install
npm run tauri dev   # Rust + frontend together (recommended)
# or
npm run dev         # Frontend only (Vite HMR, no Tauri backend)
```

```bash
npx tsc --noEmit                               # Type-check
cargo check --manifest-path src-tauri/Cargo.toml  # Rust check
npm run tauri build                            # Production build
```

## Project structure

```
src/
  components/
    Sidebar/          — project list, icon toolbar (Files/Terminal toggles)
    FileExplorer/     — file tree, context menu, inline rename, move modal
    Editor/           — EditorPane, CodeEditor (CodeMirror), EditorTab, RenderedPreview
    MainArea/         — layout host, TabBar, TerminalGrid
    Terminal/         — TerminalPane (xterm.js + custom scrollbar)
    BottomPanel/      — shell pane
    shared/           — ConfirmModal
  hooks/
    useSessionPersistence.ts  — load/save agents + projects on disk
    usePty.ts                 — Tauri PTY event listeners, input encoding
    useFileWatcher.ts         — polls open files every 2 s, reloads on external change
    useExternalFileDrop.ts    — Finder→app file drop (terminal path insert / folder copy)
  lib/
    ptyManager.ts     — module-level xterm.js instance map + write queue
    tauri.ts          — typed wrappers for all Tauri invoke/event calls
    languageDetect.ts — file extension → CodeMirror language id
    fileIcons.tsx     — per-extension lucide icon + color definitions
    fileDrag.ts       — mouse-based file drag (to folder or terminal)
    externalDrop.ts   — shared state for active external drop target
  store/
    useStore.ts       — Zustand store (projects, agents, editor, file explorer state)
src-tauri/
  src/
    commands/         — pty_commands, project_commands, file_commands
    pty/              — session, manager, reader
    state/            — app_state
```

## Configuration

Runtime config is stored at `~/Library/Application Support/multi-agents-terminal/`:
- `projects.json` — saved projects
- `agents.json` — saved agents (tab order + Claude `session_id` per agent)
- `scrollback/` — raw PTY scrollback per agent (`{agent_id}.bin`)
