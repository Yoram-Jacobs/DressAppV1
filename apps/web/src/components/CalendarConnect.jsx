import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, AlertCircle, Loader2, Link as LinkIcon, Unlink } from 'lucide-react';
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
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
      data-testid="calendar-connect-card"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(217_91%_95%)] text-[hsl(217_91%_56%)] dark:bg-[hsl(217_30%_18%)] dark:text-[hsl(217_91%_70%)] shrink-0 transition-transform duration-200">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold block text-dark-brand">
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
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('calendar.description', { defaultValue: 'Sync daily outfit proposals directly to your Google Calendar' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="space-y-3">
          {status.connected && status.google_email ? (
            <div
              className="text-[12px] font-semibold text-text-brand text-start"
              data-testid="calendar-connected-email"
            >
              {t('calendar.signedInAs')} <span className="font-bold text-dark-brand">{status.google_email}</span>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-text-brand ">
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
                  className="!gap-1"
                  data-testid="calendar-disconnect-button"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="!h-3 !w-3" /> {t('calendar.disconnectAction')}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={connect}
                  data-testid="calendar-connect-button"
                  className="!gap-1"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LinkIcon className="!h-3 !w-3" /> {t('calendar.connectAction')}
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
