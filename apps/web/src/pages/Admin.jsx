import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCcw, Users as UsersIcon, ShoppingBag, Receipt, Activity, Sparkles,
  Settings, KeyRound, AlertTriangle, CheckCircle2, ShieldCheck, ShieldOff,
  Play, Search, ArrowUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, campaignApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLocalStorageSync } from '@/lib/useLocalStorageSync';
import { useAdminStore, adminStore } from '@/lib/adminStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const fmtCents = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(
    (cents || 0) / 100
  );

const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n || 0);

const PROVIDER_TONE = {
  ok: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  warn: 'bg-amber-100 text-amber-900 border-amber-200',
  bad: 'bg-rose-100 text-rose-900 border-rose-200',
  idle: 'bg-slate-100 text-slate-800 border-slate-200',
};

const tone = (errorRate) => {
  if (errorRate === undefined || errorRate === null) return 'idle';
  if (errorRate === 0) return 'ok';
  if (errorRate < 0.2) return 'warn';
  return 'bad';
};

export default function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorageSync('dressapp.admin.activeTab', 'overview');
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdmin = (user?.roles || []).includes('admin');
  if (user && !isAdmin) return <Navigate to="/home" replace />;

  return (
    <div className="container-px max-w-7xl mx-auto pt-6 md:pt-10 pb-20" data-testid="admin-page">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="caps-label text-muted-foreground">{t('admin.title')}</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{t('admin.title')}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {t('admin.subtitle')}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl" data-testid="admin-back-home">
          <Link to="/home">{t('common.back')}</Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="rounded-xl flex-wrap h-auto p-1" data-testid="admin-tabs">
          <TabsTrigger value="overview" data-testid="admin-tab-overview">{t('admin.overview')}</TabsTrigger>
          <TabsTrigger value="providers" data-testid="admin-tab-providers">{t('admin.providers')}</TabsTrigger>
          <TabsTrigger value="trends" data-testid="admin-tab-trends">{t('admin.trendScout')}</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users">{t('admin.users')}</TabsTrigger>
          <TabsTrigger value="listings" data-testid="admin-tab-listings">{t('admin.listings')}</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="admin-tab-transactions">{t('admin.transactions')}</TabsTrigger>
          <TabsTrigger value="system" data-testid="admin-tab-system">{t('admin.system')}</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="admin-tab-campaigns">{t('campaigns.admin.queueTitle', { defaultValue: 'Campaign Queue' })}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewSection /></TabsContent>
        <TabsContent value="providers" className="mt-6"><ProvidersSection /></TabsContent>
        <TabsContent value="trends" className="mt-6"><TrendScoutSection /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersSection /></TabsContent>
        <TabsContent value="listings" className="mt-6"><ListingsSection /></TabsContent>
        <TabsContent value="transactions" className="mt-6"><TransactionsSection /></TabsContent>
        <TabsContent value="system" className="mt-6"><SystemSection /></TabsContent>
        <TabsContent value="campaigns" className="mt-6"><CampaignQueueTab /></TabsContent>
      </Tabs>

      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full h-12 w-12 p-0 shadow-editorial bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all duration-200"
          data-testid="admin-scroll-top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

// -------------------- Overview --------------------
function OverviewSection() {
  const { t } = useTranslation();
  const { overview: data, loadingOverview: loading } = useAdminStore();
  
  const refresh = async (force = false) => {
    try {
      await adminStore.loadOverview({ force });
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pages.admin.failed_to_load_overview', { defaultValue: 'Failed to load overview' }));
    }
  };

  useEffect(() => {
    refresh(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-overview-loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[calc(var(--radius)+6px)]" />
        ))}
      </div>
    );
  }

  const r = data.revenue_cents || {};
  const cards = [
    { label: t('admin.users', { defaultValue: 'Users' }), value: fmtNum(data.users.total), sub: t('pages.admin.new_users_24h', { defaultValue: '+{{count}} new in 24h', count: data.users.new_24h }), icon: UsersIcon, testid: 'admin-stat-users' },
    { label: t('pages.admin.closet_items'), value: fmtNum(data.closet_items.total), sub: t('pages.admin.across_all_users', { defaultValue: 'across all users' }), icon: Sparkles, testid: 'admin-stat-closet' },
    { label: t('admin.activeListings', { defaultValue: 'Active listings' }), value: fmtNum(data.listings.active), sub: t('pages.admin.total_count', { count: data.listings.total, defaultValue: '{{count}} total' }), icon: ShoppingBag, testid: 'admin-stat-listings' },
    { label: t('nav.transactions', { defaultValue: 'Transactions' }), value: fmtNum(data.transactions.total), sub: t('pages.admin.paid_count', { count: data.transactions.paid, defaultValue: '{{count}} paid' }), icon: Receipt, testid: 'admin-stat-transactions' },
    { label: t('pages.admin.gross_volume'), value: fmtCents(r.gross), sub: t('pages.admin.lifetime_paid_only', { defaultValue: 'lifetime, paid only' }), icon: Receipt, testid: 'admin-stat-gross' },
    { label: t('pages.admin.platform_fees'), value: fmtCents(r.platform_fee), sub: t('pages.admin.platform_fee_percent_sub', { defaultValue: '7% revenue' }), icon: Receipt, testid: 'admin-stat-platform-fee' },
    { label: t('pages.admin.stylist_24h'), value: fmtNum(data.stylist.messages_24h), sub: t('pages.admin.messages_this_week', { count: data.stylist.messages_7d, defaultValue: '{{count}} this week' }), icon: Activity, testid: 'admin-stat-stylist' },
    { label: t('pages.admin.trend_cards_live'), value: fmtNum(data.trend_scout.count), sub: t('pages.admin.todays_edition', { defaultValue: 'today’s edition' }), icon: Sparkles, testid: 'admin-stat-trend' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={refresh} className="rounded-xl" data-testid="admin-overview-refresh">
          <RefreshCcw className="h-4 w-4 me-2" /> {t('stylist.refreshScout', { defaultValue: 'Refresh' })}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-overview-grid">
        {cards.map((c) => (
          <Card key={c.label} className="rounded-[calc(var(--radius)+6px)] shadow-editorial" data-testid={c.testid}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="caps-label text-muted-foreground">{c.label}</div>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="font-display text-3xl mt-2">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ProvidersInline summary={data.providers || []} />
    </div>
  );
}

function ProvidersInline({ summary }) {
  const { t } = useTranslation();
  if (!summary?.length) {
    return (
      <Card className="rounded-[calc(var(--radius)+6px)]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t('pages.admin.no_provider_activity_yet_trigger')}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
      <CardContent className="p-5">
        <h3 className="font-display text-xl mb-3">Provider activity (last 200 calls)</h3>
        <ProviderTable rows={summary} />
      </CardContent>
    </Card>
  );
}

function ProviderTable({ rows }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-visible">
      <Table data-testid="admin-providers-table" wrapperClassName="overflow-visible">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.provider')}</TableHead>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.calls')}</TableHead>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.errors')}</TableHead>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.error_rate')}</TableHead>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.avg_ms', { defaultValue: 'avg ms' })}</TableHead>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.p95_ms', { defaultValue: 'p95 ms' })}</TableHead>
            <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.last')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.provider} data-testid="admin-providers-row">
              <TableCell className="font-mono text-xs">{p.provider}</TableCell>
              <TableCell className="text-end">{fmtNum(p.total)}</TableCell>
              <TableCell className="text-end">{fmtNum(p.fail)}</TableCell>
              <TableCell className="text-end">
                <Badge variant="outline" className={`text-[11px] ${PROVIDER_TONE[tone(p.error_rate)]}`}>
                  {(p.error_rate * 100).toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="text-end">{fmtNum(p.avg_ms)}</TableCell>
              <TableCell className="text-end">{fmtNum(p.p95_ms)}</TableCell>
              <TableCell className="text-xs">
                <div className="flex items-center gap-1">
                  {p.last_ok ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-rose-700" />
                  )}
                  <span className="truncate max-w-[260px]" title={p.last_error || ''}>
                    {p.last_ok ? 'ok' : (p.last_error || 'error')}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// -------------------- Providers --------------------
function ProvidersSection() {
  const { t } = useTranslation();
  const { providersSummary: summary, llmUsage: usage } = useAdminStore();

  const refresh = async (force = false) => {
    try {
      await adminStore.loadProviders({ force });
    } catch (err) {
      toast.error(t('pages.admin.failed_to_load_provider_data'));
    }
  };

  useEffect(() => {
    refresh(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={refresh} className="rounded-xl" data-testid="admin-providers-refresh">
          <RefreshCcw className="h-4 w-4 me-2" /> {t('stylist.refreshScout', { defaultValue: 'Refresh' })}
        </Button>
      </div>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-5">
          <h3 className="font-display text-xl mb-3">{t('pages.admin.all_providers')}</h3>
          {summary === null ? (
            <Skeleton className="h-32 w-full" />
          ) : summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pages.admin.no_calls_recorded_yet')}</p>
          ) : (
            <ProviderTable rows={summary} />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial" data-testid="admin-llm-usage-card">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="caps-label text-muted-foreground">{t('pages.admin.gemini_api_key', { defaultValue: 'Gemini API Key' })}</div>
              <h3 className="font-display text-xl mt-1">{t('pages.admin.gemini_key_usage', { defaultValue: 'Gemini API Status' })}</h3>
              {usage === null ? (
                <Skeleton className="h-5 w-64 mt-2" />
              ) : usage.available ? (
                <pre className="text-xs bg-secondary rounded-lg p-3 mt-2 overflow-x-auto" data-testid="admin-llm-usage-data">
                  {JSON.stringify(usage.usage, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  {usage.reason || 'Live usage not available.'}{' '}
                  {usage.manage_url && (
                    <a className="underline" href={usage.manage_url} target="_blank" rel="noreferrer">
                      {t('pages.admin.manage_in_google_ai_studio', { defaultValue: 'Manage in Google AI Studio' })}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Trend-Scout --------------------
function TrendScoutSection() {
  const { t } = useTranslation();
  const { trends: items } = useAdminStore();
  const [busy, setBusy] = useState(false);

  const refresh = async (force = false) => {
    try {
      await adminStore.loadTrends({ force });
    } catch { toast.error(t('pages.admin.failed_to_load_trend_reports')); }
  };

  useEffect(() => {
    refresh(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.adminTrendScoutRun(true);
      toast.success(t('pages.admin.generated_cards', { defaultValue: 'Generated {{count}} card(s)', count: res.generated?.length || 0 }));
      await refresh(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pages.admin.run_failed', { defaultValue: 'Run failed' }));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={refresh} className="rounded-xl" data-testid="admin-trends-refresh">
          <RefreshCcw className="h-4 w-4 me-2" /> {t('stylist.refreshScout', { defaultValue: 'Refresh' })}
        </Button>
        <Button onClick={run} disabled={busy} className="rounded-xl" data-testid="admin-trends-run">
          <Play className="h-4 w-4 me-2" /> {busy ? t('pages.admin.running', { defaultValue: 'Running...' }) : t('pages.admin.force_run_now', { defaultValue: 'Force run now' })}
        </Button>
      </div>
      {items === null ? (
        <Skeleton className="h-40 w-full rounded-[calc(var(--radius)+6px)]" />
      ) : items.length === 0 ? (
        <Card className="rounded-[calc(var(--radius)+6px)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t('pages.admin.no_trend_reports_yet_hit')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-trends-grid">
          {items.map((t) => (
            <Card key={t.id || `${t.bucket}-${t.date}`} className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[11px]">{t.bucket_label || t.bucket}</Badge>
                  <span className="caps-label text-muted-foreground">{t.date}</span>
                </div>
                <h3 className="font-display text-lg mt-2 leading-tight">{t.headline}</h3>
                <p className="text-sm text-muted-foreground mt-2">{t.body}</p>
                <div className="text-[11px] text-muted-foreground mt-3 font-mono">{t.model}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------- Users --------------------
function UsersSection() {
  const { t } = useTranslation();
  const { users: items, usersTotal: total, usersQuery } = useAdminStore();
  const [q, setQ] = useState(usersQuery || '');

  const refresh = async (search = q, force = false) => {
    try {
      await adminStore.loadUsers({ q: search, force });
    } catch { toast.error(t('pages.admin.failed_to_load_users')); }
  };

  useEffect(() => {
    refresh(usersQuery, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePromotion = async (u) => {
    const isAdmin = (u.roles || []).includes('admin');
    try {
      if (isAdmin) await api.adminDemoteUser(u.id);
      else await api.adminPromoteUser(u.id);
      toast.success(isAdmin ? t('pages.admin.removed_admin_role', { defaultValue: 'Removed admin role' }) : t('pages.admin.promoted_to_admin', { defaultValue: 'Promoted to admin' }));
      refresh(q, true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pages.admin.action_failed', { defaultValue: 'Action failed' }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('pages.admin.search_by_email_or_display')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refresh()}
            className="ps-9 rounded-xl"
            data-testid="admin-users-search"
          />
        </div>
        <Button onClick={() => refresh()} variant="outline" className="rounded-xl" data-testid="admin-users-search-btn">
          {t('common.search', { defaultValue: 'Search' })}
        </Button>
        <span className="text-xs text-muted-foreground ms-auto">{t('pages.admin.total_count', { count: total, defaultValue: '{{count}} total' })}</span>
      </div>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-0">
          <div className="overflow-visible">
            <Table data-testid="admin-users-table" wrapperClassName="overflow-visible">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('auth.email', { defaultValue: 'Email' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('auth.displayName', { defaultValue: 'Display name' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.roles')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.model', { defaultValue: 'Model' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.subscription_plan', { defaultValue: 'Plan' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.subscription_status', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.total_requests', { defaultValue: 'Requests' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.daily_requests', { defaultValue: 'Req/Day' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.dressapp_fee', { defaultValue: 'DressApp fee' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.billing_history', { defaultValue: 'Billing History' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('nav.closet', { defaultValue: 'Closet' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('admin.listings', { defaultValue: 'Listings' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.calendar')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.created')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items === null ? (
                  <TableRow><TableCell colSpan={15}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center text-sm text-muted-foreground py-6">{t('pages.admin.no_users_match')}</TableCell></TableRow>
                ) : items.map((u) => {
                  const isAdmin = (u.roles || []).includes('admin');
                  const sub = u.subscription || {};
                  const planName = sub.is_active ? (sub.tier || 'free') : 'free';
                  const isActive = sub.is_active;
                  const isCancelled = !!sub.cancelled_at;

                  let statusColor = 'bg-slate-50 text-slate-850 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800';
                  let statusText = t('pages.admin.inactive', { defaultValue: 'Inactive' });
                  if (isActive) {
                    if (isCancelled) {
                      statusColor = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50';
                      statusText = t('pages.admin.cancelled', { defaultValue: 'Cancelled' });
                    } else {
                      statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50';
                      statusText = t('pages.admin.active', { defaultValue: 'Active' });
                    }
                  }

                  return (
                    <TableRow key={u.id} data-testid="admin-users-row">
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.display_name}</TableCell>
                      <TableCell>
                        {(u.roles || []).map((r) => (
                          <Badge key={r} variant="outline" className="text-[11px] me-1">{r}</Badge>
                        ))}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{u.selected_model || '—'}</TableCell>
                      <TableCell className="text-sm capitalize font-semibold">
                        {t('pricing.tier.' + planName, { defaultValue: planName })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] ${statusColor}`}>
                          {statusText}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end text-sm">{fmtNum(u.total_requests)}</TableCell>
                      <TableCell className="text-end text-sm">{fmtNum(u.daily_requests)}</TableCell>
                      <TableCell className="text-end text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        ${(u.dressapp_fee || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-end text-sm font-medium">
                        ${(u.billing_history_sum || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-end text-sm">{fmtNum(u.closet_count)}</TableCell>
                      <TableCell className="text-end text-sm">{fmtNum(u.listing_count)}</TableCell>
                      <TableCell>
                        {u.calendar_connected ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px]">{t('pages.admin.connected', { defaultValue: 'connected' })}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">{t('pages.admin.no', { defaultValue: 'no' })}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg text-xs"
                          onClick={() => togglePromotion(u)}
                          data-testid="admin-user-toggle-admin"
                        >
                          {isAdmin ? <ShieldOff className="h-3 w-3 me-1" /> : <ShieldCheck className="h-3 w-3 me-1" />}
                          {isAdmin ? t('pages.admin.demote', { defaultValue: 'Demote' }) : t('pages.admin.promote', { defaultValue: 'Promote' })}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Listings --------------------
function ListingsSection() {
  const { t } = useTranslation();
  const { listings: items, listingsStatus } = useAdminStore();
  const [status, setStatus] = useState(listingsStatus || '');

  const refresh = async (currentStatus = status, force = false) => {
    try {
      await adminStore.loadListings({ status: currentStatus, force });
    } catch { toast.error(t('pages.admin.failed_to_load_listings')); }
  };

  useEffect(() => {
    refresh(status, false);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const setListingStatus = async (id, newStatus) => {
    try {
      await api.adminSetListingStatus(id, newStatus);
      toast.success(t('pages.admin.listing_status_updated', { defaultValue: 'Listing set to {{status}}', status: newStatus }));
      refresh(status, true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pages.admin.update_failed', { defaultValue: 'Update failed' }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['', 'active', 'paused', 'sold', 'removed'].map((s) => (
          <Button
            key={s || 'all'}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
            className="rounded-xl"
            data-testid={`admin-listings-filter-${s || 'all'}`}
          >
            {s || t('pages.admin.all', { defaultValue: 'All' })}
          </Button>
        ))}
      </div>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-0">
          <div className="overflow-visible">
            <Table data-testid="admin-listings-table" wrapperClassName="overflow-visible">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.listing')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('transactions.seller', { defaultValue: 'Seller' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('addItem.price', { defaultValue: 'Price' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('market.status', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.source_tag')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.created')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items === null ? (
                  <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">{t('pages.admin.no_listings')}</TableCell></TableRow>
                ) : items.map((l) => (
                  <TableRow key={l.id} data-testid="admin-listings-row">
                    <TableCell className="text-xs font-mono">{(l.id || '').slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs font-mono">{(l.seller_id || '').slice(0, 8)}…</TableCell>
                    <TableCell className="text-end">{fmtCents(l.list_price_cents, l.currency)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[11px]">{l.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-[11px]">{l.source_tag || '—'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        {l.status !== 'paused' && (
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setListingStatus(l.id, 'paused')} data-testid="admin-listing-pause">
                            {t('pages.admin.pause', { defaultValue: 'Pause' })}
                          </Button>
                        )}
                        {l.status !== 'active' && (
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setListingStatus(l.id, 'active')} data-testid="admin-listing-activate">
                            {t('pages.admin.activate', { defaultValue: 'Activate' })}
                          </Button>
                        )}
                        {l.status !== 'removed' && (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-rose-700" onClick={() => setListingStatus(l.id, 'removed')} data-testid="admin-listing-remove">
                            {t('pages.admin.remove', { defaultValue: 'Remove' })}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Transactions --------------------
function TransactionsSection() {
  const { t } = useTranslation();
  const { transactions: items, transactionsStatus } = useAdminStore();
  const [status, setStatus] = useState(transactionsStatus || '');

  const refresh = async (currentStatus = status, force = false) => {
    try {
      await adminStore.loadTransactions({ status: currentStatus, force });
    } catch { toast.error(t('transactions.loadFailed', { defaultValue: 'Failed to load transactions' })); }
  };

  useEffect(() => {
    refresh(status, false);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const aggregate = (items || []).reduce(
    (acc, t) => {
      const f = t.financial || {};
      if (t.status === 'paid') {
        acc.gross += f.gross_cents || 0;
        acc.platform += f.platform_fee_cents || 0;
        acc.stripe += f.stripe_fee_cents || 0;
        acc.net += f.seller_net_cents || 0;
      }
      return acc;
    },
    { gross: 0, platform: 0, stripe: 0, net: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['', 'pending', 'paid', 'cancelled', 'refunded'].map((s) => (
          <Button
            key={s || 'all'}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
            className="rounded-xl"
            data-testid={`admin-transactions-filter-${s || 'all'}`}
          >
            {s || t('pages.admin.all', { defaultValue: 'All' })}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('pages.admin.gross_paid', { defaultValue: 'Gross (paid)' }), value: fmtCents(aggregate.gross), id: 'agg-gross' },
          { label: t('transactions.platform7', { defaultValue: 'Platform 7%' }), value: fmtCents(aggregate.platform), id: 'agg-platform' },
          { label: t('pages.admin.stripe_fees', { defaultValue: 'Stripe fees' }), value: fmtCents(aggregate.stripe), id: 'agg-stripe' },
          { label: t('pages.admin.seller_net', { defaultValue: 'Seller net' }), value: fmtCents(aggregate.net), id: 'agg-net' },
        ].map((c) => (
          <Card key={c.id} className="rounded-[calc(var(--radius)+6px)]" data-testid={`admin-tx-${c.id}`}>
            <CardContent className="p-4">
              <div className="caps-label text-muted-foreground">{c.label}</div>
              <div className="font-display text-xl mt-1">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-0">
          <div className="overflow-visible">
            <Table data-testid="admin-transactions-table" wrapperClassName="overflow-visible">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.tx')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('market.status', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('transactions.gross', { defaultValue: 'Gross' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.platform')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.stripe')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10 text-end">{t('pages.admin.seller_net')}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('pages.admin.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items === null ? (
                  <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">{t('pages.admin.no_transactions')}</TableCell></TableRow>
                ) : items.map((t) => {
                  const f = t.financial || {};
                  return (
                    <TableRow key={t.id} data-testid="admin-transactions-row">
                      <TableCell className="text-xs font-mono">{(t.id || '').slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-[11px]">{t.status}</Badge></TableCell>
                      <TableCell className="text-end">{fmtCents(f.gross_cents, t.currency)}</TableCell>
                      <TableCell className="text-end">{fmtCents(f.platform_fee_cents, t.currency)}</TableCell>
                      <TableCell className="text-end">{fmtCents(f.stripe_fee_cents, t.currency)}</TableCell>
                      <TableCell className="text-end">{fmtCents(f.seller_net_cents, t.currency)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- System --------------------
function SystemSection() {
  const { t } = useTranslation();
  const { system: data } = useAdminStore();

  const refresh = async (force = false) => {
    try {
      await adminStore.loadSystem({ force });
    } catch { toast.error(t('pages.admin.failed_to_load_system_info')); }
  };

  useEffect(() => {
    refresh(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Skeleton className="h-40 w-full rounded-[calc(var(--radius)+6px)]" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="admin-system-grid">
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-5">
          <h3 className="font-display text-xl mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" /> {t('pages.admin.ai_config', { defaultValue: 'AI configuration' })}
          </h3>
          <dl className="text-sm space-y-2">
            {Object.entries(data.ai || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono text-xs text-end break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-5">
          <h3 className="font-display text-xl mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> {t('pages.admin.api_keys_present', { defaultValue: 'API keys present' })}
          </h3>
          <ul className="text-sm space-y-2">
            {Object.entries(data.keys_present || {}).map(([k, ok]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="font-mono text-xs">{k}</span>
                <Badge
                  variant="outline"
                  className={`text-[11px] ${ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}
                  data-testid={`admin-key-${k.toLowerCase()}`}
                >
                  {ok ? t('pages.admin.set', { defaultValue: 'set' }) : t('pages.admin.missing', { defaultValue: 'missing' })}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial md:col-span-2">
        <CardContent className="p-5">
          <h3 className="font-display text-xl mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> {t('home.trendScout', { defaultValue: 'Trend-Scout' })}
          </h3>
          <div className="text-sm flex flex-wrap gap-x-8 gap-y-2">
            <div>{t('pages.admin.enabled')} <Badge variant="outline" className="ms-1 text-[11px]">{String(data.trend_scout?.enabled)}</Badge></div>
            <div>{t('pages.admin.daily_utc')} <span className="font-mono">{data.trend_scout?.schedule_utc}</span></div>
            <div>{t('pages.admin.dev_bypass')} <Badge variant="outline" className="ms-1 text-[11px]">{String(data.dev?.allow_dev_bypass)}</Badge></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Campaign Queue --------------------
function CampaignQueueTab() {
  const { t } = useTranslation();
  const { campaigns: items, campaignsStatus } = useAdminStore();
  const [status, setStatus] = useState(campaignsStatus || 'pending_approval');
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewItem, setPreviewItem] = useState(null);

  const refresh = async (currentStatus = status, force = false) => {
    try {
      await adminStore.loadCampaigns({ status: currentStatus, force });
    } catch { toast.error(t('campaigns.admin.loadFailed', { defaultValue: 'Failed to load campaigns' })); }
  };

  useEffect(() => {
    refresh(status, false);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (id) => {
    try {
      await campaignApi.adminApproveCampaign(id);
      toast.success(t('campaigns.admin.approved', { defaultValue: 'Campaign approved' }));
      refresh(status, true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.error', { defaultValue: 'Error' }));
    }
  };

  const reject = async () => {
    if (!rejectId) return;
    try {
      await campaignApi.adminRejectCampaign(rejectId, rejectReason);
      toast.success(t('campaigns.admin.rejected', { defaultValue: 'Campaign rejected' }));
      setRejectId(null);
      setRejectReason('');
      refresh(status, true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.error', { defaultValue: 'Error' }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['pending_approval', 'all'].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
            className="rounded-xl"
            data-testid={`admin-campaigns-filter-${s}`}
          >
            {t(`campaigns.admin.filter_${s}`, { defaultValue: s })}
          </Button>
        ))}
      </div>
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-0">
          <div className="overflow-visible">
            <Table data-testid="admin-campaigns-table" wrapperClassName="overflow-visible">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('campaigns.admin.cover', { defaultValue: 'Cover' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('campaigns.admin.details', { defaultValue: 'Details' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('campaigns.admin.location', { defaultValue: 'Location' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('campaigns.admin.category', { defaultValue: 'Category' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('campaigns.admin.status', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10">{t('campaigns.admin.submitted', { defaultValue: 'Submitted' })}</TableHead>
                  <TableHead className="sticky top-16 bg-background/95 backdrop-blur z-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items === null ? (
                  <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">{t('campaigns.admin.empty', { defaultValue: 'No campaigns found' })}</TableCell></TableRow>
                ) : items.map((c) => (
                  <TableRow key={c.id} data-testid="admin-campaigns-row">
                    <TableCell>
                      {c.cover_image_url ? (
                        <img src={c.cover_image_url} alt="Cover" className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-secondary" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.business_name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.location_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[11px]">{c.category}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[11px]">{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setPreviewItem(c)} data-testid="admin-campaign-preview">
                          {t('campaigns.admin.preview', { defaultValue: 'Preview' })}
                        </Button>
                        {c.status === 'pending_approval' && (
                          <>
                            <Button size="sm" variant="ghost" className="text-xs h-7 text-emerald-600" onClick={() => approve(c.id)} data-testid="admin-campaign-approve">
                              {t('campaigns.admin.approve', { defaultValue: 'Approve' })}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs h-7 text-rose-600" onClick={() => setRejectId(c.id)} data-testid="admin-campaign-reject">
                              {t('campaigns.admin.reject', { defaultValue: 'Reject' })}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('campaigns.admin.rejectTitle', { defaultValue: 'Reject Campaign' })}</DialogTitle>
            <DialogDescription>{t('campaigns.admin.rejectDesc', { defaultValue: 'Please provide a reason for rejecting this campaign.' })}</DialogDescription>
          </DialogHeader>
          <Input 
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('campaigns.admin.reasonPlaceholder', { defaultValue: 'Reason...' })}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim()}>{t('campaigns.admin.confirmReject', { defaultValue: 'Reject' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('campaigns.admin.previewTitle', { defaultValue: 'Campaign Preview' })}</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              {previewItem.cover_image_url && (
                <img src={previewItem.cover_image_url} alt="Cover" className="w-full h-48 object-cover rounded-md" />
              )}
              <div>
                <h3 className="font-display text-lg">{previewItem.title}</h3>
                <p className="text-sm text-muted-foreground">{previewItem.business_name}</p>
              </div>
              <p className="text-sm">{previewItem.description}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>{t('campaigns.admin.location', { defaultValue: 'Location' })}:</strong> {previewItem.location_name || '—'}</div>
                <div><strong>{t('campaigns.admin.category', { defaultValue: 'Category' })}:</strong> {previewItem.category}</div>
                <div><strong>{t('campaigns.admin.website', { defaultValue: 'Website' })}:</strong> {previewItem.website_url || '—'}</div>
                <div><strong>{t('campaigns.admin.status', { defaultValue: 'Status' })}:</strong> {previewItem.status}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
