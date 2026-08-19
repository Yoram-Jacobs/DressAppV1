import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import {
  Camera,
  Image as ImgIcon,
  Loader2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fileToDataUrl } from '@/lib/profileImage';

export function PhotoSlot({ label, value, onChange, testid }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(file, 1024);
      onChange(url);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-border p-3 bg-secondary/40"
      data-testid={`profile-photo-${testid}`}
    >
      <div className="caps-label text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-background border border-border shrink-0">
          {value ? (
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <ImgIcon className="h-5 w-5 opacity-60" />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg whitespace-nowrap"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            data-testid={`profile-photo-${testid}-camera-btn`}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Camera className="h-3.5 w-3.5 me-1" /> {t('profile.takePhoto')}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg whitespace-nowrap"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-testid={`profile-photo-${testid}-upload-btn`}
          >
            <ImgIcon className="h-3.5 w-3.5 me-1" />
            {value ? t('profile.replacePhoto') : t('profile.uploadPhoto')}
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg text-rose-700"
              disabled={busy}
              onClick={() => onChange(null)}
              data-testid={`profile-photo-${testid}-remove-btn`}
            >
              <Trash2 className="h-3.5 w-3.5 me-1" />
              {t('profile.removePhoto')}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        // `capture` is honoured on mobile — opens the camera directly.
        capture="user"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}

export function Field({ label, children, htmlFor }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="caps-label text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function MeasurementNumField({ field, label, value, onChange, testId, isAi, predicting }) {
  return (
    <Field
      label={
        <span className="flex items-center gap-1.5">
          {label}
          {isAi && (
            <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/50 py-0 px-1 rounded flex items-center gap-0.5 normal-case font-normal">
              <Sparkles className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
              AI
            </Badge>
          )}
        </span>
      }
    >
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={predicting ? '...' : (value ?? '')}
          onChange={(e) => onChange(field, e.target.value)}
          className={`rounded-xl bg-card transition-all duration-300 ${isAi ? 'border-purple-200/60 focus-visible:ring-purple-400 focus-visible:border-purple-400 dark:border-purple-900/40' : ''}`}
          data-testid={testId}
          disabled={predicting}
        />
        {predicting && (
          <div className="absolute right-3 top-2.5 flex items-center">
            <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
          </div>
        )}
      </div>
    </Field>
  );
}

export function MeasurementTextField({ field, label, value, onChange, testId }) {
  return (
    <Field label={label}>
      <Input
        autoComplete="off"
        value={value ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
        className="rounded-xl bg-card"
        data-testid={testId}
      />
    </Field>
  );
}