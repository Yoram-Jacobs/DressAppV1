import { Camera } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { PhotoSlot } from './primitives.jsx';
import AvatarViewer from '../AvatarViewer.jsx';
import SkinTonePicker from '../SkinTonePicker.jsx';

export function PhotosSection({ form, setField, t, user }) {
  return (
    <AccordionItem value="photos" className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(320_80%_94%)] text-[hsl(320_80%_56%)] dark:bg-[hsl(320_30%_18%)] dark:text-[hsl(320_80%_70%)] shrink-0 transition-transform duration-200">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.sections.photosAvatar', { defaultValue: 'Photos & Avatar' })}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.sections.photosAvatarDesc', { defaultValue: 'Avatar model visual reference photos and body-render shape' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
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
          <div className="md:col-span-7 rounded-[12px] border border-border p-3 bg-white flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[12px] font-semibold text-text-brand">
                {t('profile.sections.digitalAvatar', { defaultValue: 'Digital Avatar' })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-text-brand">
                  {t('profile.skinTone', { defaultValue: 'Skin Tone' })}
                </span>
                <SkinTonePicker
                  value={form.skin_tone || '#9CA3AF'}
                  onChange={(v) => setField('skin_tone', v)}
                />
              </div>
            </div>

            <div className="flex-1 w-full rounded-[12px] overflow-hidden bg-accent-beige border border-border h-[300px] relative">
              <AvatarViewer
                shapeParams={user?.avatar_shape_params || {}}
                measurements={form.body_measurements}
                sex={form.sex || 'female'}
                bodyPhotoUrl={form.body_photo_url}
                skinColor={form.skin_tone || '#9CA3AF'}
              />
            </div>

            <div className="text-[12px] font-semibold text-text-brand mt-2 italic">
              {t('profile.sections.avatarGenerationDesc', { defaultValue: 'Adapts automatically to your body measurements.' })}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}