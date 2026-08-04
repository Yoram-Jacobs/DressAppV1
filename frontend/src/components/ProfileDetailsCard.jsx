import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Save, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  IdentitySection,
  ContactSection,
  DemographicsSection,
  PreferencesSection,
  MeasurementsSection,
  PhotosSection,
  StyleProfileSection,
  HairSection,
  ProfessionalSection,
  PayoutsSection,
  CampaignNotificationsSection,
  useProfileForm,
  useGoogleSync,
  useSaveProfile,
} from './profile/index.js';

export function ProfileDetailsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();

  const {
    form,
    setForm,
    busy,
    setBusy,
    isFreshStart,
    isDirty,
    isFreshStartInitial,
    setField,
    setNested,
    setCampaignPref,
    baselineRef,
  } = useProfileForm(user);

  const { syncingGoogle, syncGoogleProfile } = useGoogleSync(form, setForm, t);

  const { save, busy: saveBusy } = useSaveProfile(form, isDirty, baselineRef, t);

  const isFemale = form.sex === 'female';
  const wUnit = form.units.weight === 'lb' ? 'lb' : 'kg';
  const lUnit = form.units.length === 'in' ? 'in' : 'cm';

  const autofilledFromGoogle =
    !!user?.google_connected &&
    (!!user?.first_name || !!user?.last_name || !!user?.avatar_url);

  const googleConnected = !!user?.google_connected;

  return (
    <Card
      className="rounded-[calc(var(--radius)+6px)] shadow-editorial"
      data-testid="profile-details-card"
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="caps-label text-muted-foreground">
              {t('profile.sections.identity')}
            </div>
            <h3 className="font-display text-xl mt-0.5">{t('profile.title')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {user?.google_connected && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 rounded-full border-[hsl(var(--accent)/40)] hover:bg-[hsl(var(--accent)/5)]"
                onClick={syncGoogleProfile}
                disabled={syncingGoogle}
              >
                {syncingGoogle ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {t('profile.syncGoogle', { defaultValue: 'Sync Google Profile' })}
              </Button>
            )}
            {autofilledFromGoogle && (
              <Badge
                variant="outline"
                className="text-[11px] bg-card rounded-full"
                data-testid="profile-google-autofill-badge"
              >
                <Sparkles className="h-3 w-3 me-1 text-[hsl(var(--accent))]" />
                {t('profile.autofilledFromGoogle')}
              </Badge>
            )}
          </div>
        </div>

        <Accordion type="multiple" defaultValue={['identity']} className="w-full space-y-4">
          <IdentitySection form={form} setField={setField} t={t} user={user} />
          <ContactSection
            form={form}
            setField={setField}
            setNested={setNested}
            setForm={setForm}
            t={t}
            googleConnected={googleConnected}
            syncGoogleProfile={syncGoogleProfile}
            syncingGoogle={syncingGoogle}
          />
          <DemographicsSection
            form={form}
            setField={setField}
            t={t}
            googleConnected={googleConnected}
            syncGoogleProfile={syncGoogleProfile}
            syncingGoogle={syncingGoogle}
          />
          <PreferencesSection form={form} setNested={setNested} t={t} wUnit={wUnit} lUnit={lUnit} />
          <MeasurementsSection
            form={form}
            setNested={setNested}
            onChange={(k, v) => setNested('body_measurements', k, v)}
            t={t}
            wUnit={wUnit}
            lUnit={lUnit}
            isFemale={isFemale}
            isFreshStart={isFreshStart}
            hasFilledBasic={!!(form.body_measurements.height && form.body_measurements.weight && form.body_measurements.waist && form.body_measurements.foot_length)}
            predicting={false}
            hasPredicted={false}
          />
          <PhotosSection form={form} setField={setField} t={t} user={user} />
          <StyleProfileSection form={form} setField={setField} t={t} />
          <HairSection form={form} setNested={setNested} t={t} />
          <ProfessionalSection form={form} setField={setField} t={t} />
          <PayoutsSection form={form} setField={setField} t={t} />
          <CampaignNotificationsSection form={form} setCampaignPref={setCampaignPref} t={t} />
        </Accordion>

        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={busy || saveBusy || !isDirty}
            className="rounded-xl"
            data-testid="profile-details-save-btn"
          >
            {busy || saveBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 me-2" /> {t('profile.saveProfile')}
              </>
            )}
          </Button>
        </div>

        <div className="flex justify-center items-center gap-1 pt-2">
          <Button
            variant="link"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 px-2"
            onClick={() => nav('/privacy')}
            data-testid="profile-privacy-link"
          >
            {t('profile.privacyPolicy', { defaultValue: 'Privacy Policy' })}
          </Button>
          <span className="text-xs text-muted-foreground/40 select-none">·</span>
          <Button
            variant="link"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 px-2"
            onClick={() => nav('/terms')}
            data-testid="profile-terms-link"
          >
            {t('profile.termsOfService', { defaultValue: 'Terms of Service' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}