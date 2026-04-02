import {
  FileCode, FileJson, FileText, FileImage, FileVideo, FileAudio,
  FileArchive, FileType, FileTerminal, FileCog, FileLock,
  File, Database, FileWarning,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

type IconComponent = React.FC<LucideProps>;

interface FileIconDef {
  icon: IconComponent;
  color: string;
}

const EXT_MAP: Record<string, FileIconDef> = {
  // TypeScript / JavaScript
  ts:   { icon: FileCode,     color: "#3178c6" },
  tsx:  { icon: FileCode,     color: "#3178c6" },
  js:   { icon: FileCode,     color: "#f7df1e" },
  jsx:  { icon: FileCode,     color: "#61dafb" },
  mjs:  { icon: FileCode,     color: "#f7df1e" },
  cjs:  { icon: FileCode,     color: "#f7df1e" },

  // Web
  html: { icon: FileCode,     color: "#e34c26" },
  htm:  { icon: FileCode,     color: "#e34c26" },
  css:  { icon: FileCode,     color: "#264de4" },
  scss: { icon: FileCode,     color: "#cc6699" },
  sass: { icon: FileCode,     color: "#cc6699" },
  less: { icon: FileCode,     color: "#1d365d" },
  svg:  { icon: FileImage,    color: "#ffb13b" },

  // Data
  json:  { icon: FileJson,    color: "#f7c948" },
  jsonc: { icon: FileJson,    color: "#f7c948" },
  yaml:  { icon: FileCog,     color: "#cb171e" },
  yml:   { icon: FileCog,     color: "#cb171e" },
  toml:  { icon: FileCog,     color: "#9c4221" },
  xml:   { icon: FileCode,    color: "#f97316" },
  csv:   { icon: Database,    color: "#16a34a" },
  sql:   { icon: Database,    color: "#336791" },

  // Docs
  md:    { icon: FileText,    color: "#7aa2f7" },
  mdx:   { icon: FileText,    color: "#7aa2f7" },
  txt:   { icon: FileText,    color: "#a9b1d6" },
  pdf:   { icon: FileText,    color: "#f7768e" },

  // Rust
  rs:    { icon: FileCode,    color: "#ce422b" },

  // Python
  py:    { icon: FileCode,    color: "#3572a5" },
  pyc:   { icon: FileCode,    color: "#3572a5" },

  // Go
  go:    { icon: FileCode,    color: "#00add8" },

  // Ruby
  rb:    { icon: FileCode,    color: "#cc342d" },

  // Java / Kotlin / Scala
  java:  { icon: FileCode,    color: "#b07219" },
  kt:    { icon: FileCode,    color: "#7f52ff" },
  kts:   { icon: FileCode,    color: "#7f52ff" },
  scala: { icon: FileCode,    color: "#dc322f" },

  // C / C++ / C#
  c:     { icon: FileCode,    color: "#555555" },
  h:     { icon: FileCode,    color: "#555555" },
  cpp:   { icon: FileCode,    color: "#f34b7d" },
  cc:    { icon: FileCode,    color: "#f34b7d" },
  hpp:   { icon: FileCode,    color: "#f34b7d" },
  cs:    { icon: FileCode,    color: "#178600" },

  // Shell
  sh:    { icon: FileTerminal, color: "#89e051" },
  bash:  { icon: FileTerminal, color: "#89e051" },
  zsh:   { icon: FileTerminal, color: "#89e051" },
  fish:  { icon: FileTerminal, color: "#89e051" },
  ps1:   { icon: FileTerminal, color: "#012456" },

  // Config / env
  env:        { icon: FileLock,    color: "#e0af68" },
  gitignore:  { icon: FileCog,     color: "#f14e32" },
  dockerignore: { icon: FileCog,   color: "#2496ed" },
  editorconfig: { icon: FileCog,   color: "#a9b1d6" },
  eslintrc:   { icon: FileWarning, color: "#4b32c3" },
  prettierrc: { icon: FileCog,     color: "#f8bc45" },

  // Images
  png:  { icon: FileImage,    color: "#bb9af7" },
  jpg:  { icon: FileImage,    color: "#bb9af7" },
  jpeg: { icon: FileImage,    color: "#bb9af7" },
  gif:  { icon: FileImage,    color: "#bb9af7" },
  webp: { icon: FileImage,    color: "#bb9af7" },
  ico:  { icon: FileImage,    color: "#bb9af7" },

  // Video / Audio
  mp4:  { icon: FileVideo,    color: "#f7768e" },
  mov:  { icon: FileVideo,    color: "#f7768e" },
  avi:  { icon: FileVideo,    color: "#f7768e" },
  mp3:  { icon: FileAudio,    color: "#9ece6a" },
  wav:  { icon: FileAudio,    color: "#9ece6a" },

  // Archives
  zip:  { icon: FileArchive,  color: "#e0af68" },
  tar:  { icon: FileArchive,  color: "#e0af68" },
  gz:   { icon: FileArchive,  color: "#e0af68" },
  rar:  { icon: FileArchive,  color: "#e0af68" },

  // Fonts
  ttf:  { icon: FileType,     color: "#7dcfff" },
  otf:  { icon: FileType,     color: "#7dcfff" },
  woff: { icon: FileType,     color: "#7dcfff" },
  woff2:{ icon: FileType,     color: "#7dcfff" },

  // Lock files
  lock: { icon: FileLock,     color: "#565f89" },
};

// Special full-name matches (e.g. "Dockerfile", ".env")
const NAME_MAP: Record<string, FileIconDef> = {
  dockerfile:       { icon: FileCog,  color: "#2496ed" },
  "docker-compose.yml":  { icon: FileCog, color: "#2496ed" },
  "docker-compose.yaml": { icon: FileCog, color: "#2496ed" },
  makefile:         { icon: FileTerminal, color: "#e0af68" },
  ".env":           { icon: FileLock, color: "#e0af68" },
  ".env.local":     { icon: FileLock, color: "#e0af68" },
  ".env.production":{ icon: FileLock, color: "#e0af68" },
  "cargo.toml":     { icon: FileCog,  color: "#ce422b" },
  "cargo.lock":     { icon: FileLock, color: "#ce422b" },
  "package.json":   { icon: FileJson, color: "#cb3837" },
  "package-lock.json": { icon: FileLock, color: "#cb3837" },
  "tsconfig.json":  { icon: FileCog,  color: "#3178c6" },
  "vite.config.ts": { icon: FileCog,  color: "#646cff" },
  "vite.config.js": { icon: FileCog,  color: "#646cff" },
  "tailwind.config.ts": { icon: FileCog, color: "#38bdf8" },
  "tailwind.config.js":  { icon: FileCog, color: "#38bdf8" },
};

const DEFAULT: FileIconDef = { icon: File, color: "#565f89" };

export function getFileIconDef(name: string): FileIconDef {
  const lower = name.toLowerCase();
  if (NAME_MAP[lower]) return NAME_MAP[lower];

  // dotfiles like ".gitignore" → key "gitignore"
  if (lower.startsWith(".")) {
    const key = lower.slice(1);
    if (EXT_MAP[key]) return EXT_MAP[key];
    if (NAME_MAP[key]) return NAME_MAP[key];
  }

  const ext = lower.split(".").pop() ?? "";
  return EXT_MAP[ext] ?? DEFAULT;
}

export function FileIcon({ name, size = 13 }: { name: string; size?: number }) {
  const { icon: Icon, color } = getFileIconDef(name);
  return <Icon size={size} style={{ color, flexShrink: 0 }} />;
}
