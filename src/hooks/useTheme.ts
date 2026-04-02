import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { themes, applyTheme } from "../lib/themes";

/** Applies CSS custom properties to :root whenever the active theme changes. */
export function useTheme() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const found = themes.find((t) => t.id === theme);
    if (found) applyTheme(found);
  }, [theme]);
}
