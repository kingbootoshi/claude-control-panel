import { useEffect } from 'react';

/**
 * Hook to handle mobile viewport resizing and keyboard detection.
 * Sets --app-height CSS variable and toggles 'keyboard-open' class on html element.
 * 
 * Based on: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 */
export function useVisualViewport() {
  useEffect(() => {
    // Only run on client side and if visualViewport is supported
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const vv = window.visualViewport;

    const setViewportVars = () => {
      // 1. Set the app height to the actual visible viewport height
      // This is crucial for iOS where the keyboard shrinks the visual viewport
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`);

      // 2. Detect keyboard
      // On iOS, the visual viewport height is smaller than window.innerHeight when keyboard is up.
      // We can also check if the offsetTop is > 0 (scrolled up).
      // However, a simple comparison of heights is often robust enough for detection.
      // We'll use a threshold to avoid false positives from small UI bars.
      const isKeyboardOpen = vv.height < window.innerHeight * 0.85; // < 85% of screen
      
      if (isKeyboardOpen) {
        document.documentElement.classList.add('keyboard-open');
      } else {
        document.documentElement.classList.remove('keyboard-open');
      }

      // 3. Scroll to top to prevent layout breakage if somehow scrolled
      // (Optional, but often good for full-screen web apps)
      // window.scrollTo(0, 0);
    };

    // Initial set
    setViewportVars();

    // Listen for resize and scroll (iOS sometimes fires scroll instead of resize)
    vv.addEventListener('resize', setViewportVars);
    vv.addEventListener('scroll', setViewportVars);
    window.addEventListener('resize', setViewportVars); // Fallback

    return () => {
      vv.removeEventListener('resize', setViewportVars);
      vv.removeEventListener('scroll', setViewportVars);
      window.removeEventListener('resize', setViewportVars);
    };
  }, []);
}


