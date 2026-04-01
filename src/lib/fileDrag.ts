/**
 * File drag-to-terminal / drag-to-folder via mouse events
 * (HTML5 DnD is unreliable in WKWebView).
 *
 * Drop targets:
 *   - TerminalPane / ShellPane: data-agent-id="<id>"  → inserts path into PTY
 *   - FileTreeNode folder:      data-folder-path="<p>" → calls onFolderDrop callback
 */

import { writeToAgent } from "./tauri";

let draggingPath: string | null = null;
let ghost: HTMLDivElement | null = null;
let hoveredFolderEl: HTMLElement | null = null;
let folderDropCb: ((src: string, dst: string) => void) | null = null;

const FOLDER_HOVER_CLASS = "file-drag-folder-hover";

// ── Callback registration ─────────────────────────────────────────────────────

export function setOnFolderDrop(cb: (src: string, dst: string) => void) {
  folderDropCb = cb;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeInput(text: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(text))
      .map((b) => String.fromCharCode(b))
      .join("")
  );
}

function createGhost(path: string, isDir: boolean) {
  ghost = document.createElement("div");
  ghost.textContent = (isDir ? "📁 " : "📄 ") + path.split("/").pop();
  Object.assign(ghost.style, {
    position: "fixed",
    top: "-100px",
    left: "-100px",
    pointerEvents: "none",
    zIndex: "9999",
    background: "#1f2335",
    color: "#7aa2f7",
    border: "1px solid #7aa2f7",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "12px",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    opacity: "0.95",
    userSelect: "none",
  });
  document.body.appendChild(ghost);
}

function removeGhost() {
  ghost?.remove();
  ghost = null;
}

function clearSelection() {
  window.getSelection()?.removeAllRanges();
}

// ── Folder highlight tracking ─────────────────────────────────────────────────

function getElementsAt(x: number, y: number): Element[] {
  if (ghost) ghost.style.display = "none";
  const els = document.elementsFromPoint(x, y);
  if (ghost) ghost.style.display = "";
  return els;
}

function resolveFolderTarget(x: number, y: number): HTMLElement | null {
  const els = getElementsAt(x, y);
  for (const el of els) {
    const h = el as HTMLElement;
    // Hovering over a folder row — use it directly
    if (h.dataset?.folderPath !== undefined) return h;
    // Hovering over a file row — find its parent folder element by path
    if (h.dataset?.parentFolder !== undefined) {
      const parentPath = h.dataset.parentFolder;
      const folderEl = document.querySelector<HTMLElement>(
        `[data-folder-path="${CSS.escape(parentPath)}"]`
      );
      if (folderEl) return folderEl;
    }
  }
  return null;
}

function updateFolderHighlight(x: number, y: number) {
  const newFolder = resolveFolderTarget(x, y);
  if (newFolder !== hoveredFolderEl) {
    hoveredFolderEl?.classList.remove(FOLDER_HOVER_CLASS);
    newFolder?.classList.add(FOLDER_HOVER_CLASS);
    hoveredFolderEl = newFolder;
  }
}

function clearFolderHighlight() {
  hoveredFolderEl?.classList.remove(FOLDER_HOVER_CLASS);
  hoveredFolderEl = null;
}

// ── Mouse handlers ────────────────────────────────────────────────────────────

function onMouseMove(e: MouseEvent) {
  if (!ghost) return;
  ghost.style.left = e.clientX + 14 + "px";
  ghost.style.top  = e.clientY - 10 + "px";
  updateFolderHighlight(e.clientX, e.clientY);
}

function onMouseUp(e: MouseEvent) {
  const src = draggingPath;
  const folderEl = resolveFolderTarget(e.clientX, e.clientY);
  stop();
  if (!src) return;

  // Drop on folder → move
  if (folderEl) {
    const dst = folderEl.dataset.folderPath!;
    // Prevent dropping into self or own subfolder
    if (dst === src || dst.startsWith(src + "/")) return;
    // Prevent dropping into the file's current parent (no-op)
    const srcParent = src.substring(0, src.lastIndexOf("/"));
    if (dst === srcParent) return;
    folderDropCb?.(src, dst);
    return;
  }

  // Drop on terminal → insert path
  const els = getElementsAt(e.clientX, e.clientY);
  for (const el of els) {
    const agentId = (el as HTMLElement).dataset?.agentId;
    if (agentId) {
      writeToAgent(agentId, encodeInput(src)).catch(console.error);
      return;
    }
  }
}

function stop() {
  draggingPath = null;
  removeGhost();
  clearFolderHighlight();
  clearSelection();
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}

// ── Public API ────────────────────────────────────────────────────────────────

const DRAG_THRESHOLD = 6; // px

export function isDraggingFile(): boolean {
  return draggingPath !== null;
}

export function startFileDrag(path: string, isDir = false, originX = 0, originY = 0) {
  stop();

  const onPendingMove = (e: MouseEvent) => {
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

    // Threshold reached — activate drag
    window.removeEventListener("mousemove", onPendingMove);
    window.removeEventListener("mouseup", onPendingCancel);

    clearSelection();
    draggingPath = path;
    createGhost(path, isDir);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onPendingCancel = () => {
    window.removeEventListener("mousemove", onPendingMove);
    window.removeEventListener("mouseup", onPendingCancel);
  };

  window.addEventListener("mousemove", onPendingMove);
  window.addEventListener("mouseup", onPendingCancel);
}
