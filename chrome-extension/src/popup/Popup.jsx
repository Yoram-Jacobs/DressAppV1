/**
 * DressApp extension popup.
 *
 * Three states:
 *   1. Loading      — first paint, querying chrome.storage.local for
 *                      a saved token.
 *   2. Disconnected — show a primary "Connect to DressApp" button
 *                      that opens the auth-bridge tab.
 *   3. Connected    — show the user's name/email + a measurements
 *                      summary fetched from /api/v1/users/me, plus
 *                      a "Sign out" link that wipes chrome.storage.
 *
 * The popup intentionally never stores raw measurements; it asks the
 * service worker each time so the source of truth stays the backend.
 * The 5-second cache in the SW is enough to keep the popup snappy on
 * repeated opens.
 */
import { useEffect, useState } from 'react';
import { LogIn, LogOut, Loader2, ShieldCheck, AlertCircle, Ruler, Sparkles, ExternalLink, Repeat } from 'lucide-react';
import { messages, sendToBackground } from '@/lib/messages.js';
import { authBaseUrl } from '@/lib/api.js';
import { useTranslation } from 'react-i18next';
import { isRtl } from '@/lib/i18n.js';

export default function Popup() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({
    phase: 'loading', // loading | disconnected | connected | error
    user: null,
    measurementsSummary: null,
    error: null,
    backend: null, // origin we're talking to — purely informational
  });
  const [widgetEnabled, setWidgetEnabled] = useState(true);

  // Dynamically update layout direction based on language
  useEffect(() => {
    document.documentElement.dir = isRtl(i18n.language) ? 'rtl' : 'ltr';
  }, [i18n.language]);

  // Load initial widget state
  useEffect(() => {
    async function loadWidgetState() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const res = await chrome.storage.local.get(['widget_enabled']);
          setWidgetEnabled(res.widget_enabled !== false);
        } else {
          const res = localStorage.getItem('dressapp_widget_enabled');
          setWidgetEnabled(res !== 'false');
        }
      } catch (_) {}
    }
    void loadWidgetState();
  }, []);

  async function toggleWidget() {
    const nextState = !widgetEnabled;
    setWidgetEnabled(nextState);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ widget_enabled: nextState });
      } else {
        localStorage.setItem('dressapp_widget_enabled', String(nextState));
        // Dispatch global postMessage for mobile WebView context
        window.postMessage({ type: 'DRESSAPP_WIDGET_TOGGLE', enabled: nextState }, '*');
      }
    } catch (_) {}
  }

  async function refresh() {
    setState((s) => ({ ...s, phase: 'loading', error: null }));
    const r = await sendToBackground({ type: messages.AUTH_STATUS });
    if (!r || !r.ok) {
      setState({ phase: 'error', user: null, measurementsSummary: null, error: r?.error || 'Unknown error', backend: null });
      return;
    }
    if (!r.token) {
      setState({ phase: 'disconnected', user: null, measurementsSummary: null, error: null, backend: null });
      return;
    }
    const me = await sendToBackground({ type: messages.FETCH_ME });
    if (!me || !me.ok) {
      const err = String(me?.error || '');
      const looksAuthError = /401|session expired|reconnect|no token/i.test(err);
      if (looksAuthError) {
        await sendToBackground({ type: messages.CLEAR_AUTH });
        setState({
          phase: 'disconnected',
          user: null,
          measurementsSummary: null,
          error: t('staleSession', { defaultValue: 'Your previous session is no longer valid. Reconnect to continue.' }),
          backend: null,
        });
        return;
      }
      setState({
        phase: 'connected',
        user: r.user || null,
        measurementsSummary: null,
        error: err || null,
        backend: r.backend || null,
      });
      return;
    }
    setState({
      phase: 'connected',
      user: me.user,
      measurementsSummary: summarize(me.user?.body_measurements || {}),
      error: null,
      backend: r.backend || null,
    });
  }

  useEffect(() => { refresh(); }, []);

  async function connect() {
    const url = `${authBaseUrl()}/extension/connect?ext_id=${encodeURIComponent(chrome.runtime.id)}&v=1`;
    chrome.tabs.create({ url });
  }

  async function switchAccount() {
    await sendToBackground({ type: messages.CLEAR_AUTH });
    const url = `${authBaseUrl()}/extension/connect?force=1&ext_id=${encodeURIComponent(chrome.runtime.id)}&v=1`;
    chrome.tabs.create({ url });
  }

  async function disconnect() {
    await sendToBackground({ type: messages.CLEAR_AUTH });
    refresh();
  }

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="dressapp-popup">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{t('title', { defaultValue: 'DressApp' })}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('subtitle', { defaultValue: 'Shopping assistant' })}</div>
          </div>
        </div>
        <a
          href={authBaseUrl()}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          data-testid="open-dressapp"
        >
          dressapp.co <ExternalLink className="h-3 w-3" />
        </a>
      </header>

      {/* Toggle switch for enabling/disabling the overlay widget */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2 text-xs">
        <span className="font-medium text-muted-foreground">{t('enableAssistant', { defaultValue: 'Shopping Assistant' })}</span>
        <button
          onClick={toggleWidget}
          className={`relative inline-flex h-5.5 w-10 items-center rounded-full px-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${widgetEnabled ? 'bg-emerald-500' : 'bg-slate-300'} ${widgetEnabled ? 'justify-end' : 'justify-start'}`}
          role="switch"
          aria-checked={widgetEnabled}
          data-testid="widget-toggle"
        >
          <span className="inline-block h-4 w-4 rounded-full bg-background shadow" />
        </button>
      </div>

      {state.phase === 'loading' ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : state.phase === 'disconnected' ? (
        <DisconnectedView onConnect={connect} message={state.error} />
      ) : state.phase === 'error' ? (
        <ErrorView error={state.error} onRetry={refresh} />
      ) : (
        <ConnectedView
          user={state.user}
          measurementsSummary={state.measurementsSummary}
          backend={state.backend}
          onDisconnect={disconnect}
          onSwitchAccount={switchAccount}
        />
      )}

      <footer className="mt-2 border-t pt-2 text-center text-[10px] text-muted-foreground">
        {t('footerDisclaimer', { defaultValue: "Recommendations are estimates. Always confirm with the store's chart." })}
      </footer>
    </div>
  );
}

function DisconnectedView({ onConnect, message }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-stretch gap-3">
      {message ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-800"
          data-testid="popup-stale-session"
          role="status"
        >
          {message}
        </div>
      ) : null}
      <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-2 text-xs text-foreground">{t('connectPrompt', { defaultValue: 'Connect to your DressApp account to get personalised size recommendations on every shopping site.' })}</p>
      </div>
      <button
        onClick={onConnect}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
        data-testid="connect-button"
      >
        <LogIn className="h-4 w-4" /> {t('connect', { defaultValue: 'Connect to DressApp' })}
      </button>
    </div>
  );
}

function ConnectedView({ user, measurementsSummary, backend, onDisconnect, onSwitchAccount }) {
  const { t } = useTranslation();
  const backendHost = (() => {
    if (!backend) return null;
    try { return new URL(backend).host; } catch { return backend; }
  })();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(user?.full_name || user?.email || '?').slice(0,1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" data-testid="popup-user-name">{user?.full_name || user?.email || 'Connected'}</div>
          {user?.email && user?.full_name ? <div className="truncate text-[11px] text-muted-foreground" data-testid="popup-user-email">{user.email}</div> : null}
          {backendHost ? (
            <div className="truncate text-[10px] text-muted-foreground" data-testid="popup-backend-host">via {backendHost}</div>
          ) : null}
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700" data-testid="connected-badge">
          {t('loggedIn', { defaultValue: 'Logged in' })}
        </span>
      </div>

      <MeasurementsCard summary={measurementsSummary} />

      <div className="flex items-center gap-2">
        <button
          onClick={onSwitchAccount}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-muted/50"
          data-testid="switch-account-button"
          title={t('switchAccount', { defaultValue: 'Switch account' })}
        >
          <Repeat className="h-3.5 w-3.5" /> {t('switchAccount', { defaultValue: 'Switch account' })}
        </button>
        <button
          onClick={onDisconnect}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          data-testid="disconnect-button"
        >
          <LogOut className="h-3.5 w-3.5" /> {t('signOut', { defaultValue: 'Sign out' })}
        </button>
      </div>
    </div>
  );
}

function MeasurementsCard({ summary }) {
  const { t } = useTranslation();
  if (!summary || summary.count === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs" data-testid="no-measurements-card">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-800">
          <AlertCircle className="h-3.5 w-3.5" /> {t('noMeasurementsTitle', { defaultValue: 'No measurements yet' })}
        </div>
        <div className="text-amber-700">
          {t('noMeasurementsPrompt', { defaultValue: 'Add your chest, waist, and hip measurements in your DressApp profile to enable size recommendations.' })}
        </div>
        <a
          href={`${authBaseUrl()}/me`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-900 underline"
        >
          {t('openProfile', { defaultValue: 'Open profile' })} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-3 text-xs" data-testid="measurements-card">
      <div className="mb-2 flex items-center gap-1.5 font-medium">
        <Ruler className="h-3.5 w-3.5 text-primary" /> {t('measurementsTitle', { count: summary.count, defaultValue: 'Measurements ({{count}})' })}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {summary.entries.slice(0, 6).map(([k, v]) => (
          <li key={k} className="flex justify-between">
            <span className="capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</span>
            <span className="font-medium">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorView({ error, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-red-700">
      <div className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-4 w-4" /> {t('errorTitle', { defaultValue: "Couldn't load extension state" })}</div>
      <div>{error}</div>
      <button onClick={onRetry} className="self-start rounded border bg-background px-2 py-1 font-medium">{t('retry', { defaultValue: 'Retry' })}</button>
    </div>
  );
}

function summarize(m) {
  const entries = Object.entries(m || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  return { count: entries.length, entries };
}
