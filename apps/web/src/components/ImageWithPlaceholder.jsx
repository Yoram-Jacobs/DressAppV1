import React, { useState, useEffect } from 'react';
import { resolveMediaUrl } from '@/lib/itemImage';

/**
 * Reusable progressive image loading component with an instant low-res blurred placeholder.
 * Similar to Pinterest/Instagram loading transitions.
 */
export default function ImageWithPlaceholder({ src, placeholder, alt, className = '', imgClassName = '', objectFit = 'cover', ...props }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = resolveMediaUrl(src);
  const resolvedPlaceholder = resolveMediaUrl(placeholder);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [resolvedSrc]);

  if (!resolvedSrc && !resolvedPlaceholder) return null;

  return (
    <div className={`relative overflow-hidden ${className}`} {...props}>
      {/* 1. Low-res blurred placeholder (renders immediately while main image loads) */}
      {resolvedPlaceholder && !isLoaded && (
        <img
          src={resolvedPlaceholder}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-${objectFit} ${imgClassName} filter blur-md scale-[1.05] transition-opacity duration-300 ease-out`}
          style={{ zIndex: 1 }}
        />
      )}

      {/* 2. High-res target image */}
      {resolvedSrc && !hasError ? (
        <img
          src={resolvedSrc}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          className={`w-full h-full object-${objectFit} ${imgClassName} transition-opacity duration-300 ease-in-out`}
          style={{
            opacity: isLoaded ? 1 : (resolvedPlaceholder ? 0 : 0.85),
            position: 'relative',
            zIndex: 2,
          }}
        />
      ) : resolvedPlaceholder ? (
        <img
          src={resolvedPlaceholder}
          alt={alt}
          className={`w-full h-full object-${objectFit} ${imgClassName}`}
          style={{ zIndex: 2 }}
        />
      ) : (
        <div className="w-full h-full bg-muted/20 animate-pulse" />
      )}
    </div>
  );
}
