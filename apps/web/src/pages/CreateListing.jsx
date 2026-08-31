import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

const fmt = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((cents || 0) / 100);

function deriveDescription(item) {
  if (!item) return '';
  if (typeof item.notes === 'string' && item.notes.trim()) return item.notes.trim();
  if (typeof item.caption === 'string' && item.caption.trim()) return item.caption.trim();
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
    list_price_input: '25',
    shipping_fee_cents: 0,
    shipping_fee_input: '',
  });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listCloset({ limit: 2000 }).then((r) => setCloset(r.items || [])).catch(() => { });
  }, []);

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
        linked?.clean_image_url ||
        linked?.reconstructed_image_url ||
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
      nav('/market');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('createListing.createFailed'));
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* banner-start */}
      <section className="closet-banner">
        <div className="container-fluid">
          <div className="closet-banner__content">
            <div className="closet-banner__title-row">
              <h1 className="hero-title">Create a Listing</h1>
              <p className="hero-description">Turn your wardrobe into opportunity. List your fashion items for sale, swap, rent, or donation and connect with buyers in your community.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="createlisting-page">
        <div className="container-fluid">
          <button onClick={() => nav(-1)} className="createlisting-back">
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('common.back')}
          </button>
          <h1 className="createlisting-title">{t('createListing.title')}</h1>
          <p className="createlisting-subtitle">{t('createListing.feeSubtitle')}</p>
          <div className="createlisting-grid">
            <div className="createlisting-card">
              <form onSubmit={submit} className="createlisting-form" data-testid="create-listing-form">
                <div className="row gx-3 gy-4">
                  <div className="col-md-12">
                    <div className="field-set">
                      <Label>{t('createListing.linkItem')}</Label>
                      <Select value={form.closet_item_id || 'none'} onValueChange={(v) => setForm({ ...form, closet_item_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="createlisting-select" data-testid="listing-closet-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('createListing.linkNone')}</SelectItem>
                          {closet.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const linkedItem = closet.find((c) => c.id === form.closet_item_id);
                        if (!linkedItem) return null;
                        const thumb =
                          linkedItem.thumbnail_data_url ||
                          linkedItem.segmented_image_url ||
                          linkedItem.original_image_url;
                        return (
                          <div className="createlisting-linked-preview" data-testid="listing-linked-item-preview">
                            <div className="createlisting-linked-thumb">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={linkedItem.title || 'Closet item'}
                                  data-testid="listing-linked-item-thumb"
                                />
                              ) : (
                                <div className="createlisting-linked-thumb-empty">
                                  {t('createListing.linkNone')}
                                </div>
                              )}
                            </div>
                            <div className="createlisting-linked-info">
                              <div className="createlisting-linked-title" data-testid="listing-linked-item-title">
                                {linkedItem.title || linkedItem.name || '—'}
                              </div>
                              {linkedItem.category && (
                                <div className="createlisting-linked-meta">
                                  {linkedItem.category}
                                  {linkedItem.size ? ` · ${linkedItem.size}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="field-set">
                      <Label>{t('createListing.source')}</Label>
                      <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                        <SelectTrigger className="createlisting-select" data-testid="listing-source-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Shared">{t('createListing.sourceShared')}</SelectItem>
                          <SelectItem value="Retail">{t('createListing.sourceRetail')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="field-set">
                      <Label>{t('createListing.mode')}</Label>
                      <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                        <SelectTrigger className="createlisting-select" data-testid="listing-mode-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sell">{t('createListing.modeSell')}</SelectItem>
                          <SelectItem value="rent">{t('createListing.modeRent', { defaultValue: 'Rent' })}</SelectItem>
                          <SelectItem value="swap">{t('createListing.modeSwap')}</SelectItem>
                          <SelectItem value="donate">{t('createListing.modeDonate')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="field-set">
                      <Label>{t('createListing.titleField')}</Label>
                      <Input required value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="createlisting-input" data-testid="listing-title-input" />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="field-set">
                      <Label>{t('createListing.descriptionField')}</Label>
                      <Textarea value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={3} className="createlisting-textarea" data-testid="listing-description-input" />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="field-set">
                      <Label>{t('createListing.sizeField')}</Label>
                      <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                        className="createlisting-input" data-testid="listing-size-input" />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="field-set">
                      <Label>{t('createListing.conditionField')}</Label>
                      <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                        <SelectTrigger className="createlisting-select" data-testid="listing-condition-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">{t('createListing.cond_new')}</SelectItem>
                          <SelectItem value="like_new">{t('createListing.cond_like_new')}</SelectItem>
                          <SelectItem value="good">{t('createListing.cond_good')}</SelectItem>
                          <SelectItem value="fair">{t('createListing.cond_fair')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="field-set">
                      <Label>{t('createListing.priceUsd')}</Label>
                      <div className="createlisting-price-wrap">
                        <span className="createlisting-price-prefix">$</span>
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
                          className="createlisting-input createlisting-price-input"
                          data-testid="listing-price-input"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="field-set">
                      <div className="createlisting-shipping-block" data-testid="listing-shipping-block">
                        <div className="createlisting-shipping-head">
                          <Label htmlFor="listing-shipping-input" className="createlisting-label">
                            {t('createListing.shippingFee', { defaultValue: 'Shipping fee (optional)' })}
                          </Label>
                          <span className="createlisting-shipping-badge">
                            <i className="fa-solid fa-leaf"></i> {t('pages.createListing.prefer_local_pickup')}
                          </span>
                        </div>
                        <div className="createlisting-price-wrap">
                          <span className="createlisting-price-prefix">$</span>
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
                            className="createlisting-input createlisting-price-input"
                            data-testid="listing-shipping-input"
                          />
                        </div>
                        <p className="createlisting-shipping-hint">
                          {t('pages.createListing.leave_at')} <strong>0</strong> {t('pages.createListing.to_encourage_neighbours_to_meet')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="">
                      <Button type="submit" disabled={busy || !form.title} className="createlisting-submit custm-btn w-100" data-testid="listing-publish-button">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('createListing.publish')}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="createlisting-fee-card" data-testid="marketplace-fee-breakdown">
              <div className="createlisting-fee-label">{t('createListing.feePreview')}</div>
              <div className="createlisting-fee-gross" data-testid="fee-gross">{fmt(preview?.gross_cents || form.list_price_cents)}</div>
              <dl className="createlisting-fee-list">
                <div className="createlisting-fee-row">
                  <dt>{t('createListing.priceUsd')}</dt>
                  <dd>{fmt(preview?.gross_cents || form.list_price_cents)}</dd>
                </div>
                <div className="createlisting-fee-row">
                  <dt>{t('market.processingFee')}</dt>
                  <dd>− {fmt(preview?.stripe_fee_cents || 0)}</dd>
                </div>
                <div className="createlisting-fee-row">
                  <dt>{t('transactions.platform7')}</dt>
                  <dd>− {fmt(preview?.platform_fee_cents || 0)}</dd>
                </div>
                <div className="createlisting-fee-row createlisting-fee-total">
                  <dt>{t('createListing.youReceive')}</dt>
                  <dd data-testid="fee-seller-net">{fmt(preview?.seller_net_cents || 0)}</dd>
                </div>
              </dl>
              <p className="createlisting-fee-footnote">{t('createListing.feeFootnote')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}