import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  avif: "image/avif",
  tiff: "image/tiff",
  tif: "image/tiff",
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.15;

interface Props {
  path: string;
}

export function ImageViewer({ path }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setSrc(null);
    setDims(null);
    setError(null);
    setZoom(1);
    setFitZoom(1);

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME[ext] ?? "application/octet-stream";

    invoke<string>("read_file_bytes_base64", { path })
      .then((b64) => setSrc(`data:${mime};base64,${b64}`))
      .catch((e) => setError(String(e)));
  }, [path]);

  const computeFit = useCallback((naturalW: number, naturalH: number) => {
    const container = containerRef.current;
    if (!container) return 1;
    const { width, height } = container.getBoundingClientRect();
    const padding = 32;
    const scale = Math.min((width - padding) / naturalW, (height - padding) / naturalH, 1);
    return Math.max(scale, MIN_ZOOM);
  }, []);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setDims({ w, h });
    const fit = computeFit(w, h);
    setFitZoom(fit);
    setZoom(fit);
  };

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => clampZoom(z - Math.sign(e.deltaY) * ZOOM_STEP * z));
  };

  const zoomIn  = () => setZoom((z) => clampZoom(z * (1 + ZOOM_STEP)));
  const zoomOut = () => setZoom((z) => clampZoom(z / (1 + ZOOM_STEP)));
  const zoomFit = () => setZoom(fitZoom);
  const zoom100 = () => setZoom(1);

  const zoomPct = Math.round(zoom * 100);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--c-text-dim)] text-xs">
        Failed to load image: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--c-bg)]">
      {/* Toolbar */}
      {src && dims && (
        <div className="flex items-center gap-1 px-3 h-6 border-b border-[var(--c-border)] flex-shrink-0 bg-[var(--c-bg)]">
          <span className="text-[10px] text-[var(--c-text-dim)] mr-1">
            {dims.w} × {dims.h}
          </span>

          <div className="flex-1" />

          <button
            onClick={zoomOut}
            title="Zoom out"
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-selected)] text-sm leading-none"
          >
            −
          </button>

          <button
            onClick={zoom100}
            title="100%"
            className="px-1 h-5 flex items-center justify-center rounded text-[10px] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-selected)] min-w-[40px]"
          >
            {zoomPct}%
          </button>

          <button
            onClick={zoomIn}
            title="Zoom in"
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-selected)] text-sm leading-none"
          >
            +
          </button>

          <button
            onClick={zoomFit}
            title="Fit to window"
            className="px-1 h-5 flex items-center justify-center rounded text-[10px] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-selected)] ml-1"
          >
            Fit
          </button>
        </div>
      )}

      {/* Scrollable canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onWheel={onWheel}
        style={{ cursor: zoom > fitZoom ? "grab" : "default" }}
      >
        {src ? (
          <div
            style={{
              minWidth: "100%",
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              boxSizing: "border-box",
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt={path.split("/").pop()}
              onLoad={onLoad}
              draggable={false}
              style={{
                width: dims ? dims.w * zoom : undefined,
                height: dims ? dims.h * zoom : undefined,
                imageRendering: zoom > 2 ? "pixelated" : "auto",
                flexShrink: 0,
                display: "block",
              }}
              className="shadow-md"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <span className="text-[10px] text-[var(--c-text-dim)]">Loading…</span>
          </div>
        )}
      </div>

    </div>
  );
}
