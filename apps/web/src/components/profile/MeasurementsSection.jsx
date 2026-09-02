import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ruler, Sparkles } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { api } from '@/lib/api';
import { MeasurementNumField, MeasurementTextField } from './primitives.jsx';

export function MeasurementsSection({
  form,
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
      const res = await api.predictMeasurements({
        height: h_cm,
        weight: w_kg,
        waist: wa_cm,
        foot_length: fl_cm,
        gender: sex === 'male' ? 'male' : 'female'
      });

      const convertVal = (val) => {
        if (lUnit === 'in') {
          return Math.round((val / 2.54) * 10) / 10;
        }
        return Math.round(val * 10) / 10;
      };

      onChange((prev) => {
        const nextMeasurements = {
          ...prev.body_measurements,
          shoulders: convertVal(res.shoulders),
          chest: convertVal(res.chest),
          hip: convertVal(res.hip),
          sleeve: convertVal(res.sleeve),
          inseam: convertVal(res.inseam),
          outseam: convertVal(res.outseam),
        };
        if (res.recommended_sizes) {
          if (res.recommended_sizes.shirt_size) {
            nextMeasurements.shirt_size = res.recommended_sizes.shirt_size;
          }
          if (res.recommended_sizes.pants_size) {
            nextMeasurements.pants_size = res.recommended_sizes.pants_size;
          }
          if (res.recommended_sizes.shoe_size_us) {
            nextMeasurements.shoe_size = res.recommended_sizes.shoe_size_us;
          }
          if (res.recommended_sizes.dress_size && res.recommended_sizes.dress_size !== 'N/A') {
            nextMeasurements.dress_size = res.recommended_sizes.dress_size;
          }
          if (res.recommended_sizes.bra_size && res.recommended_sizes.bra_size !== 'N/A') {
            nextMeasurements.bra_size = res.recommended_sizes.bra_size;
          }
        }
        return {
          ...prev,
          body_measurements: nextMeasurements,
        };
      });
      setHasPredicted(true);
    } catch (err) {
      console.error("Prediction failed:", err);
    } finally {
      setPredicting(false);
    }
  };

  const hasFilledBasicLocal = !!(form.body_measurements.height && form.body_measurements.weight && form.body_measurements.waist && form.body_measurements.foot_length);

  const effectivePredicting = predicting ?? predictingState;
  const effectiveHasPredicted = hasPredicted ?? hasPredictedState;
  const effectiveIsFreshStart = isFreshStart ?? !(form.body_measurements.shoulders || form.body_measurements.chest || form.body_measurements.hip || form.body_measurements.sleeve || form.body_measurements.inseam || form.body_measurements.outseam);

  useEffect(() => {
    const { height, weight, waist, foot_length } = form.body_measurements;
    const sex = form.sex || 'female';

    if (!height || !weight || !waist || !foot_length) return;

    const callSig = `${height}_${weight}_${waist}_${foot_length}_${sex}_${lUnit}_${wUnit}`;
    if (callSig === lastCallRef.current) return;

    const timer = setTimeout(() => {
      lastCallRef.current = callSig;
      handlePredictMeasurements(height, weight, waist, foot_length, sex);
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.body_measurements.height,
    form.body_measurements.weight,
    form.body_measurements.waist,
    form.body_measurements.foot_length,
    form.sex,
    lUnit,
    wUnit
  ]);

  const showCalculatedAndOther = !effectiveIsFreshStart || hasFilledBasicLocal || effectiveHasPredicted;

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
        value={form.body_measurements[field]}
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
      value={form.body_measurements[field]}
      onChange={onChange}
      testId={`profile-measurement-${field}`}
    />
  );

  return (
    <AccordionItem value="measurements" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-measurements"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(142_71%_93%)] text-[hsl(142_71%_35%)] dark:bg-[hsl(142_30%_15%)] dark:text-[hsl(142_71%_55%)] shrink-0 transition-transform duration-200">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.measurements')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.measurementsDesc', { defaultValue: 'Garment sizing fits (height, chest, waist, and inseams)' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="space-y-4">
          {effectivePredicting && (
            <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 animate-pulse bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/10">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
              <span>{t('profile.measurements.calculating', { defaultValue: 'Calculating body shape measurements using AI...' })}</span>
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
              <div className="border-t border-border/40 my-2 pt-2">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  {t('profile.measurements.calculatedSection', { defaultValue: 'Calculated Body Dimensions (AI Generated)' })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {num('shoulders', t('profile.measurements.shoulders'), 'len', true)}
                {num('chest', t('profile.measurements.chest'), 'len', true)}
                {num('hip', t('profile.measurements.hip'), 'len', true)}
                {num('sleeve', t('profile.measurements.sleeve'), 'len', true)}
                {num('inseam', t('profile.measurements.inseam'), 'len', true)}
                {num('outseam', t('profile.measurements.outseam'), 'len', true)}
              </div>

              <div className="border-t border-border/40 my-2 pt-2">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  {t('profile.measurements.sizesSection', { defaultValue: 'Garment & Footwear Sizes' })}
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