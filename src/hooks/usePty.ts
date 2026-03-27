import { useEffect } from "react";
import { onAgentExited, onAgentStatus, onPtyOutput, writeToAgent } from "../lib/tauri";
import * as ptyManager from "../lib/ptyManager";
import { useStore } from "../store/useStore";

export function usePtyEvents() {
  const { updateAgentStatus } = useStore();

  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const register = (promise: Promise<() => void>) => {
      promise.then((fn) => {
        if (cancelled) fn(); // already unmounted — unlisten immediately
        else unlisteners.push(fn);
      });
    };

    const firstOutput = new Set<string>();

    register(onPtyOutput((payload) => {
      if (!firstOutput.has(payload.agent_id)) {
        firstOutput.add(payload.agent_id);
        ptyManager.clearTerminal(payload.agent_id);
      }
      const bytes = Uint8Array.from(atob(payload.data), (c) =>
        c.charCodeAt(0)
      );
      ptyManager.write(payload.agent_id, bytes);
    }));

    register(onAgentStatus((payload) => {
      updateAgentStatus(payload.agent_id, payload.status);
    }));

    register(onAgentExited((payload) => {
      updateAgentStatus(payload.agent_id, "exited", payload.exit_code ?? undefined);
    }));

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}

export function useAgentInput(agentId: string) {
  const sendInput = (data: string) => {
    const encoded = btoa(
      Array.from(new TextEncoder().encode(data))
        .map((b) => String.fromCharCode(b))
        .join("")
    );
    writeToAgent(agentId, encoded).catch(console.error);
  };
  return sendInput;
}
