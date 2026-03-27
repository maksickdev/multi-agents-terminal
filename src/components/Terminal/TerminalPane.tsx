import { useEffect, useRef } from "react";
import * as ptyManager from "../../lib/ptyManager";
import { useAgentInput } from "../../hooks/usePty";
import { resizeAgent } from "../../lib/tauri";

interface Props {
  agentId: string;
  isVisible: boolean;
}

export function TerminalPane({ agentId, isVisible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sendInput = useAgentInput(agentId);
  const inputListenerRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Attach xterm to DOM
    ptyManager.attach(agentId, containerRef.current);

    // Delay input registration to skip xterm.js init sequences (device
    // attribute queries that fire immediately after terminal.open())
    const inputTimer = setTimeout(() => {
      inputListenerRef.current = ptyManager.onData(agentId, (data) => {
        sendInput(data);
      });
    }, 150);

    // Fit after DOM layout is complete and sync PTY size
    const raf = requestAnimationFrame(() => {
      ptyManager.fit(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) {
        resizeAgent(agentId, dims.rows, dims.cols).catch(() => {});
      }
    });

    return () => {
      clearTimeout(inputTimer);
      cancelAnimationFrame(raf);
      inputListenerRef.current?.dispose();
      inputListenerRef.current = null;
    };
  }, [agentId]);

  // Fit when becoming visible (tab switch)
  useEffect(() => {
    if (!isVisible) return;

    requestAnimationFrame(() => {
      ptyManager.fit(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) {
        resizeAgent(agentId, dims.rows, dims.cols).catch(() => {});
      }
    });
  }, [isVisible, agentId]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (!isVisible) return;
      ptyManager.fit(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) {
        resizeAgent(agentId, dims.rows, dims.cols).catch(() => {});
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [agentId, isVisible]);

  return (
    <div
      ref={containerRef}
      style={
        isVisible
          ? { width: "100%", height: "100%" }
          : {
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              width: "100%",
              height: "100%",
            }
      }
      className="p-1"
    />
  );
}
