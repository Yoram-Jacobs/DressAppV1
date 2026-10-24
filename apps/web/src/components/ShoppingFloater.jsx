import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Movable / Draggable Compact Shopping Assistant Floater
 * Features:
 * - Measurement Tape Roller Icon
 * - Draggable anywhere on the screen (touch + pointer)
 * - Boundary clamping so it never disappears off-screen
 * - Remembers position in localStorage
 * - Compact 44px circular footprint so it won't block incoming calls or shopping controls
 */
export function ShoppingFloater({ onClick, className = '' }) {
  const { t } = useTranslation();
  const fabRef = useRef(null);

  // Position state (null initially until mounted to read window size)
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('dressapp_fab_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
    active: false,
  });

  // Default placement on bottom-right of viewport if no saved position
  useEffect(() => {
    if (!pos) {
      const defaultX = Math.max(16, window.innerWidth - 64);
      const defaultY = Math.max(16, window.innerHeight - 100);
      setPos({ x: defaultX, y: defaultY });
    }
  }, [pos]);

  // Keep position clamped on window resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        const clampedX = Math.min(Math.max(10, prev.x), window.innerWidth - 54);
        const clampedY = Math.min(Math.max(10, prev.y), window.innerHeight - 54);
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragInfo.current = {
      startX: clientX,
      startY: clientY,
      initialX: pos ? pos.x : 0,
      initialY: pos ? pos.y : 0,
      hasMoved: false,
      active: true,
    };
  }, [pos]);

  const handlePointerMove = useCallback((e) => {
    if (!dragInfo.current.active) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragInfo.current.startX;
    const dy = clientY - dragInfo.current.startY;

    if (!dragInfo.current.hasMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragInfo.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragInfo.current.hasMoved) {
      if (e.cancelable) e.preventDefault();
      const newX = Math.min(Math.max(8, dragInfo.current.initialX + dx), window.innerWidth - 52);
      const newY = Math.min(Math.max(8, dragInfo.current.initialY + dy), window.innerHeight - 52);
      setPos({ x: Math.round(newX), y: Math.round(newY) });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragInfo.current.active) return;
    dragInfo.current.active = false;
    setIsDragging(false);

    if (dragInfo.current.hasMoved) {
      try {
        if (pos) {
          localStorage.setItem('dressapp_fab_pos', JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) }));
        }
      } catch {}
    }
  }, [pos]);

  useEffect(() => {
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => handlePointerUp();

    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleClick = (e) => {
    if (dragInfo.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) onClick();
  };

  if (!pos) return null;

  return (
    <button
      ref={fabRef}
      type="button"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      onTouchStart={handlePointerDown}
      onMouseDown={handlePointerDown}
      onClick={handleClick}
      aria-label={t('shareTarget.badge', { defaultValue: 'DressApp Sizing Assistant' })}
      title={t('shoppingHub.floaterTooltip', { defaultValue: 'Drag anywhere to reposition. Tap for size recommendation.' })}
      data-testid="shopping-assistant-floater"
      className={`fixed z-[9999] flex items-center justify-center w-11 h-11 rounded-full bg-slate-900 border-2 border-sky-400/60 text-sky-400 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.6),0_0_12px_rgba(14,165,233,0.3)] transition-transform duration-150 select-none touch-none cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 ${
        isDragging ? 'scale-110 border-sky-400 shadow-[0_16px_32px_-8px_rgba(14,165,233,0.6)]' : ''
      } ${className}`}
    >
      {/* Measurement Tape Roller SVG (retractable tape measure with spool & markings) */}
      <span className="flex items-center justify-center w-full h-full pointer-events-none">
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Tape measure casing */}
          <rect x="2" y="5" width="13" height="14" rx="4" fill="rgba(14,165,233,0.12)" />
          {/* Center spindle */}
          <circle cx="8.5" cy="12" r="2.5" fill="currentColor" />
          {/* Extended tape blade */}
          <path d="M15 9h7v6h-7" fill="rgba(255,255,255,0.08)" />
          {/* Measurement marks */}
          <line x1="17.5" y1="9" x2="17.5" y2="12" />
          <line x1="19.5" y1="9" x2="19.5" y2="13.5" />
          <line x1="21.5" y1="9" x2="21.5" y2="12" />
        </svg>
      </span>
    </button>
  );
}

export default ShoppingFloater;
