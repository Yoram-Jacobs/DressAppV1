import * as React from 'react';

/**
 * React 19-safe ref composition utility.
 *
 * Prevents "Minified React error #185: Maximum update depth exceeded" in Radix UI
 * components (Select, Switch, DropdownMenu, etc.) caused by ref-churn loops under React 19.
 *
 * Root Cause:
 * In React 19, callback refs can return cleanup functions. When Radix UI's <Slot> or
 * components render inline ref compositions, the callback ref identity changes on every render.
 * React 19 detaches the previous ref by calling it with null (or its cleanup), which in Radix
 * invoked context state setters (e.g. setTrigger(null), setAnchor(null)) while the element
 * was still mounted. This scheduled immediate state updates during the commit phase, causing
 * infinite re-render ping-pong loops exceeding 50 renders.
 *
 * Solution:
 * 1. 2-level WeakMap memoization so composeRefs(r1, r2) returns the exact same function reference
 *    when the underlying refs are unchanged.
 * 2. Asynchronous microtask-guarded unmount so that synchronous ref identity swaps never
 *    dispatch false setRef(ref, null) updates on mounted DOM elements.
 * 3. React 19 cleanup function support.
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

      // In React 19, returning a cleanup function prevents React from
      // calling ref(null) during unmount or ref updates.
      return () => {
        const unmountingNode = activeNode;
        activeNode = null;

        // Queue teardown so that if a new ref callback is immediately attached
        // to the same mounted node (ref churn), we do NOT fire spurious state updates
        // like setTrigger(null) / setAnchor(null).
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
 * A hook that returns a stable ref callback composed of the given refs.
 */
export function useComposedRefs(...refs) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => composeRefs(...refs), refs);
}

export default composeRefs;
