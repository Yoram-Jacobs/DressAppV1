import React from 'react';
import { useTranslation } from 'react-i18next';
import AvatarViewer from './AvatarViewer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function OutfitAvatarViewer({ shapeParams, sex, outfitItemsMap, className = '', onItemClick, badgeContent, children }) {
  const { t } = useTranslation();

  return (
    <div className={cn('avatar-stage', className)}>
      <div className="avatar-stage__viewer">
        <AvatarViewer shapeParams={shapeParams} sex={sex} outfitItems={outfitItemsMap} onItemClick={onItemClick} />
      </div>
      {badgeContent && (
        <Badge className="avatar-stage__badge caps-label">
          {badgeContent}
        </Badge>
      )}
      {children}
    </div>
  );
}