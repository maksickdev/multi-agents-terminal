export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="text-5xl">⌨️</div>
      <div>
        <h2 className="text-[#c0caf5] text-lg font-semibold mb-1">
          No project selected
        </h2>
        <p className="text-[#565f89] text-sm">
          Select a project from the sidebar or add a new one
        </p>
      </div>
    </div>
  );
}
