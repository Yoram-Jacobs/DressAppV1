import React, { useState, useEffect } from 'react';
import { resolveMediaUrl } from '@/lib/itemImage';

/**
 * Reusable progressive image loading component with an instant low-res blurred placeholder.
 * Similar to Pinterest/Instagram loading transitions.
 */
export default function ImageWithPlaceholder({ src, placeholder, alt, className = '', objectFit = 'cover', ...props }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [highResSrc, setHighResSrc] = useState(null);

  const resolvedSrc = resolveMediaUrl(src);
  const resolvedPlaceholder = resolveMediaUrl(placeholder);

  useEffect(() => {
    // Reset loaded state when source changes
    setIsLoaded(false);
    setHighResSrc(null);

    if (!resolvedSrc) return;

    // Preload the high-resolution image in memory
    const img = new Image();
    img.src = resolvedSrc;
    img.onload = () => {
      setHighResSrc(resolvedSrc);
      setIsLoaded(true);
    };
    img.onerror = () => {
      // In case of error, mark loaded so spinner doesn't loop forever
      setIsLoaded(true);
    };
  }, [resolvedSrc]);

  return (
    <div className={`relative overflow-hidden ${className}`} {...props}>
      {/* 1. Low-res blurred placeholder (renders immediately) */}
      {placeholder && !isLoaded && (
        <img
          src={placeholder}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-${objectFit} filter blur-md scale-[1.05] transition-opacity duration-500 ease-out`}
          style={{ zIndex: 1 }}
        />
      )}

      {/* 2. High-res target image (fades in once fully loaded) */}
      {highResSrc ? (
        <img
          src={highResSrc}
          alt={alt}
          className={`w-full h-full object-${objectFit} transition-opacity duration-500 ease-in-out`}
          style={{
            opacity: isLoaded ? 1 : 0,
            position: isLoaded ? 'relative' : 'absolute',
            top: 0,
            left: 0,
          }}
        />
      ) : (
        /* Fallback if still preloading and no placeholder is set */
        <div className="w-full h-full bg-muted/20 animate-pulse" />
      )}
    </div>
  );
}
