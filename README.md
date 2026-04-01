# Multi-Agent Terminal

A macOS desktop app built with Tauri 2 + React + TypeScript for running and managing multiple Claude AI agents simultaneously in persistent terminal sessions.

## Features

- **Multiple agents per project** — spawn and manage Claude CLI sessions as tabbed terminal panes
- **Session persistence** — agent PTYs are respawned on restart with scrollback replay
- **File manager** — split-pane file explorer with CodeMirror editor; supports syntax highlighting for TypeScript, JavaScript, Rust, CSS, HTML, JSON, Markdown
- **Markdown preview** — RAW/RENDERED toggle for `.md` files (via `marked` + `DOMPurify`)
- **Shell panel** — persistent bottom panel with a zsh shell per project
- **Drag-to-reorder** — both agent tabs and file editor tabs support mouse-based drag reorder
- **Tab management** — rename on double-click, close on middle-click, dirty indicator for unsaved files

## Tech stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Zustand, xterm.js 5, CodeMirror 6
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
    FileExplorer/     — file tree, context menu, inline rename
    Editor/           — EditorPane, CodeEditor (CodeMirror), EditorTab, RenderedPreview
    MainArea/         — layout host, TabBar, TerminalGrid, BottomPanel
    Terminal/         — TerminalPane (xterm.js)
    BottomPanel/      — shell pane
  hooks/
    useSessionPersistence.ts  — load/save agents + projects on disk
    usePty.ts                 — Tauri PTY event listeners, input encoding
  lib/
    ptyManager.ts     — module-level xterm.js instance map
    tauri.ts          — typed wrappers for all Tauri invoke/event calls
    languageDetect.ts — file extension → CodeMirror language id
  store/
    useStore.ts       — Zustand store (projects, agents, editor, file explorer state)
src-tauri/
  src/
    commands/         — pty_commands, project_commands, file_commands
    pty/              — session, manager, reader
    state/            — app_state
```

## Configuration

Runtime config is stored at `~/.config/multi-agents-terminal/`:
- `projects.json` — saved projects
- `agents.json` — saved agents (tab order preserved)
- `scrollback/` — raw PTY scrollback per agent (`{agent_id}.bin`)
