/**
 * Shared state for OS-level (external) file drag-and-drop.
 *
 * Each droppable component sets itself as the active target via onDragOver
 * and clears it via onDragLeave.  The Tauri "drop" event handler reads the
 * active target to know where to route the dropped paths.
 *
 * No coordinate math — the browser's own hit-testing handles "which element
 * is under the cursor" correctly for DOM events.
 */

export type ExternalTarget =
  | { type: "terminal"; agentId: string }
  | { type: "folder";   folderPath: string };

let _active: ExternalTarget | null = null;

export function setActive(t: ExternalTarget | null): void {
  _active = t;
}

export function getActive(): ExternalTarget | null {
  return _active;
}

/**
 * Dispatched on `window` when the drag leaves the app window entirely
 * (Tauri "leave" event) so each component can clear its visual feedback
 * without needing a shared React state.
 */
export const DRAG_END_EVENT = "external-drag-end";

export function notifyDragEnd(): void {
  setActive(null);
  window.dispatchEvent(new CustomEvent(DRAG_END_EVENT));
}
