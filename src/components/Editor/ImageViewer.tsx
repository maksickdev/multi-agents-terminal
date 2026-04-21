import { useEffect, useState } from "react";
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

interface Props {
  path: string;
}

export function ImageViewer({ path }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);
    setDims(null);
    setError(null);

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME[ext] ?? "application/octet-stream";

    invoke<string>("read_file_bytes_base64", { path })
      .then((b64) => setSrc(`data:${mime};base64,${b64}`))
      .catch((e) => setError(String(e)));
  }, [path]);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDims({ w: img.naturalWidth, h: img.naturalHeight });
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--c-text-dim)] text-xs">
        Failed to load image: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center overflow-auto bg-[var(--c-bg)] gap-2 p-4">
      {src ? (
        <>
          <img
            src={src}
            alt={path.split("/").pop()}
            onLoad={onLoad}
            style={{ maxWidth: "100%", maxHeight: "calc(100% - 24px)", objectFit: "contain" }}
            className="rounded shadow-md"
          />
          {dims && (
            <span className="text-[10px] text-[var(--c-muted)]">
              {dims.w} × {dims.h}
            </span>
          )}
        </>
      ) : (
        <span className="text-[10px] text-[var(--c-muted)]">Loading…</span>
      )}
    </div>
  );
}
