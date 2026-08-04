import { Camera } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { PhotoSlot } from './primitives.jsx';
import AvatarViewer from '../AvatarViewer.jsx';
import SkinTonePicker from '../SkinTonePicker.jsx';

export function PhotosSection({ form, setField, t, user }) {
  return (
    <AccordionItem value="photos" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-photos"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(320_80%_94%)] text-[hsl(320_80%_56%)] dark:bg-[hsl(320_30%_18%)] dark:text-[hsl(320_80%_70%)] shrink-0 transition-transform duration-200">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.photosAvatar', { defaultValue: 'Photos & Avatar' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.photosAvatarDesc', { defaultValue: 'Avatar model visual reference photos and body-render shape' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 flex flex-col gap-3">
            <PhotoSlot
              label={t('profile.facePhoto', { defaultValue: 'Face Photo' })}
              value={form.face_photo_url}
              onChange={(v) => setField('face_photo_url', v)}
              testid="face"
            />
            <PhotoSlot
              label={t('profile.bodyPhoto', { defaultValue: 'Full-body Photo' })}
              value={form.body_photo_url}
              onChange={(v) => setField('body_photo_url', v)}
              testid="body"
            />
          </div>

          <div className="md:col-span-7 rounded-2xl border border-border p-4 bg-card flex flex-col shadow-inner min-h-[300px]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="caps-label text-muted-foreground">
                {t('profile.sections.digitalAvatar', { defaultValue: 'Digital Avatar' })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {t('profile.skinTone', { defaultValue: 'Skin Tone' })}
                </span>
                <SkinTonePicker
                  value={form.skin_tone || '#9CA3AF'}
                  onChange={(v) => setField('skin_tone', v)}
                />
              </div>
            </div>

            <div className="flex-1 w-full rounded-xl overflow-hidden bg-background border border-border min-h-[260px] relative">
              <AvatarViewer
                shapeParams={user?.avatar_shape_params || {}}
                measurements={form.body_measurements}
                sex={form.sex || 'female'}
                bodyPhotoUrl={form.body_photo_url}
                skinColor={form.skin_tone || '#9CA3AF'}
              />
            </div>

            <div className="text-xs text-muted-foreground mt-2">
              {t('profile.sections.avatarGenerationDesc', { defaultValue: 'Adapts automatically to your body measurements.' })}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}