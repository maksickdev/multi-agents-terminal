import { useEffect, useRef, useCallback } from "react";
import * as ptyManager from "../../lib/ptyManager";
import { useAgentInput } from "../../hooks/usePty";
import { resizeAgent } from "../../lib/tauri";
import { ChevronDown } from "lucide-react";

interface Props {
  agentId: string;
  isVisible: boolean;
}

export function TerminalPane({ agentId, isVisible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sendInput = useAgentInput(agentId);
  const inputListenerRef = useRef<{ dispose: () => void } | null>(null);
  const lastSentDimsRef = useRef<{ rows: number; cols: number }>({ rows: -1, cols: -1 });

  const sendResizeIfChanged = useCallback((rows: number, cols: number) => {
    const last = lastSentDimsRef.current;
    if (last.rows === rows && last.cols === cols) return;
    lastSentDimsRef.current = { rows, cols };
    resizeAgent(agentId, rows, cols).catch(() => {});
  }, [agentId]);

  // Custom scrollbar — direct DOM refs, no React state (avoids re-render lag)
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const thumbTopRef = useRef(0);
  const thumbHeightRef = useRef(100);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartThumbTopRef = useRef(0);
  const scrollBtnRef = useRef<HTMLButtonElement>(null);

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
    const scrollY = viewportY ?? buf.viewportY;
    const atBottom = totalLines <= visibleRows || scrollY >= totalLines - visibleRows;
    if (scrollBtnRef.current) {
      scrollBtnRef.current.style.display = atBottom ? "none" : "flex";
    }
    if (totalLines <= visibleRows) { applyThumb(100, 0); return; }
    const th = Math.max((visibleRows / totalLines) * 100, 5);
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
      if (dims) sendResizeIfChanged(dims.rows, dims.cols);
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
      // Rebuild the glyph atlas after a hidden→visible transition. While the
      // pane was hidden the renderer may have cached glyphs at stale metrics
      // (wrong DPR, pre-font-load measurement); without this the user sees
      // some text rendered at compressed width after switching projects.
      ptyManager.refreshRenderer(agentId);
      const dims = ptyManager.getDimensions(agentId);
      if (dims) sendResizeIfChanged(dims.rows, dims.cols);
      updateScrollbar(agentId);
    });
  }, [isVisible, agentId, sendResizeIfChanged]);

  useEffect(() => {
    if (!containerRef.current) return;
    let rafId: number | null = null;
    let sigwinchTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      // Always fit xterm so the internal buffer stays correct even when hidden.
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        ptyManager.fit(agentId);
        if (isVisible) updateScrollbar(agentId);
      });
      // Send SIGWINCH to the PTY even when hidden — this keeps the PTY size in
      // sync with the real container so that switching projects does not trigger
      // an unexpected SIGWINCH (and TUI redraw/duplication) at switch time.
      // Debounced to 150 ms so resize-dragging doesn't fire per frame.
      if (sigwinchTimer !== null) clearTimeout(sigwinchTimer);
      sigwinchTimer = setTimeout(() => {
        sigwinchTimer = null;
        const dims = ptyManager.getDimensions(agentId);
        if (dims) sendResizeIfChanged(dims.rows, dims.cols);
      }, 150);
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (sigwinchTimer !== null) clearTimeout(sigwinchTimer);
    };
  }, [agentId, isVisible, sendResizeIfChanged]);

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

  const handleScrollToBottom = useCallback(() => {
    const terminal = ptyManager.getTerminal(agentId);
    if (!terminal) return;
    terminal.scrollToBottom();
  }, [agentId]);

  return (
    <div
      style={
        isVisible
          ? { width: "100%", height: "100%", overflow: "hidden", display: "flex", position: "relative" }
          : { position: "absolute", visibility: "hidden", pointerEvents: "none", width: "100%", height: "100%", overflow: "hidden", display: "flex" }
      }
    >
      <div style={{ flex: 1, overflow: "hidden", paddingLeft: 8, paddingTop: 4, paddingBottom: 4 }}>
        <div
          ref={containerRef}
          data-agent-id={agentId}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Scroll to bottom button */}
      <button
        ref={scrollBtnRef}
        onClick={handleScrollToBottom}
        style={{
          display: "none",
          position: "absolute",
          bottom: 24,
          right: 18,
          width: 28,
          height: 28,
          alignItems: "center",
          justifyContent: "center",
          background: "var(--c-surface-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 6,
          cursor: "pointer",
          color: "var(--c-text-dim)",
          zIndex: 10,
          opacity: 0.85,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--c-text)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.color = "var(--c-text-dim)"; }}
        title="Scroll to bottom"
      >
        <ChevronDown size={16} />
      </button>

      {/* Custom scrollbar track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{ width: 6, flexShrink: 0, background: "none", position: "relative", right: 3, cursor: "pointer" }}
      >
        <div
          ref={thumbRef}
          onMouseDown={handleThumbMouseDown}
          style={{
            display: "none",
            position: "absolute",
            left: 0,
            right: 0,
            width: 6,
            top: "0%",
            height: "100%",
            background: "var(--c-muted)",
            borderRadius: 3,
            cursor: "grab",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-text-dim)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--c-muted)")}
        />
      </div>
    </div>
  );
}
