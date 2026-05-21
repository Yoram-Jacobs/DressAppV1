import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  labelForCategory, labelForDressCode, labelForGender, labelForPattern,
} from '@/lib/taxonomy';
import {
  CATEGORY_OPTIONS, DRESS_CODE_OPTIONS, GENDER_OPTIONS, PATTERN_OPTIONS,
} from '../utils';

export function TaxonomyGrid({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const row = (label, value, setter, options, testid, placeholder, formatter) => {
    const fieldId = `${idPrefix}-${testid}`;
    return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{label}</Label>
      {options ? (
        <Select value={value || ''} onValueChange={(v) => setter(v === '__clear' ? '' : v)} disabled={disabled}>
          <SelectTrigger id={fieldId} className="mt-1 rounded-xl" data-testid={testid}>
            <SelectValue placeholder={placeholder || t('addItem.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {formatter ? formatter(o, t) : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={fieldId}
          value={value || ''}
          onChange={(e) => setter(e.target.value)}
          placeholder={placeholder || ''}
          disabled={disabled}
          data-testid={testid}
          className="mt-1 rounded-xl"
        />
      )}
    </div>
  )};

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {row(t('addItem.category'), fields.category, (v) => onChange({ category: v }), CATEGORY_OPTIONS, 'add-item-category', t('addItem.categoryPlaceholder'), labelForCategory)}
      {row(t('addItem.subCategory'), fields.sub_category, (v) => onChange({ sub_category: v }), null, 'add-item-subcategory', t('addItem.subCategoryPlaceholder'))}
      {row(t('addItem.itemType'), fields.item_type, (v) => onChange({ item_type: v }), null, 'add-item-itemtype', t('addItem.itemTypePlaceholder'))}
      {row(t('addItem.brand'), fields.brand, (v) => onChange({ brand: v }), null, 'add-item-brand', t('addItem.brandPlaceholder'))}
      {row(t('itemDetail.edit.gender'), fields.gender, (v) => onChange({ gender: v }), GENDER_OPTIONS, 'add-item-gender', t('addItem.genderPlaceholder'), labelForGender)}
      {row(t('addItem.dressCode'), fields.dress_code, (v) => onChange({ dress_code: v }), DRESS_CODE_OPTIONS, 'add-item-dresscode', t('addItem.dressCodePlaceholder'), labelForDressCode)}
      {row(t('addItem.pattern'), fields.pattern, (v) => onChange({ pattern: v }), PATTERN_OPTIONS, 'add-item-pattern', t('addItem.patternPlaceholder'), labelForPattern)}
      {row(t('addItem.tradition'), fields.tradition, (v) => onChange({ tradition: v }), null, 'add-item-tradition', t('addItem.traditionPlaceholder'))}
      {row(t('addItem.size'), fields.size, (v) => onChange({ size: v }), null, 'add-item-size', t('addItem.sizePlaceholder'))}
    </div>
  );
}
