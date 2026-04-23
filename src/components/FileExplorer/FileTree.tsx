import { useState, useEffect, useCallback } from "react";
import { readDir } from "../../lib/tauri";
import type { FileEntry, Project } from "../../lib/tauri";
import { FileTreeNode } from "./FileTreeNode";
import { useStore } from "../../store/useStore";

interface Props {
  project: Project;
  /** When provided, renders children of this specific dir. Omit for project root. */
  rootPath?: string;
  depth?: number;
  /** Called when a destructive action at root requires a parent refresh. */
  onRefreshRoot?: () => void;
}

export function FileTree({ project, rootPath, depth = 0, onRefreshRoot }: Props) {
  const { expandedDirs } = useStore();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const root = rootPath ?? project.path;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await readDir(root);
      setEntries(result);
    } catch (e) {
      console.error("readDir failed for", root, e);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => { load(); }, [load]);

  const renderChildTree = (childRoot: string, childDepth: number) => (
    <FileTree
      project={project}
      rootPath={childRoot}
      depth={childDepth}
      onRefreshRoot={onRefreshRoot ?? load}
    />
  );

  if (loading && entries.length === 0) {
    return <div className="text-[var(--c-text-dim)] text-xs px-3 py-0.5">…</div>;
  }

  return (
    <div>
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={depth}
          projectId={project.id}
          onRefresh={depth === 0 ? (onRefreshRoot ?? load) : load}
          renderChildren={
            entry.is_dir &&
            (expandedDirs[project.id] ?? []).includes(entry.path)
              ? renderChildTree
              : undefined
          }
        />
      ))}

      {entries.length === 0 && !loading && depth === 0 && (
        <div className="text-[var(--c-muted)] text-xs px-3 py-1 italic">Empty folder</div>
      )}
    </div>
  );
}
