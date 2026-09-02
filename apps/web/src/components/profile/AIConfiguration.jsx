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
import { Loader2, Key, Coins, Info, ExternalLink } from 'lucide-react';

const PROVIDERS = [
  { id: 'google_ai', name: 'Google Gemini', defaultModel: 'gemini-3.5-flash', models: ['gemini-3.5-flash', 'gemini-3.5-pro'] },
  { id: 'openai', name: 'OpenAI ChatGPT', defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o'] },
  { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-3-5-haiku', models: ['claude-3-5-haiku', 'claude-3-5-sonnet'] },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'qwen', name: 'Alibaba Qwen', defaultModel: 'qwen-plus', models: ['qwen-plus', 'qwen-max'] }
];

export function AIConfiguration() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal } = useAuth();
  const isRtl = i18n.dir() === 'rtl';
  
  const [providerMode, setProviderMode] = useState('custom_keys');
  const [activeProviderId, setActiveProviderId] = useState(user?.ai_configuration?.selected_provider || 'google_ai');
  const [activeModel, setActiveModel] = useState(user?.ai_configuration?.selected_model || 'gemini-2.5-flash');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getMe().then((freshUser) => {
      if (freshUser) {
        updateUserLocal(freshUser);
      }
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
      const newProviderId = providerId || currentConfig.selected_provider || 'google_ai';
      const newModelVal = modelVal || (providerId ? (PROVIDERS.find(p => p.id === providerId)?.defaultModel || 'gemini-2.5-flash') : (currentConfig.selected_model || 'gemini-2.5-flash'));
      
      const payload = {
        ai_configuration: {
          provider_mode: 'custom_keys',
          selected_provider: newProviderId,
          selected_model: newModelVal,
          custom_keys: {}
        }
      };
      
      const providersList = ['google_ai', 'openai', 'anthropic', 'deepseek', 'qwen'];
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
      toast.error(t('profile.saveFailed', { defaultValue: 'Save failed' }));
    } finally {
      setBusy(false);
    }
  };

  const getStepInstructions = () => {
    switch (activeProviderId) {
      case 'openai':
        return {
          step1: t('profile.aiConfig.stepOpenAI1', { defaultValue: "1. Click 'Get API Key' to visit OpenAI Developer Platform." }),
          step2: t('profile.aiConfig.stepOpenAI2', { defaultValue: "2. Sign in and navigate to API Keys dashboard." }),
          step3: t('profile.aiConfig.stepOpenAI3', { defaultValue: "3. Create a new secret key, copy it, and paste it below." }),
          link: "https://platform.openai.com/api-keys"
        };
      case 'anthropic':
        return {
          step1: t('profile.aiConfig.stepAnthropic1', { defaultValue: "1. Click 'Get API Key' to visit Anthropic Developer Console." }),
          step2: t('profile.aiConfig.stepAnthropic2', { defaultValue: "2. Sign in with your developer account." }),
          step3: t('profile.aiConfig.stepAnthropic3', { defaultValue: "3. Create an API key in settings, copy it, and paste it below." }),
          link: "https://console.anthropic.com/settings/keys"
        };
      case 'deepseek':
        return {
          step1: t('profile.aiConfig.stepDeepSeek1', { defaultValue: "1. Click 'Get API Key' to visit DeepSeek Open Platform." }),
          step2: t('profile.aiConfig.stepDeepSeek2', { defaultValue: "2. Create a developer account and sign in." }),
          step3: t('profile.aiConfig.stepDeepSeek3', { defaultValue: "3. Generate a new API key, copy it, and paste it below." }),
          link: "https://platform.deepseek.com/api_keys"
        };
      case 'qwen':
        return {
          step1: t('profile.aiConfig.stepQwen1', { defaultValue: "1. Click 'Get API Key' to visit Alibaba DashScope Console." }),
          step2: t('profile.aiConfig.stepQwen2', { defaultValue: "2. Login and navigate to API Key Management." }),
          step3: t('profile.aiConfig.stepQwen3', { defaultValue: "3. Copy the key, paste it below, and click Save." }),
          link: "https://dashscope.console.aliyun.com/apiKey"
        };
      case 'google_ai':
      default:
        return {
          step1: t('profile.aiConfig.stepGemini1', { defaultValue: "1. Click 'Get API Key' to visit Google AI Studio." }),
          step2: t('profile.aiConfig.stepGemini2', { defaultValue: "2. Sign in with any Google account and click 'Create API Key'." }),
          step3: t('profile.aiConfig.stepGemini3', { defaultValue: "3. Copy the generated key, paste it below, and click Save." }),
          link: "https://aistudio.google.com/"
        };
    }
  };
  const steps = getStepInstructions();

  return (
    <AccordionItem
      value="ai-config"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
      id="ai-configuration-section"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(35_92%_95%)] text-[hsl(35_92%_52%)] dark:bg-[hsl(35_30%_18%)] dark:text-[hsl(35_92%_70%)] shrink-0 transition-transform duration-200">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.aiConfig.title', { defaultValue: 'AI Configuration' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('profile.aiConfig.subtitle', { defaultValue: 'Manage your AI service providers and customize API keys.' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('profile.aiConfig.providerLabel', { defaultValue: 'Active Provider' })}
            </Label>
            <Select
              value={activeProviderId}
              onValueChange={(val) => handleSaveConfig('custom_keys', null, val)}
              disabled={busy}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <SelectTrigger className="rounded-xl bg-card w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PROVIDERS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('profile.aiConfig.modelLabel', { defaultValue: 'Model Preference' })}
            </Label>
            <Select
              value={activeModel}
              onValueChange={(val) => handleSaveConfig('custom_keys', null, null, val)}
              disabled={busy}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <SelectTrigger className="rounded-xl bg-card w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {activeProvider.models.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3 shadow-sm text-start">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-2">
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
                <Button variant="outline" size="xs" className="rounded-lg text-[10px] h-6 bg-secondary/50">
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
                  <DialogDescription className="text-xs text-muted-foreground">
                    {t('profile.aiConfig.setupInstructions', { defaultValue: 'Setting up your custom API key is easy! Follow these steps:' })}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                  <div className="text-xs space-y-2 text-foreground/90 bg-secondary/25 p-3.5 rounded-xl border border-border/40">
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
          <p className="text-[11px] text-muted-foreground leading-normal">
            {t('profile.aiConfig.setupInstructions', { defaultValue: 'Configure your own developer key to run queries directly against your own account quota.' })}
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
