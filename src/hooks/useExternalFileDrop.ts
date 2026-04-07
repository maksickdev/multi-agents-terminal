/**
 * Handles files dragged into the app window from the OS (e.g. Finder).
 *
 * Drop targets (identified by existing data-* attributes):
 *   data-agent-id   → terminal pane / shell pane
 *                     All dropped paths are joined with spaces and sent as
 *                     keyboard input so Claude / the shell can consume them.
 *
 *   data-folder-path / data-parent-folder → file explorer panel
 *                     Each dropped FILE is copied into the target folder.
 *                     Directories are skipped (copy not supported).
 *
 * Visual feedback:
 *   - Explorer folders get the existing "file-drag-folder-hover" CSS class.
 *   - Terminal panes get a temporary accent-colour outline.
 *
 * Coordinate system:
 *   Tauri's DragDropEvent uses PhysicalPosition (device pixels).
 *   elementsFromPoint() uses CSS/logical pixels, so we divide by
 *   window.devicePixelRatio before querying.
 */
import { useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useStore } from "../store/useStore";
import { writeToAgent, copyPath } from "../lib/tauri";

const FOLDER_HOVER_CLASS = "file-drag-folder-hover";

function encodeInput(text: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(text))
      .map((b) => String.fromCharCode(b))
      .join(""),
  );
}

type DropTarget =
  | { type: "terminal"; agentId: string; highlightEl: HTMLElement }
  | { type: "folder"; folderPath: string; highlightEl: HTMLElement };

/** Convert Tauri physical coordinates → CSS logical coordinates. */
function toCss(physX: number, physY: number): [number, number] {
  const dpr = window.devicePixelRatio || 1;
  return [physX / dpr, physY / dpr];
}

/** Walk elementsFromPoint to find the best drop target. */
function resolveTarget(physX: number, physY: number): DropTarget | null {
  const [x, y] = toCss(physX, physY);
  const els = document.elementsFromPoint(x, y);

  let folderResult: DropTarget | null = null;

  for (const el of els) {
    const h = el as HTMLElement;

    // Terminal pane takes priority over folders
    if (h.dataset.agentId) {
      return { type: "terminal", agentId: h.dataset.agentId, highlightEl: h };
    }

    // Capture the first folder element found; resolve file rows to their parent
    if (folderResult === null) {
      if (h.dataset.folderPath !== undefined) {
        folderResult = { type: "folder", folderPath: h.dataset.folderPath, highlightEl: h };
      } else if (h.dataset.parentFolder !== undefined) {
        const parentEl = document.querySelector<HTMLElement>(
          `[data-folder-path="${CSS.escape(h.dataset.parentFolder)}"]`,
        );
        if (parentEl) {
          folderResult = {
            type: "folder",
            folderPath: h.dataset.parentFolder,
            highlightEl: parentEl,
          };
        }
      }
    }
  }

  return folderResult;
}

export function useExternalFileDrop() {
  const bumpFileTree = useStore((s) => s.bumpFileTree);

  // Stable ref keeps the highlight-clear logic out of the effect deps
  const prevTargetRef = useRef<DropTarget | null>(null);

  const clearHighlight = () => {
    const prev = prevTargetRef.current;
    if (!prev) return;
    if (prev.type === "folder") {
      prev.highlightEl.classList.remove(FOLDER_HOVER_CLASS);
    } else {
      prev.highlightEl.style.outline = "";
    }
    prevTargetRef.current = null;
  };

  const applyHighlight = (target: DropTarget | null) => {
    clearHighlight();
    if (!target) return;
    if (target.type === "folder") {
      target.highlightEl.classList.add(FOLDER_HOVER_CLASS);
    } else {
      // Subtle accent outline on the terminal container
      target.highlightEl.style.outline = "2px solid var(--c-accent)";
      target.highlightEl.style.outlineOffset = "-2px";
    }
    prevTargetRef.current = target;
  };

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const { type } = event.payload;

        if (type === "leave") {
          clearHighlight();
          return;
        }

        if (type === "enter" || type === "over") {
          const { position } = event.payload;
          applyHighlight(resolveTarget(position.x, position.y));
          return;
        }

        if (type === "drop") {
          clearHighlight();
          const { paths, position } = event.payload;
          if (!paths.length) return;

          const target = resolveTarget(position.x, position.y);

          // ── Terminal: paste space-separated paths as keyboard input ───────
          if (target?.type === "terminal") {
            writeToAgent(target.agentId, encodeInput(paths.join(" "))).catch(
              console.error,
            );
            return;
          }

          // ── File Explorer folder: copy each file (not dir) into the folder ─
          if (target?.type === "folder") {
            const { folderPath } = target;
            Promise.all(
              paths.map(async (src) => {
                const name = src.split("/").pop()!;
                const dst = `${folderPath}/${name}`;
                if (dst === src) return; // already in this folder — no-op
                try {
                  await copyPath(src, dst);
                } catch (e) {
                  console.warn("[external-drop] copy failed:", src, "→", dst, e);
                }
              }),
            ).then(() => bumpFileTree());
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      clearHighlight();
      unlisten?.();
    };
  }, [bumpFileTree]);
}
