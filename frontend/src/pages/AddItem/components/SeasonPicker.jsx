import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { labelForSeason } from '@/lib/taxonomy';
import { SEASON_OPTIONS } from '../utils';

export function SeasonPicker({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const active = new Set(fields.season || []);
  const toggle = (s) => {
    const next = new Set(active);
    if (s === 'all') { next.clear(); next.add('all'); }
    else {
      next.delete('all');
      if (next.has(s)) next.delete(s); else next.add(s);
    }
    onChange({ season: Array.from(next) });
  };
  const labelId = `${idPrefix}-season`;
  return (
    <div>
      <Label id={labelId} className="caps-label text-muted-foreground">{t('addItem.season')}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-labelledby={labelId} data-testid="add-item-season">
        {SEASON_OPTIONS.map((s) => {
          const on = active.has(s);
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => toggle(s)}
              aria-pressed={on}
              data-testid={`add-item-season-${s}`}
              className={`rounded-full px-3 py-1 text-xs border ${
                on ? 'bg-[hsl(var(--accent))] text-white border-[hsl(var(--accent))]' : 'bg-background border-border text-muted-foreground'
              }`}
            >
              {labelForSeason(s, t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
