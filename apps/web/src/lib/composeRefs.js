import * as React from 'react';

/**
 * React 19-safe ref composition utility.
 *
 * In React 19, callback refs can return cleanup functions.
 * Previous Radix UI versions had a bug where `useComposedRefs` returned a new callback ref
 * on every render whenever inline ref functions or context setters were passed.
 * In React 19, when a ref identity changes on every render, React repeatedly detaches
 * and reattaches the ref, invoking state setters (e.g. `setTrigger`, `setButton`)
 * during commit/layout, immediately triggering an infinite re-render loop
 * ("Minified React error #185: Maximum update depth exceeded").
 *
 * This implementation provides:
 * 1. A stable ref callback identity via useRef/useCallback([]) so React 19 does not
 *    spudiously detach and reattach refs on every render.
 * 2. Proper cleanup dispatch when DOM elements truly unmount.
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
  const refsRef = React.useRef(refs);
  const nodeRef = React.useRef(null);
  const cleanupsRef = React.useRef(new Map());

  refsRef.current = refs;

  return React.useCallback((node) => {
    nodeRef.current = node;

    if (node) {
      refsRef.current.forEach((ref) => {
        if (!ref) return;
        const cleanup = setRef(ref, node);
        if (typeof cleanup === 'function') {
          cleanupsRef.current.set(ref, cleanup);
        }
      });
    } else {
      // Unmounting: clean up
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
    }
  }, []);
}

export default composeRefs;
