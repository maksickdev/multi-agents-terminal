export type HotkeyAction =
  | "toggleSidebar"
  | "toggleFileExplorer"
  | "toggleGitPanel"
  | "toggleTerminal"
  | "globalSearch";

export interface Hotkey {
  key: string;    // lowercase, e.g. "b", "e", "g"
  meta: boolean;  // Cmd on macOS
  shift: boolean;
  alt: boolean;
}

export type HotkeyMap = Record<HotkeyAction, Hotkey>;

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  toggleSidebar:      "Toggle Sidebar",
  toggleFileExplorer: "Toggle File Explorer",
  toggleGitPanel:     "Toggle Git Panel",
  toggleTerminal:     "Toggle Terminal",
  globalSearch:       "Global Search",
};

export const DEFAULT_HOTKEYS: HotkeyMap = {
  toggleSidebar:      { key: "b", meta: true,  shift: false, alt: false },
  toggleFileExplorer: { key: "e", meta: true,  shift: false, alt: false },
  toggleGitPanel:     { key: "g", meta: true,  shift: false, alt: false },
  toggleTerminal:     { key: "j", meta: true,  shift: false, alt: false },
  globalSearch:       { key: "f", meta: true,  shift: true,  alt: false },
};

export function hotkeysFromStorage(): HotkeyMap {
  try {
    const raw = localStorage.getItem("hotkeys");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HotkeyMap>;
      return { ...DEFAULT_HOTKEYS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_HOTKEYS };
}

/** Format a Hotkey into a human-readable label like ⌘⇧F */
export function formatHotkey(h: Hotkey): string {
  const parts: string[] = [];
  if (h.meta)  parts.push("⌘");
  if (h.shift) parts.push("⇧");
  if (h.alt)   parts.push("⌥");
  parts.push(h.key.toUpperCase());
  return parts.join("");
}

/** Returns true when the KeyboardEvent matches a Hotkey binding. */
export function matchesHotkey(e: KeyboardEvent, h: Hotkey): boolean {
  return (
    e.key.toLowerCase() === h.key.toLowerCase() &&
    e.metaKey  === h.meta  &&
    e.shiftKey === h.shift &&
    e.altKey   === h.alt
  );
}
