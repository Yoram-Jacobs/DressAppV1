import React, { useState, useEffect, useRef } from 'react';
import { Blurhash } from 'react-blurhash';

/**
 * ProgressiveImage - Mimics Pinterest/Instagram image loading strategy.
 * 
 * 1. Initially displays a tiny <canvas> BlurHash.
 * 2. Uses IntersectionObserver to trigger loading when the image is within `rootMargin`.
 * 3. Uses a <picture> element to let the browser pick AVIF > WebP > Original formats natively.
 */
export default function ProgressiveImage({
  variants, // Object: { blurhash: "...", original: "url", webp: { medium: "url" }, avif: { medium: "url" } }
  originalSrc, // Fallback if variants don't exist
  alt,
  className,
  style,
  objectFit = 'cover',
  forceVisible = false
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(forceVisible);
  const imgRef = useRef(null);

  // IntersectionObserver for pre-fetching
  useEffect(() => {
    if (forceVisible) return;
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Only need to load it once
        }
      },
      { rootMargin: '600px 0px' } // Pre-fetch 2-3 screens down
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLoad = () => setIsLoaded(true);

  const isDataUrl = typeof originalSrc === 'string' && originalSrc.startsWith('data:image');

  // Fallback to legacy single-image rendering
  if (isDataUrl || !variants || (!variants.blurhash && !variants.webp)) {
    return (
      <img
        src={originalSrc || variants?.original}
        alt={alt}
        className={className}
        style={{ objectFit, ...style }}
        loading={forceVisible ? undefined : "lazy"}
      />
    );
  }

  // Determine best sizes (simplification, typically you'd pick based on container)
  const avifUrl = variants.avif?.medium || variants.avif?.small;
  const webpUrl = variants.webp?.medium || variants.webp?.small;
  const fallbackUrl = variants.original || originalSrc;

  return (
    <div
      ref={imgRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        ...style,
      }}
    >
      {/* 1. BlurHash Placeholder */}
      {!isLoaded && variants.blurhash && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Blurhash
            hash={variants.blurhash}
            width="100%"
            height="100%"
            resolutionX={32}
            resolutionY={32}
            punch={1}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* 2. The Transcoded Picture Handshake */}
      {isInView && (
        <picture
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            zIndex: 2,
          }}
        >
          {avifUrl && <source srcSet={avifUrl} type="image/avif" />}
          {webpUrl && <source srcSet={webpUrl} type="image/webp" />}
          <img
            src={fallbackUrl}
            alt={alt}
            onLoad={handleLoad}
            style={{ width: '100%', height: '100%', objectFit }}
          />
        </picture>
      )}
    </div>
  );
}
