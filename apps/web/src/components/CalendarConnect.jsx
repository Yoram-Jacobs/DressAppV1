import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, CircleAlert as AlertCircle, Loader2, Link as LinkIcon, Unlink } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/**
 * Self-contained card that lets the user connect/disconnect Google Calendar.
 *
 * Also handles the post-OAuth redirect: when the URL carries
 * `?calendar=connected` or `?calendar=error` we show a toast and strip the
 * query param.
 */
export const CalendarConnect = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ connected: false, google_email: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const s = await api.calendarStatus();
      setStatus(s || { connected: false });
    } catch {
      // non-fatal — leave status as disconnected
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(location.search);
    const cal = params.get('calendar');
    if (cal === 'connected') {
      toast.success(t('calendar.connected'));
      params.delete('calendar');
      nav({ pathname: location.pathname, search: params.toString() }, { replace: true });
    } else if (cal === 'error') {
      const reason = params.get('reason') || 'unknown_error';
      toast.error(`${t('calendar.connectFailed')}: ${reason.replaceAll('_', ' ')}`);
      params.delete('calendar');
      params.delete('reason');
      nav({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const { authorization_url } = await api.googleOAuthStart();
      if (!authorization_url) throw new Error('missing url');
      window.location.href = authorization_url;
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('calendar.connectFailedGeneric'));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.googleOAuthDisconnect();
      setStatus({ connected: false, google_email: null });
      toast.success(t('calendar.disconnected'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('calendar.disconnectFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccordionItem
      value="calendar"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
      data-testid="calendar-connect-card"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(217_91%_95%)] text-[hsl(217_91%_56%)] dark:bg-[hsl(217_30%_18%)] dark:text-[hsl(217_91%_70%)] shrink-0 transition-transform duration-200">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                {t('calendar.title', { defaultValue: 'Google Calendar' })}
              </span>
              {loading ? null : status.connected ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] rounded-full py-0.5 px-2 font-semibold"
                  data-testid="calendar-connected-badge"
                >
                  <CheckCircle2 className="h-3 w-3 me-1 inline" /> {t('calendar.connectedBadge')}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] rounded-full py-0.5 px-2 font-semibold"
                  data-testid="calendar-disconnected-badge"
                >
                  {t('calendar.notConnected')}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('calendar.description', { defaultValue: 'Sync daily outfit proposals directly to your Google Calendar' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="space-y-3">
          {status.connected && status.google_email ? (
            <div
              className="text-xs text-muted-foreground text-start"
              data-testid="calendar-connected-email"
            >
              {t('calendar.signedInAs')} <span className="font-medium text-foreground">{status.google_email}</span>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground max-w-md text-start">
              {t('calendar.offlineHint', { defaultValue: 'Connect your Google account to automatically export styled outfits as calendar events.' })}
            </p>
            <div className="shrink-0 w-full sm:w-auto">
              {loading ? (
                <Button variant="secondary" disabled className="rounded-xl w-full sm:w-auto">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              ) : status.connected ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={disconnect}
                  className="rounded-xl w-full sm:w-auto bg-card"
                  data-testid="calendar-disconnect-button"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 me-2" /> {t('calendar.disconnectAction')}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={connect}
                  className="rounded-xl w-full sm:w-auto"
                  data-testid="calendar-connect-button"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4 me-2" /> {t('calendar.connectAction')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
