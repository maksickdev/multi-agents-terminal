import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import type { OpenFile } from "../../store/useStore";
import { CodeEditor } from "./CodeEditor";
import { RenderedPreview } from "./RenderedPreview";

const PREVIEWABLE = ["markdown"];

interface Props {
  file: OpenFile;
  onChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function FullscreenFileModal({ file, onChange, onSave, onClose }: Props) {
  const isPreviewable = PREVIEWABLE.includes(file.language);
  const [previewMode, setPreviewMode] = useState<"raw" | "rendered">("raw");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--c-bg-deep)]"
      style={{ backdropFilter: "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-8 px-3 border-b border-[var(--c-border)] flex-shrink-0 bg-[var(--c-bg-deep)]">
        <span className="text-xs text-[var(--c-text-dim)] truncate">{file.path}</span>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {isPreviewable && (
            <div className="flex items-center rounded overflow-hidden border border-[var(--c-bg-selected)]">
              {(["raw", "rendered"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPreviewMode(mode)}
                  className={`px-2 h-4 text-[9px] leading-none uppercase tracking-wide transition-colors ${
                    previewMode === mode
                      ? "bg-[var(--c-accent)] text-[var(--c-bg)]"
                      : "text-[var(--c-muted)] hover:text-[var(--c-text)]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            title="Close fullscreen (Esc)"
            className="flex items-center text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isPreviewable && previewMode === "rendered"
          ? <RenderedPreview content={file.content} language={file.language} />
          : <CodeEditor
              key={file.path}
              content={file.content}
              language={file.language}
              onChange={onChange}
              onSave={onSave}
            />
        }
      </div>
    </div>,
    document.body,
  );
}
