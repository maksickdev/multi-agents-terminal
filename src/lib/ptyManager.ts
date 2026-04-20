import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { CanvasAddon } from "@xterm/addon-canvas";
import type { ThemeId } from "./themes";

interface TerminalEntry {
  terminal: Terminal;
  fitAddon: FitAddon;
}

const entries = new Map<string, TerminalEntry>();

/** Scrollback bytes waiting to be replayed when the terminal attaches. */
const pendingScrollback = new Map<string, Uint8Array>();

// ── Flow-control write queue ──────────────────────────────────────────────────
//
// xterm.js 5.x throws a hard Error when _pendingData > 50 MB:
//   "write data discarded, use flow control to avoid losing data"
//
// Queuing writes and only dispatching the next chunk after xterm signals
// completion (via the write-callback) keeps _pendingData well below the limit.

const writeQueues = new Map<string, (Uint8Array | string)[]>();
const writeBusy   = new Map<string, boolean>();

function drainQueue(agentId: string, terminal: Terminal) {
  const queue = writeQueues.get(agentId);
  if (!queue || queue.length === 0) {
    writeBusy.set(agentId, false);
    return;
  }
  writeBusy.set(agentId, true);
  const chunk = queue.shift()!;
  // terminal.write() accepts Uint8Array | string, callback fires after parsing.
  // Wrap in try-catch: xterm throws "write data discarded" if _pendingData > 50 MB.
  // On overflow, drop the queue and reset so future writes aren't blocked.
  try {
    (terminal.write as (data: Uint8Array | string, cb?: () => void) => void)(
      chunk,
      () => drainQueue(agentId, terminal),
    );
  } catch {
    writeQueues.delete(agentId);
    writeBusy.delete(agentId);
  }
}

function enqueueWrite(
  agentId: string,
  terminal: Terminal,
  data: Uint8Array | string,
) {
  if (!writeQueues.has(agentId)) writeQueues.set(agentId, []);
  writeQueues.get(agentId)!.push(data);
  if (!writeBusy.get(agentId)) drainQueue(agentId, terminal);
}

// ── Per-theme xterm color palettes ───────────────────────────────────────────

const xtermThemes: Record<ThemeId, NonNullable<ConstructorParameters<typeof Terminal>[0]>["theme"]> = {
  dark: {
    background:    "#16161e",
    foreground:    "#c0caf5",
    cursor:        "#c0caf5",
    black:         "#15161e",
    red:           "#f7768e",
    green:         "#9ece6a",
    yellow:        "#e0af68",
    blue:          "#7aa2f7",
    magenta:       "#bb9af7",
    cyan:          "#7dcfff",
    white:         "#a9b1d6",
    brightBlack:   "#414868",
    brightRed:     "#f7768e",
    brightGreen:   "#9ece6a",
    brightYellow:  "#e0af68",
    brightBlue:    "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan:    "#7dcfff",
    brightWhite:   "#c0caf5",
  },
  mint: {
    background:    "#0a0a0a",
    foreground:    "#cccccc",
    cursor:        "#00d4aa",
    cursorAccent:  "#111111",
    black:         "#111111",
    red:           "#d44444",
    green:         "#00c896",
    yellow:        "#d4a800",
    blue:          "#5599dd",
    magenta:       "#9966cc",
    cyan:          "#00b8d4",
    white:         "#888888",
    brightBlack:   "#333333",
    brightRed:     "#ff6666",
    brightGreen:   "#00e5a0",
    brightYellow:  "#f0c040",
    brightBlue:    "#77bbff",
    brightMagenta: "#bb88ee",
    brightCyan:    "#00d4aa",
    brightWhite:   "#cccccc",
  },
  light: {
    background:    "#e8e8f0",
    foreground:    "#1a1a3a",
    cursor:        "#3878e8",
    black:         "#1a1a3a",
    red:           "#d02040",
    green:         "#1a8a30",
    yellow:        "#a06010",
    blue:          "#3878e8",
    magenta:       "#6040cc",
    cyan:          "#0080bb",
    white:         "#a0a0c0",
    brightBlack:   "#7070a8",
    brightRed:     "#f04060",
    brightGreen:   "#30aa50",
    brightYellow:  "#c08030",
    brightBlue:    "#5898f8",
    brightMagenta: "#8060ee",
    brightCyan:    "#20a0db",
    brightWhite:   "#404060",
  },
};

let currentTheme: ThemeId = "dark";

/** Call this whenever the app theme changes — updates all live terminals. */
export function applyTerminalTheme(themeId: ThemeId) {
  currentTheme = themeId;
  const palette = xtermThemes[themeId];
  for (const { terminal } of entries.values()) {
    terminal.options.theme = palette;
  }
}

export function setPendingScrollback(agentId: string, data: Uint8Array) {
  pendingScrollback.set(agentId, data);
}

export function getOrCreate(agentId: string): TerminalEntry {
  if (!entries.has(agentId)) {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
      macOptionIsMeta: true,
      theme: xtermThemes[currentTheme],
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new CanvasAddon());

    entries.set(agentId, { terminal, fitAddon });
  }
  return entries.get(agentId)!;
}

export function attach(agentId: string, element: HTMLElement) {
  const entry = getOrCreate(agentId);
  if (!entry.terminal.element) {
    entry.terminal.open(element);

    // Capture-phase listener on xterm's hidden textarea prevents WKWebView
    // from processing Option+key natively (word-delete, word-nav, etc.)
    // before JavaScript. xterm handles the key via macOptionIsMeta.
    const textarea = element.querySelector(".xterm-helper-textarea");
    if (textarea) {
      textarea.addEventListener(
        "keydown",
        (e) => { if ((e as KeyboardEvent).altKey) e.preventDefault(); },
        { capture: true },
      );
    }
  }

  // Replay historical output if available (session restore).
  // Queued via flow-control so the 50 MB xterm write-buffer never overflows.
  const scrollback = pendingScrollback.get(agentId);
  if (scrollback && scrollback.length > 0) {
    pendingScrollback.delete(agentId);
    enqueueWrite(agentId, entry.terminal, scrollback);
    // Visual separator — enqueued after scrollback so it appears at the end
    enqueueWrite(
      agentId,
      entry.terminal,
      "\r\n\x1b[2m\x1b[90m─── session restored ───\x1b[0m\r\n\r\n",
    );
  }

  entry.fitAddon.fit();
}

export function fit(agentId: string) {
  const entry = entries.get(agentId);
  if (entry) {
    entry.fitAddon.fit();
  }
}

export function dispose(agentId: string) {
  const entry = entries.get(agentId);
  if (entry) {
    writeQueues.delete(agentId);
    writeBusy.delete(agentId);
    entry.terminal.dispose();
    entries.delete(agentId);
  }
}

/** Write PTY output. Uses a flow-control queue so xterm never overflows. */
export function write(agentId: string, data: Uint8Array) {
  const entry = entries.get(agentId);
  if (entry) {
    enqueueWrite(agentId, entry.terminal, data);
  }
}

export function onData(agentId: string, cb: (data: string) => void) {
  const entry = getOrCreate(agentId);
  return entry.terminal.onData(cb);
}

export function getDimensions(agentId: string): { rows: number; cols: number } | null {
  const entry = entries.get(agentId);
  if (!entry) return null;
  return { rows: entry.terminal.rows, cols: entry.terminal.cols };
}

export function clearTerminal(agentId: string) {
  const entry = entries.get(agentId);
  if (entry) {
    // Drain pending writes before clearing so stale data doesn't appear later
    writeQueues.delete(agentId);
    writeBusy.delete(agentId);
    entry.terminal.clear();
  }
}

export function getTerminal(agentId: string) {
  return entries.get(agentId)?.terminal ?? null;
}
