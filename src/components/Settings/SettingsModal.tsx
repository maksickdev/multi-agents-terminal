import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { themes } from "../../lib/themes";
import { X, FolderOpen, RotateCcw } from "lucide-react";
import { pickFolder } from "../../lib/tauri";
import {
  type HotkeyAction, type Hotkey,
  HOTKEY_LABELS, formatHotkey,
} from "../../lib/hotkeys";

interface Props {
  onClose: () => void;
}

// ── Hotkey recorder ──────────────────────────────────────────────────────────

interface HotkeyRowProps {
  action: HotkeyAction;
  binding: Hotkey;
  conflict: boolean;
  onChange: (action: HotkeyAction, hotkey: Hotkey) => void;
}

function HotkeyRow({ action, binding, conflict, onChange }: HotkeyRowProps) {
  const [recording, setRecording] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only keypresses
      if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return;

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      onChange(action, {
        key: e.key.toLowerCase(),
        meta: e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      });
      setRecording(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setRecording(false);
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [recording, action, onChange]);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--c-text)] flex-1">{HOTKEY_LABELS[action]}</span>
      <button
        ref={btnRef}
        onClick={() => setRecording(true)}
        title={recording ? "Press a key combination, or Escape to cancel" : "Click to record a new shortcut"}
        className={`min-w-[80px] px-2.5 py-1 rounded text-xs font-mono border transition-colors text-center ${
          recording
            ? "border-[var(--c-accent)] text-[var(--c-accent)] bg-[var(--c-accent)]/10 animate-pulse"
            : conflict
              ? "border-[var(--c-danger)] text-[var(--c-danger)] bg-[var(--c-danger)]/10"
              : "border-[var(--c-border)] text-[var(--c-text-bright)] hover:border-[var(--c-accent)] bg-[var(--c-bg-deep)]"
        }`}
      >
        {recording ? "recording…" : formatHotkey(binding)}
      </button>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: Props) {
  const { theme, setTheme, projectsFolder, setProjectsFolder, hotkeys, setHotkey, resetHotkeys } = useStore();
  const [folderInput, setFolderInput] = useState(projectsFolder);

  const handlePickFolder = async () => {
    const picked = await pickFolder();
    if (picked) setFolderInput(picked);
  };

  const handleFolderBlur = () => {
    setProjectsFolder(folderInput);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Detect conflicting bindings (same combo used by two actions)
  const hotkeyActions = Object.keys(hotkeys) as HotkeyAction[];
  const conflicts = new Set<HotkeyAction>();
  for (let i = 0; i < hotkeyActions.length; i++) {
    for (let j = i + 1; j < hotkeyActions.length; j++) {
      const a = hotkeys[hotkeyActions[i]];
      const b = hotkeys[hotkeyActions[j]];
      if (
        a.key === b.key &&
        a.meta === b.meta &&
        a.shift === b.shift &&
        a.alt === b.alt
      ) {
        conflicts.add(hotkeyActions[i]);
        conflicts.add(hotkeyActions[j]);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-xl shadow-2xl w-[480px] flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--c-border)] flex-shrink-0">
          <span className="text-sm font-semibold text-[var(--c-text-bright)]">Settings</span>
          <button
            onClick={onClose}
            className="text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-5 overflow-y-auto">

          {/* Projects folder */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
              Projects folder
            </span>
            <p className="text-xs text-[var(--c-text-dim)]">
              Default folder for creating new projects.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onBlur={handleFolderBlur}
                placeholder="/Users/you/Projects"
                className="flex-1 px-3 py-1.5 text-sm rounded font-mono outline-none border border-[var(--c-border)] focus:border-[var(--c-accent)] transition-colors"
                style={{ background: "var(--c-bg-deep)", color: "var(--c-text)" }}
              />
              <button
                onClick={handlePickFolder}
                title="Pick folder"
                className="px-2 py-1.5 rounded border border-[var(--c-border)] hover:border-[var(--c-accent)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
                style={{ background: "var(--c-bg-deep)" }}
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {/* Theme section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
              Theme
            </span>

            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative flex flex-col gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                      isActive
                        ? "border-[var(--c-accent)]"
                        : "border-[var(--c-border)] hover:border-[var(--c-muted)]"
                    }`}
                    style={{ background: t.vars.bg }}
                  >
                    {/* Miniature color swatch */}
                    <div className="flex gap-1">
                      {[t.vars.bgDeep, t.vars.bgElevated, t.vars.accent, t.vars.accentYellow, t.vars.danger].map(
                        (color, i) => (
                          <div
                            key={i}
                            style={{ background: color, width: 12, height: 12, borderRadius: 3, flexShrink: 0 }}
                          />
                        )
                      )}
                    </div>

                    {/* Theme name */}
                    <span
                      className="text-xs font-medium"
                      style={{ color: t.vars.textBright }}
                    >
                      {t.name}
                    </span>

                    {/* Active indicator */}
                    {isActive && (
                      <div
                        className="absolute top-2 right-2 w-2 h-2 rounded-full"
                        style={{ background: t.vars.accent }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-widest">
                Keyboard shortcuts
              </span>
              <button
                onClick={resetHotkeys}
                title="Reset all shortcuts to defaults"
                className="flex items-center gap-1 text-[10px] text-[var(--c-text-dim)] hover:text-[var(--c-text-bright)] transition-colors"
              >
                <RotateCcw size={10} />
                Reset
              </button>
            </div>
            <p className="text-xs text-[var(--c-text-dim)]">
              Click a shortcut to record a new key combination.
            </p>
            <div className="flex flex-col divide-y divide-[var(--c-border)]">
              {hotkeyActions.map((action) => (
                <HotkeyRow
                  key={action}
                  action={action}
                  binding={hotkeys[action]}
                  conflict={conflicts.has(action)}
                  onChange={setHotkey}
                />
              ))}
            </div>
            {conflicts.size > 0 && (
              <p className="text-[10px] text-[var(--c-danger)]">
                Some shortcuts conflict — highlighted in red.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-[var(--c-border)] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded bg-[var(--c-bg-hover)] text-[var(--c-text)] hover:text-[var(--c-text-bright)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
