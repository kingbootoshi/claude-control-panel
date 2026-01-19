# Ghost Control Panel - Design Guide

## Design Philosophy

### Core Principles

1. **Terminal is THE Interface**
   - Everything happens through conversation
   - UI provides context, not control
   - Talk to navigate, not click
   - Commands over menus

2. **Progressive Disclosure**
   - Show what's needed, hide what's not
   - Expand on demand
   - Never overwhelm
   - Context appears when relevant

3. **Void Aesthetic**
   - Deep blacks, not grays
   - Amber accents for focus
   - Monospace everything
   - No decoration without purpose

4. **Exclusive Feel**
   - This is a control center, not a chat app
   - Futuristic but functional
   - Power user focused
   - Every pixel intentional

---

## Color System

### Void Theme Palette

```css
:root {
  /* Backgrounds - True blacks with subtle variation */
  --void-deep: #0a0b0d;      /* Main background, deepest black */
  --void-surface: #0f1012;   /* Panel backgrounds, cards */
  --void-elevated: #151719;  /* Hover states, raised elements */
  --void-border: #1e2024;    /* Borders, dividers */

  /* Accent - Amber/Gold */
  --accent: #f59e0b;         /* Primary accent, active states */
  --accent-dim: rgba(245, 158, 11, 0.15);  /* Accent backgrounds */
  --accent-glow: rgba(245, 158, 11, 0.08); /* Subtle glow effects */

  /* Text Hierarchy */
  --text: #e5e5e5;           /* Primary text */
  --text-dim: #71717a;       /* Secondary text, labels */
  --text-muted: #3f3f46;     /* Tertiary text, disabled */

  /* Semantic Colors */
  --green: #22c55e;          /* Success, online, additions */
  --red: #ef4444;            /* Error, offline, deletions */
  --yellow: #eab308;         /* Warning, pending */
  --blue: #3b82f6;           /* Info, links, branches */
  --purple: #a855f7;         /* Tools, special actions */
  --cyan: #06b6d4;           /* Research mode, web content */
}
```

### Color Usage Rules

| Element | Color | Notes |
|---------|-------|-------|
| Page background | `--void-deep` | Always the deepest black |
| Panel/card background | `--void-surface` | Slightly elevated |
| Hover/focus states | `--void-elevated` | Subtle lift effect |
| Borders | `--void-border` | 1px, never thicker |
| Primary text | `--text` | Body copy, headings |
| Secondary text | `--text-dim` | Labels, metadata |
| Disabled/hint | `--text-muted` | Placeholders, inactive |
| Active/selected | `--accent` | Tabs, nav items, focus rings |
| User input prompt | `--accent` | The `$` or `>` symbol |
| Success indicators | `--green` | Online dots, checkmarks |
| Error states | `--red` | Errors, deletions |
| Git additions | `--green` | Added lines in diffs |
| Git deletions | `--red` | Removed lines in diffs |
| Branch names | `--blue` | Git branch indicators |
| Tool invocations | `--purple` | Tool headers, icons |

---

## Typography

### Font Stack

```css
/* Primary - Everything is monospace */
font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;

/* Fallback for system UI (rare use) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| Body text | 13px | 400 | 1.6 | 0 |
| Small text | 11px | 400 | 1.5 | 0 |
| Tiny text (labels) | 10px | 600 | 1.4 | 0.1em |
| Code/terminal | 13px | 400 | 1.6 | 0 |
| Headings (rare) | 16px | 600 | 1.3 | -0.01em |
| Section headers | 10px | 600 | 1.4 | 0.1em (uppercase) |

### Typography Rules

1. **All caps for labels** - Section headers, status labels use uppercase with letter-spacing
2. **No bold in body** - Weight variation is minimal, use color for emphasis
3. **Monospace everywhere** - Even UI labels, for consistency
4. **13px base** - Large enough for readability, small enough for density
5. **16px minimum for inputs** - Prevents iOS zoom on focus

---

## Layout System

### Three-Column Grid

The primary layout is a three-column grid that adapts based on view:

```css
/* Standard workspace layout */
.app {
  display: grid;
  grid-template-columns: 200px 1fr 260px;
  grid-template-rows: 40px 1fr 28px;
  height: 100dvh;
}

/* Kanban view - wider center */
.app.kanban {
  grid-template-columns: 200px 1fr;
}

/* Git view - wider right panel for diffs */
.app.git {
  grid-template-columns: 200px 1fr 320px;
}

/* History view - three columns with list */
.app.history {
  grid-template-columns: 200px 350px 1fr;
}
```

### Column Specifications

| Column | Width | Purpose |
|--------|-------|---------|
| Left sidebar | 200px (fixed) | Navigation, project info |
| Center | 1fr (flexible) | Terminal, kanban, main content |
| Right panel | 260-320px (fixed) | Context, details, diffs |
| Top bar | 40px height | Window controls, tabs, actions |
| Status bar | 28px height | Model, branch, session info |

### Spacing Scale

```css
/* Base unit: 4px */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
```

### Spacing Usage

| Context | Spacing |
|---------|---------|
| Inside small components | 8px |
| Component internal padding | 12px |
| Section padding | 16px |
| Between sections | 24px |
| Major section gaps | 32px |
| Terminal message spacing | 24px |

---

## Components

### Navigation Items

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  color: var(--text-dim);
  cursor: pointer;
  border-left: 2px solid transparent;
  font-size: 13px;
  transition: all 0.15s;
}

.nav-item:hover {
  background: var(--void-elevated);
  color: var(--text);
}

.nav-item.active {
  background: var(--void-elevated);
  color: var(--text);
  border-left-color: var(--accent);
}

.nav-item.active svg {
  color: var(--accent);
}
```

### Buttons

```css
/* Primary action */
.btn-primary {
  padding: 8px 16px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: var(--void-deep);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

/* Secondary/ghost button */
.btn-secondary {
  padding: 6px 12px;
  background: var(--void-elevated);
  border: 1px solid var(--void-border);
  border-radius: 4px;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background: var(--void-border);
  color: var(--text);
}
```

### Cards

```css
.card {
  background: var(--void-surface);
  border: 1px solid var(--void-border);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.15s;
}

.card:hover {
  border-color: var(--accent);
}

.card.selected {
  border-color: var(--accent);
  background: var(--void-elevated);
}
```

### Input Fields

```css
.input {
  width: 100%;
  padding: 10px 12px;
  background: var(--void-elevated);
  border: 1px solid var(--void-border);
  border-radius: 6px;
  color: var(--text);
  font-family: inherit;
  font-size: 13px; /* 16px on mobile */
  outline: none;
  transition: all 0.15s;
}

.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.input::placeholder {
  color: var(--text-muted);
}
```

### Terminal Input Line

```css
.input-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--void-elevated);
  border: 1px solid var(--void-border);
  border-radius: 8px;
}

.input-prompt {
  color: var(--accent);
  font-weight: 500;
}

.input-field {
  flex: 1;
  background: none;
  border: none;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}
```

### Tool/Command Blocks

```css
.command-block {
  margin: 16px 0;
  background: var(--void-surface);
  border: 1px solid var(--void-border);
  border-radius: 6px;
  overflow: hidden;
}

.command-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--void-elevated);
  border-bottom: 1px solid var(--void-border);
}

.command-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: lowercase;
}

.command-body {
  padding: 12px;
}
```

### Output Blocks

```css
.output-block {
  margin: 16px 0;
  padding: 16px;
  background: var(--void-surface);
  border-left: 3px solid var(--accent);
}

.output-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 12px;
  text-transform: uppercase;
}
```

### Status Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--void-elevated);
  border-radius: 10px;
  font-size: 10px;
  color: var(--text-dim);
}

.badge.success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--green);
}

.badge.warning {
  background: rgba(234, 179, 8, 0.15);
  color: var(--yellow);
}

.badge.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--red);
}

.badge.accent {
  background: var(--accent-dim);
  color: var(--accent);
}
```

### Tabs

```css
.tabs {
  display: flex;
  gap: 4px;
}

.tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  transition: all 0.15s;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  background: var(--void-deep);
  color: var(--text);
}
```

---

## Iconography

### Icon Style

- **Line icons only** - No filled icons
- **Stroke width: 2px** - Consistent weight
- **Size: 16px default** - 14px for small, 20px for emphasis
- **Color: currentColor** - Inherits from parent

### Icon Sources

Use Lucide icons (https://lucide.dev) or custom SVG with these specs:

```html
<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <!-- paths -->
</svg>
```

### Common Icons

| Action | Icon | Notes |
|--------|------|-------|
| Terminal/Chat | `terminal` or `message-square` | Main view |
| Tasks | `check-square` or `layout-list` | Kanban |
| Git | `git-branch` | Version control |
| History | `clock` or `history` | Sessions |
| Settings | `settings` | Configuration |
| Search | `search` | Search/research |
| Play | `play` | Run task |
| Pause | `pause` | Pause execution |
| Stop | `square` | Stop execution |
| Add | `plus` | Create new |
| Close | `x` | Close/dismiss |
| Expand | `chevron-down` | Expand section |
| Collapse | `chevron-up` | Collapse section |
| File | `file` | Generic file |
| Folder | `folder` | Directory |
| External | `external-link` | Open external |

---

## Animation & Motion

### Timing

```css
/* Standard transition */
transition: all 0.15s ease;

/* Slower for emphasis */
transition: all 0.3s ease;

/* Quick micro-interactions */
transition: all 0.1s ease;
```

### Principles

1. **Subtle, not showy** - Motion should be barely noticeable
2. **Purpose over decoration** - Only animate when it aids understanding
3. **Fast defaults** - 150ms is the standard
4. **Ease curves** - Always ease, never linear

### Common Animations

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide up */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Pulse (for streaming cursor) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.streaming-cursor {
  animation: pulse 1s ease-in-out infinite;
}
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile: < 768px */
/* Tablet: 768px - 1024px */
/* Desktop: > 1024px */

@media (max-width: 768px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: 48px 1fr 56px;
  }
}
```

### Mobile Adaptations

1. **Single column layout** - Stack, don't squish
2. **Bottom navigation** - Thumb-reachable nav
3. **16px minimum font** - Prevent iOS zoom
4. **48px touch targets** - Comfortable tapping
5. **Full-height terminal** - Maximize chat space
6. **Hidden sidebars** - Slide-out on demand

### Mobile-Specific CSS

```css
/* Prevent body scroll on iOS */
html, body {
  position: fixed;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Use dvh for true viewport height */
.app {
  height: 100dvh;
}

/* Larger touch targets */
.mobile-nav-item {
  min-height: 48px;
  padding: 12px 16px;
}

/* Prevent zoom on input focus */
input, textarea {
  font-size: 16px;
}
```

---

## Scrollbars

### Custom Scrollbar Style

```css
/* Webkit browsers */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--void-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--void-border) transparent;
}
```

---

## Shadows & Depth

### Shadow Scale

```css
/* Minimal - for subtle lift */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);

/* Standard - for cards, dropdowns */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);

/* Prominent - for modals, popovers */
--shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);

/* Glow effect - for focus states */
--shadow-glow: 0 0 0 3px var(--accent-glow);
```

### Usage

- **Cards:** No shadow by default, `shadow-md` on hover
- **Dropdowns/Popovers:** `shadow-lg`
- **Modals:** `shadow-lg` + backdrop
- **Focus rings:** `shadow-glow`

---

## States

### Interactive States

| State | Background | Border | Text |
|-------|------------|--------|------|
| Default | `--void-surface` | `--void-border` | `--text-dim` |
| Hover | `--void-elevated` | `--void-border` | `--text` |
| Active/Selected | `--void-elevated` | `--accent` | `--text` |
| Focus | (same as hover) | `--accent` | `--text` |
| Disabled | `--void-surface` | `--void-border` | `--text-muted` |

### Status Indicators

```css
/* Online/Success */
.status-dot.online {
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
}

/* Busy/Warning */
.status-dot.busy {
  background: var(--yellow);
  animation: pulse 2s ease-in-out infinite;
}

/* Offline/Error */
.status-dot.offline {
  background: var(--text-muted);
}
```

---

## Patterns

### Section Headers

```css
.section-header {
  padding: 12px 16px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  text-transform: uppercase;
  border-bottom: 1px solid var(--void-border);
}
```

### Empty States

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.empty-state-title {
  font-size: 14px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.empty-state-description {
  font-size: 12px;
  color: var(--text-muted);
}
```

### Loading States

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--void-surface) 0%,
    var(--void-elevated) 50%,
    var(--void-surface) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## Accessibility

### Focus Management

```css
/* Visible focus for keyboard users */
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent);
}

/* Remove outline for mouse users */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### Color Contrast

- Primary text on void-deep: 14.5:1 (AAA)
- Dim text on void-deep: 5.2:1 (AA)
- Accent on void-deep: 8.3:1 (AAA)

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Notes

### Tailwind Integration

When using Tailwind, extend the theme:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        void: {
          deep: '#0a0b0d',
          surface: '#0f1012',
          elevated: '#151719',
          border: '#1e2024',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dim: 'rgba(245, 158, 11, 0.15)',
          glow: 'rgba(245, 158, 11, 0.08)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
}
```

### CSS Variables

Always use CSS variables for theming:

```css
/* In your global CSS */
:root {
  --void-deep: #0a0b0d;
  /* ... all variables ... */
}

/* In components */
.component {
  background: var(--void-surface);
  color: var(--text);
}
```

---

## Reference Files

### Design Prototypes
- `/design-catalogue/v2-01-axia-style.html` - Base design
- `/design-catalogue/ux-flows/*.html` - All UX flow views

### Current Implementation
- `/web/src/index.css` - Current styles
- `/web/tailwind.config.js` - Tailwind theme

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-12 | Initial design guide |

---

*This guide is the source of truth for all Ghost Control Panel UI development.*
