import { useEffect, useMemo, useState } from "react";
import { useStoreState } from "@/lib/createSimpleStore";
import { marketplaceUIStore } from "@/lib/marketplaceUIStore";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SourceTagBadge } from "@/components/SourceTagBadge";
import { Plus, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StreamingProgressChip } from "@/components/StreamingProgressChip";
import { api } from "@/lib/api";
import {
  labelForCategory,
  labelForSource,
  labelForIntent,
} from "@/lib/taxonomy";
import { useLocation as useAppLocation } from "@/lib/location";
import { useAuth } from "@/lib/auth";
import {
  browseStore,
  myListingsStore,
  transactionsStore,
  marketplaceProgress,
} from "@/lib/marketplaceStore";
import { useMarketplaceProgress } from "@/lib/useMarketplaceProgress";
import { useLocalStorageSync } from "@/lib/useLocalStorageSync";
import { useCachedList } from "@/lib/createCachedStore";
import { toast } from "sonner";
import market5 from "@/assets/img/market5.webp";
import ClosetBanner from "../assets/img/inner6.webp";
const fmt = (cents, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(
    (cents || 0) / 100,
  );

// Marketplace filter dropdown.
//
// Replaced the catch-all "Shared" with the three concrete marketplace
// modes so users can drill straight to "Just show me items For sale"
// or "Just show me Donations".
//
// Values in {Retail} key on listing.source; values in
// {for_sale, swap, donate} key on listing.mode (where ``for_sale`` →
// ``mode=sell`` on the wire).
const SOURCES = ["all", "for_sale", "swap", "donate", "rent", "Retail"];
const _INTENT_VALUES = new Set(["for_sale", "swap", "donate", "rent"]);
const _INTENT_TO_MODE = {
  for_sale: "sell",
  swap: "swap",
  donate: "donate",
  rent: "rent",
};
const CATEGORIES = [
  "all",
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessory",
  "dress",
];
const RADIUS_OPTIONS = ["any", "5", "25", "50", "200"];

const INITIAL_FILTERS = { source: "all", category: "all", radius: "any" };

export default function Marketplace() {
  const { t } = useTranslation();
  const loc = useAppLocation();
  const [rawFilters, setFilters] = useLocalStorageSync(
    "dressapp.marketplace.filters",
    INITIAL_FILTERS,
  );
  const filters =
    rawFilters && typeof rawFilters === "object" && !Array.isArray(rawFilters)
      ? { ...INITIAL_FILTERS, ...rawFilters }
      : INITIAL_FILTERS;

  const [activeTab, setActiveTab] = useLocalStorageSync(
    "dressapp.marketplace.activeTab",
    "browse",
  );

  // Stable params object — keyed inputs to the cached browse store.
  // Mirrors the original wire-shape decisions: classic source values
  // (Retail) hit ``?source=…`` while the new intent values
  // (for_sale/swap/donate) hit ``?mode=…``. Geo coords are attached
  // when available so the server can rank by proximity; the radius
  // filter is honoured only when explicitly chosen.
  const browseParams = useMemo(() => {
    const params = {};
    if (filters.source === "Retail") {
      params.source = "Retail";
    } else if (_INTENT_VALUES.has(filters.source)) {
      params.mode = _INTENT_TO_MODE[filters.source];
    }
    if (filters.category !== "all") params.category = filters.category;
    if (loc?.coords?.lat != null && loc?.coords?.lng != null) {
      params.lat = loc.coords.lat;
      params.lng = loc.coords.lng;
      if (filters.radius !== "any") params.radius_km = Number(filters.radius);
    }
    return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.source,
    filters.category,
    filters.radius,
    loc?.coords?.lat,
    loc?.coords?.lng,
  ]);

  const { items, loading, refreshing } = useCachedList(
    browseStore,
    browseParams,
    {
      // Phase Z2.4 — opt out of the cached store's JSON revalidation
      // because the streaming useEffect below populates the same slot
      // via ``upsertItem`` as items arrive. If we let ``useCachedList``
      // fire its own ``ensure(filters)``, we'd race the JSON fetcher
      // against the NDJSON stream into the same slot.
      revalidateOnMount: false,
    },
  );
  // ``refreshing`` lets us hint that a stale-while-revalidate refresh
  // is in flight without blanking the grid; we don't render a spinner
  // for it today but the value is exposed for future polish.
  void refreshing;

  // Phase Z2.4 — progressive browse via NDJSON stream. Items appear
  // as the server emits them, instead of all-at-once at the end of
  // a JSON round-trip. The store handles abort-on-filter-change for
  // us; we just kick a new stream every time ``browseParams`` flips.
  // The grid stays subscribed via ``useCachedList`` above, so each
  // ``upsertItem`` call inside the stream triggers a paint of one
  // more card.
  const { browse: browseProgress, streamBrowse } = useMarketplaceProgress();
  useEffect(() => {
    // Keep existing listings on frontend if browseStore already holds fresh items
    const existing = browseStore.get(browseParams);
    if (
      existing &&
      browseStore.isFresh(existing) &&
      existing.items &&
      existing.items.length > 0
    ) {
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        await streamBrowse(browseParams, { signal: ac.signal });
      } catch (err) {
        if (!cancelled) {
          // Surface only non-abort errors. Aborts are expected when
          // the user changes filters quickly.
          if (err?.name !== "AbortError") {
            // eslint-disable-next-line no-console
            console.warn("Marketplace browse stream failed", err);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // ``streamBrowse`` is stable across renders (bound singleton).
    // Re-run when the stable filter key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(browseParams)]);

  return (
    <>
      {/* banner-start */}
      <section
        className="
            relative isolate overflow-hidden
            bg-cover bg-center bg-no-repeat
             mt-[var(--header-height)]"
        style={{
          backgroundImage: `url(${ClosetBanner})`,
        }}
      >
        {/* Dark gradient overlay */}
        <div
          className="
              absolute inset-0 -z-0
              bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)]"
        />
        <div className="relative z-10 w-full">
          <div
            className="
                px-10 py-20
                max-[991px]:px-[35px] max-[991px]:py-[45px]
                max-[767px]:px-5 max-[767px]:py-[38px]
                max-[480px]:px-4 max-[480px]:py-8"
          >
            <div className="max-w-[520px]">
              {/* Title */}
              <h1
                className="
                    m-0 mb-5
                    text-[40px] leading-[50px]
                    font-bold
                    tracking-normal
                    text-white
                    max-[767px]:text-[42px]
                    max-[480px]:text-[35px]
                  "
              >
                {t("market.hero")}
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
                Discover pre-loved fashion, list your wardrobe, or connect with
                nearby buyers and sellers. Shop smarter, earn from your closet,
                and embrace sustainable style—all in one marketplace.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="px-[40px] py-[80px] bg-[var(--accent-beige)]">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold leading-10 text-[var(--dark-color)] text-[30px] tracking-[0.5px] mb-0">
            {t("market.title")}
          </h2>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center justify-between">
            <div className="">
              <TabsList
                data-testid="marketplace-tabs"
                className="inline-flex items-center gap-1 p-[5px] bg-white rounded-full my-5"
              >
                <TabsTrigger
                  value="browse"
                  data-testid="marketplace-tab-browse"
                  className="group inline-flex items-center gap-[7px] px-5 py-[10px] rounded-full text-sm font-bold text-[var(--text-color)] bg-transparent border-none transition-all duration-300 cursor-pointer whitespace-nowrap hover:text-[var(--primary-color)] hover:bg-[var(--primary-shadow)] data-[state=active]:!bg-[var(--primary-color)] data-[state=active]:!text-white"
                >
                  <i className="fa-solid fa-store text-xs opacity-70 transition-all duration-300 group-data-[state=active]:opacity-100 group-data-[state=active]:text-white"></i>{" "}
                  {t("market.browse")}
                </TabsTrigger>
                <TabsTrigger
                  value="mine"
                  data-testid="marketplace-tab-mine"
                  className="group inline-flex items-center gap-[7px] px-5 py-[10px] rounded-full text-sm font-bold text-[var(--text-color)] bg-transparent border-none transition-all duration-300 cursor-pointer whitespace-nowrap hover:text-[var(--primary-color)] hover:bg-[var(--primary-shadow)] data-[state=active]:!bg-[var(--primary-color)] data-[state=active]:!text-white"
                >
                  <i className="fa-solid fa-shirt text-xs opacity-70 transition-all duration-300 group-data-[state=active]:opacity-100 group-data-[state=active]:text-white"></i>{" "}
                  {t("market.myListings")}
                </TabsTrigger>
                <TabsTrigger
                  value="tx"
                  data-testid="marketplace-tab-transactions"
                  className="group inline-flex items-center gap-[7px] px-5 py-[10px] rounded-full text-sm font-bold text-[var(--text-color)] bg-transparent border-none transition-all duration-300 cursor-pointer whitespace-nowrap hover:text-[var(--primary-color)] hover:bg-[var(--primary-shadow)] data-[state=active]:!bg-[var(--primary-color)] data-[state=active]:!text-white"
                >
                  <i className="fa-solid fa-receipt text-xs opacity-70 transition-all duration-300 group-data-[state=active]:opacity-100 group-data-[state=active]:text-white"></i>{" "}
                  {t("market.transactionsTab")}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="">
              <div className="topaligntab">
                <Link
                  to="/market/create"
                  asChild
                  data-testid="marketplace-create-listing"
                  className="inline-flex items-center justify-center bg-[var(--primary-color)] text-white border-none rounded-full px-[22px] py-[15px] text-[13px] font-bold leading-none transition-all duration-300 hover:bg-[var(--primary-hover)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  <i className="fa-solid fa-plus me-2"></i>
                  {t("market.createListing")}
                </Link>
              </div>
            </div>
          </div>

          <TabsContent value="browse">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-3 items-start">
              <div className="min-w-0">
                <div className="bg-white border border-border rounded-[12px] p-4 shadow-[0_8px_24px_rgba(20,30,25,0.05)]">
                  <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--dark-color)] pb-[14px] mb-4 border-b border-[#eee]">
                    <i className="fa-solid fa-sliders text-[var(--primary-color)] text-[13px]"></i>{" "}
                    {t("market.filters", { defaultValue: "Filters" })}
                  </div>

                  <div className="mb-4">
                    <label className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#9a9a94] mb-2">
                      {t("market.source", { defaultValue: "Source" })}
                    </label>
                    <Select
                      value={filters.source}
                      onValueChange={(v) =>
                        setFilters((f) => ({ ...f, source: v }))
                      }
                    >
                      <SelectTrigger
                        className="w-full h-11 rounded-xl border border-[#ccc] bg-white shadow-none text-sm text-[#666] mb-0"
                        data-testid="market-source-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {_INTENT_VALUES.has(s)
                              ? labelForIntent(s, t)
                              : labelForSource(s, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#9a9a94] mb-2">
                      {t("market.category", { defaultValue: "Category" })}
                    </label>
                    <Select
                      value={filters.category}
                      onValueChange={(v) =>
                        setFilters((f) => ({ ...f, category: v }))
                      }
                    >
                      <SelectTrigger
                        className="w-full h-11 rounded-xl border border-[#ccc] bg-white shadow-none text-sm text-[#666] mb-0"
                        data-testid="market-category-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {labelForCategory(c, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-0">
                    <label className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#9a9a94] mb-2">
                      {t("market.distance", { defaultValue: "Distance" })}
                    </label>
                    {loc?.coords ? (
                      <Select
                        value={filters.radius}
                        onValueChange={(v) =>
                          setFilters((f) => ({ ...f, radius: v }))
                        }
                      >
                        <SelectTrigger
                          className="w-full h-11 rounded-xl border border-[#ccc] bg-white shadow-none text-sm text-[#666] mb-0"
                          data-testid="market-radius-select"
                        >
                          <MapPin className="h-3.5 w-3.5 me-1 text-[hsl(var(--accent))]" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RADIUS_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r === "any"
                                ? t("market.anyDistance")
                                : t("market.radiusKm", { km: r })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="outline"
                        className="inline-flex items-center text-[11px] px-3 py-2 rounded-full bg-[var(--primary-shadow)] border border-[rgba(31,92,69,0.15)] text-[var(--primary-color)] w-full"
                        data-testid="market-location-hint"
                      >
                        <MapPin className="h-3 w-3 me-1" />
                        {t("market.needLocationForNearby")}
                      </Badge>
                    )}
                  </div>

                  {(filters.source !== "all" ||
                    filters.category !== "all" ||
                    filters.radius !== "any") && (
                    <button
                      type="button"
                      className="w-full mt-[18px] p-[10px] border border-dashed border-[rgba(31,92,69,0.35)] bg-transparent rounded-xl text-[var(--primary-color)] text-xs font-extrabold cursor-pointer transition-all duration-300 hover:bg-[var(--primary-shadow)]"
                      onClick={() => setFilters(INITIAL_FILTERS)}
                    >
                      {t("market.clearFilters", {
                        defaultValue: "Clear all filters",
                      })}
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                {!loading && items.length > 0 && (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-3"
                    data-testid="marketplace-grid"
                  >
                    {items.map((l) => (
                      <div key={l.id}>
                        <Link
                          to={`/market/${l.id}`}
                          className="block no-underline text-inherit"
                          data-testid="marketplace-item-card"
                        >
                          <div className="group rounded-2xl overflow-hidden border border-black/5 bg-white h-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:shadow-[0_24px_48px_rgba(20,30,25,0.12)] hover:border-[rgba(31,92,69,0.15)]">
                            <div className="relative aspect-square overflow-hidden bg-[#f4f4ef]">
                              {(l.images || [])[0] ? (
                                <img
                                  src={l.images[0]}
                                  alt={l.title}
                                  className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08]"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col gap-1.5 justify-center items-center text-[#b5b5ae]">
                                  <i className="fa-solid fa-image text-[22px]"></i>
                                  <span className="text-[11px] font-semibold">
                                    {t("market.noImage")}
                                  </span>
                                </div>
                              )}
                              <div className="absolute top-2.5 left-2.5 z-[2] [&>*]:!bg-[var(--primary-color)] [&>*]:!text-white [&>*]:!font-extrabold [&>*]:!text-[9px] [&>*]:tracking-[1.5px] [&>*]:!px-2.5 [&>*]:!py-1.5 [&>*]:!rounded-full [&>*]:!border-none">
                                <SourceTagBadge
                                  source={l.source}
                                  mode={l.mode}
                                />
                              </div>
                              {l.condition && (
                                <span className="absolute bottom-2.5 right-2.5 z-[2] bg-white text-[var(--primary-color)] text-[10px] font-extrabold tracking-[0.04em] capitalize px-2.5 py-1.5 rounded-full">
                                  {t(`taxonomy.condition.${l.condition}`)}
                                </span>
                              )}
                            </div>

                            <div className="p-[15px]">
                              <div className="flex items-center justify-between mb-[5px]">
                                {l.brand && (
                                  <span className="text-[10px] font-extrabold text-[var(--primary-color)] uppercase tracking-[0.08em]">
                                    {l.brand}
                                  </span>
                                )}
                                {l.size && (
                                  <span className="text-[10px] font-extrabold text-[#666] uppercase tracking-[0.5px]">
                                    {t("addItem.size")} {l.size}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-bold leading-5 mb-[5px] text-black line-clamp-1">
                                {l.title}
                              </h4>

                              <div className="flex items-center justify-between mb-0">
                                <span className="text-[18px] font-black text-[var(--primary-color)] tracking-[-0.3px]">
                                  {fmt(
                                    l.financial_metadata?.list_price_cents,
                                    l.financial_metadata?.currency ||
                                      l.currency,
                                  )}
                                  {l.mode === "rent" && (
                                    <span className="text-[11px] font-semibold text-[var(--text-color)] ml-0.5">
                                      /{t("common.day")}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[8px] font-extrabold text-[var(--primary-color)] bg-[var(--primary-shadow)] px-[9px] py-1 rounded-full whitespace-nowrap">
                                  {t("market.netShort", {
                                    amount: fmt(
                                      l.financial_metadata
                                        ?.estimated_seller_net_cents,
                                      l.financial_metadata?.currency ||
                                        l.currency,
                                    ),
                                  })}
                                </span>
                              </div>

                              {typeof l.distance_km === "number" && (
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#9a9a94] pb-1">
                                  <MapPin size={12} />
                                  {t("market.distanceKmAway", {
                                    km: l.distance_km,
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                {(loading ||
                  (browseProgress.running && items.length === 0)) && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i}>
                        <Skeleton className="aspect-[3/4] w-full rounded-[calc(var(--radius)+6px)]" />
                      </div>
                    ))}
                  </div>
                )}
                {!loading && !browseProgress.running && items.length === 0 && (
                  <div
                    className="border-0 rounded-xl bg-white shadow-[0_12px_35px_rgba(27,45,35,0.06)]"
                    data-testid="marketplace-empty-state"
                  >
                    <div className="p-20">
                      <div className="relative flex items-center justify-center mb-5">
                        <img src={market5} className="h-[250px] object-cover" />
                      </div>
                      <div className="flex justify-center items-center">
                        <div className="text-center">
                          <h2 className="mb-[5px] text-black text-[30px] font-bold leading-10">
                            {t("market.noMatching")}
                          </h2>
                          <p className="max-w-[560px] mx-auto mt-[14px] mb-6 text-[#686f6b] text-base leading-[1.65]">
                            {t("market.noMatchingSub")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="mine">
            <MyListings />
          </TabsContent>
          <TabsContent value="tx">
            <InlineTransactions />
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
// my-listings tab content
function MyListings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [removingId, setRemovingId] = useState(null);
  // Phase Z2.4 — backfill now streams. ``syncing`` derives from the
  // shared progress snapshot so multi-tab / repeated clicks behave
  // consistently.
  const { backfill: backfillProgress, streamBackfill } =
    useMarketplaceProgress();
  const syncing = !!backfillProgress.running;
  // Filter object that drives the cached store. The same shape was
  // used in the prewarm at AppLayout boot — passing the exact same
  // ``{seller_id}`` here means the page paints from cache instantly.
  const sellerFilters = useMemo(
    () => (user?.id ? { seller_id: user.id } : null),
    [user?.id],
  );
  // useCachedList tolerates a missing user (filters=null short-circuits
  // to an empty cache slot) so we don't have to gate the hook call.
  const { items, loading } = useCachedList(
    myListingsStore,
    sellerFilters || {},
    {
      revalidateOnMount: !!sellerFilters,
    },
  );
  // Hard-delete the listing AND reset the linked closet item back to
  // private/own (handled atomically on the backend). The closet card
  // flips to "Private" on next render so the user gets immediate
  // feedback that the item is no longer on the marketplace.
  const removeListing = async (l) => {
    if (
      !window.confirm(
        t("market.confirmRemoveListing", {
          defaultValue: `Remove "${l.title}" from the marketplace?`,
        }),
      )
    )
      return;
    setRemovingId(l.id);
    try {
      await api.deleteListing(l.id);
      toast.success(
        t("market.listingRemoved", {
          defaultValue: "Removed from marketplace",
        }),
      );
      // Optimistic local removal in the cache so the UI flips
      // immediately. Browse cache may also show this listing, so we
      // invalidate it for a quiet refetch on next visit.
      if (sellerFilters) myListingsStore.removeItem(sellerFilters, l.id);
      browseStore.invalidate();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          t("market.removeFailed", {
            defaultValue: "Could not remove listing",
          }),
      );
    } finally {
      setRemovingId(null);
    }
  };
  // One-shot rescue for users whose closet items have a
  // marketplace_intent set (swap/donate/for_sale) but never made it
  // to the marketplace — typically because they pre-date the
  // auto-list pipeline.
  //
  // Phase Z2.4 — streams per-candidate progress so the chip ticks
  // "Listed 12/47 · Skipped 2" live instead of showing a blank
  // "Syncing…" spinner for a multi-second batch. Idempotent on the
  // server, so re-running is safe; the new streaming endpoint
  // invalidates both caches itself on completion (see
  // ``marketplaceStore.streamBackfill``), so the page sees fresh
  // data on the next render without an explicit refetch here.
  const syncMarketplace = async () => {
    // Track failures so we can surface a per-item toast at the end
    // without making the chip itself responsible for error noise.
    const failureMessages = [];
    try {
      const done = await streamBackfill({
        onItem: (ev) => {
          if (ev?.status === "failed" && ev?.title) {
            failureMessages.push(`${ev.title}: ${ev.error || "failed"}`);
          }
        },
      });
      if (!done) return; // already running — no-op
      const candidates = done.candidates || 0;
      const created = done.created || 0;
      const skipped = done.skipped || 0;
      const synced = done.source_synced || 0;
      if (candidates === 0) {
        toast.info(
          t("market.syncNoCandidates", {
            defaultValue:
              "Nothing to sync — no closet items have a marketplace intent set.",
          }),
        );
      } else if (created === 0 && synced === 0 && skipped === candidates) {
        // Pure no-op rerun — keep the UX quiet.
        toast.info(
          t("market.syncAlreadyDone", {
            defaultValue:
              "Already synced — every candidate is on the marketplace.",
          }),
        );
      } else {
        toast.success(
          t("market.syncDone", {
            defaultValue: `Synced ${candidates} item(s): ${created} listed, ${skipped} already on marketplace${synced ? `, ${synced} re-flagged Shared` : ""}.`,
          }),
        );
      }
      if (failureMessages.length) {
        toast.error(
          t("market.syncSomeFailed", {
            defaultValue: `${failureMessages.length} item(s) couldn't be listed: ${failureMessages[0]}`,
            count: failureMessages.length,
          }),
        );
      }
      // The store's streamBackfill already invalidated both caches,
      // but we force a refetch on the seller view so the new
      // listings appear immediately rather than on the next visit.
      if (sellerFilters) {
        await myListingsStore.ensure(sellerFilters, { force: true });
      }
    } catch (err) {
      toast.error(
        err?.message ||
          t("market.syncFailed", {
            defaultValue: "Could not sync marketplace",
          }),
      );
    }
  };

  if (loading)
    return (
      <div className="py-10 caps-label text-muted-foreground">
        {t("market.loading")}
      </div>
    );

  return (
    <div className="market-mylistings">
      {/* Heading row: count on the left, contextual sync action on the right */}
      <div className="market-mylistings-heading">
        <div className="market-mylistings-heading-left">
          <span className="market-mylistings-count">
            {t("market.myListingsCount", {
              count: items.length,
              defaultValue: `${items.length} listing${items.length === 1 ? "" : "s"}`,
            })}
          </span>
          <StreamingProgressChip
            progress={backfillProgress}
            runningLabel={t("market.backfill.running", {
              defaultValue: "Listing closet items… {{n}}/{{total}}",
              n: backfillProgress.scanned || 0,
              total: backfillProgress.total || "?",
            })}
            successLabel={(() => {
              const parts = [];
              if (backfillProgress.created > 0) {
                parts.push(
                  t("market.backfill.created", {
                    defaultValue: "{{n}} listed",
                    n: backfillProgress.created,
                  }),
                );
              }
              if (backfillProgress.skipped > 0) {
                parts.push(
                  t("market.backfill.skipped", {
                    defaultValue: "{{n}} already up",
                    n: backfillProgress.skipped,
                  }),
                );
              }
              if (backfillProgress.source_synced > 0) {
                parts.push(
                  t("market.backfill.synced", {
                    defaultValue: "{{n}} reflagged",
                    n: backfillProgress.source_synced,
                  }),
                );
              }
              return parts.join(" · ");
            })()}
            failureLabel={t("market.backfill.failed", {
              defaultValue: "Couldn’t sync marketplace",
            })}
            hasSuccessChanges={(p) =>
              (p?.created || 0) + (p?.source_synced || 0) > 0 ||
              ((p?.scanned || 0) > 0 && (p?.skipped || 0) > 0)
            }
            testId="market-backfill-chip"
          />
        </div>

        <button
          type="button"
          className="market-sync-link"
          onClick={syncMarketplace}
          disabled={syncing}
          data-testid="sync-marketplace-btn"
        >
          <i className={`fa-solid fa-rotate ${syncing ? "fa-spin" : ""}`}></i>
          {syncing
            ? t("market.syncing", { defaultValue: "Syncing…" })
            : t("market.syncMarketplace", { defaultValue: "Sync from closet" })}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="market-mylistings-empty">
          <div className="market-empty-icon">
            <i className="fa-solid fa-shirt"></i>
          </div>
          <h2>{t("market.noMyListings")}</h2>
        </div>
      ) : (
        <div
          className="market-mylistings-grid"
          data-testid="market-my-listings-grid"
        >
          {items.map((l) => (
            <div
              key={l.id}
              className="market-mylisting-card"
              data-testid={`my-listing-card-${l.id}`}
            >
              <Link to={`/market/${l.id}`} className="market-mylisting-link">
                <div className="market-mylisting-image">
                  {(l.images || [])[0] ? (
                    <img src={l.images[0]} alt={l.title} />
                  ) : (
                    <div className="no-image">
                      <i className="fa-solid fa-image"></i>
                    </div>
                  )}
                  <div className="market-card-badge">
                    <SourceTagBadge source={l.source} mode={l.mode} />
                  </div>
                  <span
                    className={`market-mylisting-status market-status-${(l.status || "").toLowerCase()}`}
                  >
                    {l.status}
                  </span>
                </div>
                <div className="market-mylisting-body">
                  <div className="market-mylisting-title">{l.title}</div>
                </div>
              </Link>
              <div className="market-mylisting-footer">
                <Button
                  variant="ghost"
                  size="sm"
                  className="market-remove-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeListing(l);
                  }}
                  disabled={removingId === l.id}
                  data-testid={`my-listing-remove-${l.id}`}
                >
                  {removingId === l.id
                    ? t("market.removing", { defaultValue: "Removing…" })
                    : t("market.removeListing", {
                        defaultValue: "Remove listing",
                      })}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// transactions tab content
function InlineTransactions() {
  const { t } = useTranslation();
  const [tab, setTab] = useLocalStorageSync(
    "dressapp.marketplace.inlineTab",
    "buyer",
  );
  const { items, loading } = useCachedList(
    transactionsStore,
    { role: tab },
    {
      autoRefresh: true,
    },
  );
  return (
    <div className="market-tx">
      <div className="market-tx-toolbar">
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger
            className="market-tx-select"
            data-testid="tx-role-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer" data-testid="tx-tab-buyer">
              {t("transactions.buyer")}
            </SelectItem>
            <SelectItem value="seller" data-testid="tx-tab-seller">
              {t("transactions.seller")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <div className="caps-label text-muted-foreground">
          {t("market.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="market-tx-empty">
          <svg
            viewBox="0 0 200 160"
            className="market-tx-empty-illustration"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="100"
              cy="140"
              rx="70"
              ry="10"
              fill="var(--accent-beige)"
            />
            <rect
              x="55"
              y="35"
              width="90"
              height="95"
              rx="10"
              fill="#ffffff"
              stroke="rgba(31,92,69,0.18)"
              strokeWidth="2"
            />
            <line
              x1="70"
              y1="58"
              x2="130"
              y2="58"
              stroke="rgba(31,92,69,0.22)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="70"
              y1="74"
              x2="120"
              y2="74"
              stroke="rgba(31,92,69,0.16)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="70"
              y1="90"
              x2="125"
              y2="90"
              stroke="rgba(31,92,69,0.16)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="70"
              y1="106"
              x2="105"
              y2="106"
              stroke="rgba(31,92,69,0.16)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="140" cy="112" r="26" fill="var(--primary-color)" />
            <path
              d="M129 112 L137 120 L152 103"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M55 45 Q60 20 85 22"
              stroke="rgba(31,92,69,0.12)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M145 40 Q152 18 130 15"
              stroke="rgba(31,92,69,0.12)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <h2>{t("market.noTx")}</h2>
          <p>
            {tab === "buyer"
              ? t("transactions.emptyBuyerSub", {
                  defaultValue: "Items you purchase will show up here.",
                })
              : t("transactions.emptySellerSub", {
                  defaultValue: "Items you sell will show up here.",
                })}
          </p>
        </div>
      ) : (
        <div className="market-tx-table-wrap">
          <table className="market-tx-table" data-testid="tx-list">
            <thead>
              <tr>
                <th>
                  {t("transactions.listingCol", { defaultValue: "Listing" })}
                </th>
                <th>
                  {t("transactions.statusCol", { defaultValue: "Status" })}
                </th>
                <th>{t("transactions.dateCol", { defaultValue: "Date" })}</th>
                <th className="text-right">
                  {t("transactions.amountCol", { defaultValue: "Amount" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx.id} data-testid={`tx-row-${tx.id}`}>
                  <td className="market-tx-listing">
                    #{tx.listing_id.slice(0, 8)}
                  </td>
                  <td>
                    <span
                      className={`market-tx-status-pill market-tx-status-${(tx.status || "").toLowerCase()}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="market-tx-date">
                    {new Date(tx.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="text-right">
                    <div className="market-tx-amount">
                      {fmt(tx.financial?.gross_cents, tx.currency)}
                    </div>
                    <div className="market-tx-fee">
                      {t("market.sellerNet")}{" "}
                      {fmt(tx.financial?.seller_net_cents, tx.currency)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
