import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Key, CreditCard as Coins, Info, ExternalLink, Sparkles } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'dressapp',
    name: 'DressApp',
    defaultModel: 'Eyes v1',
    models: ['Eyes v1'],
    requiresApiKey: false,
  },
  {
    id: 'google_ai',
    name: 'Google Gemini',
    defaultModel: 'gemini-3.5-flash-lite',
    models: ['gemini-3.5-flash-lite'],
    requiresApiKey: true,
  },
];

function normalizeProviderId(providerId) {
  return PROVIDERS.some((p) => p.id === providerId) ? providerId : 'dressapp';
}

function normalizeModelForProvider(providerId, model) {
  if (providerId === 'google_ai') {
    if (!model || model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-lite' || model === 'gemini-3.5-flash' || model === 'gemini-3.5-pro') {
      return 'gemini-3.5-flash-lite';
    }
    return PROVIDERS.find((p) => p.id === 'google_ai')?.models.includes(model) ? model : 'gemini-3.5-flash-lite';
  }
  return 'Eyes v1';
}

export function AIConfiguration() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal } = useAuth();
  const isRtl = i18n.dir() === 'rtl';
  const isTester = Boolean(
    user?.subscription?.is_tester ||
    user?.subscription?.plan_type === 'tester' ||
    user?.roles?.includes('tester')
  );
  
  const [providerMode, setProviderMode] = useState('custom_keys');
  const initialProviderId = normalizeProviderId(user?.ai_configuration?.selected_provider);
  const [activeProviderId, setActiveProviderId] = useState(initialProviderId);
  const [activeModel, setActiveModel] = useState(
    normalizeModelForProvider(initialProviderId, user?.ai_configuration?.selected_model)
  );
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isTester) return;
    api.getMe().then((freshUser) => {
      if (freshUser) {
        updateUserLocal(freshUser);
      }
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTester]);

  if (!isTester) {
    return null;
  }
  
  const currentCredits = user?.ai_configuration?.current_credits ?? 1000;
  const creditsUsed = user?.ai_configuration?.credits_used_this_month ?? 0;
  const creditPrice = 0.005; 
  
  const calculatedFee = (creditsUsed * creditPrice * 0.07).toFixed(4);
  
  const activeProvider = PROVIDERS.find(p => p.id === activeProviderId) || PROVIDERS[0];
  const hasSelectedProviderKey = !!user?.ai_configuration?.custom_keys?.[activeProviderId];

  const handleSaveConfig = async (mode, keyVal = null, providerId = null, modelVal = null) => {
    setBusy(true);
    try {
      const currentConfig = user?.ai_configuration || {};
      const newProviderId = normalizeProviderId(providerId || currentConfig.selected_provider || 'dressapp');
      const normalizedCurrentModel = normalizeModelForProvider(newProviderId, currentConfig.selected_model);
      const targetDefaultModel = PROVIDERS.find(p => p.id === newProviderId)?.defaultModel || 'Eyes v1';
      const newModelVal = modelVal
        ? normalizeModelForProvider(newProviderId, modelVal)
        : (providerId ? targetDefaultModel : normalizedCurrentModel);
      
      const payload = {
        ai_configuration: {
          provider_mode: newProviderId === 'dressapp' ? 'dressapp' : 'custom_keys',
          selected_provider: newProviderId,
          selected_model: newModelVal,
          custom_keys: {}
        }
      };
      
      const providersList = ['google_ai'];
      providersList.forEach(p => {
        if (p === newProviderId && keyVal !== null) {
          payload.ai_configuration.custom_keys[p] = keyVal;
        } else if (currentConfig.custom_keys?.[p]) {
          payload.ai_configuration.custom_keys[p] = true;
        }
      });
      
      const updatedUser = await api.patchMe(payload);
      updateUserLocal(updatedUser);
      setProviderMode('custom_keys');
      if (providerId) setActiveProviderId(providerId);
      if (newModelVal) setActiveModel(newModelVal);
      toast.success(t('common.success', { defaultValue: 'Settings updated successfully' }));
      setIsModalOpen(false);
      setApiKeyInput('');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || t('profile.saveFailed', { defaultValue: 'Save failed' }));
    } finally {
      setBusy(false);
    }
  };

  const getStepInstructions = () => ({
    step1: t('profile.aiConfig.stepGemini1', { defaultValue: "1. Click 'Get API Key' to visit Google AI Studio." }),
    step2: t('profile.aiConfig.stepGemini2', { defaultValue: "2. Sign in with any Google account and click 'Create API Key'." }),
    step3: t('profile.aiConfig.stepGemini3', { defaultValue: "3. Copy the generated key, paste it below, and click Save." }),
    link: "https://aistudio.google.com/app/apikey"
  });
  const steps = getStepInstructions();

  return (
    <AccordionItem
      value="ai-config"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
      id="ai-configuration-section"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-full bg-[hsl(35_92%_95%)] text-[hsl(35_92%_52%)] dark:bg-[hsl(35_30%_18%)] dark:text-[hsl(35_92%_70%)] shrink-0 transition-transform duration-200">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.aiConfig.title', { defaultValue: 'AI Configuration' })}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.aiConfig.subtitle', { defaultValue: 'Manage your AI service providers and customize API keys.' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-4 pt-3 pb-0 mt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
          <div className="space-y-2">
            <Label>{t('profile.aiConfig.providerLabel', { defaultValue: 'Active Provider' })}</Label>
            <Select
              value={activeProviderId}
              onValueChange={(val) => handleSaveConfig('custom_keys', null, val)}
              disabled={busy}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('profile.aiConfig.modelLabel', { defaultValue: 'Model Preference' })}</Label>
            <Select
              value={activeModel}
              onValueChange={(val) => handleSaveConfig('custom_keys', null, null, val)}
              disabled={busy}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeProvider.models.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {activeProvider.requiresApiKey === false ? (
          <div className="p-3 rounded-[12px] border border-border bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm text-start">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-dark-brand flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t('profile.aiConfig.dressappEyesTitle', { defaultValue: 'DressApp Eyes Engine' })}
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('profile.aiConfig.statusIncluded', { defaultValue: 'Included / Free' })}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-[12px] border border-border bg-yellow-shadow shadow-sm text-start">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-dark-brand flex items-center gap-2">
                {t('profile.aiConfig.providerKeyLabel', { defaultValue: '{{providerName}} Key:', providerName: activeProvider.name })}
                {hasSelectedProviderKey ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t('profile.aiConfig.statusActive', { defaultValue: 'Active' })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {t('profile.aiConfig.statusInactive', { defaultValue: 'Inactive' })}
                  </span>
                )}
              </span>
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button className="text-[10px] h-6 px-3">
                    {hasSelectedProviderKey 
                      ? t('common.edit', { defaultValue: 'Edit' }) 
                      : t('profile.aiConfig.connectKey', { defaultValue: 'Connect Key' })}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md bg-card border border-border shadow-lg">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      {t('profile.aiConfig.modelSelectorTitleProvider', { defaultValue: 'Connect {{providerName}} Key', providerName: activeProvider.name })}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-text-brand">
                      {t('profile.aiConfig.setupInstructions', { defaultValue: 'Setting up your custom API key is easy! Follow these steps:' })}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-2">
                    <div className="text-xs space-y-2 text-dark-brand/90 bg-secondary/25 p-3.5 rounded-xl border border-border/40">
                      <p>{steps.step1}</p>
                      <p>{steps.step2}</p>
                      <p>{steps.step3}</p>
                    </div>

                    <div className="flex justify-end">
                      <a 
                        href={steps.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        {t('profile.aiConfig.getKeyBtn', { defaultValue: 'Get API Key' })}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{t('profile.aiConfig.apiKeyLabel', { defaultValue: 'API Key' })}</Label>
                      <Input 
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={t('profile.aiConfig.keyPlaceholder', { defaultValue: 'Paste your API key here...' })}
                        className="rounded-xl text-xs h-9 bg-card"
                      />
                    </div>
                    
                    <Button 
                      className="w-full rounded-xl text-xs h-9 font-semibold"
                      onClick={() => handleSaveConfig(providerMode, apiKeyInput, activeProviderId)}
                      disabled={busy || !apiKeyInput}
                    >
                      {busy && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      {t('profile.aiConfig.saveBtn', { defaultValue: 'Save Configuration' })}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-[12px] text-text-brand font-semibold italic">
              {t('profile.aiConfig.setupInstructions', { defaultValue: 'Configure your own developer key to run queries directly against your own account quota.' })}
            </p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
