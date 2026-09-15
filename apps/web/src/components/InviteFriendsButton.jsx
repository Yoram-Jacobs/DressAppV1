import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Copy, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export const GOOGLE_PLAY_BASE_URL = 'https://play.google.com/store/apps/details?id=com.project.dressapp';

export function getGooglePlayAffiliateUrl(userId) {
  if (!userId) return GOOGLE_PLAY_BASE_URL;
  return `${GOOGLE_PLAY_BASE_URL}&referrer=${encodeURIComponent(`ref=${userId}`)}`;
}

/**
 * Invite-friends action — web-today, mobile-ready-tomorrow.
 *
 * The browser's `navigator.share` gives us the exact same sheet a native
 * app gets on iOS/Android (iMessage, WhatsApp, Mail, AirDrop…). When the
 * browser is desktop-Chromium without a share target, we fall back to
 * clipboard copy — still one tap away from any messaging app. When the
 * app is packaged with Capacitor later, `navigator.share` transparently
 * delegates to the native share sheet with zero code changes here.
 */
export function InviteFriendsButton() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const inviteUrl = user?.id ? `${window.location.origin}/?ref=${user.id}` : `${window.location.origin}/?ref=invite`;
  const playStoreUrl = getGooglePlayAffiliateUrl(user?.id);

  const share = async () => {
    setBusy(true);
    const bodyText = t('profile.inviteBody');
    const shareMessage = `${bodyText} ${inviteUrl}\n\nGet DressApp on Google Play: ${playStoreUrl}`;
    const payload = {
      title: t('profile.inviteSubject'),
      text: shareMessage,
      url: inviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(shareMessage);
        toast.success(t('profile.inviteCopied'));
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // AbortError just means the user closed the share sheet.
        try {
          await navigator.clipboard.writeText(shareMessage);
          toast.success(t('profile.inviteCopied'));
        } catch {
          toast.error(t('common.error'));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccordionItem
      value="invite"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
      data-testid="invite-friends-card"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(271_81%_95%)] text-[hsl(271_81%_56%)] dark:bg-[hsl(271_30%_18%)] dark:text-[hsl(271_81%_70%)] shrink-0 transition-transform duration-200">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.inviteFriends', { defaultValue: 'Invite Friends' })}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.inviteDesc', { defaultValue: 'Share DressApp with your friends and family' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-text-brand">
              {t('profile.inviteBody')}
            </p>
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-[12px] font-bold text-primary-brand hover:underline"
            >
              Get DressApp on Google Play
            </a>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <Button
              onClick={share}
              disabled={busy}
              className=""
              data-testid="invite-friends-btn"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {navigator.share ? (
                    <Share2 className="!h-3 !w-3" />
                  ) : (
                    <Copy className="!h-3 !w-3" />
                  )}
                  {t('profile.inviteFriends')}
                </>
              )}
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
