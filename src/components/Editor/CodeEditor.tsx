import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";

interface Props {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

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
  ".cm-activeLine": { backgroundColor: "#1f2335" },
  ".cm-gutters": { backgroundColor: "#16161e", borderRight: "1px solid #1f2335", color: "#414868" },
  ".cm-activeLineGutter": { backgroundColor: "#1f2335" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#283457" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "#283457" },
});

function getLanguageExtension(language: string) {
  switch (language) {
    case "typescript": return javascript({ typescript: true, jsx: true });
    case "javascript": return javascript({ jsx: true });
    case "css": return css();
    case "html": return html();
    case "rust": return rust();
    case "json": return json();
    case "markdown": return markdown();
    default: return null;
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
  highlightActiveLine(),
  oneDark,
  tokyoNightTheme,
];

export function CodeEditor({ content, language, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  // Track last content pushed into editor to avoid echo loops
  const lastExternalContent = useRef(content);

  // Always-current refs so keymap / updateListener never close over stale props
  const onSaveRef  = useRef(onSave);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onSaveRef.current  = onSave;  });
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = getLanguageExtension(language);
    const state = EditorState.create({
      doc: content,
      extensions: [
        ...baseExtensions,
        languageCompartment.current.of(langExt ? [langExt] : []),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
          { key: "Mod-s", run: () => { onSaveRef.current(); return true; } },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            lastExternalContent.current = newContent;
            onChangeRef.current(newContent);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    lastExternalContent.current = content;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only re-create when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync external content changes (file switch) without re-creating the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (content === lastExternalContent.current) return;

    lastExternalContent.current = content;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
  }, [content]);

  // Update save handler when it changes (closure)
  // We handle this by recreating the editor on language change which rebuilds keymap

  return <div ref={containerRef} className="h-full overflow-hidden" />;
}
