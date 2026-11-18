import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const SESSION_STORAGE_KEY = 'dressapp_scroll_positions';

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

const scrollPositions = new Map();

/**
 * Clears all recorded scroll positions (e.g. when starting or ending an auth session)
 * so the new session always starts at the top of every page.
 */
export function clearAllScrollPositions() {
  scrollPositions.clear();
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore storage errors */
    }
  }
}

/**
 * Resets the recorded scroll position for a given route (e.g. when user taps the active tab)
 * so subsequent navigation falls back cleanly to the top of the page.
 */
export function resetRouteScrollPosition(pathname) {
  if (!pathname) return;
  scrollPositions.set(pathname, { x: 0, y: 0, mainY: 0 });
}

/**
 * Universal Navigation Rules Manager:
 * - Navigate to the last position on return / revisited routes.
 * - Fall back to the top of the page when no previous position exists.
 * - Handle hash anchors (#id).
 */
export function ScrollRestoration() {
  const location = useLocation();
  const prevKeyRef = useRef(location.key);
  const isInitialMountRef = useRef(true);
  const locationRef = useRef(location);
  locationRef.current = location;

  // Save current scroll position continuously & on unmount (in-memory for current session only)
  useEffect(() => {
    const recordScroll = () => {
      const loc = locationRef.current;
      const key = loc.pathname + (loc.search || '');
      const pathKey = loc.pathname;

      const y = window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0;
      const x = window.scrollX || window.pageXOffset || document.documentElement?.scrollLeft || 0;
      const mainEl = document.getElementById('main-content');
      const mainY = mainEl ? mainEl.scrollTop : 0;

      const pos = { x, y, mainY };
      scrollPositions.set(key, pos);
      scrollPositions.set(pathKey, pos);
    };

    window.addEventListener('scroll', recordScroll, { passive: true });
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.addEventListener('scroll', recordScroll, { passive: true });
    }

    return () => {
      recordScroll();
      window.removeEventListener('scroll', recordScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', recordScroll);
      }
    };
  }, []);

  // Execute navigation rule on route transition
  useLayoutEffect(() => {
    const key = location.pathname + (location.search || '');
    const pathKey = location.pathname;

    const applyScroll = (x, y, mainY = 0) => {
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = y;
      if (document.body) document.body.scrollTop = y;
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.scrollTop = mainY;
    };

    // Always start at the top on page refresh or initial session mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      applyScroll(0, 0, 0);
      const rAF = requestAnimationFrame(() => applyScroll(0, 0, 0));
      prevKeyRef.current = location.key;
      return () => cancelAnimationFrame(rAF);
    }

    // Rule 1: Anchor hash navigation
    if (location.hash) {
      const elementId = decodeURIComponent(location.hash.replace(/^#/, ''));
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'auto' });
        prevKeyRef.current = location.key;
        return;
      }
    }

    // Rule 2: Navigate to last position if available
    const saved = scrollPositions.get(key) || scrollPositions.get(pathKey);
    const hasLastPosition = saved && (saved.y > 0 || saved.x > 0 || (saved.mainY && saved.mainY > 0));

    if (hasLastPosition) {
      applyScroll(saved.x || 0, saved.y || 0, saved.mainY || 0);

      // Async/dynamic content height retries:
      // If the page contains dynamic lists (e.g. Closet items, Marketplace feed)
      // the container might initially be shorter than saved.y.
      const timers = [50, 150, 300].map((delay) =>
        setTimeout(() => {
          const currentY = window.scrollY || document.documentElement?.scrollTop || 0;
          if (Math.abs(currentY - saved.y) > 10) {
            applyScroll(saved.x || 0, saved.y || 0, saved.mainY || 0);
          }
        }, delay)
      );

      prevKeyRef.current = location.key;
      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // Rule 3: Fall back to the top of the page
    applyScroll(0, 0, 0);

    const rAF = requestAnimationFrame(() => {
      if (!location.hash) {
        applyScroll(0, 0, 0);
      }
    });

    prevKeyRef.current = location.key;
    return () => cancelAnimationFrame(rAF);
  }, [location.pathname, location.search, location.hash, location.key]);

  return null;
}
