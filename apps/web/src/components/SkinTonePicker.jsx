import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const SKIN_TONE_PALETTE = [
  { id: 'default', color: '#9CA3AF' }, // Default Gray
  { id: 'fair', color: '#FDF0EA' },
  { id: 'light', color: '#F5D0A9' },
  { id: 'medium', color: '#E0AC69' },
  { id: 'tan', color: '#C68642' },
  { id: 'bronze', color: '#8D5524' },
  { id: 'dark', color: '#3C2E28' },
];

export default function SkinTonePicker({ value = '#9CA3AF', onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeColor = value || '#9CA3AF';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Dropdown Button showing current selected color square */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Select Skin Tone"
      >
        <span
          className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/20 shadow-inner flex items-center justify-center shrink-0 transition-transform active:scale-95"
          style={{ backgroundColor: activeColor }}
        />
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu - No text, strictly color squares */}
      {isOpen && (
        <div className="absolute end-0 mt-2 z-50 p-2.5 bg-card/95 backdrop-blur-md rounded-2xl border border-border shadow-xl grid grid-cols-4 gap-2.5 min-w-[170px] animate-in fade-in zoom-in-95 duration-150">
          {SKIN_TONE_PALETTE.map((item) => {
            const isSelected = activeColor.toLowerCase() === item.color.toLowerCase();
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.color);
                  setIsOpen(false);
                }}
                className={`group relative w-8 h-8 rounded-lg border transition-all flex items-center justify-center ${
                  isSelected 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent scale-105' 
                    : 'border-black/10 dark:border-white/20 hover:scale-105 hover:shadow-md'
                }`}
                style={{ backgroundColor: item.color }}
              >
                {isSelected && (
                  <Check className={`w-4 h-4 ${['#fdf0ea', '#f5d0a9'].includes(item.color.toLowerCase()) ? 'text-black/80' : 'text-white'}`} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
