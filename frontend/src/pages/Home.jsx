import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  CloudSun,
  Calendar,
  ArrowRight,
  RefreshCw,
  Loader2,
  ExternalLink,
  Crown,
  Footprints,
  Leaf,
  Users,
  Recycle,
  Newspaper,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useClosetStore } from '@/lib/useClosetStore';
import { useLocation as useAppLocation } from '@/lib/location';
import { api } from '@/lib/api';
import { AdTicker } from '@/components/AdTicker';
import { LanguagePicker } from '@/components/LanguagePicker';
import { toast } from 'sonner';
import cloudyImg from "../assets/img/cloudy.png";
import Calender from "../assets/img/calendar.png";
import Capture from "../assets/img/capture.png";
import Analysis from "../assets/img/analytics.png";
import Closet from "../assets/img/closet.png";
import Effect from "../assets/img/effect.png";
import closet1 from "../assets/img/closet1.jpg";
import closet2 from "../assets/img/closet2.jpg";
import closet3 from "../assets/img/closet3.jpg";
import added1 from "../assets/img/added1.jpg";
import added2 from "../assets/img/added2.jpg";
import added3 from "../assets/img/added3.jpg";
import added4 from "../assets/img/added4.jpg";
import expert1 from "../assets/img/expert1.jpg";
import expert2 from "../assets/img/expert2.jpg";
import expert3 from "../assets/img/expert3.jpg";
import expert4 from "../assets/img/expert4.jpg";
import market1 from "../assets/img/market1.jpg";
import market2 from "../assets/img/market2.jpg";
import market3 from "../assets/img/market3.jpg";
import market4 from "../assets/img/market4.jpg";
import editor from "../assets/img/editor.jpg";

// Fallback cards used only if the Trend-Scout endpoint fails or returns empty.
// Shape mirrors the real API (``label``, ``headline``, ``summary``) so the
// renderer below can read ONE consistent set of fields. The actual strings
// live in ``home.fallbackTrends.fbN`` in every locale JSON — see
// ``buildFallbackTrends(t)`` in the component below.
const FALLBACK_TREND_KEYS = ['fb1', 'fb2', 'fb3'];

const FALLBACK_TREND_BUCKETS = {
  fb1: 'ss26-runway',
  fb2: 'street',
  fb3: 'sustainability',
};

// Per-bucket visual treatment for Trend-Scout cards.
//
// The underlying ``image_url`` field returned by the API is generated
// by the LLM and is NOT a reliable representation of the article
// content (it's a plausible-looking but hallucinated stock photo).
// Showing those mis-leads the user, so we drop the image entirely and
// substitute a small bucket icon in a tinted header band. The icon
// gives the card a recognisable identity without lying about what
// the article is about. The source link below the body lets readers
// jump to the actual article when one is provided.
const BUCKET_VISUALS = {
  'ss26-runway': { Icon: Crown, tone: 'bg-secondary/60' },
  street: { Icon: Footprints, tone: 'bg-secondary/60' },
  sustainability: { Icon: Leaf, tone: 'bg-secondary/60' },
  influencers: { Icon: Users, tone: 'bg-secondary/60' },
  second_hand: { Icon: Recycle, tone: 'bg-secondary/60' },
  recycling: { Icon: Recycle, tone: 'bg-secondary/60' },
  news_flash: { Icon: Newspaper, tone: 'bg-secondary/60' },
};
const DEFAULT_BUCKET_VISUAL = { Icon: Sparkles, tone: 'bg-secondary/60' };

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const closet = useClosetStore();
  const loc = useAppLocation();
  const isAdmin = (user?.roles || []).includes('admin');
  const [counts, setCounts] = useState(null);
  const [trends, setTrends] = useState(null); // null = loading, [] = empty, [...]
  const [trendDate, setTrendDate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = [
    "/assets/img/slide1.avif",
    "/assets/img/slide2.avif",
    "/assets/img/slide3.avif",
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4200);

    return () => clearInterval(interval);
  }, []);
  // Localised fallback cards — rebuilt whenever the active language
  // changes so a mid-session language switch immediately re-renders
  // the cards in the new locale. Bucket slugs match the BUCKETS list
  // in ``backend/app/services/trend_scout.py`` so the chip pill
  // also picks up the correct localised label.
  const FALLBACK_TRENDS = useMemo(
    () =>
      FALLBACK_TREND_KEYS.map((key, idx) => ({
        id: `fb-${idx + 1}`,
        bucket: FALLBACK_TREND_BUCKETS[key],
        label: t(`home.fallbackTrends.${key}.label`, {
          defaultValue: '',
        }),
        headline: t(`home.fallbackTrends.${key}.headline`, {
          defaultValue: '',
        }),
        summary: t(`home.fallbackTrends.${key}.summary`, {
          defaultValue: '',
        }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  // Resolve language + country for the personalized fashion-scout
  // call. Same pattern the Stylist FashionScoutPanel uses so both
  // surfaces hit the same cache key. The endpoint also picks up the
  // logged-in user automatically (auth header) and re-ranks the
  // candidate pool by the viewer's gender/profession/occupation.
  const language = (user?.preferred_language || i18n.language || 'en')
    .split('-')[0]
    .toLowerCase();
  const country =
    (loc?.country_code || user?.home_location?.country_code || '')
      .toString()
      .toUpperCase() || null;

  // Pulled into a callback so the admin "🔄 refresh" button can re-fetch
  // the same trends without duplicating logic. The ``setTrends(null)``
  // gate keeps the skeletons visible during the LLM run (~5–10 s).
  const fetchTrends = async () => {
    try {
      // Top 4 personalized cards. The backend uses our auth header to
      // rank a wider candidate pool against the user's demographics
      // and slices to limit=4 — we don't need to send any extra
      // ranking hints from the client.
      const res = await api.fashionScoutFeed(4, { language, country });
      if (res?.cards?.length) {
        setTrends(res.cards);
        setTrendDate(res.cards[0]?.date || null);
      } else {
        setTrends([]);
      }
    } catch {
      setTrends([]);
    }
  };

  // Admin-only handler. We fire ``trendsRefreshAdmin({ force: true })``
  // so today's cards are regenerated even if they already exist
  // (otherwise the dedupe in ``run_trend_scout`` would skip the call
  // and the user would see no change). The endpoint is ~5–10 seconds
  // because it makes one Gemini call per bucket; we surface a toast
  // both on success and on failure so the user knows where they stand.
  const refreshTrends = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setTrends(null); // restore skeletons while we wait
    try {
      await api.trendsRefreshAdmin(true);
      await fetchTrends();
      toast.success(t('home.trendsRefreshed', { defaultValue: 'Trends refreshed' }));
    } catch (err) {
      toast.error(
        err?.response?.data?.detail
        || t('home.trendsRefreshFailed', { defaultValue: 'Could not refresh trends' }),
      );
      // Recover the stale view so the section isn't stuck on skeletons.
      await fetchTrends();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Read closet count straight from the global store (already
        // populated by AppLayout's prewarm) — no extra round-trip.
        // Marketplace count is still server-side because we don't
        // store all listings client-side.
        const market = await api.listListings({ limit: 1, status: 'active' });
        setCounts({
          closet: closet.total || (closet.items?.length ?? 0),
          market: market.total || 0,
        });
      } catch { setCounts({ closet: closet.total || 0, market: 0 }); }
    })();
    fetchTrends();
    // We intentionally only run this once per mount; closet.total
    // updates flow through the dedicated effect below so the chip
    // stays accurate after add/delete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the closet chip in sync with store mutations from elsewhere
  // in the app (AddItem, ItemDetail delete, etc.) without a refetch.
  useEffect(() => {
    setCounts((prev) => {
      const closetCount = closet.total || (closet.items?.length ?? 0);
      if (prev && prev.closet === closetCount) return prev;
      return { closet: closetCount, market: prev?.market ?? 0 };
    });
  }, [closet.total, closet.items]);
  useEffect(() => {
    const sliderElement = document.querySelector(".trend-swiper");

    if (!window.Swiper || !sliderElement) {
      console.error("Swiper library or slider element not found");
      return undefined;
    }

    if (sliderElement.swiper) {
      sliderElement.swiper.destroy(true, true);
    }

    const trendSwiper = new window.Swiper(sliderElement, {
      slidesPerView: 1.15,
      spaceBetween: 15,
      loop: true,
      speed: 800,

      autoplay: {
        delay: 2500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      },

      navigation: {
        nextEl: ".trend-swiper-next",
        prevEl: ".trend-swiper-prev",
      },

      breakpoints: {
        576: {
          slidesPerView: 2,
          spaceBetween: 15,
        },
        992: {
          slidesPerView: 3,
          spaceBetween: 15,
        },
        1200: {
          slidesPerView: 4,
          spaceBetween: 15,
        },
      },
    });

    return () => {
      if (trendSwiper && !trendSwiper.destroyed) {
        trendSwiper.destroy(true, true);
      }
    };
  }, []);
  useEffect(() => {
    const sliderElement = document.querySelector(".market-swiper");

    if (!window.Swiper || !sliderElement) {
      return undefined;
    }

    if (sliderElement.swiper) {
      sliderElement.swiper.destroy(true, true);
    }

    const marketSwiper = new window.Swiper(sliderElement, {
      slidesPerView: 1.15,
      spaceBetween: 15,
      loop: true,
      speed: 800,

      autoplay: {
        delay: 2500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      },

      navigation: {
        nextEl: ".market-swiper-next",
        prevEl: ".market-swiper-prev",
      },

      breakpoints: {
        576: {
          slidesPerView: 2,
          spaceBetween: 15,
        },
        992: {
          slidesPerView: 3,
          spaceBetween: 15,
        },
        1200: {
          slidesPerView: 4,
          spaceBetween: 15,
        },
      },
    });

    return () => {
      if (!marketSwiper.destroyed) {
        marketSwiper.destroy(true, true);
      }
    };
  }, []);
  const trendSlides = [
    {
      id: 1,
      tag: "Runway Report",
      title: "Relaxed tailoring dominance",
      image:
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=600",
    },
    {
      id: 2,
      tag: "Street Style",
      title: "Monochromatic utility earth tones",
      image:
        "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?q=80&w=600",
    },
    {
      id: 3,
      tag: "Sustainability",
      title: "Regenerative organic linen and cotton",
      image:
        "https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=600",
    },
    {
      id: 4,
      tag: "Influencer Focus",
      title: "Functional gorpcore accessories",
      image:
        "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=600",
    },
    {
      id: 5,
      tag: "Editorial Pick",
      title: "Statement outerwear layering",
      image:
        "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=600",
    },
  ];
  const marketplaceItems = [
    {
      id: 1,
      badge: "Sell Only",
      title: "Vintage Denim Jacket",
      price: "$140",
      condition: "Pristine (9.5/10)",
      location: "Copenhagen, DK",
      image: market1,
    },
    {
      id: 2,
      badge: "Swap / Donate",
      title: "Silk Pattern Scarf",
      price: "$45",
      condition: "Excellent (9/10)",
      location: "Paris, FR",
      image: market2,
    },
    {
      id: 3,
      badge: "Sell & Swap",
      title: "Minimalist Sneakers",
      price: "$95",
      condition: "Very Good (8.5/10)",
      location: "Milan, IT",
      image: market3,
    },
    {
      id: 4,
      badge: "Sell Only",
      title: "Over-Sized Wool Coat",
      price: "$320",
      condition: "Perfect (10/10)",
      location: "Stockholm, SE",
      image: market4,
    },
    {
      id: 5,
      badge: "Sell & Swap",
      title: "Navy Tech Blazer",
      price: "$180",
      condition: "Excellent (9/10)",
      location: "Berlin, DE",
      image: closet1,
    },
  ];
  const firstName = (user?.display_name || user?.email || '').split(/\s|@/)[0];

  return (
    <>
      {/* banner-start */}
      <section className="hero-section" id="home">
        <div className="container-fluid p-0">
          <div className="row g-0 align-items-center">
            <div className="col-md-5">
              <div className="hero-content-col">
                <div className="">
                  <span className="hero-eyebrow wow fadeInDown" data-wow-duration="0.9s"><i
                    className="bi bi-stars"></i> AI wardrobe assistant for everyday
                    styling</span>
                  <h1 className="hero-title wow fadeInLeft" data-wow-delay="0.15s" data-testid="home-greeting">
                    {t('home.greeting')} <span>{firstName || t('home.greetingFallback')}</span>
                  </h1>
                  <p className="hero-description wow fadeInLeft" data-wow-delay="0.3s">
                    {t('home.stylistWarmed')}
                  </p>
                  <div className="hero-actions wow fadeInUp" data-wow-delay="0.45s">
                    <Button asChild className="custm-btn" data-testid="home-ask-stylist-cta">
                      <Link to="/stylist"><i className="bi bi-stars me-2"></i>{t('home.askStylist')}</Link>
                    </Button>
                    <Button asChild variant="secondary" className="btn-premium-secondary" data-testid="home-closet-cta">
                      <Link to="/closet">{t('home.openCloset')}<i className="fa-solid fa-arrow-right ms-2"></i></Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-7 hero-media-col">
              <div className="hero-lifestyle-container">
                {/* weather image */}
                <div className="floating-widget hero-weather-card wow fadeInRight" data-wow-delay="0.3s">
                  <div className="hero-widget-icon">
                    <img src={cloudyImg} alt="Cloudy" />
                  </div>
                  <div>
                    <div className="hero-widget-kicker">Tomorrow</div>
                    <div className="hero-widget-title">18 deg C - Light Rain</div>
                    <div className="hero-widget-copy">AI Ready Outfit</div>
                  </div>
                </div>
                <div className="floating-widget widget-outfit wow fadeInLeft" data-wow-delay="0.5s">
                  <div className="hero-outfit-header">
                    <span>Today's Suggestion</span>
                    <span className="badge bg-success-subtle text-success">98%
                      Match</span>
                  </div>
                  <div className="hero-outfit-body">
                    <div className="hero-outfit-icon">
                      <img src={Calender} alt="Cloudy" />
                    </div>
                    <div>
                      <h6>Nordic Autumn Layer</h6>
                      <p>Navy Blazer + Knit Sweater</p>
                    </div>
                  </div>
                </div>
                <div className="hero-editorial-img-wrapper hero-fashion-slider wow fadeIn" data-wow-delay="0.2s">
                  {slides.map((image, index) => (
                    <div key={image} className={`hero-slide ${activeSlide === index ? "active" : ""}`}>
                      <img src={image} alt={`Fashion slide ${index + 1}`} />
                    </div>
                  ))}
                  <div className="hero-slider-dots" aria-label="Fashion banner slider">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={activeSlide === index ? "active" : ""}
                        aria-label={`Show slide ${index + 1}`}
                        onClick={() => setActiveSlide(index)}
                      />
                    ))}
                  </div>
                  <div className="hero-editorial-meta">
                    <span>Fashion Editor Preview</span>
                    <strong>Capsule looks curated for your day</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* how-it-works-section-start */}
      <section className="howworks-section" id="how-it-works">
        <div className="container-fluid">
          <div className="section-heading text-center wow fadeInDown">
            <span className="section-tag">Seamless Process</span>
            <h2>Revolutionizing Wardrobe Management</h2>
            <p style={{ margin: "0 auto" }}>Getting beautifully dressed is now a four-step modern workflow managed by
              advanced Artificial
              Intelligence.</p>
          </div>
          <div className="howworks-row">
            <div className="hw-item wow fadeInUp" data-wow-delay="0.1s">
              <div className="hw-card">
                <span className="hw-ghost-num">01</span>
                <div className="hw-icon"><img src={Capture} alt="capture cloth" /></div>
                <h4>Capture Clothes</h4>
                <p>Snap a quick photo of your actual garments. Works beautifully
                  with all lightings and backgrounds.</p>
              </div>
              <span className="hw-arrow"><i className="bi bi-arrow-right"></i></span>
            </div>
            <div className="hw-item wow fadeInUp" data-wow-delay="0.25s">
              <div className="hw-card">
                <span className="hw-ghost-num">02</span>
                <div className="hw-icon"><img src={Analysis} alt="attribute analysis" /></div>
                <h4>AI Attribute Analysis</h4>
                <p>Our vision models detect colors, pattern, fabrics, cuts, and
                  categories instantly and automatically.</p>
              </div>
              <span className="hw-arrow"><i className="bi bi-arrow-right"></i></span>
            </div>
            <div className="hw-item wow fadeInUp" data-wow-delay="0.4s">
              <div className="hw-card">
                <span className="hw-ghost-num">03</span>
                <div className="hw-icon"><img src={Closet} alt="smart closet" /></div>
                <h4>Build Smart Closet</h4>
                <p>Your clothing catalogs itself elegantly into categorization
                  systems like Zara/COS online designs.</p>
              </div>
              <span className="hw-arrow"><i className="bi bi-arrow-right"></i></span>
            </div>
            <div className="hw-item wow fadeInUp" data-wow-delay="0.55s">
              <div className="hw-card">
                <span className="hw-ghost-num">04</span>
                <div className="hw-icon"><img src={Effect} alt="daily style" />
                  <h4>Get Styled Daily</h4>
                  <p>Receive daily styled outfits contextualized to your precise
                    geolocation weather and calendar meetings.</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
      {/* closet-section-start */}
      <section className="closet-rail-section" id="closet">
        <div className="container-fluid">
          <div className="row align-items-center gx-3">
            <div className="col-md-4">
              <div className="section-heading wow fadeInLeft">
                <span className="section-tag">Your Digital Wardrobe</span>
                <h2>Every Piece Finds Its Place</h2>
                <p>Photograph anything you own — DressApp reads the fabric, the cut, the colour,
                  and files it away like a stylist would: tagged, catalogued, ready to be pulled the moment
                  you need it.</p>
                <p>No more forgotten drawers. Search by keyword, or just describe a feeling —
                  "something warm for a rainy Monday" — and the right piece finds its way back to you.</p>
                <a href="/closet" className="custm-btn">Start Building Your Closet<i className="fa-solid fa-arrow-right ms-2"></i></a>
              </div>
            </div>
            <div className="col-md-8">
              <div className="rail-visual wow fadeInRight" data-wow-delay="0.2s">
                <div className="rail-bar-wrap">
                  <div className="rail-bar"></div>
                  <span className="rail-count-badge"><i className="bi bi-stars"></i> 3 new this week</span>
                </div>
                <div className="garment-row">
                  <div className="garment garment-1">
                    <div className="hanger-hook"></div>
                    <div className="garment-card">
                      <img src={closet1} alt="Navy blazer" />
                    </div>
                    <div className="swing-tag">
                      <span className="tag-cat">Outerwear</span>
                      <span className="tag-name">Navy Tech Blazer</span>
                      <span className="tag-meta">No. 014 — Waterproof</span>
                    </div>
                  </div>
                  <div className="garment garment-2">
                    <div className="hanger-hook"></div>
                    <div className="garment-card">
                      <img src={closet2} alt="Grey knit sweater" />
                    </div>
                    <div className="swing-tag">
                      <span className="tag-cat">Knitwear</span>
                      <span className="tag-name">Merino Crewneck</span>
                      <span className="tag-meta">No. 027 — Ash Grey</span>
                    </div>
                  </div>
                  <div className="garment garment-3">
                    <div className="hanger-hook"></div>
                    <div className="garment-card">
                      <img src={closet3} alt="White dress shirt" />
                    </div>
                    <div className="swing-tag">
                      <span className="tag-cat">Top Layer</span>
                      <span className="tag-name">Cotton Dress Shirt</span>
                      <span className="tag-meta">No. 041 — Chalk White</span>
                    </div>
                  </div>
                </div>
                <div className="recent-strip">
                  <span className="recent-label">Recently added</span>
                  <div className="recent-thumbs">
                    <div className="recent-thumb">
                      <img src={added1} alt="Sneakers" />
                    </div>
                    <div className="recent-thumb">
                      <img src={added2} alt="Denim jeans" />
                    </div>
                    <div className="recent-thumb">
                      <img src={added3} alt="Leather bag" />
                    </div>
                    <div className="recent-thumb">
                      <img src={added4} alt="Scarf" />
                    </div>
                    <div className="recent-thumb recent-thumb-more">+18</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/*stylist-section-start */}
      <section className="ai-stylist-section" id="stylist">
        <div className="container-fluid">
          <div className="row gx-4 gy-4 align-items-center">
            <div className="col-md-6">
              <div className="chat-container wow fadeInLeft">
                <div className="chat-topbar">
                  <div className="chat-brand">
                    <div className="chat-brand-icon">
                      <i className="bi bi-stars"></i>
                    </div>
                    <div>
                      <h5 className="chat-brand-title">DressApp AI Personal Stylist</h5>
                      <span className="chat-status">
                        <span className="status-dot"></span> Active &amp; Ready to Consult
                      </span>
                    </div>
                  </div>
                  <div className="chat-tabs">
                    <span className="chat-tab chat-tab-active">Chat</span>
                    <span className="chat-tab">Outfit Planner</span>
                    <span className="chat-tab">Daily Suggestion</span>
                  </div>
                </div>
                <div className="chat-bubble chat-bubble-user">
                  "What should I wear tomorrow?"
                </div>
                <div className="chat-bubble chat-bubble-ai">
                  "Tomorrow is forecast for <strong>18°C with light morning rain</strong> and your calendar
                  notes a <strong>10 AM Business Meeting</strong>. I recommend structuring a clean
                  professional look built with technical weather protection."
                </div>
                <div className="d-flex flex-column gap-3 mt-4">
                  <div className="stylist-recommendation-card">
                    <div className="recom-img">
                      <img src={closet1} alt="Navy Tech Blazer" />
                    </div>
                    <div>
                      <span className="tracking-wider">Outerwear</span>
                      <h6 className="mb-0 fw-bold">Navy Tech Blazer (Waterproof)</h6>
                      <p>Matches formal meetings, repels light drizzle.</p>
                    </div>
                  </div>
                  <div className="stylist-recommendation-card">
                    <div className="recom-img">
                      <img src={closet2} alt="White Dress Shirt" />
                    </div>
                    <div>
                      <span className="tracking-wider">Top Layer</span>
                      <h6 className="mb-0 fw-bold">Organic Cotton White Dress Shirt</h6>
                      <p>Crisp, clean, professional base styling.</p>
                    </div>
                  </div>
                </div>
                <div className="chat-chips">
                  <span className="chip"><i className="bi bi-stars"></i> Daily Suggestion</span>
                  <span className="chip"><i className="bi bi-calendar-event"></i> Plan Event Outfit</span>
                  <span className="chip"><i className="bi bi-graph-up"></i> Trend-Scout</span>
                </div>
                <div className="chat-input-bar">
                  <button type="button" className="chat-icon-btn">
                    <i className="bi bi-image"></i>
                  </button>
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Tell your stylist what you need…"
                  />
                  <button type="button" className="chat-icon-btn">
                    <i className="bi bi-mic"></i>
                  </button>
                  <button type="submit" className="chat-send-btn">
                    <i className="bi bi-send-fill"></i>
                  </button>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="section-heading wow fadeInRight">
                <span className="section-tag">Empathetic Design Intelligence</span>
                <h2>The AI Stylist That Understands Life</h2>
                <p>Your fashion choices shouldn't exist in a vacuum. DressApp connects directly to
                  your calendar feeds and precise localized weather forecasts to design optimal outfits every
                  day.</p>
                <p>Never step out under-dressed for high stakes business sessions or
                  unprepared for sudden rainfall. It feels like having a world-Name sartorial advisor living
                  in
                  your phone, with complete access to what you own.</p>
                <a href="/stylist" className="custm-btn"><i className="bi bi-stars me-2"></i>Ask the stylist</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* marketplace-section-start */}
      <section className="marketplace-section" id="marketplace">
        <div className="container-fluid">
          <div className="section-heading mb-5 wow fadeInDown">
            <span className="section-tag">Zero Waste Initiative</span>
            <h2>Circular Wardrobe Marketplace</h2>
            <div className="view-more">
              <p>Buy, sell, or donate. Our integrated marketplace allows you to monetize under-utilized garments natively from your digital closet.</p>
              <div className="marketplace-inline-stats">
                <div className="marketplace-inline-item">
                  <span className="marketplace-inline-icon">
                    <i className="bi bi-shop-window"></i>
                  </span>
                  <span className="marketplace-inline-text">
                    <strong>{counts?.market ?? 0}</strong>
                    Active listings
                  </span>
                </div>
                <span className="marketplace-inline-divider"></span>
                <div className="marketplace-inline-item">
                  <span className="marketplace-inline-icon">
                    <i className="bi bi-arrow-repeat"></i>
                  </span>
                  <span className="marketplace-inline-text">
                    Buy, swap
                    <small>or donate</small>
                  </span>
                </div>
                <Link to="/market" className="marketplace-inline-link">
                  Explore Marketplace
                </Link>
              </div>
            </div>
          </div>
          <div className="swiper market-swiper wow fadeInUp">
            <div className="swiper-wrapper">
              {marketplaceItems.map((item) => (
                <div className="swiper-slide" key={item.id}>
                  <div className="market-card">
                    <div className="market-img-wrapper">
                      <span className="market-badge-premium">
                        {item.badge}
                      </span>

                      <img
                        src={item.image}
                        alt={item.title}
                      />
                    </div>

                    <div className="market-details">
                      <div className="d-flex justify-content-between align-items-center gap-3">
                        <h6>{item.title}</h6>

                        <span className="fw-bold text-dark">
                          {item.price}
                        </span>
                      </div>

                      <p>
                        Condition: {item.condition}
                        <br />
                        Located in {item.location}
                      </p>

                      <div className="market-actions">
                        <button
                          type="button"
                          className="btn-market-action"
                        >
                          Buy
                        </button>

                        <button
                          type="button"
                          className="btn-market-action"
                        >
                          Swap
                        </button>

                        <button
                          type="button"
                          className="btn-market-action"
                        >
                          Donate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="swiper-button-prev market-swiper-prev"
              aria-label="Previous marketplace slide"
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            <button
              type="button"
              className="swiper-button-next market-swiper-next"
              aria-label="Next marketplace slide"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
          <div className="text-center mt-5">
            <p className="text-white small d-inline-flex align-items-center gap-2 px-3 py-2 bg-dark rounded-pill">
              <i className="bi bi-info-circle text-success"></i>
              Transparent 7% platform fee after payment processing. Zero hidden
              charges.
            </p>
          </div>
        </div>
      </section>
      {/* ai-fashion-editor-section */}
      <section className="ai-editor-section" id="ai-editor">
        <div className="container-fluid">
          <div className="row gx-4 gy-4 align-items-center flex-md-row-reverse">
            <div className="col-md-7">
              <div className="editor-mockup wow fadeInRight">
                <div className="editor-mockup-topbar">
                  <div className="chat-brand">
                    <h5>
                      <i className="bi bi-magic me-2"></i>
                      AI Styled Fashion Editor
                    </h5>
                    <p>Rendering live preview</p>
                  </div>
                  <span className="editor-export-btn">
                    <i className="bi bi-download"></i>
                    {" "}Export Look
                  </span>
                </div>
                <div className="editor-body">
                  <div className="editor-canvas">
                    <img
                      src={editor}
                      alt="AI styled outfit preview"
                    />
                    <span className="editor-canvas-badge">
                      <i className="bi bi-stars"></i>
                      {" "}AI Match 96%
                    </span>
                  </div>
                  <div className="editor-tools">
                    <div className="editor-tab-row">
                      <span className="editor-tab editor-tab-active">Top</span>
                      <span className="editor-tab">Bottom</span>
                      <span className="editor-tab">Shoes</span>
                      <span className="editor-tab">Accessory</span>
                    </div>
                    {/* Fabric Tone */}
                    <div className="editor-control-block">
                      <span className="editor-control-label">
                        Fabric Tone
                      </span>
                      <div className="editor-swatch-row">
                        <span
                          className="editor-color-swatch active"
                          style={{ background: "#1f5c45" }}
                        />
                        <span
                          className="editor-color-swatch"
                          style={{ background: "#2c2c2c" }}
                        />
                        <span
                          className="editor-color-swatch"
                          style={{ background: "#c9a876" }}
                        />
                        <span
                          className="editor-color-swatch"
                          style={{ background: "#8a9aa8" }}
                        />
                        <span
                          className="editor-color-swatch"
                          style={{ background: "#f5eee9" }}
                        />
                      </div>
                    </div>
                    {/* Style Intensity */}
                    <div className="editor-control-block">
                      <span className="editor-control-label">
                        Style Intensity
                      </span>
                      <div className="editor-range-track">
                        <div className="editor-range-fill"></div>
                        <span className="editor-range-handle"></span>
                      </div>
                    </div>
                    {/* Silhouette */}
                    <div className="editor-control-block">
                      <span className="editor-control-label">
                        Silhouette Fit
                      </span>
                      <div className="d-flex gap-2">
                        <span className="editor-chip">
                          Slim
                        </span>
                        <span className="editor-chip editor-chip-active">
                          Relaxed
                        </span>
                        <span className="editor-chip">
                          Oversized
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="custm-btn w-100 justify-content-center"
                    >
                      <i className="bi bi-stars me-2"></i>
                      Regenerate with AI
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Left Side Content */}
            <div className="col-md-5">
              <div className="section-heading wow fadeInLeft">

                <span className="section-tag">
                  Visual Styling Studio
                </span>

                <h2>
                  Your AI Styled Fashion Editor
                </h2>

                <p>
                  Drag, swap, and recolor real garments from your closet on a
                  live model canvas. The editor understands fit, fabric,
                  and colour theory, so every combination it suggests
                  already looks intentional.
                </p>

                <p>
                  Nudge the style intensity slider for a bolder edit,
                  lock in a silhouette, and let the AI regenerate
                  accessories and layering in real time — no design
                  experience required.
                </p>

                <a href="#" className="custm-btn">
                  <i className="bi bi-magic me-2"></i>
                  Open Fashion Editor
                </a>

              </div>
            </div>

          </div>
        </div>
      </section>
      {/* experts-section */}
      <section className="experts-spotlight-section" id="experts">
        <div className="container-fluid">
          <div className="section-heading wow fadeInDown">
            <span className="section-tag">Meet The Specialists</span>
            <a href="/experts"><h2>Talk To A Real Style Expert</h2></a>
            <div className="view-more">
              <p>Book a 1:1 session with a certified DressApp stylist whenever the AI needs a
                human, editorial finishing touch.</p>
              <a href="/experts" className="custm-btn">View All Experts<i className="fa-solid fa-arrow-right ms-2"></i></a>
            </div>
          </div>
          <div className="row gx-4 gy-4 mt-0">
            <div className="col-lg-3 col-md-6 wow fadeInUp" data-wow-delay="0.1s">
              <div className="expert-pro-card">
                <div className="expert-avatar-wrap">
                  <img src={expert1} alt="Amelia Novak" className="expert-avatar" />
                  <span className="expert-avatar-badge"><i className="bi bi-patch-check-fill"></i></span>
                </div>
                <h5>Amelia Novak</h5>
                <span className="expert-spec-tag">Senior Fashion Stylist</span>
                <div className="expert-rating-row">
                  <i className="bi bi-star-fill"></i>
                  <span>4.9</span>
                  <span className="expert-rating-count">(120 sessions)</span>
                </div>
                <p className="expert-bio">Editorial-ready looks for high-stakes professional settings.</p>
                <a href="#" className="expert-book-btn">Book Session <i className="bi bi-arrow-right"></i></a>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 wow fadeInUp" data-wow-delay="0.25s">
              <div className="expert-pro-card">
                <div className="expert-avatar-wrap">
                  <img src={expert2} alt="Marcus Lee" className="expert-avatar" />
                  <span className="expert-avatar-badge"><i className="bi bi-patch-check-fill"></i></span>
                </div>
                <h5>Marcus Lee</h5>
                <span className="expert-spec-tag">Menswear Consultant</span>
                <div className="expert-rating-row">
                  <i className="bi bi-star-fill"></i>
                  <span>4.8</span>
                  <span className="expert-rating-count">(96 sessions)</span>
                </div>
                <p className="expert-bio">Sharp, modern tailoring advice for the everyday gentleman.</p>
                <a href="#" className="expert-book-btn">Book Session <i className="bi bi-arrow-right"></i></a>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 wow fadeInUp" data-wow-delay="0.4s">
              <div className="expert-pro-card">
                <div className="expert-avatar-wrap">
                  <img src={expert3} alt="Sofia Reyes" className="expert-avatar" />
                  <span className="expert-avatar-badge"><i className="bi bi-patch-check-fill"></i></span>
                </div>
                <h5>Sofia Reyes</h5>
                <span className="expert-spec-tag">Sustainable Fashion Advisor</span>
                <div className="expert-rating-row">
                  <i className="bi bi-star-fill"></i>
                  <span>5.0</span>
                  <span className="expert-rating-count">(148 sessions)</span>
                </div>
                <p className="expert-bio">Building a conscious wardrobe without compromising on style.</p>
                <a href="#" className="expert-book-btn">Book Session <i className="bi bi-arrow-right"></i></a>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 wow fadeInUp" data-wow-delay="0.55s">
              <div className="expert-pro-card">
                <div className="expert-avatar-wrap">
                  <img src={expert4} alt="Priya Sharma" className="expert-avatar" />
                  <span className="expert-avatar-badge"><i className="bi bi-patch-check-fill"></i></span>
                </div>
                <h5>Priya Sharma</h5>
                <span className="expert-spec-tag">Occasion Wear Expert</span>
                <div className="expert-rating-row">
                  <i className="bi bi-star-fill"></i>
                  <span>4.9</span>
                  <span className="expert-rating-count">(87 sessions)</span>
                </div>
                <p className="expert-bio">Show-stopping looks for weddings, galas, and celebrations.</p>
                <a href="#" className="expert-book-btn">Book Session <i className="bi bi-arrow-right"></i></a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* trend-scout-section-start */}
      <section className="trend-section">
        <div className="container-fluid">
          <div className="section-heading wow fadeInDown">
            <span className="section-tag">Fashion Intelligence</span>
            <a href="/trends"><h2>The Trend Scout</h2></a>
            <div className="view-more">
              <p>Get styled ahead of the global curve. Discover real-time stylistic
                shifts curated by computational trend models.
              </p>
              <a href="/trends" data-testid="home-trend-scout-title-link" className="custm-btn">View More<i className="fa-solid fa-arrow-right ms-2"></i></a>
            </div>
          </div>
          <div className="swiper trend-swiper wow fadeInUp">
            <div className="swiper-wrapper">
              {trends === null
                ? Array.from({ length: 4 }).map((_, i) => (
                  <div className="swiper-slide" key={i}>
                    <Skeleton className="h-100 w-100 rounded-4" />
                  </div>
                ))
                : (trends.length > 0 ? trends : FALLBACK_TRENDS).map((card, i) => {
                  const _prettyBucket = (b) =>
                    (b || "")
                      .replace(/[-_]+/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase());

                  const localisedBucket = card.bucket
                    ? t(`trends.bucket.${card.bucket}`, { defaultValue: "" })
                    : "";
                  const chip =
                    localisedBucket ||
                    card.label ||
                    _prettyBucket(card.bucket) ||
                    card.tag;
                  const headline = card.headline || card.title;
                  const body = card.summary || card.body || card.blurb;
                  const sourceUrl = card.source_url;
                  // image fallback
                  const image =
                    card.image_url ||
                    "https://i.pinimg.com/736x/17/50/e9/1750e9027cf70bc488293df0f91daa1d.jpg";

                  return (
                    <div className="swiper-slide" key={card.id || i}>
                      <div className="trend-card" style={{ backgroundImage: `url(${image})`, }} >
                        <div className="trend-card-content">
                          <span className="trend-tag">{chip}</span>
                          <h3>{headline}</h3>
                          {body && <p>{body}</p>}
                          {sourceUrl && (
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="trend-btn"
                            >
                              {t("home.trendReadSource", {
                                defaultValue: "Read Editorial",
                              })}
                              <i className="bi bi-arrow-right ms-2"></i>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="swiper-button-prev trend-swiper-prev">
              <i className="bi bi-chevron-left"></i>
            </div>
            <div className="swiper-button-next trend-swiper-next">
              <i className="bi bi-chevron-right"></i>
            </div>
          </div>
        </div>
      </section>
      {/* <section className="relative overflow-hidden rounded-[calc(var(--radius)+6px)] hero-wash-light noise border border-border p-6 md:p-10">
          <div className="absolute bottom-6 end-6 md:bottom-10 md:end-10 z-20">
            <Button
              asChild
              className="rounded-xl shadow-sm"
              data-testid="home-add-item-button"
            >
              <Link to="/closet/add">
                <Plus className="h-4 w-4 me-0 md:me-2 text-yellow-400 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                <span className="hidden md:inline text-yellow-400 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">{t('closet.addItem')}</span>
              </Link>
            </Button>
          </div> */}

      {/* Floating language picker — small "bulb" in the top-end corner
            of the hero. RTL-safe (end inset). Blends with the hero wash
            via a glassy backdrop. */}
      {/* <div className="absolute top-4 end-4 z-10">
            <LanguagePicker
              className="rounded-full bg-card/70 backdrop-blur-sm border-border shadow-sm hover:bg-card"
              testIdSuffix="home"
            />
          </div>
          <div className="caps-label text-muted-foreground">{t('home.todayLabel')}</div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-[1.05] mt-2" data-testid="home-greeting">
            {t('home.greeting')}<br />{firstName || t('home.greetingFallback')}.
          </h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-xl">
            {t('home.stylistWarmed')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-xl" data-testid="home-ask-stylist-cta">
              <Link to="/stylist"><Sparkles className="h-4 w-4 me-2" /> {t('home.askStylist')}</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-xl" data-testid="home-closet-cta">
              <Link to="/closet">{t('home.openCloset')} <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" /></Link>
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full caps-label border-border bg-card" data-testid="home-weather-chip">
              <CloudSun className="h-3.5 w-3.5 me-1" /> {t('home.weatherAware')}
            </Badge>
            <Badge variant="outline" className="rounded-full caps-label border-border bg-card" data-testid="home-calendar-chip">
              <Calendar className="h-3.5 w-3.5 me-1" /> {t('home.calendarSmart')}
            </Badge>
          </div>
        </section> */}

      {/* <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="home-kpis">
          {[
            {
              label: t('home.piecesInCloset'),
              value: counts?.closet ?? '—',
              href: '/closet',
              // Closet count is sourced from the global closet store
              // (eager-prewarmed by AppLayout). While the very first
              // /closet fetch is still in flight we show a spinner in
              // place of "—" so the user gets clear feedback that the
              // count is loading rather than zero/unknown.
              loading: !closet.lastFullSync && (closet.loading || counts === null),
              testId: 'home-kpi-closet',
            },
            { label: t('home.activeListings'), value: counts?.market ?? '—', href: '/market', loading: counts === null, testId: 'home-kpi-market' },
            { label: t('home.platformFee'), value: '7%', sub: t('home.platformFeeSub'), testId: 'home-kpi-fee' },
          ].map((k) => (
            <Card key={k.label} className="rounded-[calc(var(--radius)+6px)] shadow-editorial" data-testid={k.testId}>
              <CardContent className="p-5">
                <div className="caps-label text-muted-foreground">{k.label}</div>
                <div className="mt-2 font-display text-4xl min-h-[2.75rem] flex items-center">
                  {k.loading ? (
                    <span
                      className="inline-flex items-center gap-2 text-muted-foreground"
                      data-testid={`${k.testId}-loading`}
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span className="text-sm font-sans">{t('common.loading', { defaultValue: 'Loading…' })}</span>
                    </span>
                  ) : (
                    <span data-testid={`${k.testId}-value`}>{k.value}</span>
                  )}
                </div>
                {k.sub && <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>}
                {k.href && (
                  <Link to={k.href} className="inline-flex items-center text-sm text-[hsl(var(--accent))] mt-3">
                    {t('common.open')} <ArrowRight className="h-3.5 w-3.5 ms-1 rtl:rotate-180" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </section> */}

      {/* <section className="mt-10">
          <div className="flex items-end justify-between mb-4 gap-3">
            <Link
              to="/trends"
              className="group flex items-center gap-1.5 text-foreground hover:text-[hsl(var(--accent))] transition-colors"
              data-testid="home-trend-scout-title-link"
            >
              <h2 className="font-display text-2xl sm:text-3xl font-semibold flex items-center gap-2 hover:underline">
                {t('home.trendScout', { defaultValue: 'Trend-Scout' })}
                <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1 duration-200" />
              </h2>
            </Link>
            <div className="flex items-center gap-2">
              <div className="caps-label text-muted-foreground">
                {trendDate ? t('home.dailyEditOn', { date: trendDate }) : t('home.dailyEdit')}
              </div> */}
      {/* Admin-only force-refresh button. Hidden for regular users
                — the daily 07:00 UTC cron + the auto-refresh on read in
                ``latest_trend_cards`` keep the feed fresh without manual
                intervention; this is just a triage / "I want it now"
                lever for the team. */}
      {/* {isAdmin ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={refreshTrends}
                  disabled={refreshing}
                  aria-label={t('home.refreshTrends', { defaultValue: 'Refresh trends' })}
                  title={t('home.refreshTrends', { defaultValue: 'Refresh trends' })}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  data-testid="home-trends-refresh-btn"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              ) : null}
            </div>
          </div> */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="home-trend-scout-feed">
            {trends === null
              ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-[calc(var(--radius)+6px)]" />
              ))
              : (trends.length > 0 ? trends : FALLBACK_TRENDS).map((card, i) => {
                // Normalise across (a) the real Trend-Scout payload from
                // ``GET /api/v1/trends/latest`` (``label``/``headline``/``summary``),
                // (b) older fallback shapes (``tag``/``title``/``body``/``blurb``),
                // and (c) the seed/demo payload. Without this normalisation the
                // home page silently rendered empty chips + empty body for the
                // real API because the previous code read ``t.tag``/``t.body``
                // which the API never sets — and ``t`` also shadowed the i18n
                // translator, so even the chip class hung off the wrong value.
                //
                // For the chip we prefer the localised ``trends.bucket.<slug>``
                // string (matches every locale JSON); the backend ``label`` is
                // a hard fallback if a bucket slug has no translation yet.
                const _prettyBucket = (b) =>
                  (b || '')
                    .replace(/[-_]+/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                const localisedBucket = card.bucket
                  ? t(`trends.bucket.${card.bucket}`, { defaultValue: '' })
                  : '';
                const chip =
                  localisedBucket
                  || card.label
                  || _prettyBucket(card.bucket)
                  || card.tag;
                const headline = card.headline || card.title;
                const body = card.summary || card.body || card.blurb;
                const sourceUrl = card.source_url;
                const sourceName = card.source_name;
                const visual = BUCKET_VISUALS[card.bucket] || DEFAULT_BUCKET_VISUAL;
                const BucketIcon = visual.Icon;
                const key = card.id || `${chip || 'trend'}-${headline || i}`;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    data-testid="home-trend-scout-card"
                  >
                    <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial h-full overflow-hidden flex flex-col"> */}
      {/* Bucket-themed header band — replaces the
                          previously-rendered ``image_url`` (which was an
                          LLM-hallucinated stock photo and didn't actually
                          represent the article). The icon + chip give the
                          card a recognisable identity without misleading
                          the reader about the content. */}
      {/* <div
                        className={`flex items-center gap-2 px-5 py-3 border-b border-border ${visual.tone}`}
                        data-testid="home-trend-scout-card-header"
                      >
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-card border border-border text-[hsl(var(--accent))]">
                          <BucketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        {chip ? (
                          <div className="caps-label text-foreground/80 truncate">{chip}</div>
                        ) : null}
                      </div>
                      <CardContent className="p-5 flex-1 flex flex-col">
                        {headline ? (
                          <h3 className="font-display text-xl leading-tight">{headline}</h3>
                        ) : null}
                        {body ? (
                          <p className="text-sm text-muted-foreground mt-3">{body}</p>
                        ) : null}
                        {sourceUrl ? (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--accent))] hover:underline focus-visible:underline focus-visible:outline-none"
                            data-testid="home-trend-scout-card-source"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            <span className="truncate">
                              {sourceName
                                ? t('home.trendReadAt', { source: sourceName, defaultValue: `Read at ${sourceName}` })
                                : t('home.trendReadSource', { defaultValue: 'Read source' })}
                            </span>
                          </a>
                        ) : null}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
          </div>
        </section> */}
      {/* <AdTicker placement="home-footer" className="-mx-4 sm:-mx-6 lg:-mx-8" /> */}
    </>
  );
}
