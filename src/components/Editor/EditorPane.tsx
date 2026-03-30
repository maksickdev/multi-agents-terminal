import { useRef } from "react";
import { useStore } from "../../store/useStore";
import { writeFileText } from "../../lib/tauri";
import { CodeEditor } from "./CodeEditor";
import { EditorTab } from "./EditorTab";

export function EditorPane() {
  const {
    openFiles, activeFilePath,
    editorPaneHeight, setEditorPaneHeight,
    setActiveFile, closeFile,
    updateFileContent, markFileSaved,
  } = useStore();

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? openFiles[0] ?? null;
  const isVisible = openFiles.length > 0;

  // ── Resize handle ─────────────────────────────────────────────────────────
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
      setEditorPaneHeight(startHRef.current + (ev.clientY - startYRef.current));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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
      const confirmed = window.confirm(`"${path.split("/").pop()}" has unsaved changes. Close anyway?`);
      if (!confirmed) return;
    }
    closeFile(path);
  };

  return (
    <div
      style={{
        height: isVisible ? editorPaneHeight : 0,
        flexShrink: 0,
        overflow: "hidden",
      }}
      className="flex flex-col bg-[#1a1b26] border-b border-[#1f2335]"
    >
      {/* Top resize handle */}
      <div
        onMouseDown={isVisible ? onHandleMouseDown : undefined}
        className="h-1 cursor-ns-resize bg-[#1f2335] hover:bg-[#7aa2f7] transition-colors flex-shrink-0"
      />

      {/* Tab bar */}
      <div className="flex h-7 bg-[#16161e] border-b border-[#1f2335] overflow-x-auto flex-shrink-0 scrollbar-none">
        {openFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={file.path === activeFile?.path}
            onSelect={() => setActiveFile(file.path)}
            onClose={() => handleClose(file.path)}
          />
        ))}
      </div>

      {/* Status bar */}
      {activeFile && (
        <div className="flex items-center justify-between px-3 h-5 bg-[#16161e] border-b border-[#1f2335] flex-shrink-0">
          <span className="text-[10px] text-[#414868] truncate">{activeFile.path}</span>
          <span className="text-[10px] text-[#414868] flex-shrink-0 ml-2">
            {activeFile.language || "plain text"}
            {activeFile.isDirty && <span className="ml-2 text-[#e0af68]">● unsaved</span>}
          </span>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeFile && (
          <CodeEditor
            key={activeFile.path}
            content={activeFile.content}
            language={activeFile.language}
            onChange={(content) => updateFileContent(activeFile.path, content)}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
