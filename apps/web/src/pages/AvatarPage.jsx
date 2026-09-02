import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save, Camera, Image as ImgIcon, Trash2, Sliders, CheckCircle2, UserCheck, Palette } from 'lucide-react';
import DynamicAvatar from '../components/DynamicAvatar';
import { SKIN_TONE_PALETTE } from '../components/SkinTonePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

async function fileToDataUrl(file, maxEdge = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AvatarPage() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Avatar display mode: 'mannequin' or 'photo'
  const [avatarMode, setAvatarMode] = useState('mannequin');
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
      const res = await api.getAvatarParams();

      if (res.measurements) {
        const m = res.measurements;
        setMeasurements({
          height: Number(m.height) || 168,
          shoulders: Number(m.shoulders) || 38,
          chest: Number(m.chest) || 88,
          waist: Number(m.waist) || 68,
          hip: Number(m.hips || m.hip) || 94,
          armLength: Number(m.arm_length || m.armLength) || 58,
          inseam: Number(m.inseam) || 76,
          gender: String(m.gender || res.gender || 'female').toLowerCase()
        });
      }

      if (res.skin_tone) {
        setSkinColor(res.skin_tone);
      }

      if (res.body_photo_url) {
        setBodyPhotoUrl(res.body_photo_url);
        setAvatarMode('photo');
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

  const handlePhotoSelected = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file, 1024);
      setBodyPhotoUrl(dataUrl);
      setAvatarMode('photo');
      toast.success(t('pages.avatarPage.photo_uploaded_success', { defaultValue: 'Full-body photo updated!' }));
    } catch (err) {
      console.error('Failed to process photo', err);
      toast.error(t('common.error', { defaultValue: 'Error uploading photo' }));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    setBodyPhotoUrl(null);
    setAvatarMode('mannequin');
    toast.info(t('pages.avatarPage.photo_removed', { defaultValue: 'Full-body photo removed' }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const payload = {
        sex: measurements.gender,
        skin_tone: skinColor,
        body_photo_url: bodyPhotoUrl,
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

      await api.patchMe(payload);

      toast.success(t('pages.avatarPage.avatar_saved_successfully', { defaultValue: 'Digital avatar profile saved successfully!' }));
    } catch (err) {
      console.error('Failed to save measurements', err);
      toast.error(t('pages.avatarPage.failed_to_save_measurements', { defaultValue: 'Failed to save measurements. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hidden File Inputs for Full-Body Photo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.avatarPage.my_digital_avatar', { defaultValue: 'My Digital Avatar' })}</h1>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 2D Parametric Double
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('pages.avatarPage.subtitle_description', { defaultValue: 'Calibrate your body measurements or upload a real full-body photo to drive virtual try-on physics.' })}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-3">
          {/* Avatar Mode Toggle (Mannequin vs Real Photo) */}
          {bodyPhotoUrl && (
            <div className="flex items-center p-1 bg-card rounded-xl border border-border shadow-sm gap-1">
              <button
                type="button"
                onClick={() => setAvatarMode('mannequin')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  avatarMode === 'mannequin'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('pages.avatarPage.vector_mannequin', { defaultValue: 'Mannequin' })}
              </button>
              <button
                type="button"
                onClick={() => setAvatarMode('photo')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  avatarMode === 'photo'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                {t('pages.avatarPage.real_photo', { defaultValue: 'Real Photo' })}
              </button>
            </div>
          )}

          {/* Save Profile Button */}
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
            <p className="text-slate-400 animate-pulse">{t('pages.avatarPage.generating_your_3d_digital_double', { defaultValue: 'Generating your digital double...' })}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Dynamic Avatar Preview Stage */}
          <Card className="lg:col-span-6 overflow-hidden border-border/60 shadow-lg bg-gradient-to-b from-card via-card/80 to-accent/10 relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <span>
                  {avatarMode === 'photo' && bodyPhotoUrl
                    ? t('pages.avatarPage.real_body_photo_title', { defaultValue: 'Real Body Figure' })
                    : t('pages.avatarPage.mannequin_preview', { defaultValue: 'Anatomical Mannequin' })}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {measurements.height}cm • {measurements.gender.toUpperCase()}
                </span>
              </CardTitle>
              <CardDescription>
                {avatarMode === 'photo' && bodyPhotoUrl
                  ? t('pages.avatarPage.real_photo_desc', { defaultValue: 'Your real full-body photo backdrop for styling.' })
                  : t('pages.avatarPage.mannequin_description', { defaultValue: 'Cubic Bezier curves calculated dynamically from body dimensions.' })}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 flex items-center justify-center min-h-[520px]">
              {avatarMode === 'photo' && bodyPhotoUrl ? (
                <div className="relative w-full h-[480px] max-w-[320px] rounded-2xl overflow-hidden border border-border shadow-inner bg-background flex items-center justify-center">
                  <img
                    src={bodyPhotoUrl}
                    alt={t('pages.avatarPage.full_body_photo', { defaultValue: 'Full body figure' })}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 end-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-lg shadow backdrop-blur-md bg-background/80"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImgIcon className="w-3.5 h-3.5 me-1" />
                      {t('profile.replacePhoto', { defaultValue: 'Replace' })}
                    </Button>
                  </div>
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* Right Column: Controls & Photo Uploader */}
          <Card className="lg:col-span-6 border-border/60 shadow-lg bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                {t('pages.avatarPage.body_measurements', { defaultValue: 'Body Profile & Controls' })}
              </CardTitle>
              <CardDescription>
                {t('pages.avatarPage.adjust_sliders_tip', { defaultValue: 'Upload a full-body photo or adjust measurements to morph your 2D avatar.' })}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* --- 1. Full-Body Photo Uploader Section --- */}
              <div className="rounded-2xl border border-border p-4 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    {t('pages.avatarPage.full_body_photo_label', { defaultValue: 'Full-Body Photo' })}
                  </span>
                  {bodyPhotoUrl && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
                    {bodyPhotoUrl ? (
                      <img src={bodyPhotoUrl} alt="Thumb" className="h-full w-full object-cover" />
                    ) : (
                      <ImgIcon className="h-6 w-6 text-muted-foreground/60" />
                    )}
                  </div>

                  <div className="flex-1 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs gap-1.5"
                      disabled={photoBusy}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {t('profile.takePhoto', { defaultValue: 'Take Photo' })}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs gap-1.5"
                      disabled={photoBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImgIcon className="w-3.5 h-3.5" />
                      {bodyPhotoUrl ? t('profile.replacePhoto', { defaultValue: 'Replace' }) : t('profile.uploadPhoto', { defaultValue: 'Upload Photo' })}
                    </Button>

                    {bodyPhotoUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                        disabled={photoBusy}
                        onClick={handleRemovePhoto}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('profile.removePhoto', { defaultValue: 'Remove' })}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* --- 2. Skin Tone Color Selection Swatches (Inside Controls Card) --- */}
              <div className="rounded-2xl border border-border p-4 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4 text-primary" />
                    {t('pages.avatarPage.skin_tone_color', { defaultValue: 'Skin Tone Color' })}
                  </span>
                </div>
                {/* Color Squares Swatch Grid */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {SKIN_TONE_PALETTE.map((item) => {
                    const isSelected = skinColor.toLowerCase() === item.color.toLowerCase();
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSkinColor(item.color)}
                        className={`w-8 h-8 rounded-lg border transition-all flex items-center justify-center ${
                          isSelected
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent scale-110 shadow-md'
                            : 'border-black/10 dark:border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: item.color }}
                        aria-label={`Skin tone ${item.id}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* --- 3. Gender Switch & Measurement Sliders --- */}
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

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Height */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{t('pages.avatarPage.height', { defaultValue: 'Height' })}</span>
                    <span className="text-primary font-mono">{measurements.height} cm</span>
                  </div>
                  <input
                    type="range"
                    min="130"
                    max="215"
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
                    min="28"
                    max="58"
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
                    max="138"
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
                    min="54"
                    max="128"
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
                    min="68"
                    max="148"
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
                    min="42"
                    max="85"
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
                    min="52"
                    max="100"
                    value={measurements.inseam}
                    onChange={(e) => handleMeasurementChange('inseam', Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>

              {/* Informational Note */}
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
