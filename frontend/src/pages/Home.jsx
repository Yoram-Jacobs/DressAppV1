import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useClosetStore } from "@/lib/useClosetStore";
import { useLocation as useAppLocation } from "@/lib/location";
import { api } from "@/lib/api";
import { AdTicker } from "@/components/AdTicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { toast } from "sonner";
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
import slide1 from "../assets/img/slide1.avif";
import slide2 from "../assets/img/slide2.avif";
import slide3 from "../assets/img/slide3.avif";
import Swiper from "swiper";
import { Navigation, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "animate.css/animate.min.css";
import WOW from "wowjs";
// Fallback cards used only if the Trend-Scout endpoint fails or returns empty.
// Shape mirrors the real API (``label``, ``headline``, ``summary``) so the
// renderer below can read ONE consistent set of fields. The actual strings
// live in ``home.fallbackTrends.fbN`` in every locale JSON — see
// ``buildFallbackTrends(t)`` in the component below.
const FALLBACK_TREND_KEYS = ["fb1", "fb2", "fb3"];

const FALLBACK_TREND_BUCKETS = {
  fb1: "ss26-runway",
  fb2: "street",
  fb3: "sustainability",
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
  "ss26-runway": { Icon: Crown, tone: "bg-secondary/60" },
  street: { Icon: Footprints, tone: "bg-secondary/60" },
  sustainability: { Icon: Leaf, tone: "bg-secondary/60" },
  influencers: { Icon: Users, tone: "bg-secondary/60" },
  second_hand: { Icon: Recycle, tone: "bg-secondary/60" },
  recycling: { Icon: Recycle, tone: "bg-secondary/60" },
  news_flash: { Icon: Newspaper, tone: "bg-secondary/60" },
};
const DEFAULT_BUCKET_VISUAL = { Icon: Sparkles, tone: "bg-secondary/60" };

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const closet = useClosetStore();
  const loc = useAppLocation();
  const isAdmin = (user?.roles || []).includes("admin");
  const [counts, setCounts] = useState(null);
  const [trends, setTrends] = useState(null); // null = loading, [] = empty, [...]
  const [trendDate, setTrendDate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = [slide1, slide2, slide3];
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
          defaultValue: "",
        }),
        headline: t(`home.fallbackTrends.${key}.headline`, {
          defaultValue: "",
        }),
        summary: t(`home.fallbackTrends.${key}.summary`, {
          defaultValue: "",
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
  const language = (user?.preferred_language || i18n.language || "en")
    .split("-")[0]
    .toLowerCase();
  const country =
    (loc?.country_code || user?.home_location?.country_code || "")
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
      await api.trendsRefreshAdmin(true, country);
      await fetchTrends();
      toast.success(
        t("home.trendsRefreshed", { defaultValue: "Trends refreshed" }),
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          t("home.trendsRefreshFailed", {
            defaultValue: "Could not refresh trends",
          }),
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
        const market = await api.listListings({ limit: 1, status: "active" });
        setCounts({
          closet: closet.total || (closet.items?.length ?? 0),
          market: market.total || 0,
        });
      } catch {
        setCounts({ closet: closet.total || 0, market: 0 });
      }
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
  const trendSwiperRef = useRef(null);
  useEffect(() => {
    const sliderElement = trendSwiperRef.current;

    if (!sliderElement) return;

    if (sliderElement.swiper) {
      sliderElement.swiper.destroy(true, true);
    }

    const trendSwiper = new Swiper(sliderElement, {
      modules: [Navigation, Autoplay],

      slidesPerView: 1.15,
      spaceBetween: 15,

      loop: false,
      speed: 800,

      autoplay: {
        delay: 2500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      },

      navigation: {
        nextEl: sliderElement.querySelector(".trend-swiper-next"),
        prevEl: sliderElement.querySelector(".trend-swiper-prev"),
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
      if (!trendSwiper.destroyed) {
        trendSwiper.destroy(true, true);
      }
    };
  }, []);
  const marketSwiperRef = useRef(null);
  useEffect(() => {
    const sliderElement = marketSwiperRef.current;

    if (!sliderElement) return;

    // Destroy previous instance
    if (sliderElement.swiper) {
      sliderElement.swiper.destroy(true, true);
    }

    const marketSwiper = new Swiper(sliderElement, {
      modules: [Navigation, Autoplay],

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
        nextEl: sliderElement.querySelector(".market-swiper-next"),
        prevEl: sliderElement.querySelector(".market-swiper-prev"),
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
  const firstName = (user?.display_name || user?.email || "").split(/\s|@/)[0];
  // --- WOW.js Scroll Animations
  useEffect(() => {
    const wow = new WOW.WOW({
      boxClass: "wow",
      animateClass: "animated",
      offset: 60,
      mobile: true,
      live: true,
    });

    wow.init();
  }, []);
  return (
    <>
      {/* banner-start */}
      <section
        id="home"
        className="relative  mt-[var(--header-height)] overflow-hidden bg-accent-beige"
      >
        <div className="grid w-full grid-cols-1 lg:grid-cols-12">
          {/* ================= LEFT CONTENT ================= */}
          <div
            className="
                          flex
                          min-h-[calc(100vh-var(--header-height))]
                          items-center
                          px-5
                          py-12
                          sm:px-8
                          sm:py-16
                          lg:col-span-5
                          lg:min-h-[calc(100vh-var(--header-height))]
                          lg:px-10
                          xl:px-14"
          >
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              className="w-full"
            >
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.65,
                  delay: 0,
                  ease: "easeOut",
                }}
                className="
      mb-5
      inline-flex
      items-center
      gap-2
      font-sans
      text-[11px]
      font-bold
      uppercase
      tracking-[1.5px]
      text-[var(--primary-color)]
      sm:text-xs
    "
              >
                <Sparkles className="h-4 w-4 shrink-0" />

                <span>
                  {t("home.aiWardrobeAssistant", {
                    defaultValue: "AI wardrobe assistant for everyday styling",
                  })}
                </span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.08,
                  ease: "easeOut",
                }}
                className="
      mb-5
      font-sans
      text-[42px]
      leading-[1.05]
      tracking-[0.8px]
      text-black
      sm:text-5xl
      md:text-6xl
      lg:text-[60px]
      xl:text-[80px]
      xl:leading-[90px]
      font-extrabold
    "
                data-testid="home-greeting"
              >
                {t("home.greeting")}{" "}
                <span className="text-[var(--primary-color)]">
                  {firstName || t("home.greetingFallback")}
                </span>
              </motion.h1>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.65,
                  delay: 0.16,
                  ease: "easeOut",
                }}
                className="
      mb-7
      max-w-[570px]
      font-sans
      text-[15px]
      leading-7
      tracking-[0.2px]
      text-[#666]
      sm:text-base
    "
              >
                {t("home.stylistWarmed")}
              </motion.p>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.65,
                  delay: 0.24,
                  ease: "easeOut",
                }}
                className="
      flex
      flex-col
      gap-3
      sm:flex-row
      sm:items-center
      sm:gap-4
    "
              >
                <Button
                  asChild
                  data-testid="home-ask-stylist-cta"
                  className="
        h-auto
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
        hover:shadow-[0_10px_30px_rgba(31,92,69,0.22)]
      "
                >
                  <Link
                    to="/stylist"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("home.askStylist")}
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="secondary"
                  data-testid="home-closet-cta"
                  className="
        h-auto
        rounded-full
        border
        border-black/10
        bg-white
        px-7
        py-3.5
        font-sans
        text-sm
        font-semibold
        text-[var(--dark-color)]
        shadow-none
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:bg-white
        hover:text-[var(--primary-color)]
        hover:shadow-[var(--shadow-medium)]
      "
                >
                  <Link
                    to="/closet"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    {t("home.openCloset")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>

          {/* ================= RIGHT IMAGE ================= */}
          <div
            className="
        relative
        min-h-[560px]
        lg:col-span-7
        lg:min-h-[calc(100vh-var(--header-height))]
      "
          >
            {/* ================= IMAGE SLIDER ================= */}
            <div className="relative h-full min-h-[560px] overflow-hidden lg:min-h-[calc(100vh-var(--header-height))]">
              {slides.map((image, index) => (
                <div
                  key={image}
                  className={`
              absolute
              inset-0
              transition-all
              duration-[1200ms]
              ease-out
              ${
                activeSlide === index
                  ? "scale-100 opacity-100"
                  : "scale-[1.04] opacity-0"
              }
            `}
                >
                  <img
                    src={image}
                    alt={t("home.fashionSlideAlt", {
                      number: index + 1,
                      defaultValue: `Fashion slide ${index + 1}`,
                    })}
                    className="
                h-full
                w-full
                object-cover
                object-center
              "
                  />
                </div>
              ))}

              {/* Image overlay */}
              <div
                className="
            pointer-events-none
            absolute
            inset-0
            bg-[linear-gradient(180deg,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0)_40%,rgba(0,0,0,0.50)_100%),linear-gradient(90deg,rgba(0,0,0,0.18),transparent_50%)]
          "
              />

              {/* ================= WEATHER CARD ================= */}
              <div
                className="
            absolute
            left-3
            top-3
            z-10
            flex
            max-w-[calc(100%-24px)]
            items-center
            gap-3
            rounded-sm
            border
            border-white/15
            bg-black/20
            p-3
            text-white
            shadow-lg
            backdrop-blur-xl
            sm:left-5
            sm:top-5
            sm:p-4
          "
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <img
                    src={cloudyImg}
                    alt={t("home.weatherIconAlt", {
                      defaultValue: "Weather",
                    })}
                    className="h-9 w-auto object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="mb-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 sm:text-[11px]">
                    {t("home.tomorrow", {
                      defaultValue: "Tomorrow",
                    })}
                  </div>

                  <div className="font-sans text-[11px] font-semibold text-white/90 sm:text-xs">
                    {t("home.weatherSummary", {
                      defaultValue: "18°C · Light Rain",
                    })}
                  </div>

                  <div className="font-sans text-[10px] text-white/65 sm:text-[11px]">
                    {t("home.aiReadyOutfit", {
                      defaultValue: "AI Ready Outfit",
                    })}
                  </div>
                </div>
              </div>

              {/* ================= AI LOOK LABEL ================= */}
              <div
                className="
            absolute
            right-3
            top-3
            z-10
            rounded-full
            border
            border-white/20
            bg-white/90
            px-3
            py-1.5
            font-sans
            text-[9px]
            font-bold
            uppercase
            tracking-[0.1em]
            text-[var(--primary-color)]
            shadow-sm
            sm:right-5
            sm:top-5
            sm:px-3.5
            sm:py-2
            sm:text-[10px]
          "
              >
                {t("home.aiStyledLook", {
                  defaultValue: "AI Styled Look",
                })}
              </div>

              {/* ================= SLIDER DOTS ================= */}
              <div
                className="
            absolute
            bottom-[105px]
            left-1/2
            z-10
            flex
            -translate-x-1/2
            items-center
            gap-1.5
            sm:bottom-[105px]
            sm:right-7
            sm:left-auto
            sm:translate-x-0
          "
                aria-label={t("home.fashionBannerSlider", {
                  defaultValue: "Fashion banner slider",
                })}
              >
                {slides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={t("home.showSlide", {
                      number: index + 1,
                      defaultValue: `Show slide ${index + 1}`,
                    })}
                    aria-current={activeSlide === index}
                    onClick={() => setActiveSlide(index)}
                    className={`
                h-1.5
                rounded-full
                border-0
                p-0
                transition-all
                duration-300
                ${activeSlide === index ? "w-7 bg-white" : "w-1.5 bg-white/50"}
              `}
                  />
                ))}
              </div>

              {/* ================= EDITORIAL META ================= */}
              <div
                className="
            absolute
            bottom-5
            right-4
            z-10
            max-w-[190px]
            text-right
            text-white
            sm:right-5
          "
              >
                <span className="mb-1 block font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-white/65 sm:text-[10px]">
                  {t("home.fashionEditorPreview", {
                    defaultValue: "Fashion Editor Preview",
                  })}
                </span>

                <strong className="block font-sans text-xs font-semibold leading-5 text-white sm:text-sm">
                  {t("home.capsuleLooks", {
                    defaultValue: "Capsule looks curated for your day",
                  })}
                </strong>
              </div>

              {/* ================= TODAY'S OUTFIT ================= */}
              <div
                className="
            absolute
            bottom-3
            left-3
            z-10
            max-w-[calc(100%-24px)]
            rounded-sm
            border
            border-white/15
            bg-black/20
            p-3
            text-white
            shadow-lg
            backdrop-blur-xl
            sm:bottom-5
            sm:left-5
            sm:p-4
          "
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-sans text-[10px] font-semibold text-white/75 sm:text-[11px]">
                    {t("home.todaySuggestion", {
                      defaultValue: "Today's Suggestion",
                    })}
                  </span>

                  <span className="rounded-full bg-white/20 px-2 py-1 font-sans text-[9px] font-bold text-white">
                    98% Match
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-11 sm:w-11">
                    <img
                      src={Calender}
                      alt={t("home.outfitPreviewAlt", {
                        defaultValue: "Today's outfit",
                      })}
                      className="h-8 w-auto object-contain sm:h-9"
                    />
                  </div>

                  <div className="min-w-0">
                    <h6 className="m-0 truncate font-sans text-[10px] font-bold text-white/90 sm:text-[11px]">
                      {t("home.nordicAutumnLayer", {
                        defaultValue: "Nordic Autumn Layer",
                      })}
                    </h6>

                    <p className="m-0 truncate font-sans text-[9px] leading-4 text-white/65 sm:text-[10px]">
                      {t("home.navyBlazerKnit", {
                        defaultValue: "Navy Blazer + Knit Sweater",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* how-it-works-section-start */}
      <section
        id="how-it-works"
        className="w-full px-[40px] py-[80px] bg-white"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mx-auto mb-[42px] max-w-[700px] text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              Seamless Process
            </span>

            <h2 className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
              Revolutionizing Wardrobe Management
            </h2>

            <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand">
              Getting beautifully dressed is now a four-step modern workflow
              managed by advanced Artificial Intelligence.
            </p>
          </div>

          {/* How Works Row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {/* Card 01 */}
            <div className="relative">
              <div className="group relative h-full min-h-[209px] overflow-hidden rounded-[12px] bg-primary-shadow px-[30px] py-[30px] transition-smooth hover:-translate-y-[3px] hover:shadow-[var(--primary-shadow)]">
                {/* Ghost Number */}
                <span className="pointer-events-none absolute right-[18px] top-[8px] select-none text-[72px] font-extrabold leading-none text-[#66666617]">
                  01
                </span>

                {/* Icon */}
                <div className="relative z-[1] mb-[22px] flex h-[48px] w-[48px] items-center justify-center">
                  <img
                    src={Capture}
                    alt="capture cloth"
                    className="h-[48px] w-[48px] object-contain transition-smooth group-hover:animate-reveal-png-icon"
                  />
                </div>

                <h4 className="relative z-[1] mb-[12px] text-[16px] font-bold leading-[1.3] text-black">
                  Capture Clothes
                </h4>

                <p className="relative z-[1] m-0 max-w-[350px] text-[14px] leading-[1.7] text-[#68706e]">
                  Snap a quick photo of your actual garments. Works beautifully
                  with all lightings and backgrounds.
                </p>
              </div>

              {/* Arrow */}
              <span className="absolute -right-[20px] top-1/2 z-[5] hidden h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full bg-primary-brand text-white shadow-[var(--primary-shadow)] lg:flex">
                <i className="bi bi-arrow-right text-[16px]" />
              </span>
            </div>

            {/* Card 02 */}
            <div className="relative">
              <div className="group relative h-full min-h-[209px] overflow-hidden rounded-[12px] bg-primary-shadow px-[30px] py-[30px] transition-smooth hover:-translate-y-[3px] hover:shadow-[var(--primary-shadow)]">
                {/* Ghost Number */}
                <span className="pointer-events-none absolute right-[18px] top-[8px] select-none text-[72px] font-extrabold leading-none text-[#66666617]">
                  02
                </span>

                {/* Icon */}
                <div className="relative z-[1] mb-[22px] flex h-[48px] w-[48px] items-center justify-center">
                  <img
                    src={Analysis}
                    alt="attribute analysis"
                    className="h-[48px] w-[48px] object-contain transition-smooth group-hover:animate-reveal-png-icon"
                  />
                </div>

                <h4 className="relative z-[1] mb-[12px] text-[16px] font-bold leading-[1.3] text-black">
                  AI Attribute Analysis
                </h4>

                <p className="relative z-[1] m-0 max-w-[350px] text-[14px] leading-[1.7] text-[#68706e]">
                  Our vision models detect colors, pattern, fabrics, cuts, and
                  categories instantly and automatically.
                </p>
              </div>

              {/* Arrow */}
              <span className="absolute -right-[20px] top-1/2 z-[5] hidden h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full bg-primary-brand text-white shadow-[var(--primary-shadow)] lg:flex">
                <i className="bi bi-arrow-right text-[16px]" />
              </span>
            </div>

            {/* Card 03 */}
            <div className="relative">
              <div className="group relative h-full min-h-[209px] overflow-hidden rounded-[12px] bg-primary-shadow px-[30px] py-[30px] transition-smooth hover:-translate-y-[3px] hover:shadow-[var(--primary-shadow)]">
                {/* Ghost Number */}
                <span className="pointer-events-none absolute right-[18px] top-[8px] select-none text-[72px] font-extrabold leading-none text-[#66666617]">
                  03
                </span>

                {/* Icon */}
                <div className="relative z-[1] mb-[22px] flex h-[48px] w-[48px] items-center justify-center">
                  <img
                    src={Closet}
                    alt="smart closet"
                    className="h-[48px] w-[48px] object-contain transition-smooth group-hover:animate-reveal-png-icon"
                  />
                </div>

                <h4 className="relative z-[1] mb-[12px] text-[16px] font-bold leading-[1.3] text-black">
                  Build Smart Closet
                </h4>

                <p className="relative z-[1] m-0 max-w-[350px] text-[14px] leading-[1.7] text-[#68706e]">
                  Your clothing catalogs itself elegantly into categorization
                  systems like Zara/COS online designs.
                </p>
              </div>

              {/* Arrow */}
              <span className="absolute -right-[20px] top-1/2 z-[5] hidden h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full bg-primary-brand text-white shadow-[var(--primary-shadow)] lg:flex">
                <i className="bi bi-arrow-right text-[16px]" />
              </span>
            </div>

            {/* Card 04 */}
            <div className="relative">
              <div className="group relative h-full min-h-[209px] overflow-hidden rounded-[12px] bg-primary-shadow px-[30px] py-[30px] transition-smooth hover:-translate-y-[3px] hover:shadow-[var(--primary-shadow)]">
                {/* Ghost Number */}
                <span className="pointer-events-none absolute right-[18px] top-[8px] select-none text-[72px] font-extrabold leading-none text-[#66666617]">
                  04
                </span>

                {/* Icon */}
                <div className="relative z-[1] mb-[22px] flex h-[48px] w-[48px] items-center justify-center">
                  <img
                    src={Effect}
                    alt="daily style"
                    className="h-[48px] w-[48px] object-contain transition-smooth group-hover:animate-reveal-png-icon"
                  />
                </div>

                <h4 className="relative z-[1] mb-[12px] text-[16px] font-bold leading-[1.3] text-black">
                  Get Styled Daily
                </h4>

                <p className="relative z-[1] m-0 max-w-[350px] text-[14px] leading-[1.7] text-[#68706e]">
                  Receive daily styled outfits contextualized to your precise
                  geolocation weather and calendar meetings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* closet-section-start */}
      <section
        id="closet"
        className="w-full overflow-hidden bg-[var(--accent-beige)] px-[40px] py-[80px] max-[991px]:px-[5px] max-[991px]:py-[40px]"
      >
        <div className="w-full">
          <div className="grid grid-cols-1 items-center gap-x-3 md:grid-cols-12">
            {/* Left Content */}
            <div className="md:col-span-4">
              <div className="mx-auto mb-[42px] max-w-[700px]">
                {/* Section Tag */}
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
                  <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
                  Your Digital Wardrobe
                </span>
                <h2 className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
                  Every Piece Finds Its Place
                </h2>
                <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand  mb-5">
                  Photograph anything you own — DressApp reads the fabric, the
                  cut, the colour, and files it away like a stylist would:
                  tagged, catalogued, ready to be pulled the moment you need it.
                </p>
                <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5">
                  No more forgotten drawers. Search by keyword, or just describe
                  a feeling — "something warm for a rainy Monday" — and the
                  right piece finds its way back to you.
                </p>
                {/* Button */}
                <a
                  href="/closet"
                  className="mt-2 inline-flex items-center justify-center rounded-[50px] border-none bg-[var(--primary-color)] px-[30px] py-[20px] text-[14px] font-bold leading-none text-[var(--white)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-[var(--white)] hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  Start Building Your Closet
                  <i className="fa-solid fa-arrow-right ml-2" />
                </a>
              </div>
            </div>
            {/* Right Visual */}
            <div className="md:col-span-8">
              <div className="relative w-full pt-[30px]">
                {/* Rail */}
                <div className="relative flex items-center">
                  <div className="h-[3px] w-full rounded-[3px] bg-[var(--dark-color)]" />
                  {/* Count Badge */}
                  <span className="absolute right-0 top-[-46px] inline-flex items-center gap-[6px] rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-[0.72rem] font-semibold text-[var(--dark-color)] shadow-[0_10px_25px_-12px_rgba(23,20,15,0.25)]">
                    <i className="bi bi-stars text-[var(--primary-color)]" />3
                    new this week
                  </span>
                </div>
                {/* Garments */}
                <div className="flex items-start justify-between gap-6 max-[991px]:gap-[14px] max-[575px]:flex-wrap max-[575px]:justify-center">
                  {/* Garment 1 */}
                  <div className="group relative flex flex-1 flex-col items-center transition-transform duration-300 ease-in hover:-translate-y-2 max-[575px]:basis-[45%]">
                    <div className="h-[26px] w-[2px] bg-[var(--dark-color)]" />
                    <div className="aspect-[4/5] w-full max-w-[190px] overflow-hidden rounded-[14px] border-[6px] border-white bg-white shadow-[0_22px_40px_-18px_rgba(23,20,15,0.35)] max-[991px]:max-w-[140px]">
                      <img
                        src={closet1}
                        alt="Navy blazer"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="relative mt-[22px] w-[88%] rounded-[8px] border border-[#e5e5e5] bg-white px-[14px] pb-3 pt-[10px] text-left shadow-[0_12px_22px_-14px_rgba(23,20,15,0.25)] max-[991px]:px-[10px] max-[991px]:pb-[10px] max-[991px]:pt-2">
                      <span className="absolute left-1/2 top-[-22px] h-[22px] w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,var(--dark-color)_0,var(--dark-color)_3px,transparent_3px,transparent_6px)]" />
                      <span className="absolute left-1/2 top-[-3px] h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-[var(--primary-color)]" />
                      <span className="mb-[3px] block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--primary-color)]">
                        Outerwear
                      </span>
                      <span className="block text-[0.92rem] font-bold leading-[1.3] text-[var(--dark-color)] max-[991px]:text-[0.8rem]">
                        Navy Tech Blazer
                      </span>
                      <span className="mt-1 block text-[0.65rem] text-[var(--text-color)]">
                        No. 014 — Waterproof
                      </span>
                    </div>
                  </div>
                  {/* Garment 2 */}
                  <div className="group relative flex flex-1 flex-col items-center transition-transform duration-300 ease-in hover:-translate-y-2 max-[575px]:basis-[45%]">
                    <div className="h-[26px] w-[2px] bg-[var(--dark-color)]" />
                    <div className="aspect-[4/5] w-full max-w-[190px] overflow-hidden rounded-[14px] border-[6px] border-white bg-white shadow-[0_22px_40px_-18px_rgba(23,20,15,0.35)] max-[991px]:max-w-[140px]">
                      <img
                        src={closet2}
                        alt="Grey knit sweater"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="relative mt-[22px] w-[88%] rounded-[8px] border border-[#e5e5e5] bg-white px-[14px] pb-3 pt-[10px] text-left shadow-[0_12px_22px_-14px_rgba(23,20,15,0.25)] max-[991px]:px-[10px] max-[991px]:pb-[10px] max-[991px]:pt-2">
                      <span className="absolute left-1/2 top-[-22px] h-[22px] w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,var(--dark-color)_0,var(--dark-color)_3px,transparent_3px,transparent_6px)]" />
                      <span className="absolute left-1/2 top-[-3px] h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-[var(--primary-color)]" />
                      <span className="mb-[3px] block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--primary-color)]">
                        Knitwear
                      </span>
                      <span className="block text-[0.92rem] font-bold leading-[1.3] text-[var(--dark-color)] max-[991px]:text-[0.8rem]">
                        Merino Crewneck
                      </span>
                      <span className="mt-1 block text-[0.65rem] text-[var(--text-color)]">
                        No. 027 — Ash Grey
                      </span>
                    </div>
                  </div>
                  {/* Garment 3 */}
                  <div className="group relative flex flex-1 flex-col items-center transition-transform duration-300 ease-in hover:-translate-y-2 max-[575px]:basis-[45%]">
                    <div className="h-[26px] w-[2px] bg-[var(--dark-color)]" />
                    <div className="aspect-[4/5] w-full max-w-[190px] overflow-hidden rounded-[14px] border-[6px] border-white bg-white shadow-[0_22px_40px_-18px_rgba(23,20,15,0.35)] max-[991px]:max-w-[140px]">
                      <img
                        src={closet3}
                        alt="White dress shirt"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="relative mt-[22px] w-[88%] rounded-[8px] border border-[#e5e5e5] bg-white px-[14px] pb-3 pt-[10px] text-left shadow-[0_12px_22px_-14px_rgba(23,20,15,0.25)] max-[991px]:px-[10px] max-[991px]:pb-[10px] max-[991px]:pt-2">
                      <span className="absolute left-1/2 top-[-22px] h-[22px] w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,var(--dark-color)_0,var(--dark-color)_3px,transparent_3px,transparent_6px)]" />
                      <span className="absolute left-1/2 top-[-3px] h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-[var(--primary-color)]" />
                      <span className="mb-[3px] block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--primary-color)]">
                        Top Layer
                      </span>
                      <span className="block text-[0.92rem] font-bold leading-[1.3] text-[var(--dark-color)] max-[991px]:text-[0.8rem]">
                        Cotton Dress Shirt
                      </span>
                      <span className="mt-1 block text-[0.65rem] text-[var(--text-color)]">
                        No. 041 — Chalk White
                      </span>
                    </div>
                  </div>
                </div>
                {/* Recently Added */}
                <div className="mt-[56px] flex flex-wrap items-center gap-[18px] border-t border-dashed border-[#e5e5e5] pt-[26px] max-[575px]:mt-0 max-[575px]:flex-col max-[575px]:items-start max-[575px]:border-0">
                  <span className="whitespace-nowrap text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-color)]">
                    Recently added
                  </span>
                  <div className="flex items-center">
                    <div className="h-[52px] w-[52px] overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-white shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]">
                      <img
                        src={added1}
                        alt="Sneakers"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="-ml-[14px] h-[52px] w-[52px] overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-white shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]">
                      <img
                        src={added2}
                        alt="Denim jeans"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="-ml-[14px] h-[52px] w-[52px] overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-white shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]">
                      <img
                        src={added3}
                        alt="Leather bag"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="-ml-[14px] h-[52px] w-[52px] overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-white shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]">
                      <img
                        src={added4}
                        alt="Scarf"
                        className="block h-full w-full object-cover"
                      />
                    </div>
                    <div className="-ml-[14px] flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-[var(--dark-color)] text-[0.68rem] font-bold text-[var(--accent-beige)] shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]">
                      +18
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* stylist-section-start */}
      <section
        id="stylist"
        className="w-full overflow-hidden bg-white px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          <div className="grid grid-cols-1 items-center gap-x-8 gap-y-8 md:grid-cols-2">
            {/* Chat */}
            <div>
              <div className="relative overflow-hidden rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[var(--primary-shadow)] transition-smooth shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                {/* Chat Topbar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between gap-4 max-[575px]:flex-col max-[575px]:items-start">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary-color)] text-white">
                        <i className="bi bi-stars text-[18px]" />
                      </div>

                      <div>
                        <h5 className="m-0 text-[14px] font-bold leading-[1.3] text-[var(--dark-color)]">
                          DressApp AI Personal Stylist
                        </h5>

                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-color)]">
                          <span className="h-[7px] w-[7px] rounded-full bg-[#3ca76b]" />
                          Active &amp; Ready to Consult
                        </span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 rounded-full bg-accent-beige p-1 max-[575px]:w-full">
                      <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--primary-color)] shadow-sm">
                        Chat
                      </span>

                      <span className="px-3 py-1.5 text-[12px] font-bold text-[var(--text-color)]">
                        Outfit Planner
                      </span>

                      <span className="px-3 py-1.5 text-[12px] font-bold text-[var(--text-color)]">
                        Daily Suggestion
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Message */}
                <div className="mb-3 ml-auto w-fit max-w-[75%] rounded-[12px] rounded-br-[0px] bg-[var(--primary-color)] px-4 py-3 text-[12px] leading-[1.5] text-white">
                  "What should I wear tomorrow?"
                </div>

                {/* AI Message */}
                <div className="mb-4 max-w-[90%] rounded-[12px] rounded-bl-[0px] font-semibold bg-accent-beige px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-color)]">
                  "Tomorrow is forecast for{" "}
                  <strong className="font-bold text-[var(--dark-color)]">
                    18°C with light morning rain
                  </strong>{" "}
                  and your calendar notes a{" "}
                  <strong className="font-bold text-[var(--dark-color)]">
                    10 AM Business Meeting
                  </strong>
                  . I recommend structuring a clean professional look built with
                  technical weather protection."
                </div>

                {/* Recommendations */}
                <div className="mt-4 flex flex-col gap-3">
                  {/* Recommendation 1 */}
                  <div className="flex items-center gap-3 rounded-[12px] border border-black/[0.06] bg-white p-3 transition-smooth shadow-sm">
                    <div className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[9px] bg-[#f1f5f4]">
                      <img
                        src={closet1}
                        alt="Navy Tech Blazer"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--primary-color)]">
                        Outerwear
                      </span>

                      <h6 className="m-0 text-[13px] font-bold leading-[1.35] text-[var(--dark-color)]">
                        Navy Tech Blazer (Waterproof)
                      </h6>

                      <p className="mt-1 mb-0 text-[11px] leading-[1.4] text-[var(--text-color)]">
                        Matches formal meetings, repels light drizzle.
                      </p>
                    </div>
                  </div>

                  {/* Recommendation 2 */}
                  <div className="flex items-center gap-3 rounded-[12px] border border-black/[0.06] bg-white p-3 transition-smooth shadow-sm">
                    <div className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[9px] bg-[#f1f5f4]">
                      <img
                        src={closet2}
                        alt="White Dress Shirt"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--primary-color)]">
                        Top Layer
                      </span>

                      <h6 className="m-0 text-[13px] font-bold leading-[1.35] text-[var(--dark-color)]">
                        Organic Cotton White Dress Shirt
                      </h6>

                      <p className="mt-1 mb-0 text-[11px] leading-[1.4] text-[var(--text-color)]">
                        Crisp, clean, professional base styling.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat Chips */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-primary-shadow px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]">
                    <i className="bi bi-stars text-[var(--primary-color)]" />
                    Daily Suggestion
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-primary-shadow px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]">
                    <i className="bi bi-calendar-event text-[var(--primary-color)]" />
                    Plan Event Outfit
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-primary-shadow px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]">
                    <i className="bi bi-graph-up text-[var(--primary-color)]" />
                    Trend-Scout
                  </span>
                </div>

                {/* Input */}
                <div className="mt-5 flex items-center gap-2 rounded-full border border-black/[0.08] bg-accent-beige p-1.5">
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-color)] transition-smooth hover:bg-white hover:text-[var(--primary-color)]"
                    aria-label="Add image"
                  >
                    <i className="bi bi-image" />
                  </button>

                  <input
                    type="text"
                    placeholder="Tell your stylist what you need…"
                    className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[12px] text-[var(--dark-color)] outline-none placeholder:text-black/40 focus:ring-0"
                  />

                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-color)] transition-smooth hover:bg-white hover:text-[var(--primary-color)]"
                    aria-label="Use microphone"
                  >
                    <i className="bi bi-mic" />
                  </button>

                  <button
                    type="submit"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)]"
                    aria-label="Send message"
                  >
                    <i className="bi bi-send-fill text-[11px]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div>
              <div className="max-w-[560px]">
                {/* Section Tag */}
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
                  <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
                  Empathetic Design Intelligence
                </span>

                <h2 className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
                  The AI Stylist That Understands Life
                </h2>

                <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5">
                  Your fashion choices shouldn't exist in a vacuum. DressApp
                  connects directly to your calendar feeds and precise localized
                  weather forecasts to design optimal outfits every day.
                </p>

                <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5">
                  Never step out under-dressed for high stakes business sessions
                  or unprepared for sudden rainfall. It feels like having a
                  world-Name sartorial advisor living in your phone, with
                  complete access to what you own.
                </p>

                {/* CTA */}
                <a
                  href="/stylist"
                  className="inline-flex items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[18px] text-[14px] font-bold leading-none text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  <i className="bi bi-stars mr-2" />
                  Ask the stylist
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* marketplace-section-start */}
      <section
        id="marketplace"
        className="w-full overflow-hidden bg-[var(--accent-beige)] px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mb-8">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              Zero Waste Initiative
            </span>

            <h2 className="mb-0 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
              Circular Wardrobe Marketplace
            </h2>

            <div className="flex items-center justify-between gap-8 max-[991px]:flex-col max-[991px]:items-start">
              <p className="max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand  mb-0">
                Buy, sell, or donate. Our integrated marketplace allows you to
                monetize under-utilized garments natively from your digital
                closet.
              </p>

              {/* Inline Stats */}
              <div className="flex shrink-0 items-center gap-5 max-[767px]:w-full max-[767px]:flex-wrap bg-white p-4 rounded-[12px]">
                {/* Active Listings */}
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-shadow)] text-[var(--primary-color)]">
                    <i className="bi bi-shop-window text-[17px]" />
                  </span>

                  <span className="flex flex-col text-[12px] font-semibold leading-[1.3] text-[var(--text-color)]">
                    <strong className="text-[15px] font-black text-[var(--dark-color)]">
                      {counts?.market ?? 0}
                    </strong>
                    Active listings
                  </span>
                </div>

                {/* Divider */}
                <span className="h-10 w-px bg-black/10 max-[767px]:hidden" />

                {/* Buy / Swap / Donate */}
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-shadow)] text-[var(--primary-color)]">
                    <i className="bi bi-arrow-repeat text-[17px]" />
                  </span>

                  <span className="flex flex-col text-[12px] font-semibold leading-[1.3] text-[var(--text-color)]">
                    Buy, swap
                    <small className="text-[11px] text-[var(--text-color)]">
                      or donate
                    </small>
                  </span>
                </div>

                {/* Explore */}
                <Link
                  to="/market"
                  className="inline-flex items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[18px] text-[14px] font-bold leading-none text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  Explore Marketplace
                  <i className="bi bi-arrow-right ml-2" />
                </Link>
              </div>
            </div>
          </div>

          {/* Marketplace Swiper */}
          <div ref={marketSwiperRef} className="swiper market-swiper relative">
            <div className="swiper-wrapper">
              {marketplaceItems.map((item) => (
                <div className="swiper-slide h-full" key={item.id}>
                  <div className="group overflow-hidden rounded-[12px] border border-black/[0.06] my-[20px] bg-white transition-smooth hover:-translate-y-[5px] hover:shadow-md">
                    {/* Image */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />

                      {/* Premium Badge */}
                      <span className="absolute left-3 top-3 rounded-full bg-[var(--primary-color)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-[var(--primary-shadow)]">
                        {item.badge}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h6 className="m-0 min-w-0 truncate text-[15px] font-black leading-[1.3] text-[var(--dark-color)]">
                          {item.title}
                        </h6>

                        <span className="shrink-0 text-[15px] font-black text-[var(--dark-color)]">
                          {item.price}
                        </span>
                      </div>

                      <p className="mt-2 mb-4 text-[12px] font-semibold leading-[1.6] text-[var(--text-color)]">
                        Condition: {item.condition}
                        <br />
                        Located in {item.location}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-[50px] border border-[var(--primary-color)] bg-[var(--primary-color)] px-3 py-2.5 text-[12px] font-bold text-white transition-smooth hover:-translate-y-[1px] hover:bg-[var(--primary-hover)]"
                        >
                          Buy
                        </button>

                        <button
                          type="button"
                          className="flex-1 rounded-[50px] border border-black/10 bg-white px-3 py-2.5 text-[12px] font-bold text-[var(--dark-color)] transition-smooth hover:-translate-y-[1px] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                        >
                          Swap
                        </button>

                        <button
                          type="button"
                          className="flex-1 rounded-[50px] border border-black/10 bg-white px-3 py-2.5 text-[12px] font-bold text-[var(--dark-color)] transition-smooth hover:-translate-y-[1px] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                        >
                          Donate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Previous Button */}
            <button
              type="button"
              className="swiper-button-prev market-swiper-prev !left-2 !top-1/2 !m-0 !flex !h-10 !w-10 !-translate-y-1/2 !items-center !justify-center !rounded-full !border !border-black/10 !bg-primary-brand !text-[var(--dark-color)] !shadow-[0_8px_20px_rgba(23,20,15,0.15)] after:!hidden transition-smooth hover:!bg-dark-brand hover:!text-white"
              aria-label="Previous marketplace slide"
            >
              <i className="bi bi-chevron-left text-[14px]" />
            </button>

            {/* Next Button */}
            <button
              type="button"
              className="swiper-button-next market-swiper-next !right-2 !top-1/2 !m-0 !flex !h-10 !w-10 !-translate-y-1/2 !items-center !justify-center !rounded-full !border !border-black/10 !bg-primary-brand !text-[var(--dark-color)] !shadow-[0_8px_20px_rgba(23,20,15,0.15)] after:!hidden transition-smooth hover:!bg-dark-brand hover:!text-white"
              aria-label="Next marketplace slide"
            >
              <i className="bi bi-chevron-right text-[14px]" />
            </button>
          </div>

          {/* Fee Information */}
          <div className="mt-12 flex justify-center">
            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-[var(--dark-color)] px-4 py-2 text-[12px] font-medium text-white">
              <i className="bi bi-info-circle text-[var(--primary-color)]" />
              Transparent 7% platform fee after payment processing. Zero hidden
              charges.
            </p>
          </div>
        </div>
      </section>
      {/* ai-fashion-editor-section */}
      <section
        id="ai-editor"
        className="w-full overflow-hidden bg-white px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          <div className="grid grid-cols-1 items-center gap-x-8 gap-y-8 md:grid-cols-12">
            {/* Editor - Right Side */}
            <div className="md:col-span-7 md:order-2">
              <div className="relative overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[var(--primary-shadow)] transition-smooth shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                {/* Editor Topbar */}
                <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-4 max-[575px]:flex-col max-[575px]:items-start">
                  <div>
                    <h5 className="m-0 flex items-center text-[14px] font-black text-[var(--dark-color)]">
                      <i className="bi bi-magic mr-2 text-[var(--primary-color)]" />
                      AI Styled Fashion Editor
                    </h5>

                    <p className="mt-1 mb-0 text-[11px] font-medium text-[var(--text-color)]">
                      Rendering live preview
                    </p>
                  </div>

                  {/* Export */}
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[11px] font-bold text-[var(--dark-color)] transition-smooth hover:-translate-y-[1px] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                  >
                    <i className="bi bi-download mr-2" />
                    Export Look
                  </button>
                </div>

                {/* Editor Body */}
                <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.35fr_0.65fr]">
                  {/* Canvas */}
                  <div className="relative min-h-[450px] overflow-hidden bg-[#f2eee8] max-[767px]:min-h-[400px]">
                    <img
                      src={editor}
                      alt="AI styled outfit preview"
                      className="block h-full min-h-[500px] w-full object-cover object-center max-[767px]:min-h-[400px]"
                    />

                    {/* AI Match Badge */}
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-[10px] font-black text-[var(--primary-color)] shadow-[0_8px_20px_rgba(23,20,15,0.12)] backdrop-blur-sm">
                      <i className="bi bi-stars" />
                      AI Match 96%
                    </span>
                  </div>

                  {/* Editor Tools */}
                  <div className="flex flex-col bg-white p-5">
                    {/* Tabs */}
                    <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-black/[0.06]">
                      <span className="whitespace-nowrap border-b-2 border-[var(--primary-color)] px-3 pb-2.5 text-[11px] font-black text-[var(--primary-color)]">
                        Top
                      </span>

                      <span className="whitespace-nowrap px-3 pb-2.5 text-[11px] font-semibold text-[var(--text-color)] transition-smooth hover:text-[var(--primary-color)]">
                        Bottom
                      </span>

                      <span className="whitespace-nowrap px-3 pb-2.5 text-[11px] font-semibold text-[var(--text-color)] transition-smooth hover:text-[var(--primary-color)]">
                        Shoes
                      </span>

                      <span className="whitespace-nowrap px-3 pb-2.5 text-[11px] font-semibold text-[var(--text-color)] transition-smooth hover:text-[var(--primary-color)]">
                        Accessory
                      </span>
                    </div>

                    {/* Fabric Tone */}
                    <div className="mb-6">
                      <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.08em] text-[var(--dark-color)]">
                        Fabric Tone
                      </span>

                      <div className="flex items-center gap-2.5">
                        <span className="h-8 w-8 cursor-pointer rounded-full border-[3px] border-white bg-[#1f5c45] shadow-[0_0_0_1px_var(--primary-color)] transition-smooth hover:scale-110" />

                        <span className="h-8 w-8 cursor-pointer rounded-full border-[3px] border-white bg-[#2c2c2c] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-smooth hover:scale-110" />

                        <span className="h-8 w-8 cursor-pointer rounded-full border-[3px] border-white bg-[#c9a876] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-smooth hover:scale-110" />

                        <span className="h-8 w-8 cursor-pointer rounded-full border-[3px] border-white bg-[#8a9aa8] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-smooth hover:scale-110" />

                        <span className="h-8 w-8 cursor-pointer rounded-full border-[3px] border-white bg-[#f5eee9] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-smooth hover:scale-110" />
                      </div>
                    </div>

                    {/* Style Intensity */}
                    <div className="mb-6">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--dark-color)]">
                          Style Intensity
                        </span>

                        <span className="text-[10px] font-semibold text-[var(--text-color)]">
                          72%
                        </span>
                      </div>

                      <div className="relative h-[5px] w-full rounded-full bg-[#e8e8e5]">
                        <div className="absolute left-0 top-0 h-full w-[72%] rounded-full bg-[var(--primary-color)]" />

                        <span className="absolute left-[72%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[var(--primary-color)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]" />
                      </div>
                    </div>

                    {/* Silhouette */}
                    <div className="mb-6">
                      <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.08em] text-[var(--dark-color)]">
                        Silhouette Fit
                      </span>

                      <div className="flex flex-wrap gap-2">
                        <span className="cursor-pointer rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]">
                          Slim
                        </span>

                        <span className="cursor-pointer rounded-full border border-[var(--primary-color)] bg-[var(--primary-color)] px-3 py-1.5 text-[10px] font-bold text-white">
                          Relaxed
                        </span>

                        <span className="cursor-pointer rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]">
                          Oversized
                        </span>
                      </div>
                    </div>

                    {/* Regenerate */}
                    <button
                      type="button"
                      className="mt-auto flex w-full items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-5 py-3.5 text-[13px] font-black text-white shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                    >
                      <i className="bi bi-stars mr-2" />
                      Regenerate with AI
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Left Side Content */}
            <div className="md:col-span-5 md:order-1">
              <div className="max-w-[540px]">
                {/* Section Tag */}
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
                  <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
                  Visual Styling Studio
                </span>

                <h2 className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
                  Your AI Styled Fashion Editor
                </h2>

                <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5">
                  Drag, swap, and recolor real garments from your closet on a
                  live model canvas. The editor understands fit, fabric, and
                  colour theory, so every combination it suggests already looks
                  intentional.
                </p>

                <p className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5">
                  Nudge the style intensity slider for a bolder edit, lock in a
                  silhouette, and let the AI regenerate accessories and layering
                  in real time — no design experience required.
                </p>

                {/* CTA */}
                <a
                  href="#"
                  className="inline-flex items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[18px] text-[14px] font-bold leading-none text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  <i className="bi bi-magic mr-2" />
                  Open Fashion Editor
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* experts-section */}
      <section
        id="experts"
        className="w-full overflow-hidden bg-[var(--accent-beige)] px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mb-12">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              Meet The Specialists
            </span>

            <a href="/experts" className="block no-underline">
              <h2 className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
                Talk To A Real Style Expert
              </h2>
            </a>

            <div className="flex items-center justify-between gap-8 max-[767px]:flex-col max-[767px]:items-start">
              <p className="max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand">
                Book a 1:1 session with a certified DressApp stylist whenever
                the AI needs a human, editorial finishing touch.
              </p>

              <a
                href="/experts"
                className="inline-flex shrink-0 items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[15px] text-[14px] font-bold leading-[24px] text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
              >
                View All Experts
                <i className="fa-solid fa-arrow-right ml-2" />
              </a>
            </div>
          </div>

          {/* Experts Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Expert 1 */}
            <div>
              <div className="group h-full rounded-[18px] border border-black/[0.06] bg-white p-6 text-center shadow-[0_15px_35px_-18px_rgba(23,20,15,0.3)] transition-smooth hover:-translate-y-[5px] hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                {/* Avatar */}
                <div className="relative mx-auto mb-5 h-[105px] w-[105px]">
                  <img
                    src={expert1}
                    alt="Amelia Novak"
                    className="h-full w-full rounded-full object-cover ring-4 ring-[var(--primary-shadow)]"
                  />

                  <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-color)] text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                    <i className="bi bi-patch-check-fill text-[13px]" />
                  </span>
                </div>

                <h5 className="m-0 mb-2 text-[17px] font-black text-[var(--dark-color)]">
                  Amelia Novak
                </h5>

                <span className="inline-flex rounded-full bg-[var(--primary-shadow)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--primary-color)]">
                  Senior Fashion Stylist
                </span>

                {/* Rating */}
                <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[var(--dark-color)]">
                  <i className="bi bi-star-fill text-[#d8a84e]" />
                  <span>4.9</span>
                  <span className="font-medium text-[var(--text-color)]">
                    (120 sessions)
                  </span>
                </div>

                <p className="my-4 text-[13px] font-medium leading-[22px] text-[var(--text-color)]">
                  Editorial-ready looks for high-stakes professional settings.
                </p>

                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 rounded-[50px] border border-[var(--primary-color)] bg-white px-5 py-2.5 text-[12px] font-bold text-[var(--primary-color)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-color)] hover:text-white"
                >
                  Book Session
                  <i className="bi bi-arrow-right" />
                </a>
              </div>
            </div>

            {/* Expert 2 */}
            <div>
              <div className="group h-full rounded-[18px] border border-black/[0.06] bg-white p-6 text-center shadow-[0_15px_35px_-18px_rgba(23,20,15,0.3)] transition-smooth hover:-translate-y-[5px] hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                <div className="relative mx-auto mb-5 h-[105px] w-[105px]">
                  <img
                    src={expert2}
                    alt="Marcus Lee"
                    className="h-full w-full rounded-full object-cover ring-4 ring-[var(--primary-shadow)]"
                  />

                  <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-color)] text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                    <i className="bi bi-patch-check-fill text-[13px]" />
                  </span>
                </div>

                <h5 className="m-0 mb-2 text-[17px] font-black text-[var(--dark-color)]">
                  Marcus Lee
                </h5>

                <span className="inline-flex rounded-full bg-[var(--primary-shadow)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--primary-color)]">
                  Menswear Consultant
                </span>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[var(--dark-color)]">
                  <i className="bi bi-star-fill text-[#d8a84e]" />
                  <span>4.8</span>
                  <span className="font-medium text-[var(--text-color)]">
                    (96 sessions)
                  </span>
                </div>

                <p className="my-4 text-[13px] font-medium leading-[22px] text-[var(--text-color)]">
                  Sharp, modern tailoring advice for the everyday gentleman.
                </p>

                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 rounded-[50px] border border-[var(--primary-color)] bg-white px-5 py-2.5 text-[12px] font-bold text-[var(--primary-color)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-color)] hover:text-white"
                >
                  Book Session
                  <i className="bi bi-arrow-right" />
                </a>
              </div>
            </div>

            {/* Expert 3 */}
            <div>
              <div className="group h-full rounded-[18px] border border-black/[0.06] bg-white p-6 text-center shadow-[0_15px_35px_-18px_rgba(23,20,15,0.3)] transition-smooth hover:-translate-y-[5px] hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                <div className="relative mx-auto mb-5 h-[105px] w-[105px]">
                  <img
                    src={expert3}
                    alt="Sofia Reyes"
                    className="h-full w-full rounded-full object-cover ring-4 ring-[var(--primary-shadow)]"
                  />

                  <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-color)] text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                    <i className="bi bi-patch-check-fill text-[13px]" />
                  </span>
                </div>

                <h5 className="m-0 mb-2 text-[17px] font-black text-[var(--dark-color)]">
                  Sofia Reyes
                </h5>

                <span className="inline-flex rounded-full bg-[var(--primary-shadow)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--primary-color)]">
                  Sustainable Fashion Advisor
                </span>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[var(--dark-color)]">
                  <i className="bi bi-star-fill text-[#d8a84e]" />
                  <span>5.0</span>
                  <span className="font-medium text-[var(--text-color)]">
                    (148 sessions)
                  </span>
                </div>

                <p className="my-4 text-[13px] font-medium leading-[22px] text-[var(--text-color)]">
                  Building a conscious wardrobe without compromising on style.
                </p>

                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 rounded-[50px] border border-[var(--primary-color)] bg-white px-5 py-2.5 text-[12px] font-bold text-[var(--primary-color)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-color)] hover:text-white"
                >
                  Book Session
                  <i className="bi bi-arrow-right" />
                </a>
              </div>
            </div>

            {/* Expert 4 */}
            <div>
              <div className="group h-full rounded-[18px] border border-black/[0.06] bg-white p-6 text-center shadow-[0_15px_35px_-18px_rgba(23,20,15,0.3)] transition-smooth hover:-translate-y-[5px] hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                <div className="relative mx-auto mb-5 h-[105px] w-[105px]">
                  <img
                    src={expert4}
                    alt="Priya Sharma"
                    className="h-full w-full rounded-full object-cover ring-4 ring-[var(--primary-shadow)]"
                  />

                  <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-color)] text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                    <i className="bi bi-patch-check-fill text-[13px]" />
                  </span>
                </div>

                <h5 className="m-0 mb-2 text-[17px] font-black text-[var(--dark-color)]">
                  Priya Sharma
                </h5>

                <span className="inline-flex rounded-full bg-[var(--primary-shadow)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--primary-color)]">
                  Occasion Wear Expert
                </span>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[var(--dark-color)]">
                  <i className="bi bi-star-fill text-[#d8a84e]" />
                  <span>4.9</span>
                  <span className="font-medium text-[var(--text-color)]">
                    (87 sessions)
                  </span>
                </div>

                <p className="my-4 text-[13px] font-medium leading-[22px] text-[var(--text-color)]">
                  Show-stopping looks for weddings, galas, and celebrations.
                </p>

                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 rounded-[50px] border border-[var(--primary-color)] bg-white px-5 py-2.5 text-[12px] font-bold text-[var(--primary-color)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-color)] hover:text-white"
                >
                  Book Session
                  <i className="bi bi-arrow-right" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* trend-scout-section-start */}
      <section
        className="relative overflow-hidden bg-white px-[40px] py-[80px]"
        id="trend-scout"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mb-12">
            {/* Tag */}
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand">
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              Fashion Intelligence
            </span>
            {/* Heading + View More */}
            <Link to="/trends" className="no-underline">
              <h2 className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]">
                The Trend Scout
              </h2>
            </Link>
            <div className="flex items-end justify-between gap-8">
              <p className="max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand">
                Get styled ahead of the global curve. Discover real-time
                stylistic shifts curated by computational trend models.
              </p>
              {/* View More */}
              <Link
                to="/trends"
                data-testid="home-trend-scout-title-link"
                className="
                inline-flex shrink-0 items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[15px] text-[14px] font-bold leading-[24px] text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
              >
                View More
                <i className="fa-solid fa-arrow-right ml-2" />
              </Link>
            </div>

            {/* Mobile View More */}
            <Link
              to="/trends"
              className="
          mt-5 inline-flex items-center gap-2
          rounded-full bg-[#1F6F6B]
          px-6 py-3
          text-sm font-bold text-white
          no-underline
          transition-all duration-300
          hover:-translate-y-1
          hover:bg-[#185c59]
          md:hidden
        "
            >
              View More
              <i className="fa-solid fa-arrow-right text-sm" />
            </Link>
          </div>

          {/* Swiper */}
          <div
            ref={trendSwiperRef}
            className="swiper trend-swiper relative !overflow-visible pb-2.5"
          >
            <div className="swiper-wrapper">
              {trends === null
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div className="swiper-slide h-auto" key={i}>
                      <Skeleton className="h-full min-h-[300px] w-full rounded-xl" />
                    </div>
                  ))
                : (trends.length > 0 ? trends : FALLBACK_TRENDS).map(
                    (card, i) => {
                      const prettyBucket = (bucket) =>
                        (bucket || "")
                          .replace(/[-_]+/g, " ")
                          .replace(/\b\w/g, (char) => char.toUpperCase());

                      const localisedBucket = card.bucket
                        ? t(`trends.bucket.${card.bucket}`, {
                            defaultValue: "",
                          })
                        : "";

                      const chip =
                        localisedBucket ||
                        card.label ||
                        prettyBucket(card.bucket) ||
                        card.tag;

                      const headline = card.headline || card.title;
                      const body = card.summary || card.body || card.blurb;
                      const sourceUrl = card.source_url;
                      const image =
                        card.image_url ||
                        "https://i.pinimg.com/736x/17/50/e9/1750e9027cf70bc488293df0f91daa1d.jpg";

                      return (
                        <div
                          className="swiper-slide !h-auto"
                          key={card.id || i}
                        >
                          {/* Card */}
                          <div
                            className="
                        group
                        relative
                        flex
                        aspect-square
                        flex-col
                        justify-end
                        overflow-hidden
                        rounded-xl
                        bg-cover
                        bg-top
                        p-5
                        transition-all
                        duration-300
                        ease-out
                        hover:-translate-y-2
                        hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]
                      "
                            style={{
                              backgroundImage: `url(${image})`,
                            }}
                          >
                            {/* Gradient */}
                            <div
                              className="
                          pointer-events-none
                          absolute inset-0
                          z-[1]
                          bg-gradient-to-t
                          from-black
                          via-black/0
                          to-transparent
                          transition-all
                          duration-300
                          group-hover:from-black
                          group-hover:via-black/30
                        "
                            />

                            {/* Content */}
                            <div className="relative z-[2]">
                              {/* Tag */}
                              <span
                                className="
                            mb-2.5
                            inline-block
                            rounded-full
                            bg-black
                            px-2 py-1
                            text-xs
                            font-extrabold
                            tracking-[0.5px]
                            text-white
                          "
                              >
                                {chip}
                              </span>

                              {/* Title */}
                              <h3
                                className="
                            mb-0
                            text-[16px]
                            font-extrabold
                            leading-[26px]
                            text-white
                          "
                              >
                                {headline}
                              </h3>

                              {/* Description */}
                              {body && (
                                <p
                                  className="
                              mb-0
                              text-[14px]
                              leading-[24px]
                              text-white
                            "
                                >
                                  {body}
                                </p>
                              )}

                              {/* Source */}
                              {sourceUrl && (
                                <a
                                  href={sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="
                              mt-2.5
                              inline-flex
                              items-center
                              gap-1.5
                              text-[0.85rem]
                              font-medium
                              text-white
                              no-underline
                              opacity-80
                              transition-all
                              duration-300
                              group-hover:gap-3
                              group-hover:opacity-100
                            "
                                >
                                  {t("home.trendReadSource", {
                                    defaultValue: "Read Editorial",
                                  })}

                                  <i className="bi bi-arrow-right" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
            </div>

            {/* Navigation ONLY when MORE THAN 4 cards */}
            {trends &&
              (trends.length > 0 ? trends.length : FALLBACK_TRENDS.length) >
                4 && (
                <>
                  {/* Previous */}
                  <button
                    type="button"
                    className="
                trend-swiper-prev
                !absolute
                !left-0
                !top-1/2
                !z-20
                !m-0
                !flex
                !h-11
                !w-11
                !-translate-y-1/2
                !items-center
                !justify-center
                !rounded-full
                !border-0
                !bg-[#1F6F6B]
                !text-white
                !shadow-md
                after:!hidden
                md:!-left-4
              "
                    aria-label="Previous trend"
                  >
                    <i className="bi bi-chevron-left text-sm" />
                  </button>

                  {/* Next */}
                  <button
                    type="button"
                    className="
                trend-swiper-next
                !absolute
                !right-0
                !top-1/2
                !z-20
                !m-0
                !flex
                !h-11
                !w-11
                !-translate-y-1/2
                !items-center
                !justify-center
                !rounded-full
                !border-0
                !bg-[#1F6F6B]
                !text-white
                !shadow-md
                after:!hidden
                md:!-right-4
              "
                    aria-label="Next trend"
                  >
                    <i className="bi bi-chevron-right text-sm" />
                  </button>
                </>
              )}
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
