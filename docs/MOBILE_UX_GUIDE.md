# Mobile UX & Styling Guide

## Overview
This document outlines the standards for mobile UX implementation in the Claude Control Panel, specifically targeting iOS Safari and "Add to Home Screen" (Standalone) web apps.

## Core Principles

1.  **No Body Scroll:** The application shell (`html`, `body`, `#root`) must never scroll. Only specific internal containers (like the chat history or file list) should have `overflow-y: auto`.
2.  **Keyboard Awareness:** The layout must adapt to the virtual keyboard. When the keyboard is open, non-essential UI (like the bottom navigation bar) should be hidden to prioritize the active input context.
3.  **Visual Viewport is Truth:** On mobile, `100vh` is unreliable. We use `window.visualViewport.height` to determine the actual visible area, especially when the keyboard is open or browser chrome is visible.
4.  **Safe Areas:** Always respect `safe-area-inset-top` and `safe-area-inset-bottom` for notches and home indicators.

## Implementation Details

### 1. Viewport Management (`useVisualViewport` hook)

We use a custom hook to synchronize the CSS variable `--app-height` with the actual visual viewport height.

```typescript
// web/src/hooks/useVisualViewport.ts
export function useVisualViewport() {
  // ... sets --app-height to window.visualViewport.height
  // ... toggles .keyboard-open class on <html>
}
```

### 2. CSS Grid Layout

For mobile, we use a CSS Grid layout to strictly define the vertical space. This avoids "padding hacks" and `position: fixed` overlays which are fragile on mobile.

```css
.app-layout.mobile {
  display: grid;
  grid-template-rows: auto 1fr auto; /* Header | Content | Nav */
  height: var(--app-height, 100dvh);
  overflow: hidden;
}
```

### 3. Keyboard Handling

When the keyboard is detected (via the hook), the `.keyboard-open` class is added to the root.

```css
/* Hide nav when keyboard is open to prevent overlap and maximize space */
html.keyboard-open .mobile-nav {
  display: none !important;
}
```

### 4. Input Zoom Prevention

To prevent iOS from zooming in when an input is focused, all inputs must have a font size of at least 16px.

```css
.terminal-input, input, textarea, select {
  font-size: 16px !important;
}
```

## Styling Rules for Contributors

1.  **Avoid `position: fixed` for Layout:** Do not use `position: fixed` for headers or footers if possible. Use Flexbox or Grid to place them in the flow.
2.  **Use `--app-height`:** For full-height containers on mobile, use `height: var(--app-height, 100dvh)`.
3.  **Contain Scrolling:** Always apply `overscroll-behavior: contain` and `-webkit-overflow-scrolling: touch` to scrollable areas.
4.  **Touch Targets:** Ensure interactive elements have `touch-action: manipulation` to disable double-tap-to-zoom delays.

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Chat input hidden behind keyboard | Layout doesn't resize | Use `useVisualViewport` and `--app-height`. |
| Nav bar overlaps input | Nav is `fixed` | Use Grid layout; hide nav on `.keyboard-open`. |
| Page zooms on focus | Font size < 16px | Set `font-size: 16px` on inputs. |
| Whole page scrolls | `body` overflow | Set `overflow: hidden` on `body` and `#root`. |



