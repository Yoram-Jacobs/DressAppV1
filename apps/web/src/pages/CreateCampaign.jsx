import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Tag,
  MapPin,
  Users,
  Bell,
  Eye,
  Image,
  DollarSign,
  CreditCard,
  ExternalLink,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { campaignApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FASHION_CATEGORIES = [
  'Boutique', 'Tailor', 'Stylist', 'Designer', 'Personal Shopper',
  'Clothing Repair', 'Alterations', 'Shoe Repair', 'Fashion Consultant',
  'Accessories', 'Jewellery', 'Vintage', 'Secondhand', 'Luxury Fashion',
  'Streetwear', 'Activewear', 'Sustainable Fashion', 'Bridal', 'Swimwear',
  'Menswear', 'Womenswear', 'Kidswear', 'Bags', 'Hats',
];

const AUDIENCE_TARGETS = [
  { value: 'women', labelKey: 'campaigns.create.audience.women' },
  { value: 'men', labelKey: 'campaigns.create.audience.men' },
  { value: 'kids', labelKey: 'campaigns.create.audience.kids' },
  { value: 'luxury', labelKey: 'campaigns.create.audience.luxury' },
  { value: 'casual', labelKey: 'campaigns.create.audience.casual' },
  { value: 'sustainable_fashion', labelKey: 'campaigns.create.audience.sustainableFashion' },
  { value: 'streetwear', labelKey: 'campaigns.create.audience.streetwear' },
  { value: 'all', labelKey: 'campaigns.create.audience.all' },
];

const STEPS = [
  { id: 'basic', icon: Tag, labelKey: 'campaigns.create.steps.basic' },
  { id: 'promotion', icon: Image, labelKey: 'campaigns.create.steps.promotion' },
  { id: 'location', icon: MapPin, labelKey: 'campaigns.create.steps.location' },
  { id: 'audience', icon: Users, labelKey: 'campaigns.create.steps.audience' },
  { id: 'notifications', icon: Bell, labelKey: 'campaigns.create.steps.notifications' },
  { id: 'review', icon: Eye, labelKey: 'campaigns.create.steps.review' },
];

const INITIAL_FORM = {
  // Basic
  title: '',
  business_name: '',
  short_description: '',
  long_description: '',
  category: '',
  cover_image_url: '',
  gallery_images: [],
  // Promotion
  discount_pct: '',
  coupon_code: '',
  sale_type: 'discount',
  limited_time_offer: false,
  start_date: '',
  end_date: '',
  // Location
  location: { country: '', city: '', lat: '', lon: '', radius_km: 25 },
  // Audience
  audience: { targets: ['all'], age_min: '', age_max: '', interests: [] },
  // Notifications
  notifications: {
    master_enabled: false,
    channels: [],
    timing: 'immediately_after_approval',
    custom_datetime: '',
  },
};

export default function CreateCampaign() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState('idle');
  const [paypalOrder, setPaypalOrder] = useState(null);
  const [paypalRequired, setPaypalRequired] = useState(false);
  const [campaignId, setCampaignId] = useState(editId || null);

  useEffect(() => {
    if (editId) {
      campaignApi.getCampaign(editId).then((res) => {
        setForm({
          title: res.title || '',
          business_name: res.business_name || '',
          short_description: res.short_description || '',
          long_description: res.long_description || '',
          category: res.category || '',
          cover_image_url: res.cover_image_url || '',
          gallery_images: res.gallery_images || [],
          discount_pct: res.discount_pct !== null && res.discount_pct !== undefined ? String(res.discount_pct) : '',
          coupon_code: res.coupon_code || '',
          sale_type: res.sale_type || 'discount',
          limited_time_offer: res.limited_time_offer || false,
          start_date: res.start_date || '',
          end_date: res.end_date || '',
          location: {
            country: res.location?.country || '',
            city: res.location?.city || '',
            lat: res.location?.lat !== null && res.location?.lat !== undefined ? String(res.location?.lat) : '',
            lon: res.location?.lon !== null && res.location?.lon !== undefined ? String(res.location?.lon) : '',
            radius_km: res.location?.radius_km || 25,
          },
          audience: {
            targets: res.audience?.targets || ['all'],
            age_min: res.audience?.age_min !== null && res.audience?.age_min !== undefined ? String(res.audience?.age_min) : '',
            age_max: res.audience?.age_max !== null && res.audience?.age_max !== undefined ? String(res.audience?.age_max) : '',
            interests: res.audience?.interests || [],
          },
          notifications: {
            master_enabled: res.notifications?.master_enabled || false,
            channels: res.notifications?.channels || [],
            timing: res.notifications?.timing || 'immediately_after_approval',
            custom_datetime: res.notifications?.custom_datetime || '',
          },
        });
      }).catch((err) => {
        toast.error("Failed to load campaign details.");
      });
    }
  }, [editId]);

  useEffect(() => {
    if (editId) return;
    if (user?.professional?.is_professional) {
      const biz = user.professional.business || {};
      const prof = user.professional.profession || '';
      const matchedCat = FASHION_CATEGORIES.find(
        (cat) => cat.toLowerCase() === prof.toLowerCase()
      ) || '';

      setForm((prev) => ({
        ...prev,
        business_name: prev.business_name || biz.name || '',
        short_description: prev.short_description || biz.description || '',
        category: prev.category || matchedCat,
        location: {
          ...prev.location,
          city: prev.location.city || user.address?.city || '',
          country: prev.location.country || user.address?.country || '',
          lat: prev.location.lat !== '' ? prev.location.lat : (user.address?.lat || ''),
          lon: prev.location.lon !== '' ? prev.location.lon : (user.address?.lon || ''),
        }
      }));
    }
  }, [user]);

  const calcFee = (startDate, endDate) => {
    if (!startDate || !endDate) return { days: 1, feeDollars: '1.00' };
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const days = Math.max(1, Math.round((e - s) / 86400000));
      return { days, feeDollars: (days * 1).toFixed(2) };
    } catch {
      return { days: 1, feeDollars: '1.00' };
    }
  };
  const feeInfo = calcFee(form?.start_date, form?.end_date);

  const isExpert = user?.professional?.is_professional;

  if (!isExpert) {
    return (
      <div className="container-px max-w-xl mx-auto pt-16 text-center">
        <h1 className="font-display text-2xl">{t('campaigns.create.notExpert')}</h1>
        <p className="text-muted-foreground mt-2">{t('campaigns.create.notExpertBody')}</p>
        <Button className="mt-6" onClick={() => navigate('/me')}>{t('campaigns.create.goToProfile')}</Button>
      </div>
    );
  }

  const setField = (path, value) => {
    setForm((prev) => {
      const keys = path.split('.');
      if (keys.length === 1) return { ...prev, [path]: value };
      return {
        ...prev,
        [keys[0]]: { ...prev[keys[0]], [keys[1]]: value },
      };
    });
  };

  const toggleTarget = (val) => {
    const current = form.audience.targets;
    if (val === 'all') {
      setField('audience.targets', ['all']);
      return;
    }
    const without = current.filter((t) => t !== 'all' && t !== val);
    if (current.includes(val)) {
      setField('audience.targets', without.length ? without : ['all']);
    } else {
      setField('audience.targets', [...without, val]);
    }
  };

  const toggleChannel = (ch) => {
    const current = form.notifications.channels;
    const next = current.includes(ch)
      ? current.filter((c) => c !== ch)
      : [...current, ch];
    setField('notifications.channels', next);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (campaignId) {
        await campaignApi.updateCampaign(campaignId, payload);
      } else {
        await campaignApi.createCampaign(payload);
      }
      toast.success(t('campaigns.create.draftSaved'));
      navigate(`/campaigns/mine`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.create.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Phase 1: Check PayPal and create order
    if (submitPhase !== 'idle') return;
    
    // Check PayPal connection client-side
    const hasPayPal = !!(user?.paypal_receiver_email);
    if (!hasPayPal) {
      setPaypalRequired(true);
      return;
    }
    
    setSubmitPhase('creating_order');
    try {
      let cid = campaignId;
      const payload = buildPayload();
      if (cid) {
        await campaignApi.updateCampaign(cid, payload);
      } else {
        const created = await campaignApi.createCampaign(payload);
        cid = created.id;
        setCampaignId(cid);
      }
      const res = await campaignApi.submitCampaign(cid); // returns {order_id, fee_cents, total_days}
      setPaypalOrder(res);
      setSubmitPhase('awaiting_payment');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'paypal_not_connected') {
        setPaypalRequired(true);
        setSubmitPhase('idle');
        return;
      }
      toast.error(err?.response?.data?.detail || t('campaigns.create.submitError'));
      setSubmitPhase('idle');
    }
  };

  const handlePayPalCapture = async () => {
    // Phase 2: Capture the PayPal order
    if (!paypalOrder?.order_id || !campaignId) return;
    setSubmitPhase('capturing');
    try {
      await campaignApi.captureSubmissionOrder(campaignId, paypalOrder.order_id);
      setSubmitPhase('done');
      toast.success(t('campaigns.create.submitSuccess'));
      navigate('/campaigns/mine');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.create.submitError'));
      setSubmitPhase('idle');
    }
  };

  const buildPayload = () => ({
    ...form,
    discount_pct: form.discount_pct !== '' ? Number(form.discount_pct) : null,
    location: {
      ...form.location,
      lat: form.location.lat !== '' ? Number(form.location.lat) : null,
      lon: form.location.lon !== '' ? Number(form.location.lon) : null,
      radius_km: Number(form.location.radius_km) || 25,
    },
    audience: {
      ...form.audience,
      age_min: form.audience.age_min !== '' ? Number(form.audience.age_min) : null,
      age_max: form.audience.age_max !== '' ? Number(form.audience.age_max) : null,
    },
  });

  const currentStep = STEPS[step];

  return (
    <div className="min-h-full">
      <div className="container-px max-w-2xl mx-auto pt-6 pb-24">
        {/* Back */}
        <button
          onClick={() => navigate('/campaigns/mine')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="create-campaign-back"
        >
          <ArrowLeft className="h-4 w-4" />{t('common.back')}
        </button>

        <div className="caps-label text-muted-foreground">{t('campaigns.create.subtitle')}</div>
        <h1 className="font-display text-3xl mt-1 mb-6">{t('campaigns.create.title')}</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button
                key={s.id}
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all',
                  isActive && 'bg-primary text-primary-foreground font-medium',
                  isDone && 'bg-secondary text-muted-foreground hover:bg-secondary/80',
                  !isActive && !isDone && 'text-muted-foreground opacity-50 cursor-not-allowed'
                )}
                data-testid={`create-campaign-step-${s.id}`}
              >
                {isDone ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                {t(s.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <Card className="rounded-2xl shadow-editorial">
          <CardContent className="p-6 space-y-5">
            {/* Step 0: Basic */}
            {step === 0 && (
              <>
                <div className="space-y-3">
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.basic.title')}</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder={t('campaigns.create.basic.titlePlaceholder')}
                      data-testid="create-campaign-title"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.basic.businessName')}</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.business_name}
                      onChange={(e) => setField('business_name', e.target.value)}
                      placeholder={t('campaigns.create.basic.businessNamePlaceholder')}
                      data-testid="create-campaign-business-name"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.basic.category')}</Label>
                    <Select value={form.category} onValueChange={(v) => setField('category', v)}>
                      <SelectTrigger className="mt-1 rounded-xl" data-testid="create-campaign-category">
                        <SelectValue placeholder={t('campaigns.create.basic.categoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {FASHION_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.basic.shortDescription')}</Label>
                    <Textarea
                      className="mt-1 rounded-xl resize-none"
                      rows={3}
                      value={form.short_description}
                      onChange={(e) => setField('short_description', e.target.value)}
                      placeholder={t('campaigns.create.basic.shortDescriptionPlaceholder')}
                      data-testid="create-campaign-short-desc"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.basic.longDescription')}</Label>
                    <Textarea
                      className="mt-1 rounded-xl resize-none"
                      rows={5}
                      value={form.long_description}
                      onChange={(e) => setField('long_description', e.target.value)}
                      placeholder={t('campaigns.create.basic.longDescriptionPlaceholder')}
                      data-testid="create-campaign-long-desc"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.basic.coverImageUrl')}</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.cover_image_url}
                      onChange={(e) => setField('cover_image_url', e.target.value)}
                      placeholder="https://..."
                      data-testid="create-campaign-cover"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 1: Promotion */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.promotion.discountPct')}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="mt-1 rounded-xl"
                      value={form.discount_pct}
                      onChange={(e) => setField('discount_pct', e.target.value)}
                      placeholder="25"
                      data-testid="create-campaign-discount"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.promotion.couponCode')}</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.coupon_code}
                      onChange={(e) => setField('coupon_code', e.target.value.toUpperCase())}
                      placeholder="SUMMER25"
                      data-testid="create-campaign-coupon"
                    />
                  </div>
                </div>
                <div>
                  <Label className="caps-label text-muted-foreground">{t('campaigns.create.promotion.saleType')}</Label>
                  <Select value={form.sale_type} onValueChange={(v) => setField('sale_type', v)}>
                    <SelectTrigger className="mt-1 rounded-xl" data-testid="create-campaign-sale-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['discount','service_promotion','product_promotion','limited_time_offer','flash_sale','seasonal'].map((v) => (
                        <SelectItem key={v} value={v}>{t(`campaigns.create.promotion.saleTypes.${v}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="limited-time"
                    checked={form.limited_time_offer}
                    onCheckedChange={(v) => setField('limited_time_offer', v)}
                    data-testid="create-campaign-limited-time"
                  />
                  <Label htmlFor="limited-time">{t('campaigns.create.promotion.limitedTimeOffer')}</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.promotion.startDate')}</Label>
                    <Input
                      type="date"
                      className="mt-1 rounded-xl"
                      value={form.start_date}
                      onChange={(e) => setField('start_date', e.target.value)}
                      data-testid="create-campaign-start-date"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.promotion.endDate')}</Label>
                    <Input
                      type="date"
                      className="mt-1 rounded-xl"
                      value={form.end_date}
                      onChange={(e) => setField('end_date', e.target.value)}
                      data-testid="create-campaign-end-date"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.location.country')}</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.location.country}
                      onChange={(e) => setField('location.country', e.target.value)}
                      placeholder="IL"
                      data-testid="create-campaign-country"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.location.city')}</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.location.city}
                      onChange={(e) => setField('location.city', e.target.value)}
                      placeholder="Tel Aviv"
                      data-testid="create-campaign-city"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.location.lat')}</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      className="mt-1 rounded-xl"
                      value={form.location.lat}
                      onChange={(e) => setField('location.lat', e.target.value)}
                      placeholder="32.0853"
                      data-testid="create-campaign-lat"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.location.lon')}</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      className="mt-1 rounded-xl"
                      value={form.location.lon}
                      onChange={(e) => setField('location.lon', e.target.value)}
                      placeholder="34.7818"
                      data-testid="create-campaign-lon"
                    />
                  </div>
                </div>
                <div>
                  <Label className="caps-label text-muted-foreground">{t('campaigns.create.location.radiusKm')}</Label>
                  <Select
                    value={String(form.location.radius_km)}
                    onValueChange={(v) => setField('location.radius_km', Number(v))}
                  >
                    <SelectTrigger className="mt-1 rounded-xl" data-testid="create-campaign-radius">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 25, 50, 100].map((r) => (
                        <SelectItem key={r} value={String(r)}>{r} km</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Audience */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="caps-label text-muted-foreground mb-2 block">{t('campaigns.create.audience.targets')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCE_TARGETS.map(({ value, labelKey }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleTarget(value)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm border transition-all',
                          form.audience.targets.includes(value)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:border-primary'
                        )}
                        data-testid={`create-campaign-target-${value}`}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.audience.ageMin')}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      className="mt-1 rounded-xl"
                      value={form.audience.age_min}
                      onChange={(e) => setField('audience.age_min', e.target.value)}
                      placeholder="18"
                      data-testid="create-campaign-age-min"
                    />
                  </div>
                  <div>
                    <Label className="caps-label text-muted-foreground">{t('campaigns.create.audience.ageMax')}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      className="mt-1 rounded-xl"
                      value={form.audience.age_max}
                      onChange={(e) => setField('audience.age_max', e.target.value)}
                      placeholder="65"
                      data-testid="create-campaign-age-max"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Notifications */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('campaigns.create.notifications.masterSwitch')}</p>
                    <p className="text-sm text-muted-foreground">{t('campaigns.create.notifications.masterSwitchBody')}</p>
                  </div>
                  <Switch
                    id="notif-master"
                    checked={form.notifications.master_enabled}
                    onCheckedChange={(v) => setField('notifications.master_enabled', v)}
                    data-testid="create-campaign-notif-master"
                  />
                </div>

                {form.notifications.master_enabled && (
                  <>
                    <div className="space-y-3">
                      <Label className="caps-label text-muted-foreground">{t('campaigns.create.notifications.channels')}</Label>
                      {['push', 'email'].map((ch) => (
                        <div key={ch} className="flex items-center gap-3">
                          <Checkbox
                            id={`channel-${ch}`}
                            checked={form.notifications.channels.includes(ch)}
                            onCheckedChange={() => toggleChannel(ch)}
                            data-testid={`create-campaign-channel-${ch}`}
                          />
                          <Label htmlFor={`channel-${ch}`}>
                            {t(`campaigns.create.notifications.channel_${ch}`)}
                          </Label>
                        </div>
                      ))}
                    </div>

                    <div>
                      <Label className="caps-label text-muted-foreground">{t('campaigns.create.notifications.timing')}</Label>
                      <Select
                        value={form.notifications.timing}
                        onValueChange={(v) => setField('notifications.timing', v)}
                      >
                        <SelectTrigger className="mt-1 rounded-xl" data-testid="create-campaign-notif-timing">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            'immediately_after_approval',
                            'on_start_date',
                            'custom',
                          ].map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(`campaigns.create.notifications.timing_${v}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {form.notifications.timing === 'custom' && (
                      <div>
                        <Label className="caps-label text-muted-foreground">{t('campaigns.create.notifications.customDatetime')}</Label>
                        <Input
                          type="datetime-local"
                          className="mt-1 rounded-xl"
                          value={form.notifications.custom_datetime}
                          onChange={(e) => setField('notifications.custom_datetime', e.target.value)}
                          data-testid="create-campaign-notif-custom-dt"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl">{t('campaigns.create.review.title')}</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32">{t('campaigns.create.basic.title')}:</span>
                    <span className="font-medium">{form.title}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32">{t('campaigns.create.basic.businessName')}:</span>
                    <span>{form.business_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32">{t('campaigns.create.basic.category')}:</span>
                    <Badge variant="outline" className="rounded-full text-xs">{form.category}</Badge>
                  </div>
                  {form.discount_pct && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">{t('campaigns.create.promotion.discountPct')}:</span>
                      <Badge className="bg-[hsl(var(--accent))] text-white border-0 rounded-full text-xs">{form.discount_pct}%</Badge>
                    </div>
                  )}
                  {form.location.city && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">{t('campaigns.create.location.city')}:</span>
                      <span>{form.location.city}, {form.location.country}</span>
                    </div>
                  )}
                  {form.end_date && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32">{t('campaigns.detail.until')}:</span>
                      <span>{form.end_date}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32">{t('campaigns.create.notifications.masterSwitch')}:</span>
                    <span>{form.notifications.master_enabled ? t('common.yes') : t('common.no')}</span>
                  </div>
                </div>

                <div className="pt-2 text-sm text-muted-foreground">
                  {t('campaigns.create.review.note')}
                </div>

                {/* Fee breakdown */}
                <div className="rounded-xl bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20 p-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-[hsl(var(--accent))]" />
                    <h4 className="font-semibold text-sm">{t('campaigns.billing.totalFee')}</h4>
                  </div>
                  <div className="text-2xl font-display font-bold text-[hsl(var(--accent))]">
                    ${feeInfo.feeDollars} USD
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('campaigns.billing.feePerDay')} × {feeInfo.days} {t('campaigns.billing.days', { count: feeInfo.days })}
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-2">
                    {t('campaigns.billing.feeNote')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => step === 0 ? navigate('/campaigns/mine') : setStep(step - 1)}
            data-testid="create-campaign-prev"
          >
            <ArrowLeft className="h-4 w-4 me-1" />{t('common.back')}
          </Button>

          <div className="flex gap-2">
            {step === STEPS.length - 1 ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={handleSaveDraft}
                  disabled={saving || !form.title || !form.category}
                  data-testid="create-campaign-save-draft"
                >
                  {t('campaigns.create.saveDraft')}
                </Button>
                {submitPhase === 'awaiting_payment' && paypalOrder ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#FFC439]/10 border border-[#FFC439]/30 p-4 text-center">
                      <p className="text-sm font-semibold">{t('campaigns.billing.paypalRequired')}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${(paypalOrder.fee_cents / 100).toFixed(2)} USD
                      </p>
                    </div>
                    <Button
                      className="w-full rounded-xl bg-[#FFC439] hover:bg-[#F5BA30] text-[#003087] font-bold"
                      onClick={handlePayPalCapture}
                      disabled={submitPhase === 'capturing'}
                      data-testid="paypal-capture-btn"
                    >
                      {submitPhase === 'capturing' && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                      PayPal — {t('campaigns.billing.confirmPayment')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full rounded-xl"
                    onClick={handleSubmit}
                    disabled={submitPhase !== 'idle' || !form.title || !form.category}
                    data-testid="campaign-submit-for-approval-btn"
                  >
                    {submitPhase === 'creating_order' && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {t('campaigns.create.submitForApproval')}
                  </Button>
                )}
              </>
            ) : (
              <Button
                className="rounded-xl"
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && (!form.title || !form.category || !form.short_description)}
                data-testid="create-campaign-next"
              >
                {t('common.next')}
                <ArrowRight className="h-4 w-4 ms-1" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PayPal Required Dialog */}
      <Dialog open={paypalRequired} onOpenChange={setPaypalRequired}>
        <DialogContent data-testid="paypal-required-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[hsl(var(--accent))]" />
              {t('campaigns.billing.paypalRequired')}
            </DialogTitle>
            <DialogDescription>{t('campaigns.billing.paypalRequiredBody')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-center">
            <span className="text-2xl font-bold text-[hsl(var(--accent))]">${feeInfo.feeDollars}</span>
            <span className="text-muted-foreground ml-1 text-xs">USD / campaign</span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaypalRequired(false)}>
              {t('common.cancel')}
            </Button>
            <Button asChild>
              <a href="/me?tab=payment" target="_blank">
                <ExternalLink className="h-4 w-4 me-1" />
                {t('campaigns.billing.connectPayPal')}
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
