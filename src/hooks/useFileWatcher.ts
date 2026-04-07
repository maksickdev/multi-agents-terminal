import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { readFileText } from "../lib/tauri";

const POLL_INTERVAL_MS = 2000;

/**
 * Polls open files for external changes every POLL_INTERVAL_MS ms.
 * Silently reloads non-dirty files whose on-disk content differs from
 * the stored content. Dirty files (unsaved edits) are never overwritten.
 */
export function useFileWatcher() {
  const openFiles        = useStore((s) => s.openFiles);
  const reloadFileContent = useStore((s) => s.reloadFileContent);

  // Keep a stable ref so the interval closure always sees the latest values
  // without being recreated every render.
  const stateRef = useRef({ openFiles, reloadFileContent });
  useEffect(() => {
    stateRef.current = { openFiles, reloadFileContent };
  });

  useEffect(() => {
    const id = setInterval(async () => {
      const { openFiles: files, reloadFileContent: reload } = stateRef.current;

      // Only watch non-dirty files (dirty = user has unsaved edits)
      const candidates = files.filter((f) => !f.isDirty);
      if (candidates.length === 0) return;

      await Promise.all(
        candidates.map(async (file) => {
          try {
            const disk = await readFileText(file.path);
            if (disk !== file.content) {
              reload(file.path, disk);
            }
          } catch {
            // File deleted / unreadable — leave the tab as-is
          }
        })
      );
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []); // intentionally empty — state accessed via stateRef
}
