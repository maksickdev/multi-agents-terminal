import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { BarChart2, RefreshCw, X } from "lucide-react";
import { fetchUsage, type UsageData } from "../../lib/tauri";
import { useStore } from "../../store/useStore";

function UsageBar({ label, pct, resets }: { label: string; pct: number | null; resets?: string | null }) {
  const value = pct ?? 0;
  const color =
    value >= 90 ? "var(--c-danger)" :
    value >= 70 ? "#e0af68" :
    "var(--c-accent)";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--c-text-dim)]">{label}</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color }}>
          {pct === null ? "—" : `${pct}%`}
        </span>
      </div>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--c-bg-elevated)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
      {resets && (
        <span className="text-[9px] text-[var(--c-muted)] leading-tight">{resets}</span>
      )}
    </div>
  );
}

export function UsageButton() {
  const { projects, selectedProjectId } = useStore();
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState({ left: 0, bottom: 0 });

  const btnRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const cwd = selectedProject?.path ?? "";
      const result = await fetchUsage(cwd);
      setData(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open) {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPanelPos({
          left: rect.right + 4,
          bottom: window.innerHeight - rect.bottom,
        });
      }
      setOpen(true);
      load();
    } else {
      setOpen(false);
    }
  };

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const noData =
    data &&
    data.session_pct === null &&
    data.week_all_pct === null &&
    data.week_sonnet_pct === null &&
    data.extra_pct === null;

  const panel = open ? (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: panelPos.left,
        bottom: panelPos.bottom,
        width: 230,
        zIndex: 200,
        background: "var(--c-bg)",
        border: "1px solid var(--c-border)",
        borderRadius: 8,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[var(--c-border)]"
        style={{ background: "var(--c-bg-deep)" }}
      >
        <div className="flex items-center gap-1.5">
          <BarChart2 size={12} className="text-[var(--c-accent)]" />
          <span className="text-xs font-semibold text-[var(--c-text-bright)]">
            Claude Code Limits
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="p-0.5 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-0.5 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-3">
        {loading && !data && (
          <p className="text-[10px] text-[var(--c-text-dim)] text-center py-2">
            Fetching usage data…
          </p>
        )}
        {error && (
          <p className="text-[10px] text-[var(--c-danger)]">{error}</p>
        )}
        {data && !noData && (
          <>
            {data.session_pct !== null && (
              <UsageBar label="Current session" pct={data.session_pct} resets={data.session_resets} />
            )}
            {data.week_all_pct !== null && (
              <UsageBar label="Week (all models)" pct={data.week_all_pct} resets={data.week_all_resets} />
            )}
            {data.week_sonnet_pct !== null && (
              <UsageBar label="Week (Sonnet only)" pct={data.week_sonnet_pct} resets={data.week_sonnet_resets} />
            )}
            {data.extra_pct !== null && (
              <UsageBar label="Extra usage" pct={data.extra_pct} resets={data.extra_resets} />
            )}
          </>
        )}
        {data && noData && !loading && (
          <p className="text-[10px] text-[var(--c-text-dim)] text-center py-1">
            Could not parse usage data.
            <br />
            Check backend logs for raw output.
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Claude Code usage limits"
        className={`flex items-center justify-center w-9 h-9 rounded transition-colors ${
          open
            ? "text-[var(--c-accent)] bg-[var(--c-bg)]"
            : "text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg)]"
        }`}
      >
        <BarChart2 size={20} />
      </button>
      {ReactDOM.createPortal(panel, document.body)}
    </>
  );
}
