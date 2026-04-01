import { useEffect, useRef, useCallback } from "react";
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

  // Custom scrollbar — direct DOM refs, no React state (avoids re-render lag)
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const thumbTopRef = useRef(0);
  const thumbHeightRef = useRef(100);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartThumbTopRef = useRef(0);

  const applyThumb = useCallback((th: number, tp: number) => {
    thumbHeightRef.current = th;
    thumbTopRef.current = tp;
    const thumb = thumbRef.current;
    const track = trackRef.current;
    if (!thumb || !track) return;
    if (th >= 100) {
      thumb.style.display = "none";
      track.style.cursor = "default";
    } else {
      thumb.style.display = "block";
      thumb.style.top = `${tp}%`;
      thumb.style.height = `${th}%`;
      track.style.cursor = "pointer";
    }
  }, []);

  const updateScrollbar = useCallback((agentId: string, viewportY?: number) => {
    const terminal = ptyManager.getTerminal(agentId);
    if (!terminal) return;
    const buf = terminal.buffer.active;
    const totalLines = buf.length;
    const visibleRows = terminal.rows;
    if (totalLines <= visibleRows) { applyThumb(100, 0); return; }
    const th = Math.max((visibleRows / totalLines) * 100, 5);
    const scrollY = viewportY ?? buf.viewportY;
    const tp = Math.max(0, Math.min(100 - th, (scrollY / (totalLines - visibleRows)) * (100 - th)));
    applyThumb(th, tp);
  }, [applyThumb]);

  useEffect(() => {
    if (!containerRef.current) return;

    ptyManager.attach(agentId, containerRef.current);

    const inputTimer = setTimeout(() => {
      inputListenerRef.current = ptyManager.onData(agentId, (data) => sendInput(data));
    }, 150);

    const raf = requestAnimationFrame(() => {
      ptyManager.fit(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) resizeAgent(agentId, dims.rows, dims.cols).catch(() => {});
      updateScrollbar(agentId);
    });

    const terminal = ptyManager.getTerminal(agentId);
    const scrollDisposable = terminal?.onScroll((viewportY) => updateScrollbar(agentId, viewportY));

    // Fallback: wheel event fires before xterm updates buffer, so we wait one frame
    const el = containerRef.current;
    const onWheel = () => requestAnimationFrame(() => updateScrollbar(agentId));
    el?.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      clearTimeout(inputTimer);
      cancelAnimationFrame(raf);
      inputListenerRef.current?.dispose();
      inputListenerRef.current = null;
      scrollDisposable?.dispose();
      el?.removeEventListener("wheel", onWheel);
    };
  }, [agentId]);

  useEffect(() => {
    if (!isVisible) return;
    requestAnimationFrame(() => {
      ptyManager.fit(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) resizeAgent(agentId, dims.rows, dims.cols).catch(() => {});
      updateScrollbar(agentId);
    });
  }, [isVisible, agentId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!isVisible) return;
      ptyManager.fit(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) resizeAgent(agentId, dims.rows, dims.cols).catch(() => {});
      updateScrollbar(agentId);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [agentId, isVisible]);

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartThumbTopRef.current = thumbTopRef.current;

    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !trackRef.current) return;
      const delta = ((e.clientY - dragStartYRef.current) / trackRef.current.clientHeight) * 100;
      const newTop = Math.max(0, Math.min(100 - thumbHeightRef.current, dragStartThumbTopRef.current + delta));
      const terminal = ptyManager.getTerminal(agentId);
      if (!terminal) return;
      const buf = terminal.buffer.active;
      terminal.scrollToLine(Math.round((newTop / (100 - thumbHeightRef.current)) * (buf.length - terminal.rows)));
    };
    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (e.target === thumbRef.current) return;
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const terminal = ptyManager.getTerminal(agentId);
    if (!terminal) return;
    const buf = terminal.buffer.active;
    terminal.scrollToLine(Math.round(((e.clientY - rect.top) / rect.height) * (buf.length - terminal.rows)));
  };

  return (
    <div
      style={
        isVisible
          ? { width: "100%", height: "100%", overflow: "hidden", display: "flex" }
          : { position: "absolute", visibility: "hidden", pointerEvents: "none", width: "100%", height: "100%", overflow: "hidden", display: "flex" }
      }
    >
      <div
        ref={containerRef}
        data-agent-id={agentId}
        style={{ flex: 1, overflow: "hidden" }}
        className="p-1"
      />

      {/* Custom scrollbar track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{ width: 8, flexShrink: 0, background: "#16161e", position: "relative", cursor: "default" }}
      >
        <div
          ref={thumbRef}
          onMouseDown={handleThumbMouseDown}
          style={{
            display: "none",
            position: "absolute",
            left: 2,
            right: 2,
            top: "0%",
            height: "100%",
            background: "#414868",
            borderRadius: 3,
            cursor: "grab",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#565f89")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#414868")}
        />
      </div>
    </div>
  );
}
