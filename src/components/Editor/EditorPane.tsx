import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useStore } from "../../store/useStore";
import { writeFileText, renamePath } from "../../lib/tauri";
import { useFileWatcher } from "../../hooks/useFileWatcher";
import { CodeEditor, type CodeEditorHandle, type EditorSearchState } from "./CodeEditor";
import { EditorTab } from "./EditorTab";
import { RenderedPreview } from "./RenderedPreview";
import { ConfirmModal } from "../shared/ConfirmModal";
import { Circle, Maximize2, Minimize2 } from "lucide-react";

const PREVIEWABLE = ["markdown"];

export function EditorPane() {
  useFileWatcher();

  const {
    openFiles, activeFilePath,
    editorPanelOpen, editorPanelWidth, setEditorPanelWidth,
    setActiveFile, closeFile,
    updateFileContent, markFileSaved,
    reorderOpenFiles, renameOpenFile,
    selectedProjectId,
  } = useStore();

  const projectFiles = openFiles.filter((f) => f.projectId === selectedProjectId);

  const activeFile =
    projectFiles.find((f) => f.path === activeFilePath) ??
    projectFiles[0] ??
    null;

  const isPreviewable = activeFile ? PREVIEWABLE.includes(activeFile.language) : false;

  // ── Left-edge resize handle (drag left = wider, drag right = narrower) ────
  const panelRef    = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startXRef   = useRef(0);
  const startWRef   = useRef(0);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = editorPanelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setEditorPanelWidth(startWRef.current + (startXRef.current - ev.clientX));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Tab drag-to-reorder ───────────────────────────────────────────────────
  const draggingRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const movedRef    = useRef(false);

  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"raw" | "rendered">("raw");
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const editorRefs = useRef<Map<string, CodeEditorHandle>>(new Map());
  const sharedSearch = useRef<EditorSearchState | null>(null);
  const prevActivePath = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevActivePath.current;
    const curr = activeFile?.path ?? null;
    prevActivePath.current = curr;
    if (prev === curr) return;
    if (prev) {
      const prevEditor = editorRefs.current.get(prev);
      if (prevEditor) sharedSearch.current = prevEditor.captureSearch();
    }
    if (curr && sharedSearch.current) {
      const nextEditor = editorRefs.current.get(curr);
      if (nextEditor) nextEditor.applySearch(sharedSearch.current);
    }
  }, [activeFile?.path]);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

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

  const handleRename = async (oldPath: string, newName: string) => {
    const lastSlash = oldPath.lastIndexOf("/");
    const newPath = `${oldPath.slice(0, lastSlash)}/${newName}`;
    try {
      await renamePath(oldPath, newPath);
      renameOpenFile(oldPath, newPath);
    } catch (e) {
      console.error("rename failed", e);
    }
  };

  const tabBar = (
    <div className="flex h-8 bg-[var(--c-bg)] border-b border-[var(--c-border)] flex-shrink-0">
      {activeFile && (
        <button
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          className="flex items-center justify-center w-8 flex-shrink-0 border-r border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)] transition-colors"
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      )}
      <div className="flex flex-1 overflow-x-auto scrollbar-none">
        {projectFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={file.path === activeFile?.path}
            isDragging={file.path === draggingPath}
            isDragOver={file.path === dragOverPath}
            onSelect={() => setActiveFile(file.path)}
            onClose={() => handleClose(file.path)}
            onRename={(newName) => handleRename(file.path, newName)}
            onMouseDown={() => startDrag(file.path)}
            onMouseEnter={() => enterTab(file.path)}
            suppressClick={() => movedRef.current}
          />
        ))}
      </div>
    </div>
  );

  const editorArea = (
    <div className="flex-1 overflow-hidden relative">
      {projectFiles.map((file) => {
        const isActive = file.path === activeFile?.path;
        const isFilePreviewable = PREVIEWABLE.includes(file.language);
        return (
          <div
            key={file.path}
            style={{
              position: "absolute",
              inset: 0,
              visibility: isActive ? "visible" : "hidden",
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            {isFilePreviewable && previewMode === "rendered"
              ? <RenderedPreview content={file.content} language={file.language} />
              : <CodeEditor
                  ref={(handle) => {
                    if (handle) editorRefs.current.set(file.path, handle);
                    else editorRefs.current.delete(file.path);
                  }}
                  content={file.content}
                  language={file.language}
                  onChange={(content) => updateFileContent(file.path, content)}
                  onSave={async () => {
                    try {
                      await writeFileText(file.path, file.content);
                      markFileSaved(file.path);
                    } catch (e) {
                      console.error("save failed", e);
                    }
                  }}
                />
            }
          </div>
        );
      })}
    </div>
  );

  const statusBar = activeFile && (
    <div className="flex items-center justify-between px-3 h-6 bg-[var(--c-bg)] border-t border-[var(--c-border)] flex-shrink-0">
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
      </div>
    </div>
  );

  // Fullscreen via portal — rendered outside normal flow
  if (fullscreen && editorPanelOpen) {
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
        {ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              top: 32,
              zIndex: 50,
              overflow: "hidden",
              marginLeft: 8,
              marginRight: 8,
              marginBottom: 8,
              borderRadius: 10,
              border: "1px solid var(--c-border)",
            }}
            className="flex flex-col bg-[var(--c-bg)]"
          >
            {tabBar}
            {editorArea}
            {statusBar}
          </div>,
          document.body
        )}
      </>
    );
  }


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
        ref={panelRef}
        style={{
          width: editorPanelOpen ? editorPanelWidth : 0,
          flexShrink: 0,
          overflow: "hidden",
          position: "relative",
          ...(editorPanelOpen ? {
            borderRadius: 10,
            border: "1px solid var(--c-border)",
            marginTop: 4,
            marginBottom: 4,
            marginRight: 4,
          } : {}),
        }}
        className="flex flex-col bg-[var(--c-bg)]"
      >
        {/* Left-edge resize handle */}
        <div
          onMouseDown={editorPanelOpen ? onHandleMouseDown : undefined}
          className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize hover:bg-[var(--c-accent)]/20 transition-colors z-10"
        />
        {tabBar}
        {editorArea}
        {statusBar}
      </div>
    </>
  );
}
