import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { themes, applyTheme } from "../lib/themes";
import { applyTerminalTheme } from "../lib/ptyManager";

/** Applies CSS custom properties to :root and xterm theme whenever the active theme changes. */
export function useTheme() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const found = themes.find((t) => t.id === theme);
    if (found) applyTheme(found);
    applyTerminalTheme(theme);
  }, [theme]);
}
