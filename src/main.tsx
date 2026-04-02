import ReactDOM from "react-dom/client";
import App from "./App";
import "@xterm/xterm/css/xterm.css";
import "./index.css";
import { themes, applyTheme } from "./lib/themes";
import type { ThemeId } from "./lib/themes";

// Apply saved theme immediately before first render to avoid flash
const savedTheme = (localStorage.getItem("theme") as ThemeId | null) ?? "dark";
const initialTheme = themes.find((t) => t.id === savedTheme) ?? themes[0];
applyTheme(initialTheme);

// StrictMode is intentionally disabled: Tauri event listeners are async
// and double-invoke in StrictMode causes duplicate PTY output in terminals.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
