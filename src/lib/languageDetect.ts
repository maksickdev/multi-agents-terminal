/** Maps a filename to a CodeMirror language identifier. */
export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();

  // Special full-name matches (before extension splitting)
  if (lower === ".env" || lower.startsWith(".env.")) return "properties";
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "docker-compose.yml" || lower === "docker-compose.yaml") return "yaml";

  const ext = lower.split(".").pop() ?? "";
  const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif", "tiff", "tif"]);
  if (IMAGE_EXTS.has(ext)) return "image";

  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    rs: "rust",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    css: "css",
    scss: "css",
    html: "html",
    htm: "html",
    xml: "html",
    py: "python",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    cs: "csharp",
    rb: "ruby",
    yml: "yaml",
    yaml: "yaml",
  };
  return map[ext] ?? "";
}
