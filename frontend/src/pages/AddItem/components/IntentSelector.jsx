import { useTranslation } from 'react-i18next';
import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { labelForIntent } from '@/lib/taxonomy';
import { INTENT_OPTIONS, fmtCents } from '../utils';

export function IntentSelector({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const intent = fields.marketplace_intent || 'own';
  // Only compute preview for 'for_sale'
  const priceCents = Number(fields.price_cents) || 0;
  const stripeFee = intent === 'for_sale' ? Math.round(priceCents * 0.029) + (priceCents > 0 ? 30 : 0) : 0;
  const netAfterStripe = Math.max(0, priceCents - stripeFee);
  const platformFee = Math.round(netAfterStripe * 0.07);
  const sellerNet = netAfterStripe - platformFee;

  return (
    <div className="rounded-2xl border border-border p-3 bg-secondary/30">
      <div className="flex items-center justify-between mb-2">
        <Label className="caps-label text-muted-foreground flex items-center gap-1">
          <Tag className="h-3 w-3" /> {t('addItem.marketplaceIntent')}
        </Label>
        <Badge variant="outline" className="text-[10px]">
          {t('addItem.intent_own')}
        </Badge>
      </div>
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        role="radiogroup"
        aria-label={t('addItem.marketplaceIntent')}
      >
        {INTENT_OPTIONS.map((o) => {
          const active = intent === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange({ marketplace_intent: o.value })}
              data-testid={`add-item-intent-${o.value}`}
              className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                active ? `${o.tone} font-medium` : 'bg-background text-muted-foreground hover:text-foreground border-border'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {labelForIntent(o.value, t)}
            </button>
          );
        })}
      </div>
      {intent === 'for_sale' && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="add-item-fee-preview">
          <div>
            <Label htmlFor={`${idPrefix}-price`} className="caps-label text-muted-foreground">
              {t('addItem.price')} ({fields.currency || 'USD'})
            </Label>
            <Input
              id={`${idPrefix}-price`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={
                fields.price_cents != null && fields.price_cents !== ''
                  ? String(Math.round(Number(fields.price_cents) / 100))
                  : '0'
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (raw && !/^\d*$/.test(raw)) return;
                const units = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                onChange({ price_cents: units * 100 });
              }}
              placeholder="0"
              disabled={disabled}
              data-testid="add-item-price"
              className="mt-1 rounded-xl"
            />
          </div>
          <div className="text-xs text-muted-foreground self-end">
            <div className="flex justify-between"><span>{t('addItem.stripeFee')}</span><span className="font-mono">{fmtCents(stripeFee)}</span></div>
            <div className="flex justify-between"><span>{t('transactions.platform7')}</span><span className="font-mono">{fmtCents(platformFee)}</span></div>
            <div className="flex justify-between font-medium text-foreground"><span>{t('addItem.youReceive')}</span><span className="font-mono">{fmtCents(sellerNet)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
