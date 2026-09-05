import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import {
  Search as SearchIcon,
  Globe,
  Phone,
  Mail,
  MapPin,
  UserRound,
  Sparkles,
  Megaphone,
} from 'lucide-react';
import { useLocation } from '@/lib/location';
import { AdTicker } from '@/components/AdTicker';
import { useAuth } from '@/lib/auth';
import { expertsStore } from '@/lib/expertsStore';
import { useCachedList } from '@/lib/createCachedStore';
import { useLocalStorageSync } from '@/lib/useLocalStorageSync';
import { CampaignFeed } from '@/components/CampaignFeed';
import noexpert from "../assets/img/noexpert.svg";
import expertsBannerImg from "../assets/img/inner6.webp";

/**
 * Experts directory — public-facing list of self-certified fashion pros.
 * Pre-filters by viewer's country when LocationProvider has coordinates.
 *
 * Tab bar: Experts | Campaigns
 *
 * NOTE: styling is now Tailwind-only — no external CSS classes.
 * Nothing about the data flow / API calls below has changed from the original.
 */
const INITIAL_FILTERS = {
  profession: '',
  country: '',
  region: '',
  q: '',
};

export default function ExpertsDirectory() {
  const { t } = useTranslation();
  const loc = useLocation?.();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'experts';

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // Two-state filter pattern: ``draft`` is bound to the inputs (every
  // keystroke), ``applied`` is the snapshot the cached store fetches.
  const [rawDraft, setDraft] = useLocalStorageSync('dressapp.experts.draftFilters', INITIAL_FILTERS);
  const draft = (rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft))
    ? { ...INITIAL_FILTERS, ...rawDraft }
    : INITIAL_FILTERS;

  const [rawApplied, setApplied] = useLocalStorageSync('dressapp.experts.appliedFilters', INITIAL_FILTERS);
  const applied = (rawApplied && typeof rawApplied === 'object' && !Array.isArray(rawApplied))
    ? { ...INITIAL_FILTERS, ...rawApplied }
    : INITIAL_FILTERS;

  useEffect(() => {
    if (!loc) return;
    setDraft((f) => ({
      ...f,
      country: f.country || loc.country_code || loc.country || '',
      region: f.region || loc.city || '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc?.country_code, loc?.city]);

  const expertParams = useMemo(() => {
    const p = {};
    if (applied.profession) p.profession = applied.profession;
    if (applied.country) p.country = applied.country;
    if (applied.region) p.region = applied.region;
    if (applied.q) p.q = applied.q;
    return p;
  }, [applied.profession, applied.country, applied.region, applied.q]);

  const { items, total, loading } = useCachedList(expertsStore, expertParams);

  const apply = () => setApplied({ ...draft });
  const clear = () => {
    const empty = { profession: '', country: '', region: '', q: '' };
    setDraft(empty);
    setApplied(empty);
  };

  const professions = useMemo(() => {
    const set = new Set((items || []).map((p) => p.professional?.profession).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const viewerIsPro = !!user?.professional?.is_professional;
  const showSkeleton = loading && (!items || items.length === 0);

  // Tab definitions
  const TABS = [
    { id: 'experts', label: t('experts.tabExperts', { defaultValue: 'Experts' }), Icon: UserRound },
    { id: 'campaigns', label: t('experts.tabCampaigns', { defaultValue: 'Campaigns' }), Icon: Megaphone },
  ];

  return (
    <>
      {/* banner-start */}
      <section
        className="relative isolate overflow-hidden bg-cover bg-center bg-no-repeat mt-20"
        style={{ backgroundImage: `url(${expertsBannerImg})` }}
      >
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
              <h1
                className="
                  m-0 mb-0 text-[40px] leading-[40px] font-bold tracking-normal text-white
                  max-[767px]:text-[42px] max-[480px]:text-[35px]
                "
                data-testid="experts-title"
              >
                {activeTab === 'campaigns' ? t('campaigns.feed.title') : t('experts.title')}
              </h1>
              <p
                className="
                  my-5 max-w-[450px] text-[14px] leading-6 tracking-[0.5px] text-white/60
                  max-[767px]:max-w-full max-[767px]:mt-[15px]
                "
              >
                {activeTab === 'campaigns' ? t('campaigns.feed.subtitle') : t('experts.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--accent-beige)] px-10 py-10 max-[991px]:px-[5px] max-[991px]:py-10">
        <div className="w-full">
          {/* tabs */}
          <div
            role="tablist"
            aria-label={t('experts.tabBar')}
            className="inline-flex items-center gap-1 p-[5px] bg-white rounded-full my-5 overflow-x-auto max-w-full"
          >
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setTab(id)}
                data-testid={`experts-tab-${id}`}
                className={`
                  inline-flex items-center gap-1.5 whitespace-nowrap
                  px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300
                  ${
                    activeTab === id
                      ? 'bg-[var(--primary-color)] text-white'
                      : 'bg-transparent text-[#666] hover:bg-[var(--primary-shadow)] hover:text-[var(--primary-color)]'
                  }
                `}
              >
                <Icon className={`h-4 w-4 ${activeTab === id ? 'text-white' : ''}`} />
                {label}
              </button>
            ))}
          </div>

          {/* ---- EXPERTS TAB ---- */}
          {activeTab === 'experts' && (
            <>
              {/* Filters */}
              <div
                className="bg-white rounded-[20px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] p-5 mb-5"
                data-testid="experts-filter-card"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-12">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <h6 className="text-base font-extrabold text-[var(--dark-color)] mb-0 flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-[var(--primary-color)] text-sm" />
                        Filters
                      </h6>
                      {activeTab === 'experts' && (
                        <span
                          data-testid="experts-count-badge"
                          className="
                            relative inline-flex items-center
                            pl-5 pr-4 py-1.5
                            bg-[var(--accent-beige)] rounded-full
                            text-xs font-extrabold text-[var(--primary-color)] whitespace-nowrap
                            before:content-[''] before:absolute before:left-[9px] before:top-1/2
                            before:-translate-y-1/2 before:w-[5px] before:h-[5px]
                            before:rounded-full before:bg-[var(--primary-color)]
                          "
                        >
                          {t('experts.countLabel', { count: total })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex flex-col">
                      <label className="text-sm font-bold text-[#666] mb-2.5">{t('experts.filters.search')}</label>
                      <div className="relative">
                        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-color)] pointer-events-none" />
                        <input
                          value={draft.q}
                          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="
                            w-full h-[46px] rounded-xl border border-black/10 bg-[#fdfdfb]
                            px-3.5 pr-10 text-sm text-[var(--dark-color)]
                            focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10
                            focus:outline-none transition
                          "
                          placeholder={t('experts.filters.search')}
                          data-testid="experts-filter-search"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex flex-col">
                      <label className="text-sm font-bold text-[#666] mb-2.5">{t('experts.filters.profession')}</label>
                      <div className="relative">
                        <input
                          list="experts-profession-suggestions"
                          value={draft.profession}
                          onChange={(e) => setDraft({ ...draft, profession: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="
                            w-full h-[46px] rounded-xl border border-black/10 bg-[#fdfdfb]
                            px-3.5 text-sm text-[var(--dark-color)]
                            focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10
                            focus:outline-none transition
                          "
                          placeholder={t('experts.filters.anyProfession')}
                          data-testid="experts-filter-profession"
                        />
                        <datalist id="experts-profession-suggestions">
                          {professions.map((p) => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex flex-col">
                      <label className="text-sm font-bold text-[#666] mb-2.5">{t('experts.filters.country')}</label>
                      <div className="relative">
                        <input
                          value={draft.country}
                          onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="
                            w-full h-[46px] rounded-xl border border-black/10 bg-[#fdfdfb]
                            px-3.5 text-sm text-[var(--dark-color)]
                            focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10
                            focus:outline-none transition
                          "
                          placeholder={t('pages.expertsDirectory.il_us_fr')}
                          data-testid="experts-filter-country"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex flex-col">
                      <label className="text-sm font-bold text-[#666] mb-2.5">{t('experts.filters.region')}</label>
                      <div className="relative">
                        <input
                          value={draft.region}
                          onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="
                            w-full h-[46px] rounded-xl border border-black/10 bg-[#fdfdfb]
                            px-3.5 text-sm text-[var(--dark-color)]
                            focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10
                            focus:outline-none transition
                          "
                          data-testid="experts-filter-region"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 mt-[18px] flex-wrap">
                  <button
                    onClick={apply}
                    disabled={loading}
                    data-testid="experts-apply-filters"
                    className="
                      inline-flex items-center gap-2
                      bg-[var(--primary-color)] hover:bg-[var(--dark-color)]
                      text-white text-xs font-semibold rounded-full px-5 py-2.5
                      transition disabled:opacity-60
                    "
                  >
                    {t('common.search', { defaultValue: 'Search' })}
                  </button>
                  <button
                    onClick={clear}
                    disabled={loading}
                    data-testid="experts-clear-filters"
                    className="
                      inline-flex items-center gap-2
                      border border-[#666] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]
                      text-xs font-semibold rounded-full px-5 py-2.5
                      transition disabled:opacity-60
                    "
                  >
                    {t('experts.filters.clear')}
                  </button>
                  {!viewerIsPro && (
                    <Link
                      to="/me"
                      data-testid="experts-become-pro-cta"
                      className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-color)] hover:underline"
                    >
                      <Sparkles className="h-3 w-3" />
                      {t('experts.becomeExpertCta')}
                    </Link>
                  )}
                </div>
              </div>

              {showSkeleton ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[190px] rounded-2xl bg-[var(--accent-beige)] animate-pulse"
                    />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div
                  className="bg-white rounded-xl shadow-[0_12px_35px_rgba(27,45,35,0.06)]"
                  data-testid="experts-empty"
                >
                  <div className="p-10 md:p-20">
                    <div className="flex items-center justify-center mb-0">
                      <img src={noexpert} className="h-[250px] object-cover" alt="" />
                    </div>
                    <div className="flex justify-center items-center">
                      <div className="text-center">
                        <h2 className="text-[30px] font-bold leading-10 text-black mb-1.5">
                          {t("experts.emptyTitle")}
                        </h2>
                        <p className="text-[#686f6b] text-base leading-relaxed max-w-[560px] mx-auto mt-3.5">
                          {t("experts.emptyBody")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="experts-grid">
                  {items.map((p) => (
                    <ExpertCard key={p.id} expert={p} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---- CAMPAIGNS TAB ---- */}
          {activeTab === 'campaigns' && (
            <>
              {viewerIsPro && (
                <div className="flex justify-end gap-2.5 mb-4 flex-wrap">
                  <Link
                    to="/campaigns/mine"
                    data-testid="experts-campaigns-manage-btn"
                    className="
                      inline-flex items-center gap-2
                      border border-[var(--primary-color)] text-[var(--primary-color)]
                      hover:bg-[var(--primary-shadow)]
                      rounded-full px-5 py-2.5 text-sm font-semibold transition
                    "
                  >
                    {t('campaigns.mine.title', { defaultValue: 'My Campaigns' })}
                  </Link>
                  <Link
                    to="/campaigns/create"
                    data-testid="experts-campaigns-create-btn"
                    className="
                      inline-flex items-center gap-2
                      bg-[var(--primary-color)] hover:bg-[var(--dark-color)]
                      text-white rounded-full px-5 py-2.5 text-sm font-semibold transition
                    "
                  >
                    <Megaphone className="h-4 w-4" />
                    {t('campaigns.mine.createNew')}
                  </Link>
                </div>
              )}
              <CampaignFeed />
            </>
          )}
        </div>

        {/* Regional ad ticker at the bottom */}
        <AdTicker placement="experts" className="mt-6" />
        {/* <ExploreBackButton /> */}
      </section>
    </>
  );
}

function ExpertCard({ expert }) {
  const { t } = useTranslation();
  const prof = expert.professional || {};
  const biz = prof.business || {};
  const city =
    expert.home_location?.city ||
    expert.address?.city ||
    expert.address?.region ||
    expert.home_location?.country ||
    expert.address?.country;

  const avatar = expert.face_photo_url || expert.avatar_url;
  const expertPhone =
    expert.phone && expert.phone.trim().length > 3
      ? expert.phone.trim()
      : biz.phone && biz.phone.trim().length > 3
      ? biz.phone.trim()
      : null;

  return (
    <div data-testid={`expert-card-${expert.id}`}>
      <div
        className="
          bg-white border border-black/[0.06] rounded-xl p-6 text-center h-full
          shadow-sm hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] hover:-translate-y-2
          transition-all duration-300
        "
      >
        <div className="relative w-[92px] h-[92px] mx-auto mb-4">
          {avatar ? (
            <img
              src={avatar}
              alt={expert.display_name}
              className="w-full h-full rounded-full object-cover border-[3px] border-white shadow-md"
            />
          ) : (
            <UserRound className="w-full h-full text-[var(--primary-color)]" />
          )}
          <span
            className="
              absolute bottom-0.5 right-0.5 w-6 h-6
              bg-[var(--primary-color)] text-white border-2 border-white rounded-full
              inline-flex items-center justify-center text-xs
            "
          >
            <i className="bi bi-patch-check-fill" />
          </span>
        </div>

        <h5 className="text-[var(--dark-color)] font-extrabold text-base mb-2.5">{expert.display_name}</h5>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-3.5">
          {prof.profession && (
            <span className="inline-block bg-[var(--primary-shadow)] text-[var(--primary-color)] text-[11px] uppercase tracking-wide font-bold px-3.5 py-1 rounded-full">
              {prof.profession}
            </span>
          )}
          {biz.name && (
            <span className="inline-block bg-[var(--primary-shadow)] text-[var(--primary-color)] text-[11px] uppercase tracking-wide font-bold px-3.5 py-1 rounded-full">
              {biz.name}
            </span>
          )}
        </div>

        {city && (
          <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--dark-color)] mb-3.5">
            <MapPin className="h-4 w-4 text-[var(--primary-color)]" />
            {city}
          </div>
        )}

        {biz.description && (
          <p className="text-sm leading-relaxed text-[var(--text-color)] mb-5 min-h-[44px]">{biz.description}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {biz.website && (
            
             <a href={biz.website}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`expert-${expert.id}-website`}
              className="
                flex-1 inline-flex items-center justify-center gap-1
                border border-[var(--primary-color)] text-[var(--primary-color)]
                hover:bg-[var(--primary-color)] hover:text-white
                rounded-full px-2 py-2 text-xs font-bold transition
              "
            >
              <Globe className="h-3.5 w-3.5" />
              {t('experts.visitWebsite')}
            </a>
          )}
          {expertPhone && (
            
              <a href={`tel:${expertPhone}`}
              data-testid={`expert-${expert.id}-phone`}
              className="
                flex-1 inline-flex items-center justify-center gap-1
                border border-[var(--primary-color)] text-[var(--primary-color)]
                hover:bg-[var(--primary-color)] hover:text-white
                rounded-full px-2 py-2 text-xs font-bold transition
              "
            >
              <Phone className="h-3.5 w-3.5" />
              {t('experts.callNow')}
            </a>
          )}
          {biz.email && (
            
              <a href={`mailto:${biz.email}`}
              data-testid={`expert-${expert.id}-email`}
              className="
                flex-1 inline-flex items-center justify-center gap-1
                border border-[var(--primary-color)] text-[var(--primary-color)]
                hover:bg-[var(--primary-color)] hover:text-white
                rounded-full px-2 py-2 text-xs font-bold transition
              "
            >
              <Mail className="h-3.5 w-3.5" />
              {t('experts.sendEmail')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}