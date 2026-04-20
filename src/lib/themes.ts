export type ThemeId = "dark" | "light" | "mint";

export interface ThemeVars {
  bgDeep: string;
  bg: string;
  bgElevated: string;
  bgSelected: string;
  bgHover: string;
  dragBg: string;
  border: string;
  muted: string;
  textDim: string;
  text: string;
  textBright: string;
  accent: string;
  accentCyan: string;
  accentYellow: string;
  danger: string;
  success: string;
  purple: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  vars: ThemeVars;
}

export const themes: Theme[] = [
  {
    id: "dark",
    name: "Tokyo Night",
    vars: {
      bgDeep: "#1a1b26",
      bg: "#16161e",
      bgElevated: "#1f2335",
      bgSelected: "#24283b",
      bgHover: "#292e42",
      dragBg: "#2a3654",
      border: "#1f2335",
      muted: "#414868",
      textDim: "#565f89",
      text: "#a9b1d6",
      textBright: "#c0caf5",
      accent: "#7aa2f7",
      accentCyan: "#7dcfff",
      accentYellow: "#e0af68",
      danger: "#f7768e",
      success: "#9ece6a",
      purple: "#bb9af7",
    },
  },
  {
    id: "mint",
    name: "Grid Mint",
    vars: {
      bgDeep:       "#111111",
      bg:           "#0a0a0a",
      bgElevated:   "#181818",
      bgSelected:   "#202020",
      bgHover:      "#252525",
      dragBg:       "#2a2a2a",
      border:       "#1e1e1e",
      muted:        "#333333",
      textDim:      "#555555",
      text:         "#888888",
      textBright:   "#cccccc",
      accent:       "#00d4aa",
      accentCyan:   "#00b8d4",
      accentYellow: "#d4a800",
      danger:       "#d44444",
      success:      "#00c896",
      purple:       "#9966cc",
    },
  },
  {
    id: "light",
    name: "Dawn",
    vars: {
      bgDeep: "#f5f5fa",
      bg: "#e8e8f0",
      bgElevated: "#ebebf2",
      bgSelected: "#d8d8e8",
      bgHover: "#e0e0ec",
      dragBg: "#c8d8ff",
      border: "#d0d0de",
      muted: "#9898b8",
      textDim: "#7070a8",
      text: "#404060",
      textBright: "#1a1a3a",
      accent: "#3878e8",
      accentCyan: "#0080bb",
      accentYellow: "#a06010",
      danger: "#d02040",
      success: "#1a8a30",
      purple: "#6040cc",
    },
  },
];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const { vars } = theme;
  root.style.setProperty("--c-bg-deep", vars.bgDeep);
  root.style.setProperty("--c-bg", vars.bg);
  root.style.setProperty("--c-bg-elevated", vars.bgElevated);
  root.style.setProperty("--c-bg-selected", vars.bgSelected);
  root.style.setProperty("--c-bg-hover", vars.bgHover);
  root.style.setProperty("--c-drag-bg", vars.dragBg);
  root.style.setProperty("--c-border", vars.border);
  root.style.setProperty("--c-muted", vars.muted);
  root.style.setProperty("--c-text-dim", vars.textDim);
  root.style.setProperty("--c-text", vars.text);
  root.style.setProperty("--c-text-bright", vars.textBright);
  root.style.setProperty("--c-accent", vars.accent);
  root.style.setProperty("--c-accent-cyan", vars.accentCyan);
  root.style.setProperty("--c-accent-yellow", vars.accentYellow);
  root.style.setProperty("--c-danger", vars.danger);
  root.style.setProperty("--c-success", vars.success);
  root.style.setProperty("--c-purple", vars.purple);
}
