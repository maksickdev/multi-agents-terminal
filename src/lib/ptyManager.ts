import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

interface TerminalEntry {
  terminal: Terminal;
  fitAddon: FitAddon;
}

const entries = new Map<string, TerminalEntry>();

/** Scrollback bytes waiting to be replayed when the terminal attaches. */
const pendingScrollback = new Map<string, Uint8Array>();

export function setPendingScrollback(agentId: string, data: Uint8Array) {
  pendingScrollback.set(agentId, data);
}

export function getOrCreate(agentId: string): TerminalEntry {
  if (!entries.has(agentId)) {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    entries.set(agentId, { terminal, fitAddon });
  }
  return entries.get(agentId)!;
}

export function attach(agentId: string, element: HTMLElement) {
  const entry = getOrCreate(agentId);
  if (!entry.terminal.element) {
    entry.terminal.open(element);
  }

  // Replay historical output if available (session restore)
  const scrollback = pendingScrollback.get(agentId);
  if (scrollback && scrollback.length > 0) {
    pendingScrollback.delete(agentId);
    entry.terminal.write(scrollback);
    // Visual separator between history and new session
    entry.terminal.write(
      "\r\n\x1b[2m\x1b[90m─── session restored ───\x1b[0m\r\n\r\n"
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
    entry.terminal.dispose();
    entries.delete(agentId);
  }
}

export function write(agentId: string, data: Uint8Array) {
  const entry = entries.get(agentId);
  if (entry) {
    entry.terminal.write(data);
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
    entry.terminal.clear();
  }
}
