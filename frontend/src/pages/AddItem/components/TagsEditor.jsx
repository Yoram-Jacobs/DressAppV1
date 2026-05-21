import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TagsEditor({ idPrefix, items, onChange, disabled }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  const fieldId = `${idPrefix}-tag-input`;
  return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{t('addItem.tags')}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5" data-testid="add-item-tags">
        {items.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[11px] pl-2 pr-1 flex items-center gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== tag))}
              disabled={disabled}
              className="h-4 w-4 rounded-full hover:bg-secondary flex items-center justify-center"
              aria-label={t('addItem.removeTagAria', { label: tag })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('addItem.addTag')}
            disabled={disabled}
            className="h-8 text-xs rounded-full w-32"
            data-testid="add-item-tag-input"
          />
          <Button type="button" size="sm" variant="ghost" className="text-xs h-8" onClick={add} disabled={disabled || !draft.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
