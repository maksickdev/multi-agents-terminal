export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="text-5xl">⌨️</div>
      <div>
        <h2 className="text-[var(--c-text-bright)] text-lg font-semibold mb-1">
          No project selected
        </h2>
        <p className="text-[var(--c-text-dim)] text-sm">
          Select a project from the sidebar or add a new one
        </p>
      </div>
    </div>
  );
}
