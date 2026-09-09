import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { bestImageUrl } from '@/lib/itemImage';
import PricingBanner from '../assets/img/inner6.webp';
const fmt = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((cents || 0) / 100);

/**
 * Build a starter listing description from the closet item's analysis.
 * The user can edit it freely; we just give them a sensible draft so
 * they don't face a blank textarea.
 *
 * Picks the best signals the item has, in order of usefulness:
 *  brand → notes → caption → composed sentence from key fields.
 */
function deriveDescription(item) {
  if (!item) return '';
  // Power user already wrote something — use it.
  if (typeof item.notes === 'string' && item.notes.trim()) return item.notes.trim();
  // Item-level caption from the LLM (a polished one-liner).
  if (typeof item.caption === 'string' && item.caption.trim()) return item.caption.trim();
  // Otherwise compose from structured fields. Filter out null/empty so
  // we don't end up with awkward "  ,  " separators.
  const bits = [
    item.brand,
    item.material,
    item.fit,
    item.pattern,
    item.style,
  ]
    .map((b) => (typeof b === 'string' ? b.trim() : ''))
    .filter(Boolean);
  if (!bits.length) return '';
  return bits.join(' · ');
}

/**
 * Translate a closet item's wear/condition hint into the listing's
 * condition enum. Defaults to ``like_new`` (matches the form's default)
 * when the item has no condition signal.
 */
function deriveCondition(item) {
  if (!item) return null;
  const raw = (item.condition || item.wear || '').toString().toLowerCase();
  if (!raw) return null;
  if (raw.includes('new with tag') || raw.includes('nwt') || raw === 'new') return 'new';
  if (raw.includes('like') || raw.includes('excellent') || raw.includes('mint'))
    return 'like_new';
  if (raw.includes('good') || raw.includes('gently') || raw.includes('used'))
    return 'good';
  if (raw.includes('fair') || raw.includes('worn') || raw.includes('vintage'))
    return 'fair';
  return null;
}

function LinkedItemThumb({ item, fallbackText }) {
  const [hasError, setHasError] = useState(false);
  const src = !hasError ? bestImageUrl(item) : null;

  if (src) {
    return (
      <img
        src={src}
        alt={item?.title || 'Closet item'}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
        data-testid="listing-linked-item-thumb"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-text-brand gap-1 p-1">
      <i className="fa-solid fa-image text-[12px]"></i>
      <span className="text-[9px] text-text-brand line-clamp-1 text-center">{fallbackText}</span>
    </div>
  );
}

export default function CreateListing() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialItem = params.get('itemId');
  const [closet, setCloset] = useState([]);
  const [form, setForm] = useState({
    closet_item_id: initialItem || '',
    source: 'Shared',
    mode: 'sell',
    title: '',
    description: '',
    category: 'top',
    size: '',
    condition: 'like_new',
    list_price_cents: 2500,
    // Raw user-typed string. Kept in sync with list_price_cents so the
    // input preserves what the user actually typed (e.g. "12.5") instead
    // of reformatting on every keystroke.
    list_price_input: '25',
    // Wave 3 — optional shipping fee. 0 = "local pickup only" (which
    // is the default and what DressApp's environmental ethos nudges
    // toward). Users can opt in to a fee when posting something that
    // must be shipped (e.g. across continents).
    shipping_fee_cents: 0,
    shipping_fee_input: '',
  });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listCloset({ limit: 2000 }).then((r) => setCloset(r.items || [])).catch(() => { });
  }, []);

  // ---------- derive listing fields from the linked closet item ----------
  // Fires whenever the linked item changes (URL param OR Select change),
  // so opening "Sell this" from a closet card lands on a form that's
  // already filled in: title, description, size, category, condition,
  // and a sensible price suggestion based on the user's purchase price.
  // We always overwrite — the user explicitly picked an item to list,
  // so they expect that item's data, not whatever leftover state was in
  // the form.
  useEffect(() => {
    if (!form.closet_item_id || closet.length === 0) return;
    const it = closet.find((c) => c.id === form.closet_item_id);
    if (!it) return;
    setForm((f) => {
      const patch = {
        ...f,
        title: it.title || it.name || f.title,
        category: it.category || f.category,
        size: it.size || f.size,
        description: deriveDescription(it) || f.description,
        condition: deriveCondition(it) || f.condition,
      };
      // Price: suggest the user's recorded purchase price as a starting
      // point. Don't overwrite if the user already typed their own.
      const wasUserTyped = f.list_price_input && f.list_price_input !== '25';
      if (!wasUserTyped && Number(it.price_cents) > 0) {
        const cents = Number(it.price_cents);
        patch.list_price_cents = cents;
        patch.list_price_input = (cents / 100).toFixed(2).replace(/\.00$/, '');
      }
      return patch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.closet_item_id, closet]);

  useEffect(() => {
    if (!form.list_price_cents) { setPreview(null); return; }
    api.feePreview(form.list_price_cents).then(setPreview).catch(() => setPreview(null));
  }, [form.list_price_cents]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        closet_item_id: form.closet_item_id || null,
        source: form.source,
        mode: form.mode,
        title: form.title,
        description: form.description || null,
        category: form.category,
        size: form.size || null,
        condition: form.condition,
        images: [],
        list_price_cents: Number(form.list_price_cents) || 0,
        shipping_fee_cents: Number(form.shipping_fee_cents) || 0,
        currency: 'USD',
      };
      const linked = closet.find((c) => c.id === form.closet_item_id);
      const chosenImg =
        linked?.reconstruct_image_url ||
        linked?.reconstructed_image_url ||
        linked?.clean_image_url ||
        linked?.cutout_url ||
        linked?.thumbnail_data_url ||
        linked?.image_url ||
        linked?.segmented_image_url ||
        linked?.original_image_url;
      if (chosenImg) {
        body.images = [chosenImg];
      }
      const listing = await api.createListing(body);
      toast.success(t('createListing.created'));
      // Per UX spec: after publishing, take the user back to the
      // marketplace landing so they see their listing in the feed
      // rather than a deep-linked detail page.
      nav('/market');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('createListing.createFailed'));
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* Banner Section */}
      <section
        className="
              relative isolate overflow-hidden
              bg-cover bg-center bg-no-repeat
            "
        style={{
          backgroundImage: `url(${PricingBanner})`,
        }}
      >
        {/* Dark gradient overlay */}
        <div
          className="
                absolute inset-0 -z-0
                bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)]
              "
        />

        <div className="relative z-10 w-full">
          <div
            className="
                  px-10 py-20
                  max-[991px]:px-[35px] max-[991px]:py-[45px]
                  max-[767px]:px-5 max-[767px]:py-[38px]
                  max-[480px]:px-4 max-[480px]:py-8
                "
          >
            <div className="max-w-[520px]">
              {/* <span>{t('profile.accountLabel')}</span> */}
              {/* Title */}
              <h1
                className="
                      m-0 mb-0
                      text-[40px] leading-[40px]
                      font-bold
                      tracking-normal
                      text-white
                      max-[767px]:text-[42px]
                      max-[480px]:text-[35px]
                    "
              >
                {t('createListing.title')}
              </h1>
              {/* Description */}
              <p
                className="
                      my-5
                      max-w-[450px]
                      text-[14px]
                      leading-6
                      tracking-[0.5px]
                      text-white/60
                      max-[767px]:max-w-full
                      max-[767px]:mt-[15px]
                    "
              >
                {t('createListing.feeSubtitle')}
              </p>

            </div>
          </div>
        </div>
      </section>
      <section className="bg-accent-beige px-[40px] py-[40px] max-[767px]:px-5 max-[767px]:py-10">
        <button onClick={() => nav(-1)} className="inline-flex items-center text-[14px] font-bold text-dark-brand mb-5 hover:text-primary-brand">
          <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('common.back')}
        </button>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 rounded-[12px] bg-white border border-border shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={submit} className="space-y-4" data-testid="create-listing-form">
                <div>
                  <Label>{t('createListing.linkItem')}</Label>
                  <Select value={form.closet_item_id || 'none'} onValueChange={(v) => setForm({ ...form, closet_item_id: v === 'none' ? '' : v })}>
                    <SelectTrigger data-testid="listing-closet-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('createListing.linkNone')}</SelectItem>
                      {closet.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* Visual confirmation of the linked closet item.
                    Uses the reconstructed/clean image / cached thumbnail. */}
                  {(() => {
                    const linkedItem = closet.find((c) => c.id === form.closet_item_id);
                    if (!linkedItem) return null;

                    return (
                      <div
                        className="mt-3 flex items-center gap-3 rounded-[12px] border border-border p-3 bg-primary-shadow"
                        data-testid="listing-linked-item-preview"
                      >
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-[12px] bg-accent-beige border border-border flex items-center justify-center">
                          <LinkedItemThumb item={linkedItem} fallbackText={t('createListing.linkNone')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-[14px] font-bold"
                            data-testid="listing-linked-item-title"
                          >
                            {linkedItem.title || linkedItem.name || '—'}
                          </div>
                          {linkedItem.category && (
                            <div className="truncate text-[12px] text-text-brand font-semibold">
                              {linkedItem.category}
                              {linkedItem.size ? ` · ${linkedItem.size}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('createListing.source')}</Label>
                    <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                      <SelectTrigger data-testid="listing-source-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Shared">{t('createListing.sourceShared')}</SelectItem>
                        <SelectItem value="Retail">{t('createListing.sourceRetail')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('createListing.mode')}</Label>
                    <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                      <SelectTrigger data-testid="listing-mode-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sell">{t('createListing.modeSell')}</SelectItem>
                        <SelectItem value="rent">{t('createListing.modeRent', { defaultValue: 'Rent' })}</SelectItem>
                        <SelectItem value="swap">{t('createListing.modeSwap')}</SelectItem>
                        <SelectItem value="donate">{t('createListing.modeDonate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t('createListing.titleField')}</Label>
                  <Input required value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    data-testid="listing-title-input" />
                </div>
                <div>
                  <Label>{t('createListing.descriptionField')}</Label>
                  <Textarea value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3} data-testid="listing-description-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('createListing.sizeField')}</Label>
                    <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                    data-testid="listing-size-input" />
                  </div>
                  <div>
                    <Label>{t('createListing.conditionField')}</Label>
                    <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                      <SelectTrigger data-testid="listing-condition-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t('createListing.cond_new')}</SelectItem>
                        <SelectItem value="like_new">{t('createListing.cond_like_new')}</SelectItem>
                        <SelectItem value="good">{t('createListing.cond_good')}</SelectItem>
                        <SelectItem value="fair">{t('createListing.cond_fair')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t('createListing.priceUsd')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.list_price_input}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw && !/^\d*([.,]\d{0,2})?$/.test(raw)) return;
                      const normalised = raw.replace(',', '.');
                      const cents =
                        normalised && !isNaN(parseFloat(normalised))
                          ? Math.max(0, Math.round(parseFloat(normalised) * 100))
                          : 0;
                      setForm({ ...form, list_price_input: raw, list_price_cents: cents });
                    }}
                    placeholder="0.00"
                    data-testid="listing-price-input"
                  />
                </div>

                {/* Wave 3 — optional shipping fee. We lead with the
                  community-first ethos so the default (0) feels
                  intentional, not lazy. */}
                <div className="border border-border p-3 bg-primary-shadow rounded-[12px]" data-testid="listing-shipping-block">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="mb-0" htmlFor="listing-shipping-input">
                      Shipping fee (optional)
                    </Label>
                    <span className="text-[12px] text-primary-brand font-semibold">
                      {t('pages.createListing.prefer_local_pickup')}
                    </span>
                  </div>
                  <Input
                    id="listing-shipping-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.shipping_fee_input}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw && !/^\d*([.,]\d{0,2})?$/.test(raw)) return;
                      const normalised = raw.replace(',', '.');
                      const cents =
                        normalised && !isNaN(parseFloat(normalised))
                          ? Math.max(0, Math.round(parseFloat(normalised) * 100))
                          : 0;
                      setForm({ ...form, shipping_fee_input: raw, shipping_fee_cents: cents });
                    }}
                    placeholder="0.00"
                    data-testid="listing-shipping-input"
                    className="mb-0"
                  />
                  <p className="text-[12px] text-text-brand mt-1.5 font-semibold italic">
                    {t('pages.createListing.leave_at')} <strong>0</strong> {t('pages.createListing.to_encourage_neighbours_to_meet')}
                  </p>
                </div>
                <Button type="submit" disabled={busy || !form.title} className="w-full" data-testid="listing-publish-button">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('createListing.publish')}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="rounded-[12px] bg-white border border-border shadow-sm h-fit" data-testid="marketplace-fee-breakdown">
            <CardContent className="p-5">
              <div className="text-[12px] text-primary-brand font-bold">{t('createListing.feePreview')}</div>
              <div className="text-[25px] text-dark-brand font-extrabold my-2" data-testid="fee-gross">{fmt(preview?.gross_cents || form.list_price_cents)}</div>
              <dl className="mt-1 text-[12px] space-y-2 font-semibold">
                <div className="flex justify-between"><dt className="text-text-brand font-semibold">{t('createListing.priceUsd')}</dt><dd>{fmt(preview?.gross_cents || form.list_price_cents)}</dd></div>
                <div className="flex justify-between"><dt className="text-text-brand font-semibold">{t('market.processingFee')}</dt><dd>− {fmt(preview?.stripe_fee_cents || 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-text-brand font-semibold">{t('transactions.platform7')}</dt><dd>− {fmt(preview?.platform_fee_cents || 0)}</dd></div>
                <div className="flex justify-between font-semibold border-t border-border pt-2"><dt>{t('createListing.youReceive')}</dt><dd data-testid="fee-seller-net">{fmt(preview?.seller_net_cents || 0)}</dd></div>
              </dl>
              <p className="text-[12px] text-text-brand mt-3 font-semibold">{t('createListing.feeFootnote')}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
