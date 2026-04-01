import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { createFile, createDirAll, renamePath } from "../../lib/tauri";
import { FileTree } from "./FileTree";
import { MoveConfirmModal } from "./MoveConfirmModal";
import { setOnFolderDrop } from "../../lib/fileDrag";

export function FileExplorer() {
  const {
    projects, selectedProjectId,
    fileExplorerOpen, fileExplorerWidth,
    setFileExplorerOpen, setFileExplorerWidth,
  } = useStore();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  // ── Resize ───────────────────────────────────────────────────────────────
  const resizingRef = useRef(false);
  const startXRef   = useRef(0);
  const startWRef   = useRef(0);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = fileExplorerWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setFileExplorerWidth(startWRef.current + (ev.clientX - startXRef.current));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Keyboard shortcut: Cmd+E ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        setFileExplorerOpen(!fileExplorerOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fileExplorerOpen, setFileExplorerOpen]);

  // ── Root-level file/folder creation ──────────────────────────────────────
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [newName, setNewName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // ── File move (drag-to-folder) ────────────────────────────────────────────
  const [pendingMove, setPendingMove] = useState<{ src: string; dst: string } | null>(null);

  useEffect(() => {
    setOnFolderDrop((src, dst) => setPendingMove({ src, dst }));
  }, []);

  const confirmMove = async () => {
    if (!pendingMove) return;
    const { src, dst } = pendingMove;
    setPendingMove(null);
    const name = src.split("/").pop()!;
    try {
      await renamePath(src, `${dst}/${name}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error("move failed", e);
    }
  };

  const startCreating = (type: "file" | "dir") => {
    setNewName("");
    setCreating(type);
  };

  const commitCreate = async () => {
    if (!selectedProject || !newName.trim()) { setCreating(null); return; }
    const newPath = `${selectedProject.path}/${newName.trim()}`;
    try {
      if (creating === "dir") {
        await createDirAll(newPath);
      } else {
        await createFile(newPath);
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error("create failed", e);
    } finally {
      setCreating(null);
      setNewName("");
    }
  };

  const handleNewKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitCreate();
    if (e.key === "Escape") { setCreating(null); setNewName(""); }
  };

  return (
    <>
    {pendingMove && (
      <MoveConfirmModal
        sourcePath={pendingMove.src}
        targetFolder={pendingMove.dst}
        onConfirm={confirmMove}
        onCancel={() => setPendingMove(null)}
      />
    )}
    <div
      style={{
        width: fileExplorerOpen ? fileExplorerWidth : 0,
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
      className="flex flex-col bg-[#16161e] border-r border-[#1f2335]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 h-7 bg-[#16161e] border-b border-[#1f2335] flex-shrink-0 select-none">
        <span className="text-xs font-semibold text-[#565f89] uppercase tracking-widest truncate">
          {selectedProject ? selectedProject.name : "Explorer"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => startCreating("file")}
            title="New File"
            disabled={!selectedProject}
            className="p-0.5 text-[#565f89] hover:text-[#c0caf5] disabled:opacity-30 rounded text-sm leading-none"
          >
            +
          </button>
          <button
            onClick={() => startCreating("dir")}
            title="New Folder"
            disabled={!selectedProject}
            className="p-0.5 text-[#565f89] hover:text-[#c0caf5] disabled:opacity-30 rounded text-xs leading-none"
          >
            📁
          </button>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh"
            className="p-0.5 text-[#565f89] hover:text-[#c0caf5] rounded text-xs leading-none"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Tree content — data-folder-path on the root container so dragging
          into empty space targets the project root folder */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden py-1"
        data-folder-path={selectedProject?.path}
      >
        {selectedProject ? (
          <>
            {/* Inline creation input at root level */}
            {creating && (
              <div className="flex items-center gap-1 py-0.5 px-2 text-xs">
                <span>{creating === "dir" ? "📁" : "📄"}</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleNewKey}
                  onBlur={commitCreate}
                  autoFocus
                  placeholder={creating === "dir" ? "folder name" : "file name"}
                  className="flex-1 bg-[#292e42] text-[#c0caf5] text-xs px-1 rounded outline-none"
                />
              </div>
            )}

            <FileTree
              key={`${selectedProject.id}-${refreshKey}`}
              project={selectedProject}
              onRefreshRoot={() => setRefreshKey((k) => k + 1)}
            />
          </>
        ) : (
          <div className="text-[#414868] text-xs px-3 py-2 italic">
            Select a project
          </div>
        )}
      </div>

      {/* Right-side resize handle */}
      <div
        onMouseDown={fileExplorerOpen ? onHandleMouseDown : undefined}
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize hover:bg-[#7aa2f7]/20 transition-colors flex items-center justify-center"
      />
    </div>
    </>
  );
}
