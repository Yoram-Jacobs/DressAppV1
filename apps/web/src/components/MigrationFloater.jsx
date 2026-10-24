import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Shirt } from 'lucide-react';

/**
 * Movable / Draggable Compact DressApp Migration Agent Floater
 * Features:
 * - DressApp Wardrobe Agent Icon (Hanger/Shirt + Sparkles)
 * - Draggable anywhere on the screen (touch + pointer)
 * - Boundary clamping so it never disappears off-screen
 * - Remembers position in localStorage
 * - Compact 44px circular footprint so it won't block competitor logins, pop-up close buttons, or grid controls
 * - Subtle pulsing indicator showing the DressApp Agent is standing by and monitoring the wardrobe platform
 */
export function MigrationFloater({ onClick, className = '', isScanning = false }) {
  const { t } = useTranslation();
  const fabRef = useRef(null);

  // Position state (null initially until mounted to read window size)
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('dressapp_migration_floater_pos');
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
      const defaultY = Math.max(16, window.innerHeight - 110);
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
          localStorage.setItem('dressapp_migration_floater_pos', JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) }));
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
      aria-label={t('migration.agentTitle', { defaultValue: 'DressApp Migration Agent' })}
      title={t('migration.floaterTooltip', {
        defaultValue: 'DressApp Agent: Drag anywhere out of the way. Tap when you are on your wardrobe grid.',
      })}
      data-testid="migration-agent-floater"
      className={`fixed z-[9999] flex items-center justify-center w-12 h-12 rounded-full bg-slate-900 border-2 border-indigo-400 text-white shadow-[0_8px_24px_-4px_rgba(15,23,42,0.6),0_0_16px_rgba(99,102,241,0.45)] transition-transform duration-150 select-none touch-none cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 ${
        isDragging ? 'scale-110 border-indigo-300 shadow-[0_16px_32px_-8px_rgba(99,102,241,0.7)]' : ''
      } ${className}`}
    >
      {/* Outer Pulse Ring when idle or scanning */}
      <span className={`absolute -inset-1 rounded-full bg-indigo-500/25 pointer-events-none ${isScanning ? 'animate-ping' : 'animate-pulse'}`} />

      {/* DressApp Agent Icon */}
      <span className="relative flex items-center justify-center w-full h-full pointer-events-none">
        <Shirt className="w-5 h-5 text-indigo-300" />
        <Sparkles className="w-3 h-3 text-amber-400 absolute -top-0.5 -right-0.5 animate-spin-slow" />
      </span>
    </button>
  );
}

export default MigrationFloater;
