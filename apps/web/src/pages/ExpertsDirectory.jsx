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

/**
 * Experts directory — public-facing list of self-certified fashion pros.
 * Pre-filters by viewer's country when LocationProvider has coordinates.
 *
 * Tab bar: Experts | Campaigns
 *
 * NOTE: styling lives in ./experts-directory.css — this file only owns
 * markup, state, and data. Nothing about the data flow / API calls below
 * has changed from the original.
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
      <section className="closet-banner">
        <div className="container-fluid">
          <div className="closet-banner__content">
            <div className="closet-banner__title-row">
              {/* <div className="experts-eyebrow">{t('nav.experts')}</div> */}
              <h1 className="hero-title" data-testid="experts-title">
                {activeTab === 'campaigns' ? t('campaigns.feed.title') : t('experts.title')}
              </h1>
              <p className="hero-description">
                {activeTab === 'campaigns' ? t('campaigns.feed.subtitle') : t('experts.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="experts-page">
        <div className="container-fluid">
          {/* tabs */}
          <div className="experts-tabs" role="tablist" aria-label={t('experts.tabBar')}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => setTab(id)}
                className={`experts-tab${activeTab === id ? ' is-active' : ''}`}
                data-testid={`experts-tab-${id}`}>
                <Icon className="experts-tab-icon" />
                {label}
              </button>
            ))}
          </div>
          {/* ---- EXPERTS TAB ---- */}
          {activeTab === 'experts' && (
            <>
              {/* Filters */}
              <div className="filter-card" data-testid="experts-filter-card">
                <div className="row">
                  <div className='col-md-12'>
                    <div className='expert-main'>
                      <div class=""><h6><i class="fa-solid fa-sliders me-2"></i>Filters</h6></div>
                      {activeTab === 'experts' && (
                        <span className="experts-count-tag" data-testid="experts-count-badge">
                          {t('experts.countLabel', { count: total })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="field-set">
                      <label>{t('experts.filters.search')}</label>
                      <div className="filter-input-wrap has-icon">
                        <SearchIcon className="filter-search-icon" />
                        <input
                          value={draft.q}
                          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="createlisting-input"
                          placeholder={t('experts.filters.search')}
                          data-testid="experts-filter-search"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="field-set">
                      <label>{t('experts.filters.profession')}</label>
                      <div className="filter-input-wrap">
                        <input
                          list="experts-profession-suggestions"
                          value={draft.profession}
                          onChange={(e) => setDraft({ ...draft, profession: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="createlisting-input"
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
                  <div className="col-md-3">
                    <div className="field-set">
                      <label>{t('experts.filters.country')}</label>
                      <div className="filter-input-wrap">
                        <input
                          value={draft.country}
                          onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="createlisting-input"
                          placeholder={t('pages.expertsDirectory.il_us_fr')}
                          data-testid="experts-filter-country"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="field-set">
                      <label>{t('experts.filters.region')}</label>
                      <div className="filter-input-wrap">
                        <input
                          value={draft.region}
                          onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && apply()}
                          className="createlisting-input"
                          data-testid="experts-filter-region"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="filter-actions">
                  <button
                    onClick={apply}
                    disabled={loading}
                    className="btn-edit-icon"
                    data-testid="experts-apply-filters"
                  >
                    {t('common.search', { defaultValue: 'Search' })}
                  </button>
                  <button
                    onClick={clear}
                    disabled={loading}
                    className="btn-pill hover-item"
                    data-testid="experts-clear-filters"
                  >
                    {t('experts.filters.clear')}
                  </button>
                  {!viewerIsPro && (
                    <Link to="/me" className="become-pro-link" data-testid="experts-become-pro-cta">
                      <Sparkles />
                      {t('experts.becomeExpertCta')}
                    </Link>
                  )}
                </div>
              </div>
              {showSkeleton ? (
                <div className="row gx-3 gy-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="col-xl-4 col-lg-4 col-md-6 col-12">
                      <div className="skeleton-card" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="card closet-empty-card" data-testid="experts-empty">
                  <div className='card-body'>
                    <div className="closet-empty-card__visual mb-0">
                      <img src={noexpert} />
                    </div>
                    <div className="closet-empty-card__content">
                      <div className='text-center'>
                        <h2>{t("experts.emptyTitle")}</h2>
                        <p>{t("experts.emptyBody")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row gx-3 gy-3" data-testid="experts-grid">
                  {items.map((p) => (
                    <div key={p.id} className="col-xl-4 col-lg-4 col-md-6 col-12">
                      <ExpertCard expert={p} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---- CAMPAIGNS TAB ---- */}
          {activeTab === 'campaigns' && (
            <>
              {viewerIsPro && (
                <div className="campaigns-actions">
                  <Link to="/campaigns/mine" className="btn btn-outline" data-testid="experts-campaigns-manage-btn">
                    {t('campaigns.mine.title', { defaultValue: 'My Campaigns' })}
                  </Link>
                  <Link to="/campaigns/create" className="btn btn-primary" data-testid="experts-campaigns-create-btn">
                    <Megaphone className="btn-icon" />
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
    <div className="expert-card" data-testid={`expert-card-${expert.id}`}>
      <div className="expert-pro-card">
        <div className="expert-avatar-wrap">
          {avatar ? (
            <img src={avatar} alt={expert.display_name} className="expert-avatar" />
          ) : (
            <UserRound className="expert-avatar-fallback" />
          )}
          <span className="expert-avatar-badge"><i className="bi bi-patch-check-fill"></i></span>
        </div>
        <h5>{expert.display_name}</h5>
        {prof.profession && <span className="expert-spec-tag">{prof.profession}</span>}
        {biz.name && <span className="expert-spec-tag">{biz.name}</span>}
        <div className="expert-rating-row">
          {city && (
            <>
              <MapPin />
              {city}
            </>
          )}
        </div>
        {biz.description && <p className="expert-bio">{biz.description}</p>}
        <div className="expert-actions">
          {biz.website && (
            <a
              href={biz.website}
              target="_blank"
              rel="noopener noreferrer"
              className="expert-book-btn"
              data-testid={`expert-${expert.id}-website`}
            >
              <Globe className="btn-icon" />
              {t('experts.visitWebsite')}
            </a>
          )}
          {expertPhone && (
            <a href={`tel:${expertPhone}`} className="expert-book-btn" data-testid={`expert-${expert.id}-phone`}>
              <Phone className="btn-icon" />
              {t('experts.callNow')}
            </a>
          )}
          {biz.email && (
            <a href={`mailto:${biz.email}`} className="expert-book-btn" data-testid={`expert-${expert.id}-email`}>
              <Mail className="btn-icon" />
              {t('experts.sendEmail')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
