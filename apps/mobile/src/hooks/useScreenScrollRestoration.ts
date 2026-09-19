import { useRef, useCallback } from 'react';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

const screenScrollOffsets = new Map<string, number>();

/** Resets recorded scroll position for a given mobile screen (e.g. active tab tap). */
export function resetScreenScroll(screenKey: string) {
  screenScrollOffsets.set(screenKey, 0);
}

/** Retrieves the last recorded scroll position for a given mobile screen. */
export function getScreenScroll(screenKey: string): number {
  return screenScrollOffsets.get(screenKey) || 0;
}

/** Updates the recorded scroll position for a given mobile screen. */
export function setScreenScroll(screenKey: string, offset: number) {
  screenScrollOffsets.set(screenKey, Math.max(0, offset));
}

/**
 * useScreenScrollRestoration
 *
 * Universal Mobile Navigation Rules:
 * 1. Navigate to the last position when screen gains focus.
 * 2. Fall back to the top of the screen (0) when no saved position exists.
 * 3. Active tab tap resets scroll to 0 and scrolls smoothly to top via useScrollToTop.
 */
export function useScreenScrollRestoration(
  screenKey: string,
  scrollRef: React.RefObject<any>
) {
  // Bind standard React Navigation tab-press scroll-to-top handler
  try {
    useScrollToTop(scrollRef);
  } catch {
    // If used outside navigation container or unsupported ref
  }
  const currentOffsetRef = useRef<number>(screenScrollOffsets.get(screenKey) || 0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      currentOffsetRef.current = y;
      setScreenScroll(screenKey, y);
    },
    [screenKey]
  );

  useFocusEffect(
    useCallback(() => {
      const saved = screenScrollOffsets.get(screenKey) || 0;

      const restore = (targetOffset: number, animated = false) => {
        if (!scrollRef.current) return;
        if (typeof scrollRef.current.scrollToOffset === 'function') {
          scrollRef.current.scrollToOffset({ offset: targetOffset, animated });
        } else if (typeof scrollRef.current.scrollTo === 'function') {
          scrollRef.current.scrollTo({ y: targetOffset, animated });
        }
      };

      if (saved > 0) {
        // Navigate to last position
        restore(saved, false);
        const t1 = setTimeout(() => restore(saved, false), 60);
        const t2 = setTimeout(() => restore(saved, false), 220);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      } else {
        // Fall back to top of the screen
        restore(0, false);
      }
    }, [screenKey, scrollRef])
  );

  const scrollToTop = useCallback(
    (animated = true) => {
      resetScreenScroll(screenKey);
      currentOffsetRef.current = 0;
      if (!scrollRef.current) return;
      if (typeof scrollRef.current.scrollToOffset === 'function') {
        scrollRef.current.scrollToOffset({ offset: 0, animated });
      } else if (typeof scrollRef.current.scrollTo === 'function') {
        scrollRef.current.scrollTo({ y: 0, animated });
      }
    },
    [screenKey, scrollRef]
  );

  return {
    onScroll,
    currentOffsetRef,
    scrollToTop,
  };
}
