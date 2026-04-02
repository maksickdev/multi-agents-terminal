import { useState, useRef } from "react";
import { useStore } from "../../store/useStore";
import { readFileText, deletePath, renamePath, revealInFinder } from "../../lib/tauri";
import type { FileEntry } from "../../lib/tauri";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { detectLanguage } from "../../lib/languageDetect";
import { startFileDrag } from "../../lib/fileDrag";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Copy, Trash2, ScanSearch } from "lucide-react";
import { FileIcon } from "../../lib/fileIcons";

interface Props {
  entry: FileEntry;
  depth: number;
  projectId: string;
  onRefresh: () => void;
  /** Only provided when this dir node is expanded; renders sub-FileTree. */
  renderChildren?: (rootPath: string, depth: number) => React.ReactNode;
}

interface ContextState { x: number; y: number }

export function FileTreeNode({ entry, depth, projectId, onRefresh, renderChildren }: Props) {
  const { toggleExpandedDir, openFile } = useStore();

  const [contextMenu, setContextMenu] = useState<ContextState | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const indent = depth * 12;

  // ── Rename ───────────────────────────────────────────────────────────────
  const startRename = () => {
    setRenameValue(entry.name);
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    setRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === entry.name) return;
    const lastSlash = entry.path.lastIndexOf("/");
    const parent = entry.path.slice(0, lastSlash);
    const newPath = `${parent}/${trimmed}`;
    try {
      await renamePath(entry.path, newPath);
      onRefresh();
    } catch (e) {
      console.error("rename failed", e);
    }
  };

  const handleRenameKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenaming(false);
  };

  // ── Click ────────────────────────────────────────────────────────────────
  const handleClick = async () => {
    if (entry.is_dir) {
      toggleExpandedDir(projectId, entry.path);
      return;
    }
    try {
      const content = await readFileText(entry.path);
      openFile({
        path: entry.path,
        projectId,
        content,
        isDirty: false,
        language: detectLanguage(entry.name),
      });
    } catch (e) {
      console.error("open file failed", e);
    }
  };

  // ── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextItems: ContextMenuItem[] = [
    {
      label: "Rename",
      icon: Pencil,
      onClick: startRename,
    },
    {
      label: "Reveal in Finder",
      icon: ScanSearch,
      onClick: () => revealInFinder(entry.path),
    },
    {
      label: "Copy Path",
      icon: Copy,
      onClick: () => navigator.clipboard.writeText(entry.path),
    },
    {
      label: entry.is_dir ? "Delete Folder" : "Delete File",
      icon: Trash2,
      danger: true,
      onClick: async () => {
        const confirmed = window.confirm(
          `Delete "${entry.name}"?${entry.is_dir ? "\n\nThis will delete the folder and all its contents." : ""}`
        );
        if (!confirmed) return;
        try {
          await deletePath(entry.path);
          onRefresh();
        } catch (e) {
          console.error("delete failed", e);
        }
      },
    },
  ];

  return (
    <>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div
        className="group flex items-center gap-1 py-0.5 rounded cursor-pointer hover:bg-[var(--c-bg-elevated)] select-none text-xs"
        style={{ paddingLeft: 2 + indent, paddingRight: 0, marginLeft: 4, marginRight: 4 }}
        data-folder-path={entry.is_dir ? entry.path : undefined}
        data-parent-folder={!entry.is_dir ? entry.path.substring(0, entry.path.lastIndexOf("/")) : undefined}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => { e.stopPropagation(); if (!entry.is_dir) startRename(); }}
        onMouseDown={(e) => {
          if (e.button === 0) {
            e.preventDefault();
            startFileDrag(entry.path, entry.is_dir, e.clientX, e.clientY);
          }
        }}
      >
        {/* Expand caret for dirs */}
        <span className="w-3 flex-shrink-0 flex items-center justify-center text-[var(--c-text-dim)]">
          {entry.is_dir ? (renderChildren ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </span>

        {/* Icon */}
        <span className="flex-shrink-0 flex items-center">
          {entry.is_dir
            ? (renderChildren
                ? <FolderOpen size={13} style={{ color: "var(--c-accent-yellow)" }} />
                : <Folder size={13} style={{ color: "var(--c-accent-yellow)" }} />)
            : <FileIcon name={entry.name} size={13} />}
        </span>

        {/* Name / rename input */}
        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKey}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-[var(--c-bg-hover)] text-[var(--c-text-bright)] text-xs px-1 rounded outline-none min-w-0"
            autoFocus
          />
        ) : (
          <span className="truncate flex-1 text-[var(--c-text)] group-hover:text-[var(--c-text-bright)]">
            {entry.name}
          </span>
        )}
      </div>

      {/* Expanded children — rendered directly below */}
      {renderChildren?.(entry.path, depth + 1)}
    </>
  );
}

