import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Normalizes an array of {name, pct} or string items so that:
 * 1. Every entry is { name: string, pct: number }.
 * 2. Missing, null, or zero percentages are intelligently inferred.
 * 3. Total sum strictly equals 100%.
 */
export function normalizeWeightedTags(tags) {
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : [tags];
  const clean = [];
  for (const it of arr) {
    if (typeof it === 'string' && it.trim()) {
      clean.push({ name: it.trim(), pct: null });
    } else if (it && typeof it === 'object' && it.name) {
      const p = it.pct != null && it.pct !== '' && !isNaN(Number(it.pct)) ? Number(it.pct) : null;
      clean.push({ ...it, pct: p });
    }
  }
  if (!clean.length) return [];
  if (clean.length === 1) {
    clean[0].pct = 100;
    return clean;
  }
  const knownSum = clean.reduce((s, c) => s + (c.pct != null && c.pct > 0 ? c.pct : 0), 0);
  const unassigned = clean.filter((c) => c.pct == null || c.pct <= 0);

  if (unassigned.length === 0 && knownSum === 100) {
    return clean;
  }

  if (knownSum > 0 && knownSum < 100 && unassigned.length > 0) {
    const rem = 100 - knownSum;
    const share = Math.floor(rem / unassigned.length);
    let distributed = 0;
    unassigned.forEach((c, idx) => {
      if (idx === unassigned.length - 1) {
        c.pct = rem - distributed;
      } else {
        c.pct = share;
        distributed += share;
      }
    });
    return clean;
  }

  // All unassigned or invalid sum: distribute sensibly so primary color is dominant
  if (clean.length === 2) {
    clean[0].pct = 70;
    clean[1].pct = 30;
  } else if (clean.length === 3) {
    clean[0].pct = 60;
    clean[1].pct = 25;
    clean[2].pct = 15;
  } else if (clean.length === 4) {
    clean[0].pct = 50;
    clean[1].pct = 25;
    clean[2].pct = 15;
    clean[3].pct = 10;
  } else {
    const share = Math.floor(100 / clean.length);
    const rem = 100 % clean.length;
    clean.forEach((c, idx) => {
      c.pct = share + (idx === 0 ? rem : 0);
    });
  }
  return clean;
}

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
 *   idPrefix?: optional ID prefix for scoped elements
 *   label?: literal heading string (takes precedence over labelKey).
 *   labelKey?: i18n key for the heading.
 *   items: array of `{ name: string, pct: number|null }`.
 *   onChange: receives the next items array.
 *   placeholder: per-row name input placeholder.
 *   disabled: read-only mode.
 *   testid: prefix for `data-testid` on the rows + add button.
 */
export function WeightedList({
  idPrefix,
  label,
  labelKey,
  items,
  onChange,
  placeholder,
  disabled,
  testid,
}) {
  const { t } = useTranslation();
  const safe = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  // Auto-heal unassigned percentages on mount/change if items have names but missing percentages
  useEffect(() => {
    if (!onChange || disabled) return;
    if (safe.length > 0 && safe.some((it) => it && it.name && (it.pct == null || it.pct === ''))) {
      const normalized = normalizeWeightedTags(safe);
      onChange(normalized);
    }
  }, [safe, onChange, disabled]);

  const sum = safe.reduce((s, it) => s + (Number(it.pct) || 0), 0);
  const update = (i, patch) =>
    onChange(safe.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(safe.filter((_, j) => j !== i));
  const add = () => {
    const rem = Math.max(0, 100 - sum);
    onChange([...safe, { name: '', pct: rem > 0 ? rem : (safe.length === 0 ? 100 : 0) }]);
  };
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
              id={idPrefix ? `${idPrefix}-${testid}-name-${i}` : `${testid}-name-${i}`}
              value={it.name || ''}
              className="mb-0"
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={placeholder}
              disabled={disabled}
              data-testid={`${testid}-name-${i}`}
              aria-label={`${heading} item name ${i + 1}`}
            />
            <Input
              id={idPrefix ? `${idPrefix}-${testid}-pct-${i}` : `${testid}-pct-${i}`}
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
