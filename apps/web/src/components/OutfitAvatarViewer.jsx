import React from 'react';
import { useTranslation } from 'react-i18next';
import AvatarViewer from './AvatarViewer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function OutfitAvatarViewer({ shapeParams, sex, outfitItemsMap, className = '', onItemClick, badgeContent, children }) {
  const { t } = useTranslation();

  return (
    <div className={cn("relative w-full aspect-[4/5] bg-secondary/10 shrink-0", className)}>
      <AvatarViewer shapeParams={shapeParams} sex={sex} outfitItems={outfitItemsMap} onItemClick={onItemClick} />
      {badgeContent && (
        <Badge className="absolute top-3 start-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
          {badgeContent}
        </Badge>
      )}
      {children}
    </div>
  );
}
