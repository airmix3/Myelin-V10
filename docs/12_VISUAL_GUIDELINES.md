# 12 -- Visual Guidelines (CSS Reference for the Developer)

This document defines the exact visual language for the Cortex UI. It is extracted from the working v3 CSS and templates. **Copy these values directly -- do not improvise colors, fonts, or spacing.**

This doc covers ONLY visual style. For page layouts, component behavior, and architecture, see Docs 05/06/07.

**Canonical rule**: if any other doc re-lists visual tokens or component styles and disagrees with this file, this file wins.

---

## Design Philosophy

The Cortex looks like a **developer tool / terminal dashboard** -- dark background, monospace font, accent-colored highlights, information-dense. Think: VS Code dark theme meets a Bloomberg terminal.

Rules:
- No gradients on panels
- No box shadows (except subtle hover states)
- No rounded corners beyond 4px (badges excepted at 10px)
- No Tailwind, no Bootstrap, no CSS frameworks
- Single CSS file: `public/cortex.css`
- Monospace everywhere -- headings, body, inputs, buttons

---

## CSS Variables (Copy Verbatim)

```css
:root {
  /* Backgrounds: darkest to lightest */
  --bg:         #1a1a2e;    /* Page background -- very dark navy */
  --bg-2:       #16213e;    /* Cards, panels, sidebar -- slightly lighter */
  --bg-3:       #0f3460;    /* Input fields, deep buttons, elevated -- deep blue */

  /* Borders */
  --border:     #2a2a4a;    /* ALL borders everywhere -- dark purple-gray */

  /* Text */
  --text:       #e0e0e0;    /* Primary text */
  --text-dim:   #a0a0b0;    /* Secondary / muted text */

  /* Accent */
  --accent:     #e94560;    /* Primary accent -- coral red */
  --accent-dim: #c73652;    /* Accent hover / pressed state */

  /* Semantic colors */
  --green:      #00d68f;    /* Success, approved, active, completion */
  --amber:      #ffb347;    /* Warning, pending, in-progress */
  --red:        #e94560;    /* Error, rejected, cancel (same as accent) */
  --gray:       #666;       /* Disabled, inactive */

  /* Typography */
  --font:       'JetBrains Mono', 'Fira Code', 'Monaco', 'Courier New', monospace;
  --radius:     4px;        /* Border radius for ALL rectangular elements */
}
```

---

## Typography

| Element | Size | Weight | Color | Extra |
|---------|------|--------|-------|-------|
| Body text | 13px | normal | `--text` | line-height: 1.5 |
| Page heading (h1) | 16px | bold | `--text` | -- |
| Card title | 11px | bold | `--accent` | uppercase, letter-spacing: 0.1em |
| Section subtitle | 13px | bold | `--text-dim` | uppercase, letter-spacing: 0.05em |
| Chat message | 13px | normal | `--text` | line-height: 1.6 |
| Chat timestamp | 9px | normal | `--text-dim` | -- |
| Badge text | 10px | bold | varies | uppercase, letter-spacing: 0.05em |
| Button text | 12px | normal | `--text` | -- |
| Code / mono inline | 12px | normal | `#6496ff` | bg: rgba(0,0,0,0.4), padding: 1px 5px |
| Stat value | 24px | bold | `--accent` | -- |
| Stat label | 10px | normal | `--text-dim` | uppercase |
| Nav link | 13px | normal | `--text-dim` | active: `--text` |
| Sidebar logo | 15px | bold | `--accent` | -- |
| Sidebar version | 11px | normal | `--text-dim` | -- |

**Font loading**: JetBrains Mono from system font stack. No Google Fonts CDN. Fallback chain: `'JetBrains Mono', 'Fira Code', 'Monaco', 'Courier New', monospace`.

---

## Department Colors

These colors are used consistently for: badges, avatar circles, card top-borders, chart nodes, and chat bubbles.

| Department | Hex | RGB for rgba() | Usage |
|-----------|-----|-----------------|-------|
| Tech (CTO) | `#6496ff` | 100, 150, 255 | Blue |
| Marketing (CMO) | `#ff64c8` | 255, 100, 200 | Pink |
| Operations (COO) | `#64c864` | 100, 200, 100 | Green |
| Executive / Tamir | `#e94560` | 233, 69, 96 | Accent red |
| CEO (Omer) | `--bg-3` | -- | Gray / dark blue |

---

## Agent Avatars

Circular, 30px in chat (28px in workspace), colored by department. White single-letter initial. Used in chat, participants bar, org context.

```css
.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: bold; color: white; flex-shrink: 0;
}
/* Colors set inline via style="background: #6496ff" etc. */
```

| Agent | Letter | Background |
|-------|--------|------------|
| Tamir | T | `var(--accent)` / `#e94560` |
| CTO | C | `#6496ff` |
| CMO | C | `#ff64c8` |
| COO | C | `#64c864` |
| CEO | O | `var(--bg-3)` with `color: var(--text)` |

---

## Badge System

All badges: `display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 10px; uppercase`.

```css
/* Department badges -- 15% opacity background, full color text */
.badge-tech       { background: rgba(100,150,255,0.15); color: #6496ff; }
.badge-marketing  { background: rgba(255,100,200,0.15); color: #ff64c8; }
.badge-ops        { background: rgba(100,200,100,0.15); color: #64c864; }

/* Status badges -- include 1px border at 30% opacity */
.badge-active     { background: rgba(0,214,143,0.15); color: var(--green);  border: 1px solid rgba(0,214,143,0.3); }
.badge-pending    { background: rgba(255,179,71,0.15); color: var(--amber); border: 1px solid rgba(255,179,71,0.3); }
.badge-error      { background: rgba(233,69,96,0.15);  color: var(--red);   border: 1px solid rgba(233,69,96,0.3); }
.badge-done       { background: rgba(0,214,143,0.1);   color: var(--text-dim); }
```

---

## Buttons

```css
/* Default button */
.btn {
  padding: 5px 12px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-3); color: var(--text); cursor: pointer;
  font-family: var(--font); font-size: 12px;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }

/* Accent button (primary action) */
.btn-accent { background: var(--accent); border-color: var(--accent); color: white; }
.btn-accent:hover { background: var(--accent-dim); }

/* Small variant */
.btn-sm { padding: 3px 8px; font-size: 11px; }

/* Approve button (green) */
.btn-approve { background: var(--green); border: none; color: #111; font-weight: bold; }
.btn-approve:hover { opacity: 0.85; }

/* Cancel / destructive */
.btn-cancel { background: none; border: 1px solid var(--border); color: var(--text-dim); }
.btn-cancel:hover { border-color: var(--red); color: var(--red); }

/* Disabled */
.btn:disabled, button:disabled { opacity: 0.4; cursor: not-allowed; }
```

---

## Cards & Panels

```css
.card {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);    /* 4px */
  padding: 16px;
  margin-bottom: 16px;
}
.card-title {
  font-size: 11px; color: var(--accent);
  text-transform: uppercase; letter-spacing: 0.1em;
  margin-bottom: 12px; padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
```

**Agent cards** (org context) get a 3px colored top-border by department:
```css
.agent-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
}
.agent-card.tech::before      { background: #6496ff; }
.agent-card.marketing::before { background: #ff64c8; }
.agent-card.operations::before { background: #64c864; }
.agent-card.exec::before      { background: var(--accent); }
```

---

## Chat Bubbles

```css
/* Agent message: dark bg, subtle border, sharp top-left corner */
.msg.agent .bubble {
  background: var(--bg-2); border: 1px solid var(--border);
  border-radius: 2px 12px 12px 12px;
  padding: 10px 14px; font-size: 13px; line-height: 1.6;
}

/* User message: accent bg, white text, sharp bottom-right corner */
.msg.user .bubble {
  background: var(--accent); color: white;
  border-radius: 12px 12px 2px 12px;
  padding: 10px 14px; font-size: 13px; line-height: 1.6;
}

/* Workspace chat (smaller) */
.ws-bubble { padding: 8px 12px; font-size: 12px; line-height: 1.5; }
```

Messages animate in with a subtle fade-up:
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.msg { animation: fadeUp 0.2s ease; }
```

---

## Chat Input Area

```css
.input-area {
  padding: 14px; border-top: 1px solid var(--border);
  display: flex; gap: 10px; align-items: flex-end;
  background: var(--bg-2);
}
textarea.chat-input {
  flex: 1; background: var(--bg-3); border: 1px solid var(--border);
  color: var(--text); padding: 12px 14px; border-radius: 8px;
  font-family: var(--font); font-size: 13px; resize: none;
  min-height: 44px; max-height: 120px; outline: none;
}
textarea.chat-input:focus { border-color: var(--accent); }
.send-btn {
  background: var(--accent); border: none; color: white;
  padding: 12px 18px; border-radius: 8px; cursor: pointer;
  font-family: var(--font); font-size: 13px;
}
.send-btn:hover { background: var(--accent-dim); }
```

---

## Markdown Rendering (.md-render)

Applied to agent chat bubbles, deliverable content, knowledge previews, plan canvas.

```css
.md-render { line-height: 1.7; font-size: 13px; color: var(--text); }
.md-render h1 { font-size: 18px; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.md-render h2 { font-size: 15px; color: var(--accent); margin: 18px 0 10px; }
.md-render h3 { font-size: 13px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
.md-render code { background: rgba(0,0,0,0.4); padding: 1px 5px; border-radius: 2px; font-size: 12px; color: #6496ff; }
.md-render pre { background: rgba(0,0,0,0.5); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
.md-render pre code { background: none; padding: 0; color: var(--text); }
.md-render table { width: 100%; border-collapse: collapse; font-size: 12px; }
.md-render th { background: rgba(233,69,96,0.1); color: var(--accent); padding: 7px 10px; border: 1px solid var(--border); }
.md-render td { padding: 6px 10px; border: 1px solid var(--border); }
.md-render blockquote { border-left: 3px solid var(--accent); padding-left: 12px; color: var(--text-dim); }
.md-render a { color: var(--accent); }
.md-render img { max-width: 100%; border: 1px solid var(--border); border-radius: var(--radius); }
.md-render strong { color: var(--text); }
```

---

## Build Log Entries

Claude Code-style expandable log lines:

```css
.log-entry { border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; }
.log-entry-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; cursor: pointer; font-size: 11px; background: var(--bg-2);
}
.log-entry-header:hover { background: rgba(233,69,96,0.04); }
.log-entry-body {
  display: none; padding: 10px 12px; font-size: 11px; color: var(--text-dim);
  border-top: 1px solid var(--border); background: rgba(0,0,0,0.2);
  white-space: pre-wrap; max-height: 300px; overflow-y: auto;
}
.log-entry.open .log-entry-body { display: block; }
```

**Type badge colors** (inside log entries):

| Type | CSS | Background | Text |
|------|-----|-----------|------|
| THINK | `.log-type-think` | rgba(233,69,96,0.15) | `--accent` |
| TOOL_CALL | `.log-type-tool` | rgba(255,179,71,0.15) | `--amber` |
| SKILL_USED | `.log-type-skill` | rgba(100,150,255,0.15) | `#6496ff` |
| ROUTE | `.log-type-route` | rgba(0,214,143,0.15) | `--green` |
| COMPLETE | `.log-type-complete` | rgba(0,214,143,0.25) | `--green` |

---

## Tables

```css
table { width: 100%; border-collapse: collapse; }
th {
  text-align: left; padding: 6px 10px; color: var(--accent);
  font-size: 11px; text-transform: uppercase;
  border-bottom: 1px solid var(--border);
}
td { padding: 7px 10px; border-bottom: 1px solid rgba(42,42,74,0.6); }
tr:hover td { background: rgba(233,69,96,0.04); }
```

---

## Status Dots

```css
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dot-green { background: var(--green); }
.dot-amber { background: var(--amber); }
.dot-red   { background: var(--red); }
.dot-gray  { background: var(--gray); }
```

---

## Form Inputs

```css
/* Text input / search bar */
input[type="text"], input[type="number"], .search-bar {
  background: var(--bg-3); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 8px 12px;
  color: var(--text); font-family: var(--font); font-size: 13px; outline: none;
}
input:focus, .search-bar:focus { border-color: var(--accent); }

/* Range slider */
input[type="range"] {
  -webkit-appearance: none; height: 4px;
  background: var(--border); border-radius: 2px; outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
  background: var(--accent); cursor: pointer; border: 2px solid var(--bg);
}

/* Checkbox */
input[type="checkbox"] { accent-color: var(--accent); }
```

---

## Gallery Cards (VS Code Extension Style)

Used in plan mode tool/skill selector and Org Context skill browser.

```css
.gallery-card {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px; cursor: pointer;
}
.gallery-card:hover { border-color: var(--accent); background: rgba(233,69,96,0.04); }
.gallery-card.selected { border-color: var(--green); background: rgba(0,214,143,0.06); }
.gallery-card.other-dept { opacity: 0.5; }

.gallery-card-icon {
  width: 32px; height: 32px; border-radius: 6px;
  background: var(--bg-3); display: flex; align-items: center; justify-content: center;
  font-size: 16px; margin-bottom: 8px;
}
.gallery-card-name { font-size: 12px; font-weight: bold; color: var(--text); }
.gallery-card-desc { font-size: 10px; color: var(--text-dim); line-height: 1.4; }
```

Grid: `repeat(auto-fill, minmax(190px, 1fr))`, gap 10px, max-height 300px with overflow scroll.

---

## Tabs

```css
.tab-bar { display: flex; gap: 0; border-bottom: 1px solid var(--border); }
.tab {
  padding: 8px 18px; font-size: 11px; cursor: pointer;
  border: none; background: none; color: var(--text-dim);
  font-family: var(--font); border-bottom: 2px solid transparent;
}
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab:hover { color: var(--text); }
```

---

## Scrollbars

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bg-3); }
```

---

## Sidebar Nav Icons

Unicode symbols as nav icons -- no image assets needed:

| Page | Symbol | Char |
|------|--------|------|
| Dashboard | ▣ | U+25A3 |
| Tamir | ◐ | U+25D0 |
| Deliverables | ◎ | U+25CE |
| Org Context | ◆ | U+25C6 |
| Vault | ⬡ | U+2B21 |

---

## Animations

Only two animations in the entire system:

1. **Chat fade-up** (messages entering): `fadeUp 0.2s ease`
2. **Typewriter cursor blink** (plan canvas): `blink 0.6s infinite`

```css
@keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
@keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
```

No other transitions beyond `transition: all 0.15s` on hover states for buttons, nav links, and cards.

---

## Mobile

Not a priority (single-user localhost), but basic fallback:

```css
@media (max-width: 768px) {
  .sidebar { display: none; }
  .grid-3, .grid-2 { grid-template-columns: 1fr; }
  .stat-row { flex-direction: column; }
}
```
