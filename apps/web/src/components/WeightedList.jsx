import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Editable list of weighted (name, %) entries — used for the rich
 * `colors` and `fabric_materials` taxonomy across both the Add Item
 * and Item Detail (edit) pages.
 *
 * Lives in `components/` (not co-located with a page) because both
 * pages render the exact same control: keeping a single source of
 * truth means the percentage validation (sum coloured red/green at
 * 100) and field shape stay consistent end-to-end.
 *
 * Props:
 *   label?: literal heading string (takes precedence over labelKey).
 *   labelKey?: i18n key for the heading.
 *   items: array of `{ name: string, pct: number|null }`.
 *   onChange: receives the next items array.
 *   placeholder: per-row name input placeholder.
 *   disabled: read-only mode.
 *   testid: prefix for `data-testid` on the rows + add button.
 */
export function WeightedList({
  label,
  labelKey,
  items,
  onChange,
  placeholder,
  disabled,
  testid,
}) {
  const { t } = useTranslation();
  const safe = Array.isArray(items) ? items : [];
  const sum = safe.reduce((s, it) => s + (Number(it.pct) || 0), 0);
  const update = (i, patch) =>
    onChange(safe.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(safe.filter((_, j) => j !== i));
  const add = () => onChange([...safe, { name: '', pct: 0 }]);
  const heading = labelKey ? t(labelKey) : label;
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{heading}</Label>
        <span
          className={`text-[10px] font-bold ${
            sum === 100
              ? 'text-primary-brand'
              : sum > 100
              ? 'text-rose-700'
              : 'text-text-brand'
          }`}
        >
          {sum}%
        </span>
      </div>
      <div className="mt-1 space-y-1.5" data-testid={testid}>
        {safe.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              id={`${testid}-name-${i}`}
              value={it.name || ''}
              className="mb-0"
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={placeholder}
              disabled={disabled}
              data-testid={`${testid}-name-${i}`}
              aria-label={`${heading} item name ${i + 1}`}
            />
            <Input
              id={`${testid}-pct-${i}`}
              type="number"
              min="0"
              max="100"
              className="w-30 mb-0"
              value={it.pct ?? ''}
              onChange={(e) =>
                update(i, {
                  pct:
                    e.target.value === ''
                      ? null
                      : Math.max(0, Math.min(100, Number(e.target.value))),
                })
              }
              disabled={disabled}
              data-testid={`${testid}-pct-${i}`}
              aria-label={`${heading} item percentage ${i + 1}`}
            />
            <span className="text-xs text-text-brand">%</span>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              className="flex items-center justify-center"
              aria-label={t('addItem.removeEntryAria', {
                label: it.name || heading,
              })}
              data-testid={`${testid}-remove-${i}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-[#ef4444] hover:text-dark-brand" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          className="!gap-0"
          onClick={add}
          disabled={disabled}
          data-testid={`${testid}-add`}
        >
          <Plus className="h-3 w-3 text-white" />{t('addItem.addAction')}
        </Button>
      </div>
    </div>
  );
}

export default WeightedList;
