/**
 * WorkProgressFloater.jsx — bottom-right pill that shows in-flight
 * /analyze + polish work across page navigations.
 *
 * Patch M20 (May 2026) — Subscribes to the global ``workStore`` and
 * renders a compact glass-morphism pill whenever there's activity.
 * The pill auto-hides ~500 ms after the last job drains so the user
 * gets a visible "done" beat without it lingering forever.
 */

import { useSyncExternalStore, useEffect, useState, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { workStore } from '@/lib/workStore';

export function WorkProgressFloater() {
  const { t } = useTranslation();
  const state = useSyncExternalStore(
    workStore.subscribe,
    workStore.getSnapshot,
    workStore.getSnapshot,
  );

  const [linger, setLinger] = useState(false);
  const analyzeCount = Object.keys(state.analyzeJobs).length;
  const active = analyzeCount > 0;

  useEffect(() => {
    if (active) {
      setLinger(true);
      return undefined;
    }
    const handle = setTimeout(() => setLinger(false), 1200);
    return () => clearTimeout(handle);
  }, [active]);

  // Draggable state
  const [pos, setPos] = useState(null); // null = default position
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const boxRef = useRef(null);

  const handlePointerDown = useCallback((e) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging.current = true;
    boxRef.current.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current || !boxRef.current) return;
    const parentRect = boxRef.current.parentElement.getBoundingClientRect();
    const x = e.clientX - parentRect.left - dragOffset.current.x;
    const y = e.clientY - parentRect.top - dragOffset.current.y;
    setPos({ x: Math.max(0, Math.min(x, parentRect.width - boxRef.current.offsetWidth)), y: Math.max(0, Math.min(y, parentRect.height - boxRef.current.offsetHeight)) });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!active && !linger) return null;

  const analyzeItems = Object.values(state.analyzeJobs).reduce(
    (acc, j) => acc + (j.items || 0), 0,
  );
  const analyzeExpected = Object.values(state.analyzeJobs).reduce(
    (acc, j) => acc + (j.total || 0), 0,
  );
  const analyzeLabel =
    analyzeExpected > 0
      ? t('floater.analyzing', {
          defaultValue: 'Analysing {{n}}/{{m}} items',
          n: analyzeItems,
          m: analyzeExpected,
        })
      : t('floater.analyzingPhotos', {
          defaultValue: 'Analysing {{count}} photo',
          count: analyzeCount,
        });
  const analyzePct =
    analyzeExpected > 0
      ? Math.min(100, Math.round((analyzeItems / analyzeExpected) * 100))
      : 0;

  return (
    <div
      data-testid="work-progress-floater"
      className="fixed z-50 pointer-events-none bottom-20 start-4 md:bottom-4"
    >
      <div
        ref={boxRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={pos ? { transform: `translate(${pos.x - (boxRef.current?.offsetLeft || 0)}px, ${pos.y - (boxRef.current?.offsetTop || 0)}px)` } : undefined}
        className={
          'pointer-events-auto rounded-2xl border border-border bg-card/95 ' +
          'shadow-lg backdrop-blur-xl px-4 py-3 min-w-[220px] max-w-[calc(100vw-2rem)] sm:max-w-[320px] ' +
          'transition-opacity duration-300 touch-none select-none cursor-grab active:cursor-grabbing ' +
          (active ? 'opacity-100' : 'opacity-70')
        }
      >
        {analyzeCount > 0 && (
          <div className="flex flex-col gap-1.5" data-testid="floater-analyze">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" aria-hidden />
              <span className="truncate">{analyzeLabel}</span>
            </div>
            <div
              className="h-1 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={analyzePct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(5, analyzePct)}%` }}
              />
            </div>
          </div>
        )}
        {!active && (
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
            <span aria-hidden>✓</span>
            <span>{t('floater.done', { defaultValue: 'All done' })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
