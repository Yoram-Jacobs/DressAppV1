import * as React from 'react';

/**
 * React 19-safe ref composition utility.
 *
 * Prevents "Minified React error #185: Maximum update depth exceeded" across all Radix UI
 * primitives (Select, Switch, DropdownMenu, Tabs, Dialog, Slot, etc.).
 *
 * Mechanism:
 * 1. `useComposedRefs`: Returns a 100% stable ref callback identity via `useCallback(..., [])`.
 *    Radix components often pass inline arrow functions (e.g. `(e) => setItem(e)`) to `useComposedRefs`.
 *    A stable callback identity ensures React 19 does not churn refs on every render.
 * 2. `composeRefs`: Memoized with a 2-level `WeakMap` so that non-hook consumers (like `<Slot>` / `<SlotClone>`)
 *    that call `composeRefs(anchorRef, triggerRef)` during render receive the identical function reference.
 * 3. Microtask-guarded unmount: If React 19 does detach a ref during an identity swap, state setters
 *    (e.g. `setTrigger(null)`, `setAnchor(null)`) are not dispatched synchronously on mounted elements.
 */

export function setRef(ref, value) {
  if (typeof ref === 'function') {
    return ref(value);
  } else if (ref !== null && ref !== undefined && 'current' in ref) {
    ref.current = value;
  }
}

// 2-level WeakMap cache to memoize composeRefs(refA, refB).
const refCache = new WeakMap();

function getCachedComposedRef(r1, r2) {
  const map = refCache.get(r1);
  return map ? map.get(r2) : undefined;
}

function setCachedComposedRef(r1, r2, fn) {
  let map = refCache.get(r1);
  if (!map) {
    map = new WeakMap();
    refCache.set(r1, map);
  }
  map.set(r2, fn);
}

function createComposedRef(refs) {
  let activeNode = null;
  const cleanups = new Map();
  let pendingTeardown = null;

  return (node) => {
    if (node) {
      activeNode = node;
      pendingTeardown = null;

      refs.forEach((ref) => {
        if (!ref) return;
        const cleanup = setRef(ref, node);
        if (typeof cleanup === 'function') {
          cleanups.set(ref, cleanup);
        }
      });

      // In React 19, returning a cleanup function allows React to clean up on unmount
      return () => {
        const unmountingNode = activeNode;
        activeNode = null;

        pendingTeardown = unmountingNode;
        queueMicrotask(() => {
          if (pendingTeardown === unmountingNode) {
            refs.forEach((ref) => {
              if (!ref) return;
              const cleanup = cleanups.get(ref);
              if (typeof cleanup === 'function') {
                try {
                  cleanup();
                } catch (e) {
                  console.error('Error during ref cleanup:', e);
                }
              } else {
                setRef(ref, null);
              }
            });
            cleanups.clear();
            pendingTeardown = null;
          }
        });
      };
    } else {
      // Legacy or non-cleanup detach: node is null
      const unmountingNode = activeNode;
      activeNode = null;

      pendingTeardown = unmountingNode;
      queueMicrotask(() => {
        if (pendingTeardown === unmountingNode) {
          refs.forEach((ref) => {
            if (!ref) return;
            const cleanup = cleanups.get(ref);
            if (typeof cleanup === 'function') {
              try {
                cleanup();
              } catch (e) {
                console.error('Error during ref cleanup:', e);
              }
            } else {
              setRef(ref, null);
            }
          });
          cleanups.clear();
          pendingTeardown = null;
        }
      });
    }
  };
}

/**
 * Composes multiple refs into a single ref callback.
 * Memoized with WeakMap so identical ref pairs return the exact same function reference.
 */
export function composeRefs(...refs) {
  const validRefs = refs.filter(Boolean);
  if (validRefs.length === 0) return null;
  if (validRefs.length === 1) return validRefs[0];

  if (validRefs.length === 2) {
    const [r1, r2] = validRefs;
    const canCache =
      (typeof r1 === 'object' || typeof r1 === 'function') &&
      (typeof r2 === 'object' || typeof r2 === 'function');

    if (canCache) {
      const cached = getCachedComposedRef(r1, r2);
      if (cached) return cached;
    }

    const fn = createComposedRef(validRefs);
    if (canCache) {
      setCachedComposedRef(r1, r2, fn);
    }
    return fn;
  }

  // For > 2 refs, reduce right-associatively: composeRefs(r1, composeRefs(r2, r3))
  const [first, ...rest] = validRefs;
  return composeRefs(first, composeRefs(...rest));
}

/**
 * A hook that returns a 100% stable ref callback composed of the given refs.
 * Crucial for React 19 compatibility when components pass inline ref callbacks.
 */
export function useComposedRefs(...refs) {
  const refsRef = React.useRef(refs);
  const cleanupsRef = React.useRef(new Map());
  const activeNodeRef = React.useRef(null);
  const pendingTeardownRef = React.useRef(null);

  refsRef.current = refs;

  return React.useCallback((node) => {
    if (node) {
      activeNodeRef.current = node;
      pendingTeardownRef.current = null;

      refsRef.current.forEach((ref) => {
        if (!ref) return;
        const cleanup = setRef(ref, node);
        if (typeof cleanup === 'function') {
          cleanupsRef.current.set(ref, cleanup);
        }
      });

      return () => {
        const unmountingNode = activeNodeRef.current;
        activeNodeRef.current = null;
        pendingTeardownRef.current = unmountingNode;

        queueMicrotask(() => {
          if (pendingTeardownRef.current === unmountingNode) {
            refsRef.current.forEach((ref) => {
              if (!ref) return;
              const cleanup = cleanupsRef.current.get(ref);
              if (typeof cleanup === 'function') {
                try {
                  cleanup();
                } catch (e) {
                  console.error('Error during ref cleanup:', e);
                }
              } else {
                setRef(ref, null);
              }
            });
            cleanupsRef.current.clear();
            pendingTeardownRef.current = null;
          }
        });
      };
    } else {
      const unmountingNode = activeNodeRef.current;
      activeNodeRef.current = null;
      pendingTeardownRef.current = unmountingNode;

      queueMicrotask(() => {
        if (pendingTeardownRef.current === unmountingNode) {
          refsRef.current.forEach((ref) => {
            if (!ref) return;
            const cleanup = cleanupsRef.current.get(ref);
            if (typeof cleanup === 'function') {
              try {
                cleanup();
              } catch (e) {
                console.error('Error during ref cleanup:', e);
              }
            } else {
              setRef(ref, null);
            }
          });
          cleanupsRef.current.clear();
          pendingTeardownRef.current = null;
        }
      });
    }
  }, []);
}

export default composeRefs;
