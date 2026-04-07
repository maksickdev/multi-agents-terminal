/**
 * Handles files dragged into the app window from the OS (e.g. Finder).
 *
 * Uses Tauri's onDragDropEvent (the only reliable source for external drags
 * in WKWebView — DOM dragover/dragenter events do not fire for OS-level drags).
 *
 * Coordinate note: on macOS/WKWebView, DragDropEvent.position is already in
 * logical (CSS) pixels relative to the window content area — no scale division
 * or window-offset subtraction is needed.
 */
import { useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useStore } from "../store/useStore";
import { writeToAgent, copyPath } from "../lib/tauri";
import * as externalDrop from "../lib/externalDrop";

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

function resolveTarget(x: number, y: number): DropTarget | null {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
  const els = document.elementsFromPoint(x, y);

  let folderResult: DropTarget | null = null;

  for (const el of els) {
    const h = el as HTMLElement;

    if (h.dataset.agentId) {
      return { type: "terminal", agentId: h.dataset.agentId, highlightEl: h };
    }

    if (folderResult === null) {
      if (h.dataset.folderPath !== undefined) {
        folderResult = { type: "folder", folderPath: h.dataset.folderPath, highlightEl: h };
      } else if (h.dataset.parentFolder !== undefined) {
        const parentEl = document.querySelector<HTMLElement>(
          `[data-folder-path="${CSS.escape(h.dataset.parentFolder)}"]`,
        );
        if (parentEl) {
          folderResult = { type: "folder", folderPath: h.dataset.parentFolder, highlightEl: parentEl };
        }
      }
    }
  }

  return folderResult;
}

export function useExternalFileDrop() {
  const bumpFileTree = useStore((s) => s.bumpFileTree);

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
          externalDrop.setActive(null);
          return;
        }

        if (type === "enter" || type === "over") {
          const { x, y } = event.payload.position;
          applyHighlight(resolveTarget(x, y));
          return;
        }

        if (type === "drop") {
          const { paths, position } = event.payload;
          const target = resolveTarget(position.x, position.y) ?? prevTargetRef.current;
          clearHighlight();
          externalDrop.setActive(null);

          if (!paths.length || !target) return;

          if (target.type === "terminal") {
            writeToAgent(target.agentId, encodeInput(paths.join(" "))).catch(console.error);
            return;
          }

          if (target.type === "folder") {
            const { folderPath } = target;
            Promise.all(
              paths.map(async (src) => {
                const name = src.split("/").pop()!;
                const dst  = `${folderPath}/${name}`;
                if (dst === src) return;
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
      .then((fn) => { unlisten = fn; });

    return () => {
      clearHighlight();
      unlisten?.();
    };
  }, [bumpFileTree]);
}
