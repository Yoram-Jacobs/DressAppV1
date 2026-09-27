import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ruler, Sparkles, Loader2 } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { MeasurementNumField, MeasurementTextField } from './primitives.jsx';

export function MeasurementsSection({
  form,
  setForm,
  setNested,
  onChange,
  t,
  wUnit,
  lUnit,
  isFemale,
  isFreshStart,
  hasFilledBasic,
  predicting,
  hasPredicted,
}) {
  const [predictingState, setPredicting] = useState(false);
  const [hasPredictedState, setHasPredicted] = useState(false);
  const lastCallRef = useRef('');

  const isFemaleProp = isFemale ?? form.sex === 'female';

  const effectivePredicting = Boolean(predicting || predictingState);
  const effectiveHasPredicted = Boolean(hasPredicted || hasPredictedState);

  const handlePredictMeasurements = async (height, weight, waist, footLength, sex) => {
    let h_cm = parseFloat(height);
    let w_kg = parseFloat(weight);
    let wa_cm = parseFloat(waist);
    let fl_cm = parseFloat(footLength);

    if (isNaN(h_cm) || isNaN(w_kg) || isNaN(wa_cm) || isNaN(fl_cm)) return;

    if (lUnit === 'in') {
      h_cm *= 2.54;
      wa_cm *= 2.54;
      fl_cm *= 2.54;
    }
    if (wUnit === 'lb') {
      w_kg *= 0.45359237;
    }

    setPredicting(true);
    try {
      const predictFn = api.predictMeasurements || api.misc?.predictMeasurements;
      if (!predictFn) {
        throw new Error('predictMeasurements API method not found');
      }

      const res = await predictFn({
        height: h_cm,
        weight: w_kg,
        waist: wa_cm,
        foot_length: fl_cm,
        gender: sex === 'male' ? 'male' : 'female',
      });

      const convertVal = (val) => {
        if (val == null || isNaN(val)) return '';
        if (lUnit === 'in') {
          return Math.round((val / 2.54) * 10) / 10;
        }
        return Math.round(val * 10) / 10;
      };

      const patch = {
        shoulders: convertVal(res.shoulders),
        chest: convertVal(res.chest),
        hip: convertVal(res.hip),
        sleeve: convertVal(res.sleeve),
        inseam: convertVal(res.inseam),
        outseam: convertVal(res.outseam),
      };

      if (res.recommended_sizes) {
        if (res.recommended_sizes.shirt_size) {
          patch.shirt_size = res.recommended_sizes.shirt_size;
        }
        if (res.recommended_sizes.pants_size) {
          patch.pants_size = res.recommended_sizes.pants_size;
        }
        if (res.recommended_sizes.shoe_size_us) {
          patch.shoe_size = res.recommended_sizes.shoe_size_us;
        }
        if (res.recommended_sizes.dress_size && res.recommended_sizes.dress_size !== 'N/A') {
          patch.dress_size = res.recommended_sizes.dress_size;
        }
        if (res.recommended_sizes.bra_size && res.recommended_sizes.bra_size !== 'N/A') {
          patch.bra_size = res.recommended_sizes.bra_size;
        }
      }

      // Atomically apply updates to form state
      if (setForm) {
        setForm((prev) => ({
          ...prev,
          body_measurements: {
            ...prev.body_measurements,
            ...patch,
          },
        }));
      } else if (setNested) {
        setNested('body_measurements', patch);
      } else if (typeof onChange === 'function') {
        Object.entries(patch).forEach(([k, v]) => onChange(k, v));
      }

      setHasPredicted(true);
      toast.success(
        t('profile.measurements.predictedSuccess', {
          defaultValue: 'Body dimensions calculated using AI!',
        }),
      );
    } catch (err) {
      console.error('Prediction failed:', err);
      toast.error(
        err?.response?.data?.detail ||
          t('profile.measurements.predictFailed', {
            defaultValue: 'Failed to calculate body dimensions.',
          }),
      );
    } finally {
      setPredicting(false);
    }
  };

  const hasFilledBasicLocal = !!(
    form.body_measurements?.height &&
    form.body_measurements?.weight &&
    form.body_measurements?.waist &&
    form.body_measurements?.foot_length
  );

  const effectiveIsFreshStart =
    isFreshStart ??
    !(
      form.body_measurements?.shoulders ||
      form.body_measurements?.chest ||
      form.body_measurements?.hip ||
      form.body_measurements?.sleeve ||
      form.body_measurements?.inseam ||
      form.body_measurements?.outseam
    );

  useEffect(() => {
    const bm = form.body_measurements || {};
    const { height, weight, waist, foot_length, shoulders, chest, hip } = bm;
    const sex = form.sex || 'female';

    if (!height || !weight || !waist || !foot_length) return;

    const hasCalculated = Boolean(shoulders || chest || hip);
    const callSig = `${height}_${weight}_${waist}_${foot_length}_${sex}_${lUnit}_${wUnit}`;

    // Only skip if inputs haven't changed AND calculated dimensions are already populated
    if (callSig === lastCallRef.current && hasCalculated) return;

    const timer = setTimeout(() => {
      lastCallRef.current = callSig;
      handlePredictMeasurements(height, weight, waist, foot_length, sex);
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.body_measurements?.height,
    form.body_measurements?.weight,
    form.body_measurements?.waist,
    form.body_measurements?.foot_length,
    form.sex,
    lUnit,
    wUnit,
  ]);

  const showCalculatedAndOther =
    !effectiveIsFreshStart || hasFilledBasicLocal || effectiveHasPredicted;

  const unitKey = (unit) => {
    if (unit === 'wt') {
      return `profile.unit${wUnit === 'lb' ? 'Lb' : 'Kg'}`;
    }
    return `profile.unit${lUnit === 'in' ? 'In' : 'Cm'}`;
  };

  const num = (field, label, unit = 'len', isAi = false) => {
    const translatedUnit = t(unitKey(unit));
    return (
      <MeasurementNumField
        key={field}
        field={field}
        label={`${label} (${translatedUnit})`}
        value={form.body_measurements?.[field]}
        onChange={onChange}
        testId={`profile-measurement-${field}`}
        isAi={isAi}
        predicting={effectivePredicting && isAi}
      />
    );
  };

  const txt = (field, label) => (
    <MeasurementTextField
      key={field}
      field={field}
      label={label}
      value={form.body_measurements?.[field]}
      onChange={onChange}
      testId={`profile-measurement-${field}`}
    />
  );

  return (
    <AccordionItem
      value="measurements"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(142_71%_93%)] text-[hsl(142_71%_35%)] dark:bg-[hsl(142_30%_15%)] dark:text-[hsl(142_71%_55%)] shrink-0 transition-transform duration-200">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.sections.measurements')}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.sections.measurementsDesc', {
                defaultValue: 'Garment sizing fits (height, chest, waist, and inseams)',
              })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="space-y-4">
          {effectivePredicting && (
            <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 animate-pulse bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/10">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
              <span>
                {t('profile.measurements.calculating', {
                  defaultValue: 'Calculating body shape measurements using AI...',
                })}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {num('height', t('profile.measurements.height'))}
            {num('weight', t('profile.measurements.weight'), 'wt')}
            {num('waist', t('profile.measurements.waist'))}
            {num('foot_length', t('profile.measurements.footLength'))}
          </div>

          {showCalculatedAndOther && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-text-brand flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  {t('profile.measurements.calculatedSection', {
                    defaultValue: 'Calculated Body Dimensions (AI Generated)',
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 text-[11px] gap-1 rounded-full text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  onClick={() => {
                    const bm = form.body_measurements || {};
                    handlePredictMeasurements(
                      bm.height,
                      bm.weight,
                      bm.waist,
                      bm.foot_length,
                      form.sex,
                    );
                  }}
                  disabled={effectivePredicting || !hasFilledBasicLocal}
                  data-testid="profile-recalculate-measurements-btn"
                >
                  {effectivePredicting ? (
                    <Loader2 className="h-3 w-3 animate-spin text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  )}
                  {effectiveHasPredicted
                    ? t('profile.measurements.recalculate', {
                        defaultValue: 'Recalculate with AI',
                      })
                    : t('profile.measurements.calculate', {
                        defaultValue: 'Calculate with AI',
                      })}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {num('shoulders', t('profile.measurements.shoulders'), 'len', true)}
                {num('chest', t('profile.measurements.chest'), 'len', true)}
                {num('hip', t('profile.measurements.hip'), 'len', true)}
                {num('sleeve', t('profile.measurements.sleeve'), 'len', true)}
                {num('inseam', t('profile.measurements.inseam'), 'len', true)}
                {num('outseam', t('profile.measurements.outseam'), 'len', true)}
              </div>
              <div className="">
                <span className="text-[12px] font-semibold text-text-brand">
                  {t('profile.measurements.sizesSection', {
                    defaultValue: 'Garment & Footwear Sizes',
                  })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {txt('shirt_size', t('profile.measurements.shirtSize'))}
                {txt('pants_size', t('profile.measurements.pantsSize'))}
                {txt('shoe_size', t('profile.measurements.shoeSize'))}
                {isFemaleProp && (
                  <>
                    {txt('bra_size', t('profile.measurements.braSize'))}
                    {txt('dress_size', t('profile.measurements.dressSize'))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}