import type { GitLogEntry } from "../../lib/tauri";

// ── constants ─────────────────────────────────────────────────────────────────

const ROW_H   = 28;
const LANE_W  = 16;
const DOT_R   = 3.5;
const MID_Y   = ROW_H / 2;

// Lane colors — lane 0 uses theme accent, rest are fixed
const LANE_COLORS = [
  "var(--c-accent)",
  "#7aa2f7",
  "#bb9af7",
  "#e0af68",
  "#f7768e",
  "#9ece6a",
  "#7dcfff",
  "#f77fbe",
  "#73daca",
  "#ff9e64",
];

function laneColor(i: number): string {
  return LANE_COLORS[i % LANE_COLORS.length];
}

function laneX(i: number): number {
  return i * LANE_W + LANE_W / 2;
}

// ── graph computation ─────────────────────────────────────────────────────────

interface GraphRow {
  commit: GitLogEntry;
  /** Index of the column this commit sits in */
  lane: number;
  /** Lane state BEFORE this commit was processed (for top-half connectors) */
  before: Array<string | null>;
  /** Lane state AFTER this commit was processed (for bottom-half connectors) */
  after: Array<string | null>;
  /** Lanes that converge INTO this commit from above (top-half diagonals) */
  closingLanes: number[];
  /** Lanes that open FROM this commit going down (bottom-half diagonals) */
  openingLanes: number[];
}

export function computeGraph(commits: GitLogEntry[]): GraphRow[] {
  // lanes[i] = hash of the commit we expect to see in lane i next
  const lanes: Array<string | null> = [];
  const rows: GraphRow[] = [];

  for (const commit of commits) {
    const before = [...lanes];

    // 1. Find myLane: the first lane expecting this commit hash
    let lane = lanes.indexOf(commit.hash);
    if (lane === -1) {
      // Not expected anywhere — use first free slot or extend
      const free = lanes.indexOf(null);
      lane = free !== -1 ? free : lanes.length;
      if (lane === lanes.length) lanes.push(null);
    }

    // 2. Set first parent in myLane
    lanes[lane] = commit.parents[0] ?? null;

    // 3. Handle extra parents (merge commits)
    const openingLanes: number[] = [];
    for (let pi = 1; pi < commit.parents.length; pi++) {
      const ph = commit.parents[pi];
      const existing = lanes.indexOf(ph);
      if (existing !== -1) {
        // This parent lane already exists — it will close into myLane below
        // (handled by closingLanes detection below)
      } else {
        // Open a new lane for this parent
        const free = lanes.findIndex((h, idx) => h === null && idx !== lane);
        const newLane = free !== -1 ? free : lanes.length;
        if (newLane === lanes.length) lanes.push(null);
        lanes[newLane] = ph;
        openingLanes.push(newLane);
      }
    }

    // 4. Detect closing lanes: duplicate expectations pointing to same hash
    //    (two lanes both targeting the same commit → the duplicate closes in)
    const closingLanes: number[] = [];
    for (let i = 0; i < lanes.length; i++) {
      if (i === lane || lanes[i] === null) continue;
      for (let j = i + 1; j < lanes.length; j++) {
        if (lanes[i] === lanes[j]) {
          closingLanes.push(j);
          lanes[j] = null;
        }
      }
    }

    // Also detect if myLane's first parent was already tracked elsewhere
    // (the other lane becomes a closing lane targeting myLane)
    if (commit.parents[0]) {
      for (let i = 0; i < lanes.length; i++) {
        if (i !== lane && lanes[i] === commit.parents[0]) {
          closingLanes.push(i);
          lanes[i] = null;
        }
      }
    }

    const after = [...lanes];

    rows.push({ commit, lane, before, after, closingLanes, openingLanes });
  }

  return rows;
}

// ── SVG row renderer ──────────────────────────────────────────────────────────

function GraphRowSVG({ row }: { row: GraphRow }) {
  const { lane, before, after, closingLanes, openingLanes } = row;
  const numLanes = Math.max(before.length, after.length, lane + 1, 1);
  const width = numLanes * LANE_W + 4;

  const lines: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < numLanes; i++) {
    const x = laneX(i);
    const color = laneColor(i);
    const isClosing = closingLanes.includes(i);
    const isOpening = openingLanes.includes(i);
    const myX = laneX(lane);

    // Top-half vertical line (from row above into midY)
    const activeTop = before[i] != null || i === lane;
    if (activeTop && !isClosing) {
      lines.push(
        <line key={key++} x1={x} y1={0} x2={x} y2={MID_Y}
          stroke={color} strokeWidth={1.5} />
      );
    }

    // Closing diagonal: from this lane converging into myLane at midY
    if (isClosing) {
      const fromColor = laneColor(i);
      lines.push(
        <line key={key++} x1={x} y1={0} x2={myX} y2={MID_Y}
          stroke={fromColor} strokeWidth={1.5} />
      );
    }

    // Bottom-half vertical line (from midY down to next row)
    const activeBottom = after[i] != null;
    if (activeBottom && !isOpening) {
      lines.push(
        <line key={key++} x1={x} y1={MID_Y} x2={x} y2={ROW_H}
          stroke={color} strokeWidth={1.5} />
      );
    }

    // Opening diagonal: from myLane down-out to this new lane
    if (isOpening) {
      const toColor = laneColor(i);
      lines.push(
        <line key={key++} x1={myX} y1={MID_Y} x2={x} y2={ROW_H}
          stroke={toColor} strokeWidth={1.5} />
      );
    }
  }

  // Commit dot
  const myX = laneX(lane);
  const myColor = laneColor(lane);
  lines.push(
    <circle key={key++} cx={myX} cy={MID_Y} r={DOT_R}
      fill={myColor} stroke={myColor} strokeWidth={1} />
  );

  return (
    <svg
      width={width}
      height={ROW_H}
      style={{ display: "block", flexShrink: 0 }}
    >
      {lines}
    </svg>
  );
}

// ── ref badge ─────────────────────────────────────────────────────────────────

function RefBadge({ label }: { label: string }) {
  const isHead = label.startsWith("HEAD");
  const isRemote = label.includes("/") && !label.startsWith("HEAD");
  const bg = isHead
    ? "color-mix(in srgb, var(--c-accent) 20%, transparent)"
    : isRemote
    ? "color-mix(in srgb, #7aa2f7 15%, transparent)"
    : "color-mix(in srgb, #bb9af7 15%, transparent)";

  const color = isHead
    ? "var(--c-accent)"
    : isRemote
    ? "#7aa2f7"
    : "#bb9af7";

  return (
    <span
      className="inline-flex items-center px-1 rounded text-[9px] font-mono leading-none py-px flex-shrink-0"
      style={{ background: bg, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  commits: GitLogEntry[];
  loading: boolean;
}

export function GitGraphView({ commits, loading }: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--c-text-dim)] text-xs">
        Loading…
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--c-text-dim)] text-xs">
        No commits
      </div>
    );
  }

  const rows = computeGraph(commits);

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      {rows.map((row) => (
        <div
          key={row.commit.hash}
          className="flex items-stretch hover:bg-[var(--c-bg-elevated)] transition-colors group"
          style={{ height: ROW_H, minWidth: 0 }}
          title={row.commit.hash}
        >
          {/* Graph column */}
          <div className="flex-shrink-0">
            <GraphRowSVG row={row} />
          </div>

          {/* Info column */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
            {/* Ref badges */}
            {row.commit.refs.length > 0 && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {row.commit.refs.map((ref) => (
                  <RefBadge key={ref} label={ref} />
                ))}
              </div>
            )}

            {/* Commit message */}
            <span className="text-[11px] text-[var(--c-text-bright)] truncate flex-1">
              {row.commit.message}
            </span>

            {/* Author */}
            <span className="text-[10px] text-[var(--c-text-dim)] flex-shrink-0 hidden group-hover:inline">
              {row.commit.author}
            </span>

            {/* Short hash */}
            <span className="text-[10px] font-mono text-[var(--c-muted)] flex-shrink-0">
              {row.commit.shortHash}
            </span>

            {/* Date */}
            <span className="text-[10px] text-[var(--c-text-dim)] flex-shrink-0">
              {row.commit.date}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
