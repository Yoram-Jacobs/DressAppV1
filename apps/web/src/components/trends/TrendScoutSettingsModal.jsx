import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Sparkles,
  Shirt,
  Share2,
  Check,
  RefreshCw,
  Loader2,
  Link2,
  Unlink,
  Layers,
  Zap,
} from 'lucide-react';

const SUGGESTED_STYLES = [
  { id: 'vintage', label: 'Vintage' },
  { id: 'quiet_luxury', label: 'Quiet Luxury' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'streetwear', label: 'Streetwear' },
  { id: 'old_money', label: 'Old Money' },
  { id: 'boho_casual', label: 'Boho & Casual' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'y2k', label: 'Y2K' },
  { id: 'classic_business', label: 'Classic Business' },
  { id: 'athleisure', label: 'Athleisure' },
];

const PLATFORM_ICONS = {
  instagram: '📸',
  facebook: '📘',
  pinterest: '📌',
  tiktok: '🎵',
  x: '𝕏',
  threads: '🧵',
};

export function TrendScoutSettingsModal({ open, onOpenChange, onRefreshTriggered, selectedGender, country }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customStyle, setCustomStyle] = useState('');
  const [socialPlatforms, setSocialPlatforms] = useState([]);
  const [closetProfile, setClosetProfile] = useState(null);
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [handleInput, setHandleInput] = useState('');

  useEffect(() => {
    if (!open) return;
    fetchSettings();
  }, [open]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      if (res.success) {
        setCustomStyle(res.settings?.custom_style || '');
        setSocialPlatforms(res.settings?.social_platforms || []);
        setClosetProfile(res.closet_profile || null);
      }
    } catch (err) {
      console.error('Failed to load trend scout settings:', err);
      toast.error(t('trends.loadSettingsError', { defaultValue: 'Failed to load personalization settings' }));
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlatform = (platformId) => {
    setSocialPlatforms((prev) =>
      prev.map((p) => (p.id === platformId ? { ...p, active: !p.active } : p))
    );
  };

  const handleOpenConnect = (platform) => {
    setConnectingPlatform(platform);
    setHandleInput(platform.username || '');
  };

  const handleSaveConnect = async () => {
    if (!connectingPlatform) return;
    try {
      await api.connectSocial(connectingPlatform.id, handleInput.trim());
      setSocialPlatforms((prev) =>
        prev.map((p) =>
          p.id === connectingPlatform.id
            ? { ...p, connected: true, active: true, username: handleInput.trim() }
            : p
        )
      );
      toast.success(t('trends.socialConnected', { defaultValue: `Connected to ${connectingPlatform.name}` }));
      setConnectingPlatform(null);
      setHandleInput('');
    } catch (err) {
      console.error('Failed to connect platform:', err);
      toast.error(t('trends.connectError', { defaultValue: 'Failed to connect account' }));
    }
  };

  const handleDisconnect = async (platformId) => {
    try {
      await api.disconnectSocial(platformId);
      setSocialPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId ? { ...p, connected: false, active: false, username: '' } : p
        )
      );
      toast.success(t('trends.socialDisconnected', { defaultValue: 'Account disconnected' }));
    } catch (err) {
      console.error('Failed to disconnect platform:', err);
      toast.error(t('trends.disconnectError', { defaultValue: 'Failed to disconnect account' }));
    }
  };

  const handleSaveSettings = async (autoRefresh = false) => {
    if (saving || refreshing) return;
    setSaving(true);
    try {
      const payload = {
        custom_style: customStyle.trim() || null,
        social_platforms: socialPlatforms,
      };
      const res = await api.updateSettings(payload);
      if (res.success) {
        setClosetProfile(res.closet_profile || null);
        toast.success(t('trends.settingsSaved', { defaultValue: 'Personalization settings saved' }));
      }
      if (autoRefresh) {
        setRefreshing(true);
        try {
          try {
            await api.trendsRunNowDev(true, selectedGender, country);
          } catch (runErr) {
            console.warn('trendsRunNowDev background refresh notice:', runErr);
          }
          if (onRefreshTriggered) {
            try {
              await onRefreshTriggered();
            } catch (trigErr) {
              console.warn('onRefreshTriggered failed:', trigErr);
            }
          }
          toast.success(t('trends.feedRefreshedSuccess', { defaultValue: 'Trend Scout refreshed for your style & platforms!' }));
        } catch (err) {
          console.error('Refresh failed:', err);
          toast.error(t('trends.refreshFailed', { defaultValue: 'Scout refresh encountered an error' }));
        } finally {
          setRefreshing(false);
          onOpenChange(false);
        }
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(t('trends.saveFailed', { defaultValue: 'Could not save settings' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-[12px] p-5">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary-shadow text-primary-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="mb-1">
                {t('trends.settingsTitle', { defaultValue: 'Trend Scout Personalization' })}
              </DialogTitle>
              <DialogDescription>
                {t('trends.settingsDesc', { defaultValue: 'Connect social accounts and personalize your style filter.' })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary-brand" />
            <p className="text-xs text-primary-brand">
              {t('trends.loadingSettings', { defaultValue: 'Analyzing closet profile...' })}
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Closet Intelligence Card */}
            <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-dark-brand">
                  <Shirt className="h-4 w-4 text-primary-brand" />
                  {t('trends.closetIntelligence', { defaultValue: 'Wardrobe Analysis' })}
                </span>
                <span className="text-[12px] text-primary-brand font-semibold">
                  {closetProfile?.item_count || 0} {t('trends.itemsAnalyzed', { defaultValue: 'items' })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-xs border border-primary-brand bg-white text-primary-brand px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <span>{t('trends.leadDressCode', { defaultValue: 'Lead Dress Code' })}: <strong className="ms-1">{closetProfile?.lead_dress_code || 'Casual'}</strong></span>
                </Badge>
                <Badge variant="outline" className="text-xs border border-primary-brand bg-white text-primary-brand px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <span>{t('trends.leadClosetStyle', { defaultValue: 'Closet Style' })}: <strong className="ms-1">{closetProfile?.lead_closet_style || 'Classic'}</strong></span>
                </Badge>
                {closetProfile?.effective_style && closetProfile?.effective_style !== closetProfile?.lead_closet_style && (
                  <Badge variant="outline" className="text-xs border border-primary-brand bg-white ttext-primary-brand px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span>{t('trends.customActive', { defaultValue: 'Active Override' })}: <strong className="ms-1">{closetProfile.effective_style}</strong></span>
                  </Badge>
                )}
              </div>
            </div>
            {/* Custom Style Input Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-dark-brand flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary-brand" />
                  {t('trends.customStyleField', { defaultValue: 'Style Preference' })}
                </label>
                {customStyle && (
                  <button
                    type="button"
                    onClick={() => setCustomStyle('')}
                    className="text-[12px] font-bold text-primary-brand hover:text-dark-brand"
                  >
                    {t('common.clear', { defaultValue: 'Reset to closet' })}
                  </button>
                )}
              </div>
              <Input
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder={t('trends.stylePlaceholder', { defaultValue: 'e.g., Vintage, Quiet Luxury, Streetwear...' })}
                className=""
              />
              <p className="text-[11px] text-text-brand font-semibold">
                {t('trends.styleFieldHint', { defaultValue: 'Enter any style or aesthetic to override your closet baseline and guide web discovery.' })}
              </p>
              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_STYLES.map((style) => {
                  const localizedLabel = t(`trends.styles.${style.id}`, { defaultValue: style.label });
                  const isSelected = customStyle.toLowerCase() === style.label.toLowerCase() || customStyle.toLowerCase() === localizedLabel.toLowerCase();
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setCustomStyle(localizedLabel)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                        isSelected
                          ? 'border-primary-brand bg-primary-brand text-white'
                          : 'border-border bg-white text-text-brand'
                      }`}
                    >
                      {localizedLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Social Media Accounts Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-dark-brand flex items-center gap-1.5">
                  <Share2 className="h-4 w-4 text-primary-brand" />
                  {t('trends.socialAccounts', { defaultValue: 'Social Media Feeds' })}
                </label>
                <span className="text-[12px] font-bold text-primary-brand">
                  {socialPlatforms.filter((p) => p.active).length} / {socialPlatforms.length} {t('trends.active', { defaultValue: 'active' })}
                </span>
              </div>
              <p className="text-[11px] text-text-brand font-semibold">
                {t('trends.socialDesc', { defaultValue: 'Trend Scout prioritizes fashion creators, hashtags, and viral aesthetics from your connected platforms.' })}
              </p>
              <div className="space-y-2">
                {socialPlatforms.map((platform) => {
                  const icon = PLATFORM_ICONS[platform.id] || '🌐';
                  return (
                    <div
                      key={platform.id}
                      className={`flex items-center justify-between p-3 rounded-[12px] border transition-all ${
                        platform.active
                          ? 'border-primary-brand bg-primary-shadow'
                          : 'border-border bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl select-none">{icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-dark-brand">{platform.name}</span>
                            {platform.connected && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-md">
                                {platform.username ? `@${platform.username}` : t('trends.connected', { defaultValue: 'Connected' })}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-primary-brand block">
                            {platform.active
                              ? t('trends.platformActive', { defaultValue: 'Active in Trend Scout' })
                              : t('trends.platformInactive', { defaultValue: 'Muted' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {platform.connected ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant={platform.active ? 'default' : 'outline'}
                              onClick={() => handleTogglePlatform(platform.id)}
                              className="h-8 px-2.5 gap-1"
                            >
                              {platform.active ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  {t('trends.enabled', { defaultValue: 'Active' })}
                                </>
                              ) : (
                                t('trends.enable', { defaultValue: 'Enable' })
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDisconnect(platform.id)}
                              className="h-8 px-2.5 gap-1 bg-destructive"
                              title={t('trends.disconnect', { defaultValue: 'Disconnect account' })}
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenConnect(platform)}
                            className="h-8 px-2.5 gap-1"
                          >
                            <Link2 className="h-3 w-3" />
                            {t('trends.connectAccount', { defaultValue: 'Connect' })}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Connect Dialog/Inline Form */}
            {connectingPlatform && (
              <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-dark-brand">
                  <span>{t('trends.connectModalTitle', { defaultValue: 'Connect' })} {connectingPlatform.name}</span>
                  <button
                    type="button"
                    onClick={() => setConnectingPlatform(null)}
                    className="text-primary-brand hover:text-dark-brand text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    placeholder={t('trends.handlePlaceholder', { defaultValue: 'Enter @username or profile handle' })}
                    className="mb-0"
                  />
                  <Button size="sm" onClick={handleSaveConnect} className="">
                    {t('common.save', { defaultValue: 'Save' })}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions: Save & Instant Refresh */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleSaveSettings(false)}
                disabled={saving || refreshing}
                className="flex-1 rounded-xl h-10 text-xs font-medium"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('common.saveChanges', { defaultValue: 'Save Preferences' })}
              </Button>
              <Button
                variant="default"
                onClick={() => handleSaveSettings(true)}
                disabled={saving || refreshing}
                className="flex-1 rounded-xl h-10 text-xs font-medium bg-brand text-primary-foreground hover:bg-brand/90 gap-1.5 shadow-sm"
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t('trends.saveAndRefreshInstant', { defaultValue: 'Save & Instant Refresh' })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
