import { useEffect, useRef, useState } from "react";
import { getConfigDir, readFileText } from "../lib/tauri";
import type { HookEvent } from "../store/useStore";

export type { HookEvent };

const POLL_INTERVAL_MS = 2000;

export function useHookEvents(onEvent?: (event: HookEvent) => void) {
  const [events, setEvents] = useState<HookEvent[]>([]);
  const lastLineCountRef = useRef(0);
  const eventsFilePathRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // On mount: resolve file path and skip all lines already in the file
  // so we only process events that arrive while the app is running.
  useEffect(() => {
    getConfigDir().then(async (dir) => {
      const filePath = `${dir}/hook-events.jsonl`;
      eventsFilePathRef.current = filePath;
      try {
        const text = await readFileText(filePath);
        lastLineCountRef.current = text.trim().split("\n").filter(Boolean).length;
      } catch {
        lastLineCountRef.current = 0;
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      const filePath = eventsFilePathRef.current;
      if (!filePath) return;
      try {
        const text = await readFileText(filePath);
        const lines = text.trim().split("\n").filter(Boolean);
        if (lines.length <= lastLineCountRef.current) return;

        const newLines = lines.slice(lastLineCountRef.current);
        lastLineCountRef.current = lines.length;

        const newEvents: HookEvent[] = newLines.flatMap((line) => {
          try { return [JSON.parse(line) as HookEvent]; }
          catch { return []; }
        });

        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
          newEvents.forEach((e) => onEventRef.current?.(e));
        }
      } catch {
        // File doesn't exist yet — normal until first hook fires
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  return { events };
}
