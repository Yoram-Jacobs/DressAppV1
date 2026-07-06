import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Copy, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { toast } from 'sonner';

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
  const [busy, setBusy] = useState(false);

  const inviteUrl = `${window.location.origin}/?ref=invite`;

  const share = async () => {
    setBusy(true);
    const payload = {
      title: t('profile.inviteSubject'),
      text: t('profile.inviteBody'),
      url: inviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
        toast.success(t('profile.inviteCopied'));
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // AbortError just means the user closed the share sheet.
        try {
          await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
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
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
      data-testid="invite-friends-card"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(271_81%_95%)] text-[hsl(271_81%_56%)] dark:bg-[hsl(271_30%_18%)] dark:text-[hsl(271_81%_70%)] shrink-0 transition-transform duration-200">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.inviteFriends', { defaultValue: 'Invite Friends' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('profile.inviteDesc', { defaultValue: 'Share DressApp with your friends and family' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground max-w-md text-start">
            {t('profile.inviteBody')}
          </p>
          <div className="shrink-0 w-full sm:w-auto">
            <Button
              onClick={share}
              disabled={busy}
              className="rounded-xl w-full sm:w-auto"
              data-testid="invite-friends-btn"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {navigator.share ? (
                    <Share2 className="h-4 w-4 me-2" />
                  ) : (
                    <Copy className="h-4 w-4 me-2" />
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
