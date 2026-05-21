import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { labelForState, labelForCondition, labelForQuality } from '@/lib/taxonomy';
import { STATE_OPTIONS, CONDITION_OPTIONS, QUALITY_OPTIONS } from '../utils';

export function QualityRow({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const cell = (label, value, setter, options, testid, formatter) => {
    const fieldId = `${idPrefix}-${testid}`;
    return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{label}</Label>
      <Select value={value || ''} onValueChange={(v) => setter(v === '__clear' ? '' : v)} disabled={disabled}>
        <SelectTrigger id={fieldId} className="mt-1 rounded-xl" data-testid={testid}>
          <SelectValue placeholder={t('addItem.selectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {formatter ? formatter(o, t) : o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )};
  return (
    <div className="grid grid-cols-3 gap-3">
      {cell(t('addItem.state'), fields.state, (v) => onChange({ state: v }), STATE_OPTIONS, 'add-item-state', labelForState)}
      {cell(t('addItem.condition'), fields.condition, (v) => onChange({ condition: v }), CONDITION_OPTIONS, 'add-item-condition', labelForCondition)}
      {cell(t('addItem.qualityLabel'), fields.quality, (v) => onChange({ quality: v }), QUALITY_OPTIONS, 'add-item-quality', labelForQuality)}
    </div>
  );
}
