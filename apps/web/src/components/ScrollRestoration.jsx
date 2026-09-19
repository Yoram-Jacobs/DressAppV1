import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const SESSION_STORAGE_KEY = 'dressapp_scroll_positions';

function loadPositions() {
  const map = new Map();
  if (typeof window === 'undefined') return map;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => map.set(k, v));
    }
  } catch {
    /* ignore parse errors */
  }
  return map;
}

function persistPositions(map) {
  if (typeof window === 'undefined') return;
  try {
    const obj = {};
    map.forEach((v, k) => {
      obj[k] = v;
    });
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore storage quota errors */
  }
}

const scrollPositions = loadPositions();

/**
 * Resets the recorded scroll position for a given route (e.g. when user taps the active tab)
 * so subsequent navigation falls back cleanly to the top of the page.
 */
export function resetRouteScrollPosition(pathname) {
  if (!pathname) return;
  scrollPositions.set(pathname, { x: 0, y: 0, mainY: 0 });
  persistPositions(scrollPositions);
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
  const locationRef = useRef(location);
  locationRef.current = location;

  // Save current scroll position continuously & on unmount
  useEffect(() => {
    let saveTimeout = null;

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

      if (!saveTimeout) {
        saveTimeout = setTimeout(() => {
          saveTimeout = null;
          persistPositions(scrollPositions);
        }, 300);
      }
    };

    window.addEventListener('scroll', recordScroll, { passive: true });
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.addEventListener('scroll', recordScroll, { passive: true });
    }

    return () => {
      recordScroll();
      if (saveTimeout) clearTimeout(saveTimeout);
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

    const applyScroll = (x, y, mainY = 0) => {
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = y;
      if (document.body) document.body.scrollTop = y;
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.scrollTop = mainY;
    };

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
