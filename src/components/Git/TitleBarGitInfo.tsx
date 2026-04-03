import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { gitStatus, type GitStatus } from "../../lib/tauri";
import { useStore } from "../../store/useStore";

interface Props {
  projectPath: string;
  projectId: string;
}

export function TitleBarGitInfo({ projectPath, projectId }: Props) {
  const gitStatusVersion = useStore((s) => s.gitStatusVersion);
  const [info, setInfo] = useState<GitStatus | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    gitStatus(projectPath)
      .then((s) => { if (!cancelled) setInfo(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, projectPath, gitStatusVersion]);

  if (!info?.isGitRepo) return null;

  const { branch } = info;

  // Count added / modified / deleted across staged + unstaged
  let added = 0, modified = 0, deleted = 0;
  for (const f of info.files) {
    const s = f.stagedStatus !== " " ? f.stagedStatus : f.unstagedStatus;
    if (s === "A" || s === "?") added++;
    else if (s === "M" || s === "R" || s === "C") modified++;
    else if (s === "D") deleted++;
  }

  const hasDiff = added + modified + deleted > 0;

  return (
    <div className="flex items-center gap-2 pointer-events-none select-none">
      {/* Divider */}
      <span className="text-[var(--c-border)] text-sm">·</span>

      {/* Branch */}
      <div className="flex items-center gap-1">
        <GitBranch size={11} className="text-[var(--c-accent)]" style={{ flexShrink: 0 }} />
        <span className="text-xs text-[var(--c-accent)] font-medium">{branch.branch}</span>
        {branch.ahead > 0 && (
          <span className="text-[10px] text-[var(--c-text-dim)]">↑{branch.ahead}</span>
        )}
        {branch.behind > 0 && (
          <span className="text-[10px] text-[var(--c-text-dim)]">↓{branch.behind}</span>
        )}
      </div>

      {/* Diff stats */}
      {hasDiff && (
        <>
          <span className="text-[var(--c-border)] text-sm">·</span>
          <div className="flex items-center gap-1.5">
            {added > 0 && (
              <span className="text-[10px] font-medium" style={{ color: "var(--c-success)" }}>
                +{added}
              </span>
            )}
            {modified > 0 && (
              <span className="text-[10px] font-medium" style={{ color: "var(--c-accent-yellow)" }}>
                ~{modified}
              </span>
            )}
            {deleted > 0 && (
              <span className="text-[10px] font-medium" style={{ color: "var(--c-danger)" }}>
                -{deleted}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
