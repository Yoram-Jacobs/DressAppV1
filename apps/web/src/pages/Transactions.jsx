/**
 * Transactions page — Wave 3 rewrite.
 *
 * UX:
 * - Primary tabs by transaction *kind*: All / Buying / Selling / Swaps /
 *   Donations. Counts next to each label so returning users instantly
 *   see where the activity is.
 * - Secondary multi-select chips let users narrow to specific statuses
 *   (pending / accepted / denied / shipped / completed / paid).
 * - Each row shows a kind-appropriate icon + status badge. If the row
 *   is a swap or donate that's been accepted but not yet confirmed by
 *   the current user, we surface a "Confirm receipt" CTA inline so
 *   the happy-path action is one click from the list.
 *
 * Fetch strategy: one pull from ``GET /transactions`` (role=all, limit=100)
 * per session; all filtering is client-side to keep the UI snappy and
 * reduce API churn.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import {
  ArrowUpRight,
  Receipt,
  ShoppingBag,
  Repeat,
  HeartHandshake,
  Check,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { transactionsStore } from '@/lib/marketplaceStore';
import { useCachedList } from '@/lib/createCachedStore';
import { toast } from 'sonner';
// same banner image used on the Privacy Policy page — swap this import
// if you want a dedicated image for Transactions.
import PrivacyBanner from '../assets/img/inner6.webp';
import ReceiptIllustration from '../assets/img/receipt.png';


const fmt = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(
    (cents || 0) / 100,
  );

const STATUS_TONE = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  paid: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  accepted: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  shipped: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  completed: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  denied: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  cancelled: 'bg-rose-100 text-rose-900 border-rose-200',
  refunded: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-300',
  failed: 'bg-rose-100 text-rose-900 border-rose-200',
  disputed: 'bg-amber-100 text-amber-900 border-amber-200',
};

const STATUS_ICON = {
  pending: Clock,
  paid: CheckCircle2,
  accepted: CheckCircle2,
  shipped: Package,
  completed: CheckCircle2,
  denied: XCircle,
  cancelled: XCircle,
  refunded: Receipt,
  failed: XCircle,
  disputed: Clock,
};

const KIND_META = {
  buy: { icon: ShoppingBag },
  swap: { icon: Repeat },
  donate: { icon: HeartHandshake },
  rent: { icon: Clock },
};

const STATUS_FILTER_OPTIONS = [
  'pending', 'accepted', 'denied', 'shipped', 'completed', 'paid', 'refunded',
];

/**
 * Decide whether the current user can click "Confirm receipt" on a row.
 * Rules:
 *   - Only swap/donate rows ever get the CTA (buy flows complete on capture).
 *   - Tx must be in an accepted or shipped state (not pending, denied, or
 *     already completed).
 *   - The current user must NOT have already confirmed their side.
 */
function canConfirmReceipt(tx, userId) {
  if (!userId) return false;
  if (!['swap', 'donate'].includes(tx.kind)) return false;
  if (!['accepted', 'shipped'].includes(tx.status)) return false;
  const role = tx.seller_id === userId ? 'lister' : 'swapper';
  const nested = tx[tx.kind] || {};
  return !nested[`${role}_received_at`];
}

export default function Transactions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { items, loading, invalidate } = useCachedList(transactionsStore, { role: 'all', limit: 200 }, {
    autoRefresh: true,
  });
  const [activeKind, setActiveKind] = useState('all');
  const [statusFilter, setStatusFilter] = useState([]);

  const refresh = async () => {
    invalidate();
  };

  // --------- partitioned counts for the tab labels ---------
  const partitioned = useMemo(() => {
    const me = user?.id;
    const buying = items.filter((tx) => tx.buyer_id === me && ((tx.kind || 'buy') === 'buy' || tx.kind === 'rent'));
    const selling = items.filter((tx) => tx.seller_id === me && ((tx.kind || 'buy') === 'buy' || tx.kind === 'rent'));
    const swaps = items.filter((tx) => tx.kind === 'swap');
    const donations = items.filter((tx) => tx.kind === 'donate');
    return { all: items, buying, selling, swaps, donations };
  }, [items, user?.id]);

  const activeItems = useMemo(() => {
    const pool = partitioned[activeKind] || [];
    if (statusFilter.length === 0) return pool;
    return pool.filter((tx) => statusFilter.includes(tx.status));
  }, [partitioned, activeKind, statusFilter]);

  const toggleStatus = (s) =>
    setStatusFilter((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );

  const TAB_DEFS = [
    { value: 'all', label: t('common.all', { defaultValue: 'All' }), count: partitioned.all.length },
    { value: 'buying', label: t('pages.transactions.buying', { defaultValue: 'Buying' }), count: partitioned.buying.length },
    { value: 'selling', label: t('pages.transactions.selling', { defaultValue: 'Selling' }), count: partitioned.selling.length },
    { value: 'swaps', label: t('pages.transactions.swaps', { defaultValue: 'Swaps' }), count: partitioned.swaps.length },
    { value: 'donations', label: t('pages.transactions.donations', { defaultValue: 'Donations' }), count: partitioned.donations.length },
  ];

  return (
    <div data-testid="transactions-page">
      {/* Banner Section */}
      <section
        className="
          relative isolate overflow-hidden
          bg-cover bg-center bg-no-repeat
        "
        style={{
          backgroundImage: `url(${PrivacyBanner})`,
        }}
      >
        {/* Dark gradient overlay */}
        <div
          className="
            absolute inset-0 -z-0
            bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)]
          "
        />

        <div className="relative z-10 w-full">
          <div
            className="
              px-10 py-20
              max-[991px]:px-[35px] max-[991px]:py-[45px]
              max-[767px]:px-5 max-[767px]:py-[38px]
              max-[480px]:px-4 max-[480px]:py-8
            "
          >
            <div className="max-w-[520px]">
              {/* Title */}
              <h1
                className="
                  m-0 mb-0
                  text-[40px] leading-[40px]
                  font-bold
                  tracking-normal
                  text-white
                  max-[767px]:text-[42px]
                  max-[480px]:text-[35px]
                "
              >
                {t('transactions.bannerTitle', { defaultValue: 'Your Transactions' })}
              </h1>
              {/* Description */}
              <p
                className="
                  my-5
                  max-w-[450px]
                  text-[14px]
                  leading-6
                  tracking-[0.5px]
                  text-white/60
                  max-[767px]:max-w-full
                  max-[767px]:mt-[15px]
                "
              >
                {t('transactions.subtitle', { defaultValue: 'A 7% platform fee is applied after payment processing.' })}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-accent-beige px-[40px] py-[40px] max-[767px]:px-5 max-[767px]:py-10">
        <Tabs value={activeKind} onValueChange={setActiveKind} className="w-full">
          {/* Segmented pill tabs — matches the Camera & Upload / Digital Import control */}
          <div className="flex items-end justify-between mb-5">
            <TabsList
              className="
        inline-flex flex-wrap h-auto w-fit
        bg-white rounded-full p-1.5 gap-1
        border border-border/40 shadow-sm
      "
              data-testid="transactions-kind-tabs"
            >
              {TAB_DEFS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="
            gap-2 group flex gap-0.5 items-center rounded-full px-4 py-2
            text-[14px] font-semibold
            text-text-brand
            transition-colors
            data-[state=active]:bg-primary-brand
            data-[state=active]:text-white
            data-[state=active]:shadow-none
          "
                  data-testid={`transactions-tab-${tab.value}`}
                >
                  {tab.label}
                  <Badge
                    variant="secondary"
                    className="
              text-[10px] h-5 px-1.5 min-w-[20px] justify-center
              bg-primary-shadow text-primary-brand
             group-data-[state=active]:bg-white
            "
                    data-testid={`transactions-tab-count-${tab.value}`}
                  >
                    {tab.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              className=" h-auto
                      rounded-full
                      border-0
                      bg-[var(--primary-color)]
                      px-7
                      py-3.5
                      font-sans
                      text-sm
                      font-medium
                      text-white
                      shadow-none
                      transition-all
                      duration-300
                      hover:-translate-y-0.5
                      hover:bg-[var(--primary-hover)]
                      hover:text-white
                      hover:shadow-[0_10px_30px_rgba(31,92,69,0.22)]"
              asChild
              data-testid="transactions-goto-market"
            >
              <Link to="/market">
                <ArrowUpRight className="h-4 w-4" /> {t('transactions.goMarket', { defaultValue: 'Marketplace' })}
              </Link>
            </Button>
          </div>
          <div className='bg-white p-5 rounded-[12px] shadow-sm border border-border'>
            {/* Status filter chips — shared across all tabs. */}
            <div
              className="flex flex-wrap gap-2 pb-5"
              data-testid="transactions-status-filters"
              aria-label={t('pages.transactions.filter_by_status')}
            >
              {STATUS_FILTER_OPTIONS.map((s) => {
                const Icon = STATUS_ICON[s];
                const active = statusFilter.includes(s);
                return (
                  <Toggle
                    key={s}
                    pressed={active}
                    onPressedChange={() => toggleStatus(s)}
                    className={[
                      'rounded-full bg-white border border-primary-brand',
                      'data-[state=on]:border-emerald-900 data-[state=on]:bg-emerald-900',
                      'data-[state=on]:text-white',
                      'h-9 px-3.5 text-xs capitalize gap-1.5 font-bold',
                      'shadow-sm hover:bg-white hover:border-border text-primary-brand',
                    ].join(' ')}
                    data-testid={`transactions-status-chip-${s}`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {t(`pages.transactions.status.${s}`, { defaultValue: s })}
                  </Toggle>
                );
              })}
              {statusFilter.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter([])}
                  className="h-9 text-xs font-bold"
                  data-testid="transactions-status-clear"
                >
                  {t('common.clear', { defaultValue: 'Clear' })}
                </Button>
              )}
            </div>
            <TabsContent value={activeKind}>
              {loading ? (
                <div className="space-y-3" data-testid="transactions-loading">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : activeItems.length === 0 ? (
                <EmptyState kind={activeKind} hasFilter={statusFilter.length > 0} />
              ) : (
                <div className="rounded-[12px] border border-border overflow-hidden overflow-x-auto" data-testid="transactions-list">
                  <table className="w-full border-collapse min-w-[720px]">
                    <thead>
                      <tr className="border-b border-border bg-primary-shadow">
                        <th className="text-left text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                          {t('pages.transactions.type', { defaultValue: 'Type' })}
                        </th>
                        <th className="text-left text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                          {t('pages.transactions.status_label', { defaultValue: 'Status' })}
                        </th>
                        <th className="text-left text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                          {t('pages.transactions.date', { defaultValue: 'Date' })}
                        </th>
                        <th className="text-left text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                          {t('pages.transactions.details', { defaultValue: 'Details' })}
                        </th>
                        <th className="text-right text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                          {t('pages.transactions.action', { defaultValue: 'Action' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map((tx) => (
                        <TransactionRow
                          key={tx.id}
                          tx={tx}
                          userId={user?.id}
                          onConfirmed={refresh}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  );
}

function EmptyState({ kind, hasFilter }) {
  const { t } = useTranslation();
  const copy = {
    all: {
      title: t('transactions.empty', { defaultValue: 'No transactions yet' }),
      sub: t('transactions.emptySub', { defaultValue: 'Buy, swap, or donate from the marketplace to start building your history.' }),
    },
    buying: {
      title: t('transactions.emptyPurchases', { defaultValue: 'No purchases yet' }),
      sub: t('transactions.emptyPurchasesSub', { defaultValue: 'Browse the marketplace to discover curated pieces with full fee transparency.' }),
    },
    selling: {
      title: t('transactions.emptySales', { defaultValue: 'No sales yet' }),
      sub: t('transactions.emptySalesSub', { defaultValue: 'List pieces from your closet and track the net payout you can expect here.' }),
    },
    swaps: {
      title: t('transactions.emptySwaps', { defaultValue: 'No swaps yet' }),
      sub: t('transactions.emptySwapsSub', { defaultValue: "When someone proposes a swap — or you propose one — it'll appear here." }),
    },
    donations: {
      title: t('transactions.emptyDonations', { defaultValue: 'No donations yet' }),
      sub: t('transactions.emptyDonationsSub', { defaultValue: "Share something you've outgrown or claim a freebie from your community." }),
    },
  }[kind] || copy?.all;

  return (
    <div
      className="text-center py-[40px]"
      data-testid="transactions-empty-state"
    >
      {/* Illustration */}
      <div className="flex justify-center mb-3">
        <img
          src={ReceiptIllustration}
          alt={t("pages.closet.flat_lay_empty_state")}
          className="h-auto w-[200px] object-contain"
        />
      </div>
      <h2 className="text-[20px] font-bold text-dark-brand">{copy.title}</h2>
      <p className="text-[14px] font-semibold text-text-brand max-w-md mx-auto">
        {hasFilter
          ? t('transactions.emptyFilter', { defaultValue: 'Nothing matches the active status filter. Try clearing it.' })
          : copy.sub}
      </p>

      <Button
        asChild
        className="mt-4 h-auto rounded-full bg-emerald-900 hover:bg-emerald-800 px-6 py-3 text-sm font-medium text-white shadow-none transition-all duration-300 hover:-translate-y-0.5 !gap-0.5"
        data-testid="transactions-empty-cta"
      >
        <Link to="/market">
          <ArrowUpRight className="h-4 w-4" />
          {t('pages.transactions.explore_the_marketplace', { defaultValue: 'Explore the marketplace' })}
        </Link>
      </Button>
    </div>
  );
}

function TransactionRow({ tx, userId, onConfirmed }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const cur = tx.currency || 'USD';
  const f = tx.financial || {};
  const kind = tx.kind || 'buy';
  const kindMeta = KIND_META[kind] || KIND_META.buy;
  const KIcon = kindMeta.icon;
  const SIcon = STATUS_ICON[tx.status];
  const canConfirm = canConfirmReceipt(tx, userId);
  const isBuyerSide = tx.buyer_id === userId;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await api.confirmReceipt(tx.id);
      toast.success(t('pages.transactions.receipt_confirmed_thanks_for_closing', { defaultValue: 'Receipt confirmed. Thanks for closing the loop!' }));
      onConfirmed?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pages.transactions.could_not_confirm_receipt', { defaultValue: 'Could not confirm receipt.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-black/[0.015] transition-colors align-middle"
      data-testid="transactions-list-item"
      data-kind={kind}
      id={`tx-${tx.id}`}
    >
      {/* Type */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-full bg-primary-shadow flex items-center justify-center shrink-0">
            <KIcon className="h-4 w-4 text-primary-brand" />
          </span>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">
              {kind === 'buy' && t('pages.transactions.purchase', { defaultValue: 'Purchase' })}
              {kind === 'rent' && t('pages.transactions.rental', { defaultValue: 'Rental' })}
              {kind === 'swap' && t('pages.transactions.swap', { defaultValue: 'Swap' })}
              {kind === 'donate' && t('pages.transactions.donation', { defaultValue: 'Donation' })}
            </div>
            {(kind === 'buy' || kind === 'rent') && (
              <div className="text-xs font-bold text-text-brand">
                {isBuyerSide ? t('transactions.buyer') : t('transactions.seller')}
              </div>
            )}
          </div>
        </div>
      </td>
      {/* Status */}
      <td className="px-4 py-4">
        <Badge
          variant="outline"
          className={`text-[11px] gap-1 w-fit ${STATUS_TONE[tx.status] || ''}`}
          data-testid="transactions-status-badge"
        >
          {SIcon && <SIcon className="h-3 w-3" />}
          {t(`pages.transactions.status.${tx.status}`, { defaultValue: tx.status })}
        </Badge>
      </td>
      {/* Date */}
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-xs font-bold text-text-brand">
          {new Date(tx.created_at).toLocaleString()}
        </span>
      </td>
      {/* Details / amount */}
      <td className="px-4 py-4">
        {(kind === 'buy' || kind === 'rent') ? (
          <div className="flex items-center gap-6">
            <div>
              <div className="font-bold text-text-brand text-[10px]">{t('transactions.gross')}</div>
              <div className="font-semibold text-sm">{fmt(f.gross_cents, cur)}</div>
            </div>
            <div>
              <div className="font-bold text-text-brand text-[10px]">
                {isBuyerSide ? t('transactions.youPaid') : t('transactions.yourNet')}
              </div>
              <div className="font-semibold text-sm">
                {isBuyerSide ? fmt(f.gross_cents, cur) : fmt(f.seller_net_cents, cur)}
              </div>
            </div>
          </div>
        ) : kind === 'donate' ? (
          <div>
            <div className="font-bold text-text-brand text-[10px]">
              {(f.gross_cents || 0) > 0 ? t('transactions.gross') : t('transactions.fees')}
            </div>
            <div className="font-semibold text-sm">
              {(f.gross_cents || 0) > 0 ? fmt(f.gross_cents, cur) : fmt(0, cur)}
            </div>
          </div>
        ) : (
          <div>
            <div className="font-bold text-text-brand text-[10px]">{t('taxonomy.intent.swap')}</div>
            <div className="font-semibold text-sm">{t('pages.transactions.item_item')}</div>
          </div>
        )}
      </td>

      {/* Action */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-1.5">
          {canConfirm && (
            <Button
              size="sm"
              className="rounded-full !gap-0.5"
              onClick={handleConfirm}
              disabled={busy}
              data-testid="transactions-confirm-receipt"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> {t('pages.transactions.confirm_receipt')}
                </>
              )}
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full font-bold  hover:underline"
            data-testid="transactions-open-listing"
          >
            <Link to={`/market/${tx.listing_id}`}>{t('transactions.view', { defaultValue: 'View' })}</Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}