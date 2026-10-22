import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocalStorageSync } from '@/lib/useLocalStorageSync';
import { ZoomIn, ZoomOut, Grid2X2 } from 'lucide-react';

/**
 * Custom hook to adjust grid density via pinch gestures on touchscreens
 * and trackpad/mousewheel pinch gestures, with persistent localStorage state.
 *
 * @param {Object} options
 * @param {string} options.key - localStorage key for persistence
 * @param {number} [options.defaultDensity=2] - Default density level (1 = largest cards/1 col, higher = more columns)
 * @param {number} [options.minDensity=1] - Minimum density level
 * @param {number} [options.maxDensity=4] - Maximum density level
 * @param {Object} [options.gridClasses] - Map of density level (1..N) to Tailwind grid class string
 */
export function usePinchGridDensity({
  key,
  defaultDensity = 2,
  minDensity = 1,
  maxDensity = 4,
  gridClasses = {},
}) {
  const [storedDensity, setStoredDensity] = useLocalStorageSync(key, defaultDensity);
  const density = typeof storedDensity === 'number' ? storedDensity : defaultDensity;

  const [activeFeedback, setActiveFeedback] = useState(null);
  const feedbackTimerRef = useRef(null);

  const initialDistRef = useRef(null);
  const isPinchingRef = useRef(false);
  const lastDensityRef = useRef(density);
  lastDensityRef.current = density;

  const showFeedback = useCallback((level) => {
    setActiveFeedback(level);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setActiveFeedback(null);
    }, 1200);
  }, []);

  const changeDensity = useCallback(
    (newVal) => {
      const clamped = Math.max(minDensity, Math.min(maxDensity, newVal));
      if (clamped !== lastDensityRef.current) {
        setStoredDensity(clamped);
        showFeedback(clamped);
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
          }
        } catch {
          // ignore
        }
      }
    },
    [minDensity, maxDensity, setStoredDensity, showFeedback]
  );

  // Touch handlers for mobile touchscreen pinch
  const onTouchStart = useCallback((e) => {
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialDistRef.current = dist;
      isPinchingRef.current = true;
    }
  }, []);

  const onTouchMove = useCallback(
    (e) => {
      if (!isPinchingRef.current || !e.touches || e.touches.length !== 2) return;
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (!initialDistRef.current || initialDistRef.current === 0) {
        initialDistRef.current = currentDist;
        return;
      }

      const ratio = currentDist / initialDistRef.current;
      // Pinch OUT (fingers spreading apart) -> zoom in -> fewer columns (lower density)
      if (ratio > 1.35) {
        changeDensity(lastDensityRef.current - 1);
        initialDistRef.current = currentDist; // reset baseline for continuous pinch
      }
      // Pinch IN (fingers coming together) -> zoom out -> more columns (higher density)
      else if (ratio < 0.72) {
        changeDensity(lastDensityRef.current + 1);
        initialDistRef.current = currentDist; // reset baseline for continuous pinch
      }
    },
    [changeDensity]
  );

  const onTouchEnd = useCallback((e) => {
    if (!e.touches || e.touches.length < 2) {
      isPinchingRef.current = false;
      initialDistRef.current = null;
    }
  }, []);

  // Trackpad pinch handling via Ctrl+Wheel
  const onWheel = useCallback(
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < -15) {
          // Trackpad pinch OUT -> zoom in -> fewer columns
          changeDensity(lastDensityRef.current - 1);
        } else if (e.deltaY > 15) {
          // Trackpad pinch IN -> zoom out -> more columns
          changeDensity(lastDensityRef.current + 1);
        }
      }
    },
    [changeDensity]
  );

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Compute active grid classes
  const currentGridClass = gridClasses[density] || gridClasses[defaultDensity] || '';

  return {
    density,
    setDensity: changeDensity,
    currentGridClass,
    activeFeedback,
    pinchProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onWheel,
    },
  };
}

/**
 * Compact accessible UI control to indicate and adjust grid density.
 */
export function PinchDensityControl({
  density,
  setDensity,
  min = 1,
  max = 4,
  className = '',
  labels = {},
}) {
  const canZoomIn = density > min;
  const canZoomOut = density < max;

  return (
    <div
      className={`inline-flex items-center gap-1 bg-white dark:bg-card border border-border rounded-full p-1 shadow-2xs ${className}`}
      role="group"
      aria-label="Grid density control"
    >
      <button
        type="button"
        onClick={() => setDensity(density - 1)}
        disabled={!canZoomIn}
        title="Larger cards (Pinch out)"
        aria-label="Larger cards"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
          canZoomIn
            ? 'text-dark-brand hover:bg-secondary active:scale-95'
            : 'text-muted-foreground/40 cursor-not-allowed'
        }`}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>

      <span className="text-[11px] font-bold px-1.5 tabular-nums text-text-brand select-none">
        {labels[density] || `${density}x`}
      </span>

      <button
        type="button"
        onClick={() => setDensity(density + 1)}
        disabled={!canZoomOut}
        title="More cards per row (Pinch in)"
        aria-label="More cards per row"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
          canZoomOut
            ? 'text-dark-brand hover:bg-secondary active:scale-95'
            : 'text-muted-foreground/40 cursor-not-allowed'
        }`}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Floating feedback toast indicating current density when pinching.
 */
export function PinchFeedbackBadge({ activeDensity, labels = {} }) {
  if (activeDensity == null) return null;
  const text = labels[activeDensity] || `${activeDensity} Columns`;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark-brand/90 text-white backdrop-blur-md shadow-xl text-xs font-bold border border-white/10">
        <Grid2X2 className="h-3.5 w-3.5 text-primary-color" />
        <span>{text}</span>
      </div>
    </div>
  );
}
