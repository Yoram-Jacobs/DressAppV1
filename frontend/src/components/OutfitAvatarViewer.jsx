import React from 'react';
import { useTranslation } from 'react-i18next';
import AvatarViewer from './AvatarViewer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function OutfitAvatarViewer({ shapeParams, sex, outfitItemsMap, className = '', onItemClick, badgeContent, children }) {
  const { t } = useTranslation();
  const outerwear = outfitItemsMap['outerwear'];
  const hasOuterwear = outerwear && !!(outerwear.image_url || outerwear.url);
  const hasTopOrDress = outfitItemsMap['top'] || outfitItemsMap['dress'];

  if (hasOuterwear && hasTopOrDress) {
    const withOuterwearMap = { ...outfitItemsMap };
    delete withOuterwearMap['top'];
    delete withOuterwearMap['dress'];

    const withoutOuterwearMap = { ...outfitItemsMap };
    delete withoutOuterwearMap['outerwear'];

    return (
      <div className={cn("flex flex-col w-full", className)}>
        <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0 border-b border-border/50">
          <AvatarViewer shapeParams={shapeParams} sex={sex} outfitItems={withOuterwearMap} onItemClick={onItemClick} />
          {badgeContent && (
            <Badge className="absolute top-3 left-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
              {badgeContent}
            </Badge>
          )}
          <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur px-2.5 py-1 rounded-md text-[10px] font-medium text-foreground shadow-sm pointer-events-none border border-border/50">
            {t('suitcase.withOuterwear', { defaultValue: 'With Outerwear' })}
          </div>
          {children}
        </div>
        <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0">
          <AvatarViewer shapeParams={shapeParams} sex={sex} outfitItems={withoutOuterwearMap} onItemClick={onItemClick} />
          <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur px-2.5 py-1 rounded-md text-[10px] font-medium text-foreground shadow-sm pointer-events-none border border-border/50">
            {t('suitcase.withoutOuterwear', { defaultValue: 'Without Outerwear' })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full aspect-[4/5] bg-secondary/10 shrink-0", className)}>
      <AvatarViewer shapeParams={shapeParams} sex={sex} outfitItems={outfitItemsMap} onItemClick={onItemClick} />
      {badgeContent && (
        <Badge className="absolute top-3 left-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
          {badgeContent}
        </Badge>
      )}
      {children}
    </div>
  );
}
