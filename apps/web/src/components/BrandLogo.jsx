import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * DressApp brand lockup: the new figure-in-circle mark (served from
 * /apple-touch-icon.png so it's always available without bundling a
 * second copy into the JS bundle) placed to the left of the Gloock
 * serif wordmark.
 *
 * Sizing is controlled via the ``size`` prop so the same component
 * works in the small TopNav slot (text-2xl) and the large login
 * editorial panel (text-3xl) without re-implementing the markup in
 * each location.
 */
export function BrandLogo({ className, size = 'md', showWordmark = true, testId = 'brand-logo', }) {
  const { t } = useTranslation();
  // Map the size prop to matching mark height + text class. Keeping
  // both in one table makes it obvious the two scale together.
  // Mark heights are tuned to the cap-height of the Gloock wordmark
  // so the figure optically sits on the same baseline as the letters.
  // The wordmark already has ``leading-none`` which drops its line-box
  // close to its cap-height; the mark is sized to roughly match that
  // (≈ 0.75× of the text's em-box) instead of matching the whole
  // line-height, which otherwise makes the icon look oversized.
  const sizing = {
    sm: { markH: 'h-[50px]', wordClass: 'text-xl' },
    md: { markH: 'h-[50px]', wordClass: 'text-2xl' },
    lg: { markH: 'h-[50px]', wordClass: 'text-3xl' },
    xl: { markH: 'h-[50px]', wordClass: 'text-4xl' },
  }
  [size] || { markH: 'h-6', wordClass: 'text-2xl', };

  return (
    <div className={cn('flex items-center gap-2', className)} data-testid={testId} >
      <img src="/apple-touch-icon.png" alt={t('brand', { defaultValue: 'DressApp' })} loading="eager" decoding="async" className={cn(sizing.markH, 'w-auto object-contain shrink-0')} /> {showWordmark && (<span className={cn('font-display text-primary-brand leading-none self-center font-extrabold', sizing.wordClass)} > {t('brand', { defaultValue: 'DressApp' })} </span>)} </div>);
}
export default BrandLogo;
