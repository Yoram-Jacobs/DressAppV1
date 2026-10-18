import * as React from 'react';

/**
 * React 19-safe ref composition utility.
 *
 * In React 19, callback refs can return cleanup functions.
 * Previous Radix UI versions had a bug where the returned cleanup function
 * prematurely nullified non-cleanup refs (`setRef(ref, null)`) whenever any sibling
 * ref returned a cleanup or when ref callbacks changed during render.
 * In React 19 concurrent/synchronous mode, this caused immediate state updates
 * (e.g. `setTrigger(null)`, `setButton(null)`) during the commit phase, triggering
 * an infinite re-render loop ("Minified React error #185: Maximum update depth exceeded").
 *
 * React 19 itself already invokes `ref(null)` when an element unmounts for refs
 * that do not return a cleanup function. Therefore, the cleanup callback should
 * only invoke functions returned by cleanup-aware refs and NEVER prematurely nullify
 * other refs while elements remain mounted.
 */

export function setRef(ref, value) {
  if (typeof ref === 'function') {
    return ref(value);
  } else if (ref !== null && ref !== undefined) {
    ref.current = value;
  }
}

export function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true;
      }
      return cleanup;
    });

    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === 'function') {
            try {
              cleanup();
            } catch (err) {
              console.error('Error during ref cleanup:', err);
            }
          }
        }
      };
    }
  };
}

export function useComposedRefs(...refs) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(composeRefs(...refs), refs);
}

export default composeRefs;
