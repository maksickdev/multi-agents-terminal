import { useEffect, useRef, useState } from "react";
import { spawnAgent, killAgent, renamePath, saveProjects } from "../../lib/tauri";
import { useStore, type Agent } from "../../store/useStore";
import type { Project } from "../../lib/tauri";
import { ConfirmModal } from "../shared/ConfirmModal";
import { ContextMenu, type ContextMenuItem } from "../FileExplorer/ContextMenu";
import { revealInFinder } from "../../lib/tauri";
import { Plus, Trash2, ScanSearch, Pencil, Copy } from "lucide-react";

interface Props {
  project: Project;
}

export function ProjectItem({ project }: Props) {
  const { selectedProjectId, selectProject, addAgent, removeProject, renameProject, getProjectAgents, projects, agentAttention } =
    useStore();
  const isSelected = selectedProjectId === project.id;
  const agents = getProjectAgents(project.id);

  // "permission"   — PermissionRequest hook (requires confirmation)
  // "notification" — Stop hook (Claude finished responding, waiting for input)
  const attention = (() => {
    if (agents.some((a) => agentAttention[a.id] === "permission")) return "permission";
    if (!isSelected && agents.some((a) => agentAttention[a.id] === "notification")) return "notification";
    return null;
  })();

  const [showConfirm, setShowConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setRenameValue(project.name);
      setRenameError(null);
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 0);
    }
  }, [renaming]);

  const commitRename = async () => {
    const newName = renameValue.trim();
    if (!newName || newName === project.name) { setRenaming(false); return; }
    if (newName.includes("/") || newName.includes("\\")) {
      setRenameError("Name must not contain slashes");
      return;
    }

    const parent = project.path.substring(0, project.path.lastIndexOf("/"));
    const newPath = `${parent}/${newName}`;

    try {
      await renamePath(project.path, newPath);
      renameProject(project.id, newName, newPath);
      await saveProjects(
        projects.map((p) => p.id === project.id ? { ...p, name: newName, path: newPath } : p)
      );
      setRenaming(false);
    } catch (e) {
      setRenameError(String(e));
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") { setRenaming(false); }
  };

  const handleNewAgent = async () => {
    selectProject(project.id);
    try {
      const agentId = await spawnAgent(project.id, project.path);
      const agent: Agent = {
        id: agentId,
        projectId: project.id,
        name: `Agent ${agents.length + 1}`,
        cwd: project.path,
        status: "active",
        createdAt: Date.now(),
      };
      addAgent(agent);
    } catch (err) {
      console.error("Failed to spawn agent:", err);
      alert(`Failed to start agent: ${err}`);
    }
  };

  const doRemove = async () => {
    setShowConfirm(false);
    for (const agent of agents) {
      await killAgent(agent.id).catch(() => {});
    }
    removeProject(project.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextItems: ContextMenuItem[] = [
    {
      label: "New Agent",
      icon: Plus,
      onClick: handleNewAgent,
    },
    {
      label: "Rename Folder",
      icon: Pencil,
      onClick: () => setRenaming(true),
    },
    {
      label: "Copy Path",
      icon: Copy,
      onClick: () => navigator.clipboard.writeText(project.path),
    },
    {
      label: "Reveal in Finder",
      icon: ScanSearch,
      onClick: () => revealInFinder(project.path),
    },
    {
      label: "Remove Project",
      icon: Trash2,
      onClick: () => setShowConfirm(true),
      danger: true,
    },
  ];

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title="Remove project?"
          message={`Remove "${project.name}"?${agents.length > 0 ? ` ${agents.length} agent${agents.length > 1 ? "s" : ""} will be stopped.` : ""}`}
          confirmLabel="Remove"
          danger
          onConfirm={doRemove}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div
        onClick={() => !renaming && selectProject(project.id)}
        onContextMenu={handleContextMenu}
        onDoubleClick={() => setRenaming(true)}
        className={`flex flex-col px-3 py-2 rounded cursor-pointer transition-colors ${
          isSelected
            ? "bg-[var(--c-bg-elevated)] text-[var(--c-text-bright)]"
            : "text-[var(--c-text)] hover:bg-[var(--c-bg)]"
        }`}
      >
        <div className="flex items-center justify-between min-w-0">
          {renaming ? (
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                onKeyDown={handleRenameKeyDown}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-sm font-medium rounded px-1 outline-none border border-[var(--c-accent)] bg-[var(--c-bg-deep)] text-[var(--c-text-bright)]"
              />
              {renameError && (
                <span className="text-[10px] text-[var(--c-danger)]">{renameError}</span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium truncate">{project.name}</span>
          )}
          {!renaming && attention && (
            <span
              className="ml-2 flex-shrink-0 w-2 h-2 rounded-full animate-pulse"
              style={{
                backgroundColor: attention === "permission"
                  ? "#e0af68"
                  : "var(--c-accent)",
              }}
              title={attention === "permission" ? "Requires confirmation" : "Waiting for input"}
            />
          )}
          {!renaming && agents.length > 0 && (
            <span className="text-xs text-[var(--c-accent)] ml-1 flex-shrink-0">{agents.length}</span>
          )}
        </div>
        {!renaming && (
          <span className="text-xs text-[var(--c-text-dim)] truncate">{project.path}</span>
        )}
      </div>
    </>
  );
}
