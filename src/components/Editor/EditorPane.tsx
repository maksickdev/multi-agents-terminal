import { useCallback, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { writeFileText } from "../../lib/tauri";
import { useFileWatcher } from "../../hooks/useFileWatcher";
import { CodeEditor } from "./CodeEditor";
import { EditorTab } from "./EditorTab";
import { RenderedPreview } from "./RenderedPreview";
import { ConfirmModal } from "../shared/ConfirmModal";
import { FullscreenFileModal } from "./FullscreenFileModal";
import { Circle, Maximize2 } from "lucide-react";

const PREVIEWABLE = ["markdown"];

export function EditorPane() {
  useFileWatcher();

  const {
    openFiles, activeFilePath,
    editorPaneHeight, setEditorPaneHeight,
    setActiveFile, closeFile,
    updateFileContent, markFileSaved,
    reorderOpenFiles,
    selectedProjectId,
  } = useStore();

  // Only show files belonging to the currently selected project
  const projectFiles = openFiles.filter((f) => f.projectId === selectedProjectId);

  const activeFile =
    projectFiles.find((f) => f.path === activeFilePath) ??
    projectFiles[0] ??
    null;

  const isVisible = projectFiles.length > 0;
  const isPreviewable = activeFile ? PREVIEWABLE.includes(activeFile.language) : false;

  // ── Resize handle (bottom edge — grows downward into terminal area) ───────
  const panelRef    = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startYRef   = useRef(0);
  const startHRef   = useRef(0);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = editorPaneHeight;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setEditorPaneHeight(startHRef.current + (startYRef.current - ev.clientY));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Tab drag-to-reorder (same mouse-event pattern as agent TabBar) ────────
  const draggingRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const movedRef    = useRef(false);

  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"raw" | "rendered">("raw");
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const doReorder = useCallback((fromPath: string, toPath: string) => {
    const paths = projectFiles.map((f) => f.path);
    const from = paths.indexOf(fromPath);
    const to   = paths.indexOf(toPath);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...paths];
    next.splice(from, 1);
    next.splice(to, 0, fromPath);
    reorderOpenFiles(next);
  }, [projectFiles, reorderOpenFiles]);

  const startDrag = useCallback((path: string) => {
    draggingRef.current = path;
    dragOverRef.current = null;
    movedRef.current    = false;
    setDraggingPath(path);
    setDragOverPath(null);

    const onMouseUp = () => {
      const from = draggingRef.current;
      const to   = dragOverRef.current;
      if (from && to && from !== to) doReorder(from, to);

      draggingRef.current = null;
      dragOverRef.current = null;
      movedRef.current    = false;
      setDraggingPath(null);
      setDragOverPath(null);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mouseup", onMouseUp);
  }, [doReorder]);

  const enterTab = useCallback((path: string) => {
    if (!draggingRef.current || draggingRef.current === path) return;
    movedRef.current    = true;
    dragOverRef.current = path;
    setDragOverPath(path);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeFile) return;
    try {
      await writeFileText(activeFile.path, activeFile.content);
      markFileSaved(activeFile.path);
    } catch (e) {
      console.error("save failed", e);
    }
  };

  const handleClose = (path: string) => {
    const file = openFiles.find((f) => f.path === path);
    if (file?.isDirty) {
      setPendingClosePath(path);
      return;
    }
    closeFile(path);
  };

  const confirmClose = () => {
    if (pendingClosePath) closeFile(pendingClosePath);
    setPendingClosePath(null);
  };

  return (
    <>
    {fullscreen && activeFile && (
      <FullscreenFileModal
        file={activeFile}
        initialPreviewMode={isPreviewable ? previewMode : "raw"}
        onChange={(content) => updateFileContent(activeFile.path, content)}
        onSave={handleSave}
        onClose={() => setFullscreen(false)}
      />
    )}
    {pendingClosePath && (
      <ConfirmModal
        title="Unsaved changes"
        message={`"${pendingClosePath.split("/").pop()}" has unsaved changes. Close anyway?`}
        confirmLabel="Close"
        danger
        onConfirm={confirmClose}
        onCancel={() => setPendingClosePath(null)}
      />
    )}
    <div
      ref={panelRef}
      style={{
        height: isVisible ? editorPaneHeight : 0,
        flexShrink: 0,
        overflow: "hidden",
      }}
      className="relative flex flex-col bg-[var(--c-bg-deep)]"
    >
      {/* Top resize handle */}
      <div
        onMouseDown={isVisible ? onHandleMouseDown : undefined}
        className="absolute top-0 left-0 right-0 h-[6px] border-t border-[var(--c-border)] cursor-ns-resize hover:bg-[var(--c-accent)]/20 transition-colors z-10 flex flex-col justify-center"
      />

      {/* Tab bar */}
      <div className="flex h-8 bg-[var(--c-bg-deep)] border-b border-[var(--c-border)] overflow-x-auto flex-shrink-0 scrollbar-none">
        {projectFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={file.path === activeFile?.path}
            isDragging={file.path === draggingPath}
            isDragOver={file.path === dragOverPath}
            onSelect={() => setActiveFile(file.path)}
            onClose={() => handleClose(file.path)}
            onMouseDown={() => startDrag(file.path)}
            onMouseEnter={() => enterTab(file.path)}
            onDoubleClick={() => { setActiveFile(file.path); setFullscreen(true); }}
            suppressClick={() => movedRef.current}
          />
        ))}
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden">
        {activeFile && (
          isPreviewable && previewMode === "rendered"
            ? <RenderedPreview content={activeFile.content} language={activeFile.language} />
            : <CodeEditor
                key={activeFile.path}
                content={activeFile.content}
                language={activeFile.language}
                onChange={(content) => updateFileContent(activeFile.path, content)}
                onSave={handleSave}
              />
        )}
      </div>

      {/* Status bar — bottom */}
      {activeFile && (
        <div className="flex items-center justify-between px-3 h-6 bg-[var(--c-bg-deep)] border-t border-[var(--c-border)] flex-shrink-0">
          <span className="text-[10px] text-[var(--c-muted)] truncate">{activeFile.path}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {isPreviewable && (
              <div className="flex items-center rounded overflow-hidden border border-[var(--c-bg-selected)]">
                {(["raw", "rendered"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`px-2 h-4 text-[9px] leading-none uppercase tracking-wide transition-colors ${
                      previewMode === mode
                        ? "bg-[var(--c-accent)] text-[var(--c-bg)]"
                        : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[10px] text-[var(--c-muted)]">
              {activeFile.language || "plain text"}
              {activeFile.isDirty && (
                <span className="ml-2 inline-flex items-center gap-1 text-[var(--c-accent-yellow)]">
                  <Circle size={6} className="fill-[var(--c-accent-yellow)]" /> unsaved
                </span>
              )}
            </span>
            <button
              onClick={() => setFullscreen(true)}
              title="Fullscreen (double-click tab)"
              className="flex items-center text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors"
            >
              <Maximize2 size={11} />
            </button>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
