# Design System

This document defines the unified design language for the Multi-Agent Terminal application. All UI components must conform to these specifications.

The app supports **3 themes** switchable at runtime. All components must work correctly in every theme — never hardcode hex values, always use CSS variables.

---

## Table of Contents

1. [Theming System](#theming-system)
   - [How Themes Work](#how-themes-work)
   - [Theme: Tokyo Night (dark)](#theme-tokyo-night-dark)
   - [Theme: Grid Mint (mint)](#theme-grid-mint-mint)
   - [Theme: Dawn (light)](#theme-dawn-light)
   - [Terminal Theme (xterm)](#terminal-theme-xterm)
   - [Adding a New Theme](#adding-a-new-theme)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Borders & Radius](#borders--radius)
6. [Icons](#icons)
7. [Interactive States](#interactive-states)
8. [Component Patterns](#component-patterns)
   - [Panel](#panel)
   - [Panel Header](#panel-header)
   - [Section Header](#section-header)
   - [List Item / Row](#list-item--row)
   - [Empty State](#empty-state)
   - [Button](#button)
   - [Text Input](#text-input)
   - [Tabs](#tabs)
   - [Modal / Overlay](#modal--overlay)
   - [Context Menu](#context-menu)
   - [Resize Handle](#resize-handle)
   - [Status Badge](#status-badge)
   - [Scrollbar](#scrollbar)
8. [Layout & Structure](#layout--structure)
9. [Z-Index Scale](#z-index-scale)
10. [Dos & Don'ts](#dos--donts)

---

## Theming System

### How Themes Work

Themes are implemented via **CSS custom properties** set on `document.documentElement`. There are no Tailwind dark-mode classes, no `data-theme` attributes — just direct `style.setProperty` calls on the root element.

**Files involved:**

| File | Role |
|---|---|
| `src/lib/themes.ts` | Theme definitions + `applyTheme()` function |
| `src/index.css` | Default variable values (Tokyo Night, used as fallback) |
| `src/store/useStore.ts` | Zustand state: `theme: ThemeId`, `setTheme()` |
| `src/hooks/useTheme.ts` | React hook — watches store, calls `applyTheme()` + `applyTerminalTheme()` |
| `src/lib/ptyManager.ts` | xterm color palettes per theme, `applyTerminalTheme()` |
| `src/main.tsx` | Pre-render initialization from localStorage to avoid FOUC |
| `src/components/Settings/SettingsModal.tsx` | Theme picker UI (3 cards with live swatches) |

**Startup sequence:**

```ts
// src/main.tsx — runs before React renders
const savedTheme = (localStorage.getItem("theme") as ThemeId | null) ?? "dark";
const initialTheme = themes.find((t) => t.id === savedTheme) ?? themes[0];
applyTheme(initialTheme); // sets CSS vars immediately → no FOUC
```

**Runtime switch (user picks theme in Settings):**

```ts
// useStore.ts
setTheme: (theme) => {
  set({ theme });
  localStorage.setItem("theme", theme);
}

// useTheme.ts — reacts to store change
useEffect(() => {
  const t = themes.find((t) => t.id === currentThemeId) ?? themes[0];
  applyTheme(t);          // updates CSS vars on documentElement
  applyTerminalTheme(t);  // updates all live xterm instances
}, [currentThemeId]);
```

**`applyTheme` internals (`src/lib/themes.ts`):**

```ts
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const v = theme.vars;
  root.style.setProperty("--c-bg-deep",       v.bgDeep);
  root.style.setProperty("--c-bg",            v.bg);
  root.style.setProperty("--c-bg-elevated",   v.bgElevated);
  root.style.setProperty("--c-bg-selected",   v.bgSelected);
  root.style.setProperty("--c-bg-hover",      v.bgHover);
  root.style.setProperty("--c-drag-bg",       v.dragBg);
  root.style.setProperty("--c-border",        v.border);
  root.style.setProperty("--c-muted",         v.muted);
  root.style.setProperty("--c-text-dim",      v.textDim);
  root.style.setProperty("--c-text",          v.text);
  root.style.setProperty("--c-text-bright",   v.textBright);
  root.style.setProperty("--c-accent",        v.accent);
  root.style.setProperty("--c-accent-cyan",   v.accentCyan);
  root.style.setProperty("--c-accent-yellow", v.accentYellow);
  root.style.setProperty("--c-danger",        v.danger);
  root.style.setProperty("--c-success",       v.success);
  root.style.setProperty("--c-purple",        v.purple);
}
```

---

### Theme: Tokyo Night (`dark`)

Default theme. Dark blue-grey palette inspired by [tokyo-night](https://github.com/folke/tokyonight.nvim).

| Variable | Value | Role |
|---|---|---|
| `--c-bg-deep` | `#1a1b26` | Deepest bg: input backgrounds, modal header/footer |
| `--c-bg` | `#16161e` | App default background, active tab bg |
| `--c-bg-elevated` | `#1f2335` | Panel surfaces, elevated layers |
| `--c-bg-selected` | `#24283b` | Selected row / active list item |
| `--c-bg-hover` | `#292e42` | Hover state on rows and buttons |
| `--c-drag-bg` | `#2a3654` | Drag-over highlight on drop targets |
| `--c-border` | `#1f2335` | All 1px borders and dividers |
| `--c-muted` | `#414868` | Muted text, scrollbar track, disabled icons |
| `--c-text-dim` | `#565f89` | Labels, placeholders, secondary metadata |
| `--c-text` | `#a9b1d6` | Primary body text |
| `--c-text-bright` | `#c0caf5` | Active/highlighted text, headings |
| `--c-accent` | `#7aa2f7` | Primary accent: focus borders, active buttons |
| `--c-accent-cyan` | `#7dcfff` | Secondary accent: keywords, special highlights |
| `--c-accent-yellow` | `#e0af68` | Folder icons, dirty dot, warnings |
| `--c-danger` | `#f7768e` | Destructive actions, errors, deleted lines |
| `--c-success` | `#9ece6a` | Success state, added lines in diffs |
| `--c-purple` | `#bb9af7` | Alternative accent: types, special labels |

xterm foreground: `#a9b1d6` · cursor: `#c0caf5` · selection: `rgba(192,202,245,0.15)`

---

### Theme: Grid Mint (`mint`)

Dark monochromatic theme with a cyan-green accent. Near-black surfaces with cool grey text.

| Variable | Value | Role |
|---|---|---|
| `--c-bg-deep` | `#111111` | Deepest bg |
| `--c-bg` | `#0a0a0a` | App background |
| `--c-bg-elevated` | `#181818` | Panel surfaces |
| `--c-bg-selected` | `#202020` | Selected state |
| `--c-bg-hover` | `#252525` | Hover state |
| `--c-drag-bg` | `#2a2a2a` | Drag-over highlight |
| `--c-border` | `#1e1e1e` | Borders |
| `--c-muted` | `#333333` | Muted elements |
| `--c-text-dim` | `#555555` | Dim text |
| `--c-text` | `#888888` | Primary text |
| `--c-text-bright` | `#cccccc` | Bright text |
| `--c-accent` | `#00d4aa` | Primary accent (cyan-green) |
| `--c-accent-cyan` | `#00b8d4` | Secondary accent |
| `--c-accent-yellow` | `#d4a800` | Warnings, folder icons |
| `--c-danger` | `#d44444` | Destructive / errors |
| `--c-success` | `#00c896` | Success |
| `--c-purple` | `#9966cc` | Alternative accent |

xterm foreground: `#888888` · cursor: `#00d4aa` · selection: `rgba(0,212,170,0.15)`

---

### Theme: Dawn (`light`)

Light theme. Lavender-tinted whites with deep navy text. The only theme where the "deep" background is lighter than "bg" — contrast is inverted relative to the dark themes.

| Variable | Value | Role |
|---|---|---|
| `--c-bg-deep` | `#f5f5fa` | Deepest bg (lightest surface — inputs, modal headers) |
| `--c-bg` | `#e8e8f0` | App background |
| `--c-bg-elevated` | `#ebebf2` | Panel surfaces |
| `--c-bg-selected` | `#d8d8e8` | Selected state |
| `--c-bg-hover` | `#e0e0ec` | Hover state |
| `--c-drag-bg` | `#c8d8ff` | Drag-over highlight |
| `--c-border` | `#d0d0de` | Borders (visible against light backgrounds) |
| `--c-muted` | `#9898b8` | Muted elements |
| `--c-text-dim` | `#7070a8` | Dim text |
| `--c-text` | `#404060` | Primary text |
| `--c-text-bright` | `#1a1a3a` | Bright/heading text |
| `--c-accent` | `#3878e8` | Primary accent (blue) |
| `--c-accent-cyan` | `#0080bb` | Secondary accent |
| `--c-accent-yellow` | `#a06010` | Warnings, folder icons |
| `--c-danger` | `#d02040` | Destructive / errors |
| `--c-success` | `#1a8a30` | Success |
| `--c-purple` | `#6040cc` | Alternative accent |

xterm foreground: `#404060` · cursor: `#3878e8` · selection: `rgba(56,120,232,0.2)`

> **Light theme notes:** On Dawn, `--c-bg-deep` is the *lightest* surface (it sits inside panels and inputs, which need to stand out against the slightly darker panel body). This is the inverse of dark themes — account for this when building components that use `--c-bg-deep` for inputs inside modals.

---

### Terminal Theme (xterm)

xterm.js terminals have their own 16-color ANSI palette that must match the active app theme. Managed in `src/lib/ptyManager.ts` via the `xtermThemes` map.

Each xterm palette defines:

```ts
{
  background, foreground, cursor, cursorAccent, selectionBackground,
  // 16 ANSI colors:
  black, red, green, yellow, blue, magenta, cyan, white,
  brightBlack, brightRed, brightGreen, brightYellow,
  brightBlue, brightMagenta, brightCyan, brightWhite
}
```

When the user switches themes, `applyTerminalTheme(theme)` iterates all live terminal instances and calls `terminal.options.theme = xtermThemes[theme.id]` — terminals update instantly without restart.

---

### Adding a New Theme

1. Add a new entry to the `themes` array in `src/lib/themes.ts` with a unique `id: ThemeId`, a display `name`, and all 17 `vars` values.
2. Add a matching xterm palette to the `xtermThemes` map in `src/lib/ptyManager.ts`.
3. Update the `ThemeId` union type in `src/lib/themes.ts`.
4. The Settings UI picks up new themes automatically (it iterates `themes`).
5. Add a default fallback in `src/index.css` `:root` block only if making it the new default.

---

## Color Palette

All colors are defined as CSS custom properties. Never hardcode hex values — always reference the variable. The 17 variables below exist in **every theme** — components that use them work automatically across all 3 themes.

The table below lists all 17 variables and their **semantic role** — the actual values change per theme (see [Theming System](#theming-system) for per-theme hex values).

### Background

| Variable | Semantic Role |
|---|---|
| `--c-bg-deep` | Deepest surface: input backgrounds, modal header/footer |
| `--c-bg` | App default background, active tab background |
| `--c-bg-elevated` | Panel surfaces, cards, elevated layers |
| `--c-bg-selected` | Selected row / active list item |
| `--c-bg-hover` | Hover state on rows, buttons, and menu items |
| `--c-drag-bg` | Drag-over highlight on valid drop targets |

### Borders

| Variable | Semantic Role |
|---|---|
| `--c-border` | All 1px borders and dividers |

### Text

| Variable | Semantic Role |
|---|---|
| `--c-text-dim` | Labels, placeholders, secondary metadata |
| `--c-muted` | Muted elements, scrollbar track, disabled icons |
| `--c-text` | Primary body text |
| `--c-text-bright` | Active/highlighted text, panel headings |

### Accent

| Variable | Semantic Role |
|---|---|
| `--c-accent` | Primary accent: focus borders, active buttons, links |
| `--c-accent-cyan` | Secondary accent: keywords, special highlights |
| `--c-accent-yellow` | Folder icons, dirty-file dot, warnings |
| `--c-purple` | Alternative accent: types, special labels |

### Semantic

| Variable | Semantic Role |
|---|---|
| `--c-danger` | Destructive actions, errors, deleted diff lines |
| `--c-success` | Success state, added diff lines |

### Opacity Variants

Use Tailwind's opacity modifier syntax with variables:

```
bg-[var(--c-accent)]/10   → accent at 10% opacity (subtle highlight)
bg-[var(--c-accent)]/20   → accent at 20% opacity (button fill)
bg-[var(--c-danger)]/15   → danger at 15% opacity (destructive button fill)
```

For `color-mix` in inline styles (when Tailwind opacity modifier is insufficient):
```ts
backgroundColor: "color-mix(in srgb, var(--c-accent) 15%, transparent)"
border: "1px solid color-mix(in srgb, var(--c-accent) 30%, transparent)"
```

---

## Typography

### Font Stack

```css
/* UI (all panels, modals, buttons) */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

/* Code, paths, hashes, terminal content */
font-family: "JetBrains Mono", Menlo, monospace;
```

Use `font-mono` Tailwind class for all monospaced content.

### Size Scale

| Class | Size | Usage |
|---|---|---|
| `text-[9px]` | 9px | Status badges, git diff status letters |
| `text-[10px]` | 10px | Section headers (uppercase labels) |
| `text-[11px]` | 11px | File names, git log hashes, dense lists |
| `text-xs` | 12px | Standard UI text: list items, buttons, metadata |
| `text-sm` | 14px | Input values, modal body text, panel headers |

Do not use `text-base` or larger in panels/modals.

### Weight Scale

| Class | Weight | Usage |
|---|---|---|
| `font-normal` | 400 | Default body text |
| `font-medium` | 500 | Buttons, interactive labels |
| `font-semibold` | 600 | Panel headers, modal titles |
| `font-bold` | 700 | Status badges, git status letters |

### Letter Spacing

- `tracking-wider` / `tracking-widest` — Section header labels (10px uppercase)
- `tabular-nums` — Counters, numbers that must align

### Line Height

- `leading-tight` — Compact list items
- `leading-snug` — Standard body text
- No explicit override needed for most cases (Tailwind defaults are fine)

### Text Utilities

- `truncate` — Single-line overflow with ellipsis (file names, paths)
- `line-clamp-4` — Multi-line clamp (log messages, commit descriptions)

---

## Spacing

Base unit: **4px** (`p-1` = 4px).

### Padding Reference

| Tailwind | px | Usage |
|---|---|---|
| `p-1` / `px-1` / `py-1` | 4px | Icon-only buttons, tight chips |
| `p-2` / `px-2` / `py-2` | 8px | List item horizontal padding, section body |
| `px-3` | 12px | Editor tabs, context menu items, standard buttons |
| `px-4` | 16px | Modal header/footer, form body padding |
| `p-4` | 16px | Modal content area |
| `py-0.5` | 2px | Ultra-compact list items (file tree, log rows) |
| `py-1` | 4px | Compact rows |
| `py-1.5` | 6px | Button vertical padding, input vertical padding |
| `py-3` | 12px | Modal header/footer vertical padding |

### Gap Reference

| Tailwind | px | Usage |
|---|---|---|
| `gap-1` | 4px | Icon + label in dense rows |
| `gap-1.5` | 6px | Standard icon-label pairs |
| `gap-2` | 8px | Button groups, form fields |
| `gap-3` | 12px | Section separations inside modals |
| `gap-4` | 16px | Major form section separations |

### Panel Margins

Floating panels (Projects, Git, Explorer, Automation) sit inside their container with:
```ts
margin: 4  // 4px on all sides
borderRadius: 10
```

---

## Borders & Radius

### Border Color

Always: `border-[var(--c-border)]`

On focus/hover active elements: `border-[var(--c-accent)]`

### Border Width

Always 1px (Tailwind `border` class). Never use thicker borders.

### Border Placement

- `border-b` — Panel headers, modal headers/footers, tab bars
- `border-r` — Resize dividers, tab separators
- `border-t` — Footer sections, bottom bars

### Border Radius

| Value | Usage |
|---|---|
| `rounded` (4px) | Buttons, inputs, small chips, context menu items |
| `rounded-lg` (8px) | Standard modals (ConfirmModal) |
| `rounded-xl` (12px) | Primary modals (AutomationForm, NewProjectModal) |
| `rounded-full` | Circular badges, avatars |
| `borderRadius: 10` | Panel containers (inline style) |

---

## Icons

All icons use the `lucide-react` library.

### Size Scale

| Size | px | Usage |
|---|---|---|
| `size-3` / `w-3 h-3` | 12px | Tiny inline indicators (dirty dot Circle) |
| `size-3.5` | 14px | Small row icons, status dots |
| `size-4` / `w-4 h-4` | 16px | Standard button icons inside rows |
| `size-[13px]` | 13px | Dense list icons, context menu icons |
| `size-[14px]` | 14px | Panel header action buttons |
| `size-[15px]` | 15px | Slightly larger header icons |
| `size-[20px]` | 20px | Activity bar navigation icons |
| `size-[28px]` | 28px | Empty state illustration icons |

### Color

- Default: `text-[var(--c-text-dim)]`
- On hover: `text-[var(--c-text)]`
- Active / accent: `text-[var(--c-accent)]`
- Destructive: `text-[var(--c-danger)]`
- Folder icon: `color: var(--c-accent-yellow)` (inline style)

### Stroke Width

Default lucide stroke width (1.5) for all icons. Do not override unless specifically needed.

---

## Interactive States

### Hover

```
text:       hover:text-[var(--c-text)]
background: hover:bg-[var(--c-bg-hover)]
border:     hover:border-[var(--c-accent)]
```

### Focus

```
outline:    focus:outline-none
border:     focus:border-[var(--c-accent)]
ring:       (not used — avoid Tailwind ring utilities)
```

### Selected / Active

```
background: bg-[var(--c-bg-selected)]
text:       text-[var(--c-text-bright)]
accent:     text-[var(--c-accent)]
```

### Disabled

```
opacity:    disabled:opacity-40
cursor:     disabled:cursor-not-allowed
```

### Transitions

All interactive elements must include `transition-colors`. Use `transition-all` only when multiple properties change (e.g., size + color on hover).

---

## Component Patterns

### Panel

A resizable side panel (Projects, Git, Explorer, Automation).

```tsx
// Outer wrapper — sets panel dimensions and positioning
<div
  className="flex flex-col overflow-hidden border border-[var(--c-border)] bg-[var(--c-bg-elevated)]"
  style={{ borderRadius: 10, margin: 4 }}
>
  <PanelHeader />
  <div className="flex-1 overflow-y-auto min-h-0">
    {/* scrollable content */}
  </div>
</div>
```

**Rules:**
- Always `overflow: hidden` on the outer container
- Inner scroll area: `flex-1 overflow-y-auto min-h-0`
- Background: `--c-bg-elevated` for the panel surface

---

### Panel Header

Every panel has a 32px tall header with a title and optional action buttons.

```tsx
<div className="h-8 flex items-center justify-between px-2 border-b border-[var(--c-border)] flex-shrink-0">
  <span className="text-xs font-semibold text-[var(--c-text-bright)] uppercase tracking-wider">
    Panel Title
  </span>
  <div className="flex items-center gap-1">
    {/* icon action buttons */}
    <button className="p-1 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-hover)] transition-colors">
      <PlusIcon size={14} />
    </button>
  </div>
</div>
```

**Rules:**
- Height: always `h-8` (32px), `flex-shrink-0`
- Title: `text-xs font-semibold text-[var(--c-text-bright)]`
- Title casing: sentence case or title case — no uppercase unless it's a section header label
- Divider: `border-b border-[var(--c-border)]`
- Action icon size: 13–15px
- Action button padding: `p-1`

---

### Section Header

A label inside a panel body that groups content beneath it.

```tsx
<div className="px-2 py-1 flex items-center gap-1">
  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--c-text-dim)]">
    Section Name
  </span>
</div>
```

**Rules:**
- Font: `text-[10px] font-semibold uppercase tracking-widest`
- Color: `text-[var(--c-text-dim)]`
- Padding: `px-2 py-1`
- Optional collapse chevron: 12px icon, same color

---

### List Item / Row

Standard selectable row in any list (file, agent, branch, log entry).

```tsx
<div
  className={`
    flex items-center gap-1.5 px-2 py-0.5 text-xs cursor-pointer
    transition-colors rounded
    ${selected
      ? "bg-[var(--c-bg-selected)] text-[var(--c-text-bright)]"
      : "text-[var(--c-text)] hover:bg-[var(--c-bg-hover)]"}
  `}
>
  <Icon size={13} className="flex-shrink-0 text-[var(--c-text-dim)]" />
  <span className="flex-1 truncate">{label}</span>
  <span className="text-[var(--c-text-dim)]">{meta}</span>
</div>
```

**Rules:**
- Font: `text-xs`
- Horizontal padding: `px-2`
- Vertical padding: `py-0.5` (ultra-compact) or `py-1` (standard)
- Gap between icon and label: `gap-1.5`
- Label: `flex-1 truncate` to prevent overflow
- Icon: `flex-shrink-0`, 13px
- Never use `py-2` or larger — it breaks visual density

---

### Empty State

Shown when a panel has no content yet.

```tsx
<div className="flex flex-col items-center justify-center flex-1 gap-2 text-[var(--c-text-dim)]">
  <Icon size={28} strokeWidth={1} />
  <span className="text-xs">No items yet</span>
</div>
```

**Rules:**
- Icon: 28px, `strokeWidth={1}` (lighter visual weight)
- Label: `text-xs text-[var(--c-text-dim)]`
- Layout: centered column, `gap-2`
- No action buttons in empty state unless onboarding requires it

---

### Button

Two distinct accent button variants exist — use them in the right context.

#### Primary Solid — Modal footer CTA (Save / Create / Push / Done)

```tsx
<button className="flex-1 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
  Save
</button>
```

#### Primary Soft — Small panel actions, ConfirmModal confirm button

```tsx
<button className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
  Confirm
</button>
```

#### Secondary (Ghost) — Cancel in modal footer

```tsx
<button className="flex-1 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors">
  Cancel
</button>
```

#### Danger

```tsx
<button className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--c-danger)]/15 text-[var(--c-danger)] hover:bg-[var(--c-danger)]/25 transition-colors">
  Delete
</button>
```

#### Icon-Only

```tsx
<button className="p-1 rounded text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-hover)] transition-colors">
  <Icon size={14} />
</button>
```

#### Segmented / Toggle Group

```tsx
<div className="flex rounded border border-[var(--c-border)] overflow-hidden">
  {options.map(opt => (
    <button
      key={opt.value}
      className={`flex-1 py-1 text-xs transition-colors ${
        active === opt.value
          ? "bg-[var(--c-accent)] text-[var(--c-bg-deep)] font-medium"
          : "text-[var(--c-text-dim)] hover:bg-[var(--c-bg-hover)]"
      }`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

**Rules:**
- All buttons: `rounded`, always include a transition class
- Modal footer primary: `flex-1 py-1.5 text-sm` + **solid** `bg-[var(--c-accent)] text-[var(--c-bg-deep)]` + `hover:opacity-90 transition-opacity`
- Small panel primary: `px-3 py-1.5 text-xs` + **soft** `bg-[var(--c-accent)]/20 text-[var(--c-accent)]` + `transition-colors`
- Modal footer cancel: `flex-1 py-1.5 text-sm` + border ghost style
- Icon-only: `p-1`, no label, `hover:bg-[var(--c-bg-hover)]`
- `text-[var(--c-bg-deep)]` instead of `text-white` on solid buttons — works correctly in all 3 themes

---

### Text Input

```tsx
<input
  className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
/>
```

#### Textarea

```tsx
<textarea
  className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] transition-colors resize-none"
  rows={3}
/>
```

#### Select / Dropdown

```tsx
<select className="w-full bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-[var(--c-text)] focus:outline-none focus:border-[var(--c-accent)] transition-colors appearance-none">
```

**Rules:**
- Background: always `--c-bg-deep` (darker than panel surface)
- Border: `--c-border`, accent on focus
- Padding: `px-2 py-1.5`
- Font: `text-sm`
- Placeholder: `--c-text-dim`
- `resize-none` on textareas unless content demands resize

#### Form Field Wrapper

```tsx
<div className="flex flex-col gap-1">
  <label className="text-xs text-[var(--c-text-dim)]">Field Label</label>
  <input ... />
</div>
```

Label: `text-xs text-[var(--c-text-dim)]`, no bold, no uppercase.

---

### Tabs

#### Agent / Page Tabs (TabBar)

```tsx
// Tab item
<div className={`
  flex items-center gap-1 px-3 h-full border-r border-[var(--c-border)] cursor-pointer flex-shrink-0
  text-xs transition-colors
  ${active
    ? "bg-[var(--c-bg)] text-[var(--c-text-bright)]"
    : "bg-transparent text-[var(--c-text-dim)] hover:bg-[var(--c-bg-elevated)]"}
`}>
  <span className="truncate max-w-[120px]">{label}</span>
</div>
```

**Rules:**
- Tab bar height: `h-8` (32px)
- Tab bar background: `bg-[var(--c-bg-deep)]`
- Active tab: `bg-[var(--c-bg)]` (lifted to app background color)
- Separator: `border-r border-[var(--c-border)]`
- Tab overflow: `overflow-x-auto scrollbar-none`

---

### Modal / Overlay

#### Overlay Backdrop

```tsx
<div
  className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60"
  onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  {/* modal body */}
</div>
```

Use `onMouseDown` with `e.target === e.currentTarget` (not `onClick`) to close on backdrop click — prevents accidental close when releasing a drag that started inside the modal.

#### Standard Modal (ConfirmModal style)

For simple confirmations and alerts. No header/footer separator bg, compact width.

```tsx
<div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg shadow-2xl p-5 w-80 flex flex-col gap-4">
  <div className="flex flex-col gap-1">
    <span className="text-sm font-semibold text-[var(--c-text-bright)]">{title}</span>
    <span className="text-xs text-[var(--c-text)] leading-relaxed">{message}</span>
  </div>
  <div className="flex justify-end gap-2">
    <button className="px-3 py-1.5 text-xs rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-hover)] transition-colors">
      Cancel
    </button>
    <button className="px-3 py-1.5 text-xs rounded bg-[var(--c-accent)]/20 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/30 transition-colors">
      Confirm
    </button>
  </div>
</div>
```

#### Form Modal (AutomationForm / NewProjectModal style)

For data entry forms with multiple fields. Header and footer **share the same background** as the body (`--c-bg`) — no darker bg-deep band.

```tsx
<div className="w-[420px] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
  {/* Header — same bg as body, no extra background class */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
    <span className="text-sm font-medium text-[var(--c-text)]">Modal Title</span>
    <button className="text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors">
      <X size={16} />
    </button>
  </div>

  {/* Body */}
  <div className="p-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>
    {/* form fields */}
  </div>

  {/* Footer — same bg as body, full-width buttons */}
  <div className="flex gap-2 px-4 py-3 border-t border-[var(--c-border)]">
    <button className="flex-1 py-1.5 text-sm rounded border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors">
      Cancel
    </button>
    <button className="flex-1 py-1.5 text-sm rounded font-medium bg-[var(--c-accent)] text-[var(--c-bg-deep)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
      Save
    </button>
  </div>
</div>
```

**Rules:**
- Simple modal width: `w-80` (320px), form modal width: `w-[420px]`
- Simple modal: `rounded-lg` + `p-5`, form modal: `rounded-xl` + `flex flex-col overflow-hidden`
- **Header and footer have NO extra background** — they inherit `bg-[var(--c-bg)]` from the container
- Header title: `text-sm font-medium text-[var(--c-text)]` (not bright, not semibold)
- Close button: `text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors` with `<X size={16} />` — no padding wrapper, no hover bg
- Body max height: `maxHeight: "70vh"` with `overflow-y-auto`
- Footer buttons: `flex gap-2` with `flex-1` on both — full-width side by side
- Primary button: **solid** `bg-[var(--c-accent)] text-[var(--c-bg-deep)]` with `hover:opacity-90 transition-opacity`
- Cancel button: ghost with border, `text-[var(--c-text-dim)]`
- Always `shadow-2xl`
- Always `ReactDOM.createPortal(..., document.body)` at `z-[500]`
- Backdrop: `bg-black/60` class, close on `onMouseDown` with currentTarget check

---

### Context Menu

```tsx
// Rendered via ReactDOM.createPortal
<div
  className="fixed z-[9999] bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded shadow-lg py-1"
  style={{ minWidth: 160, top, left }}
>
  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--c-text)] hover:bg-[var(--c-bg-hover)] transition-colors">
    <Icon size={13} className="flex-shrink-0 opacity-70" />
    Item Label
  </button>

  {/* Separator */}
  <div className="my-1 border-t border-[var(--c-border)]" />

  {/* Danger item */}
  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--c-danger)] hover:bg-[var(--c-bg-hover)] transition-colors">
    <Trash2 size={13} className="flex-shrink-0 opacity-70" />
    Delete
  </button>
</div>
```

**Rules:**
- `position: fixed`, `z-index: 9999`
- Background: `--c-bg-elevated`, border: `--c-border`
- `rounded` (4px), `shadow-lg`, `py-1`
- Min width: 160px
- Item padding: `px-3 py-1.5`
- Item font: `text-xs`
- Icon size: 13px, `opacity-70`
- Close on outside click (capture phase) and Escape key

---

### Resize Handle

Horizontal (between panels, left-right resize):

```tsx
<div
  className="w-[6px] cursor-ew-resize flex-shrink-0 hover:bg-[var(--c-accent)]/20 transition-colors"
  onMouseDown={startResize}
/>
```

Vertical (between editor and terminal, top-bottom resize):

```tsx
<div
  className="h-[6px] cursor-ns-resize flex-shrink-0 hover:bg-[var(--c-accent)]/20 transition-colors"
  onMouseDown={startResize}
/>
```

**Rules:**
- Width/height: 6px
- Cursor: `ew-resize` or `ns-resize`
- Hover: `--c-accent` at 20% opacity
- No visible color at rest — only shows on hover

---

### Status Badge

Small inline chip for agent status, file change type, branch state.

```tsx
// Success / active
<span className="text-[9px] font-bold text-[var(--c-success)]">A</span>

// Warning / modified
<span className="text-[9px] font-bold text-[var(--c-accent-yellow)]">M</span>

// Danger / deleted
<span className="text-[9px] font-bold text-[var(--c-danger)]">D</span>

// Muted / waiting
<span className="text-[9px] font-bold text-[var(--c-muted)]">?</span>
```

For pill-style badges:

```tsx
<span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--c-accent)]/15 text-[var(--c-accent)]">
  active
</span>
```

---

### Scrollbar

All non-terminal scrollbars use the global styles from `src/index.css`:

```css
* {
  scrollbar-color: var(--c-muted) var(--c-bg);
  scrollbar-width: thin;  /* 6px effective width */
}
```

For elements that must hide their scrollbar entirely:

```tsx
className="scrollbar-none overflow-x-auto"
```

Terminal panes use a **custom React scrollbar** (direct DOM refs, no React state) — do not apply custom scrollbar logic outside the terminal.

---

## Layout & Structure

```
App (full screen)
├── ActivityBar          w-12 (48px), flex-shrink-0, h-full
├── FileExplorer         resizable, default 230px, min 160px
└── MainArea             flex-1
    ├── TabBar            h-8 (32px), flex-shrink-0
    ├── TerminalArea      flex-1
    ├── EditorPane        resizable height
    └── BottomPanel       resizable height, default 0 when closed
```

### Fixed Heights

| Element | Height |
|---|---|
| All panel headers | 32px (`h-8`) |
| All tab bars | 32px (`h-8`) |
| Activity bar buttons | 36px (`h-9 w-9`) |
| Activity bar | full height, 48px wide |
| Resize handles | 6px |

### Panel Constraints

| Panel | Default | Min |
|---|---|---|
| FileExplorer width | 230px | 160px |
| BottomPanel height | 220px | 80px |
| EditorPane height | dynamic | 80px |

---

## Z-Index Scale

| Level | Value | Usage |
|---|---|---|
| Resize handles | `z-10` | Above sibling content |
| Panel overlays | `z-[200]` | Usage tooltip portal |
| Modals / overlays | `z-50` | ConfirmModal, form modals |
| Fullscreen terminal | `z-50` | CSS position:fixed |
| Fullscreen editor | `z-50` | Portal to body |
| Context menus | `z-[9999]` | Always on top |

---

## Dos & Don'ts

### Do

- Use CSS variables (`var(--c-*)`) for all colors
- Apply `transition-colors` to every interactive element
- Use `flex-shrink-0` on headers and fixed-size elements
- Add `min-h-0` to flex containers that need inner scroll
- Use `truncate` on any text that might overflow
- Render modals and context menus via `ReactDOM.createPortal` to `document.body`
- Keep panel headers exactly 32px tall
- Use lucide-react for all icons with consistent sizing

### Don't

- Hardcode hex color values anywhere in component files
- Use `text-base` or larger in UI panels
- Use Tailwind `ring-*` utilities (not part of this design language)
- Use `display: none` on terminal-containing elements (use `visibility: hidden` or `height: 0`)
- Use `font-bold` for body text (reserved for status badges and git letters)
- Use `rounded-2xl` or larger (max is `rounded-xl`)
- Add `overflow: hidden` to flex containers that need inner scrolling without also adding `min-h-0`
- Use HTML5 drag-and-drop API (use mouse events — HTML5 DnD is unreliable in WKWebView)
