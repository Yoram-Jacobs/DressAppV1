import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function NameCaption({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-name`} className="caps-label text-muted-foreground">{t('addItem.itemName')}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={fields.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('addItem.namePlaceholder')}
          disabled={disabled}
          data-testid="add-item-name"
          className="mt-1 font-display text-xl bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-[hsl(var(--accent))]"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-caption`} className="caps-label text-muted-foreground">{t('addItem.caption')}</Label>
        <Textarea
          id={`${idPrefix}-caption`}
          value={fields.caption || ''}
          onChange={(e) => onChange({ caption: e.target.value })}
          rows={2}
          placeholder={t('addItem.captionPlaceholder')}
          disabled={disabled}
          data-testid="add-item-caption"
          className="mt-1 resize-none"
        />
      </div>
    </div>
  );
}
