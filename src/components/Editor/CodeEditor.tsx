import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor } from "@codemirror/view";
import { EditorState, Compartment, Transaction } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import { oneDark, oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { csharp } from "@codemirror/legacy-modes/mode/clike";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { useStore } from "../../store/useStore";
import type { ThemeId } from "../../lib/themes";

// ── Search panel icon patch ───────────────────────────────────────────────────
const SVG_NS = "http://www.w3.org/2000/svg";

function makeSVGIcon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "14"); svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  // pathData contains only d= attributes or point= attributes — no script vectors
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<svg xmlns="${SVG_NS}">${pathData}</svg>`, "image/svg+xml");
  parsed.documentElement.childNodes.forEach((n) => svg.appendChild(document.importNode(n, true)));
  return svg;
}

const SEARCH_ICONS: Record<string, { node: () => SVGSVGElement; title: string }> = {
  previous:      { node: () => makeSVGIcon('<polyline points="18 15 12 9 6 15"/>'),                                                                              title: "Previous (Shift+Enter)" },
  next:          { node: () => makeSVGIcon('<polyline points="6 9 12 15 18 9"/>'),                                                                               title: "Next (Enter)" },
  all:           { node: () => makeSVGIcon('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),    title: "Select all" },
  replace:       { node: () => makeSVGIcon('<path d="M5 3 3 5l2 2"/><path d="M3 5h11a4 4 0 0 1 4 4v3"/><path d="M19 21l2-2-2-2"/><path d="M21 19H10a4 4 0 0 1-4-4v-3"/>'), title: "Replace" },
  "replace all": { node: () => makeSVGIcon('<path d="m3 7 2-2 2 2"/><path d="M5 5v5a4 4 0 0 0 4 4h3"/><path d="m21 17-2 2-2-2"/><path d="M19 19v-5a4 4 0 0 0-4-4h-3"/>'), title: "Replace all" },
  "×":           { node: () => makeSVGIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),                                     title: "Close (Escape)" },
};
const CHEVRON_RIGHT = '<polyline points="9 18 15 12 9 6"/>';
const CHEVRON_DOWN  = '<polyline points="6 9 12 15 18 9"/>';

function patchSearchPanel(container: HTMLElement) {
  const panel = container.querySelector<HTMLElement>(".cm-search");
  if (!panel || panel.dataset.panelPatched) return;
  panel.dataset.panelPatched = "1";

  // Patch all button icons
  panel.querySelectorAll<HTMLElement>(".cm-button").forEach((btn) => {
    const name = btn.getAttribute("name") ?? "";
    const key = name === "close" ? "×"
              : name === "replaceAll" ? "replace all"
              : name === "replace" ? "replace"
              : (btn.textContent?.trim().toLowerCase() ?? "");
    const def = SEARCH_ICONS[key];
    if (def) { btn.replaceChildren(def.node()); btn.title = def.title; }
  });

  // Restructure: wrap replace row in collapsible section
  const br = panel.querySelector("br");
  const closeBtn = panel.querySelector<HTMLElement>(".cm-button[name='close']");
  if (!br || !closeBtn) return;

  // Collect nodes after <br> except the close button
  const replaceNodes: ChildNode[] = [];
  let node: ChildNode | null = br.nextSibling;
  while (node) { if (node !== closeBtn) replaceNodes.push(node); node = node.nextSibling; }

  const replaceSection = document.createElement("div");
  replaceSection.style.cssText = "display:none;align-items:center;gap:4px;flex:1 1 100%;padding-top:2px;";
  replaceNodes.forEach(n => replaceSection.appendChild(n));

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "cm-button";
  toggleBtn.title = "Toggle replace";
  toggleBtn.appendChild(makeSVGIcon(CHEVRON_RIGHT));

  let expanded = false;
  toggleBtn.addEventListener("click", () => {
    expanded = !expanded;
    replaceSection.style.display = expanded ? "flex" : "none";
    toggleBtn.replaceChildren(makeSVGIcon(expanded ? CHEVRON_DOWN : CHEVRON_RIGHT));
  });

  br.replaceWith(toggleBtn);
  closeBtn.style.marginLeft = "auto";
  panel.appendChild(replaceSection);
  panel.appendChild(closeBtn);
}

interface Props {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

// ── Dark: Tokyo Night ─────────────────────────────────────────────────────────
const tokyoNightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1a1b26",
    color: "#c0caf5",
    height: "100%",
    fontSize: "13px",
    fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { caretColor: "#c0caf5", padding: "4px 0" },
  ".cm-cursor": { borderLeftColor: "#c0caf5" },
  ".cm-gutters": { backgroundColor: "#16161e", borderRight: "1px solid #1f2335", color: "#414868" },
  ".cm-activeLineGutter": { backgroundColor: "#1f2335", color: "#7aa2f7" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#3d59a1" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "#3d59a1" },
  ".cm-searchMatch": { backgroundColor: "#3d59a180", outline: "1px solid #3d59a1" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#7aa2f7", color: "#1a1b26" },
  ".cm-panels": { backgroundColor: "#16161e", borderTop: "1px solid #1f2335", padding: "0" },
  ".cm-search": { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px", padding: "6px 8px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace' },
  ".cm-textfield": { height: "26px", padding: "0 8px", backgroundColor: "#0d0e17", color: "#c0caf5", border: "1px solid #1f2335", borderRadius: "3px", fontSize: "12px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', outline: "none", minWidth: "150px" },
  ".cm-textfield:focus": { borderColor: "#7aa2f7" },
  ".cm-search .cm-button": { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", padding: "0", border: "none", borderRadius: "0", backgroundColor: "transparent", backgroundImage: "none", color: "#414868", cursor: "pointer", flexShrink: "0" },
  ".cm-search .cm-button:hover": { color: "#7aa2f7" },
  ".cm-search label": { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', color: "#414868", cursor: "pointer", userSelect: "none" },
  ".cm-search input[type=checkbox]": { accentColor: "#7aa2f7", width: "12px", height: "12px", margin: "0", cursor: "pointer" },
}, { dark: true });

// ── Dark: Grid Mint ───────────────────────────────────────────────────────────
const gridMintTheme = EditorView.theme({
  "&": {
    backgroundColor: "#0a0a0a",
    color: "#cccccc",
    height: "100%",
    fontSize: "13px",
    fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { caretColor: "#00d4aa", padding: "4px 0" },
  ".cm-cursor": { borderLeftColor: "#00d4aa" },
  ".cm-gutters": { backgroundColor: "#0a0a0a", borderRight: "1px solid #1e1e1e", color: "#333333" },
  ".cm-activeLineGutter": { backgroundColor: "#111111", color: "#00d4aa" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#00d4aa50" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "#00d4aa50" },
  ".cm-searchMatch": { backgroundColor: "#00d4aa30", outline: "1px solid #00d4aa" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#00d4aa", color: "#0a0a0a" },
  ".cm-panels": { backgroundColor: "#0a0a0a", borderTop: "1px solid #1e1e1e", padding: "0" },
  ".cm-search": { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px", padding: "6px 8px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace' },
  ".cm-textfield": { height: "26px", padding: "0 8px", backgroundColor: "#050505", color: "#cccccc", border: "1px solid #1e1e1e", borderRadius: "3px", fontSize: "12px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', outline: "none", minWidth: "150px" },
  ".cm-textfield:focus": { borderColor: "#00d4aa" },
  ".cm-search .cm-button": { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", padding: "0", border: "none", borderRadius: "0", backgroundColor: "transparent", backgroundImage: "none", color: "#333333", cursor: "pointer", flexShrink: "0" },
  ".cm-search .cm-button:hover": { color: "#00d4aa" },
  ".cm-search label": { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', color: "#333333", cursor: "pointer", userSelect: "none" },
  ".cm-search input[type=checkbox]": { accentColor: "#00d4aa", width: "12px", height: "12px", margin: "0", cursor: "pointer" },
  ".cm-tooltip": { backgroundColor: "#111111", border: "1px solid #1e1e1e", color: "#cccccc" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "#00d4aa22" },
}, { dark: true });

// ── Light: Dawn ───────────────────────────────────────────────────────────────
const dawnTheme = EditorView.theme({
  "&": {
    backgroundColor: "#f5f5fa",
    color: "#1a1a3a",
    height: "100%",
    fontSize: "13px",
    fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { caretColor: "#1a1a3a", padding: "4px 0" },
  ".cm-cursor": { borderLeftColor: "#3878e8" },
  ".cm-gutters": { backgroundColor: "#e8e8f0", borderRight: "1px solid #d0d0de", color: "#9898b8" },
  ".cm-activeLineGutter": { backgroundColor: "#ebebf2", color: "#3878e8" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#c8d8ff" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "#c8d8ff" },
  ".cm-searchMatch": { backgroundColor: "#c8d8ff80", outline: "1px solid #3878e8" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#3878e8", color: "#ffffff" },
  ".cm-panels": { backgroundColor: "#e8e8f0", borderTop: "1px solid #d0d0de", padding: "0" },
  ".cm-search": { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px", padding: "6px 8px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace' },
  ".cm-textfield": { height: "26px", padding: "0 8px", backgroundColor: "#ffffff", color: "#1a1a3a", border: "1px solid #d0d0de", borderRadius: "3px", fontSize: "12px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', outline: "none", minWidth: "150px" },
  ".cm-textfield:focus": { borderColor: "#3878e8" },
  ".cm-search .cm-button": { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", padding: "0", border: "none", borderRadius: "0", backgroundColor: "transparent", backgroundImage: "none", color: "#9898b8", cursor: "pointer", flexShrink: "0" },
  ".cm-search .cm-button:hover": { color: "#3878e8" },
  ".cm-search label": { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', color: "#9898b8", cursor: "pointer", userSelect: "none" },
  ".cm-search input[type=checkbox]": { accentColor: "#3878e8", width: "12px", height: "12px", margin: "0", cursor: "pointer" },
  ".cm-tooltip": { backgroundColor: "#ebebf2", border: "1px solid #d0d0de", color: "#1a1a3a" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "#c8d8ff" },
}, { dark: false });

function getThemeExtensions(themeId: ThemeId) {
  if (themeId === "dark")  return [oneDark, tokyoNightTheme];
  if (themeId === "mint")  return [gridMintTheme, syntaxHighlighting(oneDarkHighlightStyle)];
  return [dawnTheme, syntaxHighlighting(defaultHighlightStyle)];
}

function getLanguageExtension(language: string) {
  switch (language) {
    case "typescript":  return javascript({ typescript: true, jsx: true });
    case "javascript":  return javascript({ jsx: true });
    case "css":         return css();
    case "html":        return html();
    case "rust":        return rust();
    case "json":        return json();
    case "markdown":    return markdown();
    case "python":      return python();
    case "yaml":        return yaml();
    case "csharp":      return StreamLanguage.define(csharp);
    case "ruby":        return StreamLanguage.define(ruby);
    case "dockerfile":  return StreamLanguage.define(dockerFile);
    case "shell":       return StreamLanguage.define(shell);
    case "properties":  return StreamLanguage.define(properties);
    default:            return null;
  }
}

const baseExtensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  search({ top: false }),
];

export function CodeEditor({ content, language, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const themeCompartment   = useRef(new Compartment());
  // Track last content pushed into editor to avoid echo loops
  const lastExternalContent = useRef(content);

  const theme = useStore((s) => s.theme);

  // Always-current refs so keymap / updateListener never close over stale props
  const onSaveRef  = useRef(onSave);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onSaveRef.current  = onSave;  });
  useEffect(() => { onChangeRef.current = onChange; });

  // ── Create editor (recreate on language change) ───────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = getLanguageExtension(language);
    const state = EditorState.create({
      doc: content,
      extensions: [
        ...baseExtensions,
        languageCompartment.current.of(langExt ? [langExt] : []),
        themeCompartment.current.of(getThemeExtensions(theme)),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...searchKeymap,
          indentWithTab,
          { key: "Mod-s", run: () => { onSaveRef.current(); return true; } },
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          // Skip programmatic updates (file switch / external reload)
          const isExternal = update.transactions.some(
            (tr) => tr.annotation(Transaction.userEvent) === "external"
          );
          if (isExternal) return;
          const newContent = update.state.doc.toString();
          lastExternalContent.current = newContent;
          onChangeRef.current(newContent);
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    lastExternalContent.current = content;

    // Patch search panel whenever it opens (icons + replace spoiler)
    const observer = new MutationObserver(() => patchSearchPanel(containerRef.current!));
    observer.observe(containerRef.current, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      view.destroy();
      viewRef.current = null;
    };
    // Only re-create when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Swap theme without recreating the editor ──────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(getThemeExtensions(theme)),
    });
  }, [theme]);

  // ── Sync external content changes (file switch) ───────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (content === lastExternalContent.current) return;

    lastExternalContent.current = content;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      annotations: Transaction.userEvent.of("external"),
    });
  }, [content]);

  return <div ref={containerRef} className="h-full overflow-hidden" />;
}
