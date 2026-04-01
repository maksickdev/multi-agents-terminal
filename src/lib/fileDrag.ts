/**
 * File drag-to-terminal via mouse events (HTML5 DnD is unreliable in WKWebView).
 *
 * Usage:
 *   - FileTreeNode calls startFileDrag(path) on mousedown
 *   - TerminalPane containers carry data-agent-id="<id>" attribute
 *   - On mouseup this module finds the terminal under cursor and writes the path
 */

import { writeToAgent } from "./tauri";

let draggingPath: string | null = null;
let ghost: HTMLDivElement | null = null;

function encodeInput(text: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(text))
      .map((b) => String.fromCharCode(b))
      .join("")
  );
}

function createGhost(path: string) {
  ghost = document.createElement("div");
  ghost.textContent = "📄 " + path.split("/").pop();
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

function onMouseMove(e: MouseEvent) {
  if (!ghost) return;
  ghost.style.left = e.clientX + 14 + "px";
  ghost.style.top  = e.clientY - 10 + "px";
}

function findAgentId(x: number, y: number): string | null {
  if (ghost) ghost.style.display = "none";
  const els = document.elementsFromPoint(x, y);
  if (ghost) ghost.style.display = "";
  for (const el of els) {
    const id = (el as HTMLElement).dataset?.agentId;
    if (id) return id;
  }
  return null;
}

function onMouseUp(e: MouseEvent) {
  const path = draggingPath;
  stop();
  if (!path) return;
  const agentId = findAgentId(e.clientX, e.clientY);
  if (!agentId) return;
  writeToAgent(agentId, encodeInput(path)).catch(console.error);
}

function clearSelection() {
  window.getSelection()?.removeAllRanges();
}

function stop() {
  draggingPath = null;
  removeGhost();
  clearSelection();
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}

export function startFileDrag(path: string) {
  stop(); // clear any previous drag
  clearSelection();
  draggingPath = path;
  createGhost(path);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}
