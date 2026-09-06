import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollPositions = new Map();

/**
 * Universal Scroll Restoration & Top-of-Page Navigation Manager.
 *
 * - On new route navigation (PUSH/REPLACE, e.g. clicking tabs, links, header/footer nav):
 *   Always resets scroll position to the top of the page / screen header (0, 0).
 * - On back/forward navigation (POP):
 *   Restores the user's previous scroll position on that page.
 * - On hash navigation (#target):
 *   Scrolls to the target element if present.
 */
export function ScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevKeyRef = useRef(location.key);

  // Save current scroll position before navigating away
  useEffect(() => {
    const handleScroll = () => {
      const key = location.key || (location.pathname + location.search);
      scrollPositions.set(key, {
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || 0,
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      handleScroll(); // record position on unmount / route change
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.key, location.pathname, location.search]);

  // Execute scroll adjustment immediately on route change
  useLayoutEffect(() => {
    const currentKey = location.key || (location.pathname + location.search);

    if (location.hash) {
      const elementId = decodeURIComponent(location.hash.replace(/^#/, ''));
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'auto' });
        return;
      }
    }

    if (navType === 'POP' && scrollPositions.has(currentKey)) {
      const saved = scrollPositions.get(currentKey);
      window.scrollTo({
        left: saved.x,
        top: saved.y,
        behavior: 'instant',
      });
    } else {
      // PUSH / REPLACE or new route: Always open at top / screen header
      window.scrollTo({
        left: 0,
        top: 0,
        behavior: 'instant',
      });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.scrollTop = 0;
    }

    // Microtask & requestAnimationFrame safety check for lazy-loaded route chunks
    const rAF = requestAnimationFrame(() => {
      if (navType !== 'POP' && !location.hash) {
        if (window.scrollY > 0) {
          window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        }
        if (document.documentElement && document.documentElement.scrollTop > 0) {
          document.documentElement.scrollTop = 0;
        }
        if (document.body && document.body.scrollTop > 0) {
          document.body.scrollTop = 0;
        }
        const mainEl = document.getElementById('main-content');
        if (mainEl && mainEl.scrollTop > 0) {
          mainEl.scrollTop = 0;
        }
      }
    });

    prevKeyRef.current = location.key;
    return () => cancelAnimationFrame(rAF);
  }, [location.pathname, location.search, location.hash, location.key, navType]);

  return null;
}
