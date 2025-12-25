# CCP Design System

## Overview

Claude Control Panel uses a **terminal-inspired dark UI** with a carefully curated color palette and typography. The design prioritizes readability, minimal visual noise, and a professional "command center" aesthetic.

---

## Color Palette

All colors are defined as CSS variables in `web/src/index.css`:

```css
:root {
  /* Backgrounds (darkest to lightest) */
  --void-deep: #0a0b0d;      /* Main background */
  --void-surface: #0f1012;   /* Sidebars, cards */
  --void-elevated: #151719;  /* Hover states, elevated surfaces */
  --void-border: #1e2024;    /* Borders, dividers */

  /* Accent (Orange/Amber) */
  --accent: #f59e0b;         /* Primary accent - buttons, active states */
  --accent-dim: #d97706;     /* Darker accent variant */
  --amber: #f59e0b;          /* Alias for accent */
  --amber-dim: #92400e;      /* Very dark amber */

  /* Semantic Colors */
  --red: #ef4444;            /* Errors */
  --yellow: #eab308;         /* Warnings */
  --green: #22c55e;          /* Success, online status */

  /* Text */
  --text: #e5e5e5;           /* Primary text */
  --text-dim: #71717a;       /* Secondary text, labels */
  --text-muted: #3f3f46;     /* Disabled, hints */
}
```

### Usage Guidelines

| Element | Color |
|---------|-------|
| Page background | `--void-deep` |
| Sidebar/panel background | `--void-surface` |
| Hover states | `--void-elevated` |
| All borders | `--void-border` |
| Primary actions, active tabs | `--accent` |
| User messages accent | `--accent` (left border) |
| Status indicators | `--green` (online), `--red` (error) |
| Body text | `--text` |
| Labels, secondary info | `--text-dim` |
| Placeholders, disabled | `--text-muted` |

---

## Typography

### Font Stack

```css
font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
```

- **JetBrains Mono** is loaded from Google Fonts in `index.html`
- Monospace throughout for terminal aesthetic
- No sans-serif fonts used

### Font Sizes

| Element | Size |
|---------|------|
| Body text | `14px` |
| Mobile body | `15-16px` |
| Section titles | `11-12px` (uppercase, letter-spacing) |
| Small labels/badges | `10-11px` |
| Code blocks | `12-13px` |

### Font Weights

- `400` - Normal text
- `500` - Emphasis, commands
- `600` - Headers, titles

---

## Layout Structure

### Desktop (3-column)

```
┌──────────┬────────────────────────────┬──────────┐
│          │                            │          │
│ Sidebar  │        Main Area           │  Right   │
│  280px   │       (flexible)           │ Sidebar  │
│          │                            │  300px   │
└──────────┴────────────────────────────┴──────────┘
```

### Mobile (bottom nav)

```
┌────────────────────────────────┐
│ Header (agent + status)        │
├────────────────────────────────┤
│                                │
│ Active View (Chat or Files)    │
│                                │
├────────────────────────────────┤
│ Input (chat only)              │
├────────────────────────────────┤
│ [Chat]  [Files]  [More]        │
└────────────────────────────────┘
```

### Breakpoints

```css
@media (max-width: 1200px)  /* Right sidebar narrows */
@media (max-width: 1024px)  /* Right sidebar becomes drawer */
@media (max-width: 768px)   /* Full mobile layout */
```

---

## Component Patterns

### Buttons

**Primary Action Button:**
```css
.button-primary {
  background: var(--accent);
  color: var(--void-deep);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
}
```

**Ghost/Subtle Button:**
```css
.button-ghost {
  background: transparent;
  color: var(--text-dim);
  border: 1px solid var(--void-border);
}
.button-ghost:hover {
  background: var(--void-elevated);
  color: var(--text);
}
```

### Cards/Panels

```css
.card {
  background: var(--void-surface);
  border: 1px solid var(--void-border);
  border-radius: 6px;
}
```

### Active/Selected State

```css
.item.active {
  color: var(--accent);
  background: var(--void-elevated);
  border-left: 3px solid var(--accent);
}
```

### Status Indicators

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot.online {
  background: var(--green);
  box-shadow: 0 0 6px var(--green); /* Glow effect */
}
```

---

## Mobile-Specific Patterns

### Touch Targets

All interactive elements must be **minimum 44px** height:

```css
.sidebar-item,
.file-item,
.quick-menu-item {
  min-height: 44px;
}
```

### Bottom Navigation

```css
.mobile-nav {
  height: 60px;
  background: #050505; /* Slightly darker than --void-deep */
  border-top: 1px solid var(--void-border);
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Bottom Sheet (Quick Menu)

```css
.quick-menu {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  max-height: 70vh;
}
```

---

## Iconography

All icons are inline SVGs in `web/src/components/Icons.tsx`.

**Standard icon size:** `16x16` or `20x20`

**Icon style:**
- Stroke-based (not filled)
- `strokeWidth: 2`
- `fill: none`
- `stroke: currentColor` (inherits text color)

### Adding New Icons

```tsx
export const NewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="..." />
  </svg>
);
```

---

## Message Styling

### User Messages

```css
.message-block.user-message {
  border-left: 3px solid var(--accent);
  padding-left: 16px;
  margin-top: 28px;
}
```

### Assistant Messages

```css
.message-block.assistant-message {
  padding-left: 16px;
  /* No border - clean look */
}
```

### Tool Blocks

```css
.tool-block {
  border: 1px solid var(--void-border);
  border-radius: 6px;
}
.tool-block.error {
  border-color: var(--red);
}
```

---

## Animation Guidelines

**Transitions:**
- Duration: `0.15s` for micro-interactions
- Duration: `0.3s` for panel slides
- Easing: `ease` for most, `ease-out` for entrances

**Examples:**
```css
/* Hover transitions */
transition: all 0.15s;

/* Panel slides */
transition: transform 0.3s ease;

/* Opacity fades */
transition: opacity 0.2s ease;
```

**Avoid:**
- Bouncy/spring animations
- Delays on hover states
- Animations longer than 0.3s

---

## File Structure

```
web/src/
├── index.css              # All styles (single file)
├── components/
│   ├── Icons.tsx          # All SVG icons
│   ├── Terminal/          # Chat/terminal components
│   ├── Sidebar/           # Left sidebar (desktop)
│   ├── RightSidebar/      # Context panel (desktop)
│   ├── MobileNav/         # Bottom navigation
│   ├── QuickMenu/         # Bottom sheet menu
│   ├── FilesView/         # Workspace file browser
│   ├── MobileHeader.tsx   # Mobile top bar
│   ├── TabBar.tsx         # Desktop tab bar
│   └── WarningBanner.tsx  # Token warning
└── App.tsx                # Main layout logic
```

---

## Key Design Principles

1. **Terminal First** - Everything should feel like a command center
2. **Minimal Chrome** - Let content breathe, avoid unnecessary borders/shadows
3. **Orange Accent Only** - Single accent color for focus and actions
4. **Monospace Everything** - Consistent terminal typography
5. **Dark by Default** - No light mode (terminal aesthetic)
6. **Touch-Friendly Mobile** - 44px targets, bottom nav, thumb-reachable actions
