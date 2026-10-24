import React from 'react';
import { useTranslation } from 'react-i18next';
import AvatarViewer from './AvatarViewer';
import OutfitPiecePreview from './OutfitPiecePreview';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function OutfitAvatarViewer({
  shapeParams,
  measurements,
  skinColor,
  hair,
  sex,
  outfitItemsMap,
  className = '',
  onItemClick,
  badgeContent,
  interactive = false,
  children,
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("relative w-full aspect-[4/5] bg-secondary/10 shrink-0 overflow-hidden", className)}>
      {interactive ? (
        <AvatarViewer
          shapeParams={shapeParams}
          measurements={measurements}
          skinColor={skinColor}
          hair={hair}
          sex={sex}
          outfitItems={outfitItemsMap}
          onItemClick={onItemClick}
          interactive={true}
        />
      ) : (
        <OutfitPiecePreview
          outfitItems={outfitItemsMap}
          onItemClick={onItemClick}
          shapeParams={shapeParams}
          measurements={measurements}
          skinColor={skinColor}
          hair={hair}
          sex={sex}
        />
      )}
      {badgeContent && (
        <Badge className="absolute top-3 start-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur z-30">
          {badgeContent}
        </Badge>
      )}
      {children}
    </div>
  );
}
