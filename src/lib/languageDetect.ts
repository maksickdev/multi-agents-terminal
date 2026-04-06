/** Maps a filename to a CodeMirror language identifier. */
export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
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
  };
  return map[ext] ?? "";
}
