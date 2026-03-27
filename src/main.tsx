import ReactDOM from "react-dom/client";
import App from "./App";
import "@xterm/xterm/css/xterm.css";
import "./index.css";

// StrictMode is intentionally disabled: Tauri event listeners are async
// and double-invoke in StrictMode causes duplicate PTY output in terminals.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
