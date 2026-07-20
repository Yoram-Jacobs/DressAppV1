import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save, User, Sliders, CheckCircle2 } from 'lucide-react';
import DynamicAvatar from '../components/DynamicAvatar';
import SkinTonePicker from '../components/SkinTonePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AvatarPage() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Body measurements state (cm)
  const [measurements, setMeasurements] = useState({
    height: 168,
    shoulders: 38,
    chest: 88,
    waist: 68,
    hip: 94,
    armLength: 58,
    inseam: 76,
    gender: 'female'
  });

  // Selected skin color state
  const [skinColor, setSkinColor] = useState('#9CA3AF');

  useEffect(() => {
    fetchParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchParams = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/v1/avatar/params', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data?.measurements) {
        const m = res.data.measurements;
        setMeasurements({
          height: Number(m.height) || 168,
          shoulders: Number(m.shoulders) || 38,
          chest: Number(m.chest) || 88,
          waist: Number(m.waist) || 68,
          hip: Number(m.hips || m.hip) || 94,
          armLength: Number(m.arm_length || m.armLength) || 58,
          inseam: Number(m.inseam) || 76,
          gender: String(m.gender || res.data.gender || 'female').toLowerCase()
        });
      }

      if (res.data?.skin_tone) {
        setSkinColor(res.data.skin_tone);
      }
    } catch (err) {
      console.error('Failed to fetch avatar parameters', err);
      toast.error(t('pages.avatarPage.failed_to_load_avatar_parameters', { defaultValue: 'Failed to load avatar parameters. Ensure your profile measurements are set.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleMeasurementChange = (key, value) => {
    setMeasurements(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const payload = {
        sex: measurements.gender,
        skin_tone: skinColor,
        body_measurements: {
          height: Number(measurements.height),
          shoulders: Number(measurements.shoulders),
          chest: Number(measurements.chest),
          waist: Number(measurements.waist),
          hips: Number(measurements.hip),
          arm_length: Number(measurements.armLength),
          inseam: Number(measurements.inseam),
          gender: measurements.gender
        }
      };

      await axios.patch('/api/v1/users/me', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      toast.success(t('pages.avatarPage.avatar_saved_successfully', { defaultValue: 'Digital avatar measurements saved successfully!' }));
    } catch (err) {
      console.error('Failed to save measurements', err);
      toast.error(t('pages.avatarPage.failed_to_save_measurements', { defaultValue: 'Failed to save measurements. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.avatarPage.my_digital_avatar', { defaultValue: 'My Digital Avatar' })}</h1>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 2D Dynamic Mannequin
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('pages.avatarPage.subtitle_description', { defaultValue: 'Parametric 2D avatar scaled directly from your body measurements. Move sliders to customize your digital styling double.' })}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-3">
          {/* Skin Tone Color Dropdown (Color Squares Only) */}
          <div className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border border-border shadow-sm">
            <span className="text-xs font-medium text-muted-foreground ps-2">
              {t('pages.avatarPage.skin_tone', { defaultValue: 'Color:' })}
            </span>
            <SkinTonePicker value={skinColor} onChange={setSkinColor} />
          </div>

          {/* Save Button */}
          <Button onClick={handleSaveProfile} disabled={saving} className="rounded-xl shadow-md gap-2">
            {saving ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('pages.avatarPage.save_measurements', { defaultValue: 'Save Profile' })}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="w-full h-[550px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 animate-pulse">{t('pages.avatarPage.generating_your_3d_digital_double', { defaultValue: 'Generating your 2D digital double...' })}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Dynamic 2D Avatar Preview Stage */}
          <Card className="lg:col-span-6 overflow-hidden border-border/60 shadow-lg bg-gradient-to-b from-card via-card/80 to-accent/10 relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <span>{t('pages.avatarPage.mannequin_preview', { defaultValue: 'Anatomical Mannequin' })}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {measurements.height}cm • {measurements.gender.toUpperCase()}
                </span>
              </CardTitle>
              <CardDescription>
                {t('pages.avatarPage.mannequin_description', { defaultValue: 'Cubic Bezier curves calculated dynamically from body dimensions.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex items-center justify-center min-h-[520px]">
              <div className="w-full h-[480px] max-w-[280px]">
                <DynamicAvatar
                  height={measurements.height}
                  shoulders={measurements.shoulders}
                  chest={measurements.chest}
                  waist={measurements.waist}
                  hip={measurements.hip}
                  armLength={measurements.armLength}
                  inseam={measurements.inseam}
                  gender={measurements.gender}
                  skinColor={skinColor}
                  showGuideLines={true}
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Live Measurement Controls */}
          <Card className="lg:col-span-6 border-border/60 shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                {t('pages.avatarPage.body_measurements', { defaultValue: 'Body Measurements (cm)' })}
              </CardTitle>
              <CardDescription>
                {t('pages.avatarPage.adjust_sliders_tip', { defaultValue: 'Adjust any dimension to instantly observe the mannequin morph.' })}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Gender Selector Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <span className="text-sm font-medium">{t('pages.avatarPage.gender_baseline', { defaultValue: 'Gender Model' })}</span>
                <div className="flex items-center p-1 bg-card rounded-lg border border-border gap-1">
                  <button
                    type="button"
                    onClick={() => handleMeasurementChange('gender', 'female')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      measurements.gender === 'female' 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('pages.avatarPage.female', { defaultValue: 'Female' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMeasurementChange('gender', 'male')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      measurements.gender === 'male' 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('pages.avatarPage.male', { defaultValue: 'Male' })}
                  </button>
                </div>
              </div>

              {/* Measurement Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Height */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.height', { defaultValue: 'Height' })}</span>
                    <span className="text-primary font-mono">{measurements.height} cm</span>
                  </div>
                  <input
                    type="range"
                    min="140"
                    max="210"
                    value={measurements.height}
                    onChange={(e) => handleMeasurementChange('height', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Shoulders */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.shoulders', { defaultValue: 'Shoulder Width' })}</span>
                    <span className="text-primary font-mono">{measurements.shoulders} cm</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="55"
                    value={measurements.shoulders}
                    onChange={(e) => handleMeasurementChange('shoulders', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Chest */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.chest', { defaultValue: 'Chest Circumference' })}</span>
                    <span className="text-primary font-mono">{measurements.chest} cm</span>
                  </div>
                  <input
                    type="range"
                    min="65"
                    max="135"
                    value={measurements.chest}
                    onChange={(e) => handleMeasurementChange('chest', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Waist */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.waist', { defaultValue: 'Waist Circumference' })}</span>
                    <span className="text-primary font-mono">{measurements.waist} cm</span>
                  </div>
                  <input
                    type="range"
                    min="55"
                    max="125"
                    value={measurements.waist}
                    onChange={(e) => handleMeasurementChange('waist', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Hip */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.hip', { defaultValue: 'Hip Circumference' })}</span>
                    <span className="text-primary font-mono">{measurements.hip} cm</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="145"
                    value={measurements.hip}
                    onChange={(e) => handleMeasurementChange('hip', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Arm Length */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.arm_length', { defaultValue: 'Arm Length' })}</span>
                    <span className="text-primary font-mono">{measurements.armLength} cm</span>
                  </div>
                  <input
                    type="range"
                    min="45"
                    max="80"
                    value={measurements.armLength}
                    onChange={(e) => handleMeasurementChange('armLength', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Inseam */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.inseam', { defaultValue: 'Inseam (Leg Length)' })}</span>
                    <span className="text-primary font-mono">{measurements.inseam} cm</span>
                  </div>
                  <input
                    type="range"
                    min="55"
                    max="98"
                    value={measurements.inseam}
                    onChange={(e) => handleMeasurementChange('inseam', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>

              {/* Informational Footer Note */}
              <div className="bg-primary/5 text-primary p-3.5 rounded-xl text-xs border border-primary/10 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {t('pages.avatarPage.info_note', { defaultValue: 'Body measurements directly calibrate virtual garment try-on physics and size recommendations across the app.' })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
