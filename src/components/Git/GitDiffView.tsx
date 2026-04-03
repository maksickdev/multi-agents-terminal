interface DiffLine {
  type: "added" | "removed" | "context" | "hunk" | "header";
  content: string;
  oldNo: number | null;
  newNo: number | null;
}

function parseDiff(raw: string): DiffLine[] {
  if (!raw.trim()) return [];
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;

  for (const line of raw.split("\n")) {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      lines.push({ type: "header", content: line, oldNo: null, newNo: null });
      continue;
    }

    if (line.startsWith("@@")) {
      // @@ -oldStart,oldCount +newStart,newCount @@
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldNo = parseInt(m[1], 10) - 1;
        newNo = parseInt(m[2], 10) - 1;
      }
      lines.push({ type: "hunk", content: line, oldNo: null, newNo: null });
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      newNo++;
      lines.push({ type: "added", content: line.slice(1), oldNo: null, newNo });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      oldNo++;
      lines.push({ type: "removed", content: line.slice(1), oldNo, newNo: null });
    } else if (line.startsWith(" ") || line === "") {
      oldNo++;
      newNo++;
      lines.push({ type: "context", content: line.slice(1), oldNo, newNo });
    }
  }

  return lines;
}

interface Props {
  diff: string;
}

export function GitDiffView({ diff }: Props) {
  const lines = parseDiff(diff);

  if (!diff.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--c-text-dim)] text-xs">
        No changes
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto text-xs font-mono"
      style={{ background: "var(--c-bg)", userSelect: "text" }}
    >
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 36 }} />
          <col />
        </colgroup>
        <tbody>
          {lines.map((line, i) => {
            if (line.type === "header") {
              return (
                <tr key={i}>
                  <td colSpan={3}
                    style={{ color: "var(--c-text-dim)", padding: "1px 8px", background: "var(--c-bg-deep)" }}
                  >
                    {line.content}
                  </td>
                </tr>
              );
            }
            if (line.type === "hunk") {
              return (
                <tr key={i}>
                  <td colSpan={3}
                    style={{ color: "var(--c-accent-cyan)", padding: "2px 8px", background: "var(--c-bg-elevated)" }}
                  >
                    {line.content}
                  </td>
                </tr>
              );
            }

            const bg =
              line.type === "added"   ? "rgba(70,130,70,0.18)" :
              line.type === "removed" ? "rgba(180,60,60,0.18)" :
              "transparent";

            const color =
              line.type === "added"   ? "var(--c-success)" :
              line.type === "removed" ? "var(--c-danger)"  :
              "var(--c-text)";

            const prefix =
              line.type === "added"   ? "+" :
              line.type === "removed" ? "−" : " ";

            return (
              <tr key={i} style={{ background: bg }}>
                {/* Old line number */}
                <td style={{ textAlign: "right", padding: "0 6px", color: "var(--c-text-dim)", userSelect: "none", borderRight: "1px solid var(--c-border)" }}>
                  {line.oldNo ?? ""}
                </td>
                {/* New line number */}
                <td style={{ textAlign: "right", padding: "0 6px", color: "var(--c-text-dim)", userSelect: "none", borderRight: "1px solid var(--c-border)" }}>
                  {line.newNo ?? ""}
                </td>
                {/* Content */}
                <td style={{ padding: "0 8px", color, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  <span style={{ color: "var(--c-text-dim)", marginRight: 6, userSelect: "none" }}>{prefix}</span>
                  {line.content}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
