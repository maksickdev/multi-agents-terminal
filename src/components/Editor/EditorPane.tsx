import { useCallback, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { writeFileText } from "../../lib/tauri";
import { CodeEditor } from "./CodeEditor";
import { EditorTab } from "./EditorTab";
import { RenderedPreview } from "./RenderedPreview";
import { ConfirmModal } from "../shared/ConfirmModal";
import { Circle } from "lucide-react";

const PREVIEWABLE = ["markdown"];

export function EditorPane() {
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
      style={{
        height: isVisible ? editorPaneHeight : 0,
        flexShrink: 0,
        overflow: "hidden",
      }}
      className="relative flex flex-col bg-[#1a1b26]"
    >
      {/* Top resize handle */}
      <div
        onMouseDown={isVisible ? onHandleMouseDown : undefined}
        className="absolute top-0 left-0 right-0 h-[6px] border-t border-[#1f2335] cursor-ns-resize hover:bg-[#7aa2f7]/20 transition-colors z-10 flex flex-col justify-center"
      />

      {/* Tab bar */}
      <div className="flex h-8 bg-[#16161e] border-b border-[#1f2335] overflow-x-auto flex-shrink-0 scrollbar-none">
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
        <div className="flex items-center justify-between px-3 h-6 bg-[#16161e] border-t border-[#1f2335] flex-shrink-0">
          <span className="text-[10px] text-[#414868] truncate">{activeFile.path}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {isPreviewable && (
              <div className="flex items-center rounded overflow-hidden border border-[#2a2b3d]">
                {(["raw", "rendered"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`px-2 h-4 text-[9px] leading-none uppercase tracking-wide transition-colors ${
                      previewMode === mode
                        ? "bg-[#7aa2f7] text-[#1a1b26]"
                        : "text-[#414868] hover:text-[#a9b1d6]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[10px] text-[#414868]">
              {activeFile.language || "plain text"}
              {activeFile.isDirty && <span className="ml-2 flex items-center gap-1 text-[#e0af68]"><Circle size={6} className="fill-[#e0af68]" /> unsaved</span>}
            </span>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
