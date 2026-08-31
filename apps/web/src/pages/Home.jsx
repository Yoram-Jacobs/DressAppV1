import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useClosetStore } from "@/lib/useClosetStore";
import { useLocation as useAppLocation } from "@/lib/location";
import { useTrendScoutStore } from "@/lib/trendScoutStore";
import { api } from "@/lib/api";
import { AdTicker } from "@/components/AdTicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { toast } from "sonner";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/effect-fade";
import slide1 from "../assets/img/slide1.webp";
import slide2 from "../assets/img/slide2.webp";
import slide3 from "../assets/img/slide3.webp";
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
  const trendStore = useTrendScoutStore();
  const [counts, setCounts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
    (user?.address?.country_code || user?.home_location?.country_code || "")
      .toString()
      .toUpperCase() || null;

  // Resolve trends and date from the global store
  const trends =
    trendStore.loading && !trendStore.cards.length
      ? null
      : (trendStore.cards || []).slice(0, 4);
  const trendDate = trendStore.cards?.[0]?.date || null;

  const fetchTrends = async (force = false) => {
    try {
      await trendStore.prewarm({ language, country, force });
    } catch {
      // Handled in store, keep safe fallback
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
    try {
      await api.trendsRefreshAdmin(true, country);
      await fetchTrends(true);
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
    // We intentionally only run this once per mount; closet.total
    // updates flow through the dedicated effect below so the chip
    // stays accurate after add/delete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, country]);

  // Keep the closet chip in sync with store mutations from elsewhere
  // in the app (AddItem, ItemDetail delete, etc.) without a refetch.
  useEffect(() => {
    setCounts((prev) => {
      const closetCount = closet.total || (closet.items?.length ?? 0);
      if (prev && prev.closet === closetCount) return prev;
      return { closet: closetCount, market: prev?.market ?? 0 };
    });
  }, [closet.total, closet.items]);

  const firstName = (user?.display_name || user?.email || "").split(/\s|@/)[0];
  // hero-banner-slider
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = [slide1, slide2, slide3];
  const bannerSwiperRef = useRef(null);
  //
  const marketPrevRef = useRef(null);
  const marketNextRef = useRef(null);
  const trendPrevRef = useRef(null);
  const trendNextRef = useRef(null);
  const trendSwiperRef = useRef(null);
  const marketSwiperRef = useRef(null);
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
  const EXPERTS = [
    {
      id: "amelia-novak",
      name: "Amelia Novak", // proper noun — not translated
      image: expert1,
      roleKey: "home.experts.roles.seniorFashionStylist",
      roleDefault: "Senior Fashion Stylist",
      bioKey: "home.experts.bios.ameliaNovak",
      bioDefault:
        "Editorial-ready looks for high-stakes professional settings.",
      rating: 4.9,
      sessions: 120,
    },
    {
      id: "marcus-lee",
      name: "Marcus Lee",
      image: expert2,
      roleKey: "home.experts.roles.menswearConsultant",
      roleDefault: "Menswear Consultant",
      bioKey: "home.experts.bios.marcusLee",
      bioDefault: "Sharp, modern tailoring advice for the everyday gentleman.",
      rating: 4.8,
      sessions: 96,
    },
    {
      id: "sofia-reyes",
      name: "Sofia Reyes",
      image: expert3,
      roleKey: "home.experts.roles.sustainableFashionAdvisor",
      roleDefault: "Sustainable Fashion Advisor",
      bioKey: "home.experts.bios.sofiaReyes",
      bioDefault:
        "Building a conscious wardrobe without compromising on style.",
      rating: 5.0,
      sessions: 148,
    },
    {
      id: "priya-sharma",
      name: "Priya Sharma",
      image: expert4,
      roleKey: "home.experts.roles.occasionWearExpert",
      roleDefault: "Occasion Wear Expert",
      bioKey: "home.experts.bios.priyaSharma",
      bioDefault: "Show-stopping looks for weddings, galas, and celebrations.",
      rating: 4.9,
      sessions: 87,
    },
  ];
  const EDITOR_TABS = [
    { id: "top", labelKey: "home.aiEditor.tabs.top", labelDefault: "Top" },
    {
      id: "bottom",
      labelKey: "home.aiEditor.tabs.bottom",
      labelDefault: "Bottom",
    },
    {
      id: "shoes",
      labelKey: "home.aiEditor.tabs.shoes",
      labelDefault: "Shoes",
    },
    {
      id: "accessory",
      labelKey: "home.aiEditor.tabs.accessory",
      labelDefault: "Accessory",
    },
  ];

  const FABRIC_TONES = [
    {
      hex: "#1f5c45",
      labelKey: "home.aiEditor.tones.forest",
      labelDefault: "Forest green",
      active: true,
    },
    {
      hex: "#2c2c2c",
      labelKey: "home.aiEditor.tones.charcoal",
      labelDefault: "Charcoal",
    },
    {
      hex: "#c9a876",
      labelKey: "home.aiEditor.tones.camel",
      labelDefault: "Camel",
    },
    {
      hex: "#8a9aa8",
      labelKey: "home.aiEditor.tones.slate",
      labelDefault: "Slate blue",
    },
    {
      hex: "#f5eee9",
      labelKey: "home.aiEditor.tones.ivory",
      labelDefault: "Ivory",
    },
  ];

  const SILHOUETTE_OPTIONS = [
    {
      id: "slim",
      labelKey: "home.aiEditor.silhouettes.slim",
      labelDefault: "Slim",
    },
    {
      id: "relaxed",
      labelKey: "home.aiEditor.silhouettes.relaxed",
      labelDefault: "Relaxed",
    },
    {
      id: "oversized",
      labelKey: "home.aiEditor.silhouettes.oversized",
      labelDefault: "Oversized",
    },
  ];

  // Component state (replaces hardcoded "always Top / always Relaxed"):
  const [activeEditorTab, setActiveEditorTab] = useState(EDITOR_TABS[0].id);
  const [activeSilhouette, setActiveSilhouette] = useState("relaxed");

  // These two were plain hardcoded numbers (96, 72) baked into the JSX text.
  // Wire them to real preview state if you have it; otherwise keep as a
  // named constant so it's at least a single source of truth, not a magic
  // number repeated in two places (badge text + slider width):
  const AI_MATCH_PERCENT = 96;
  const STYLE_INTENSITY_PERCENT = 72;
  const STYLIST_PREVIEW_TABS = [
    { id: "chat", labelKey: "home.stylistPreview.tabs.chat", labelDefault: "Chat" },
    { id: "planner", labelKey: "home.stylistPreview.tabs.outfitPlanner", labelDefault: "Outfit Planner" },
    { id: "daily", labelKey: "home.stylistPreview.tabs.dailySuggestion", labelDefault: "Daily Suggestion" },
  ];

  const STYLIST_PREVIEW_RECOMMENDATIONS = [
    {
      id: "blazer",
      image: closet1,
      categoryKey: "home.stylistPreview.recs.blazer.category",
      categoryDefault: "Outerwear",
      titleKey: "home.stylistPreview.recs.blazer.title",
      titleDefault: "Navy Tech Blazer (Waterproof)",
      descriptionKey: "home.stylistPreview.recs.blazer.description",
      descriptionDefault: "Matches formal meetings, repels light drizzle.",
    },
    {
      id: "shirt",
      image: closet2,
      categoryKey: "home.stylistPreview.recs.shirt.category",
      categoryDefault: "Top Layer",
      titleKey: "home.stylistPreview.recs.shirt.title",
      titleDefault: "Organic Cotton White Dress Shirt",
      descriptionKey: "home.stylistPreview.recs.shirt.description",
      descriptionDefault: "Crisp, clean, professional base styling.",
    },
  ];

  const STYLIST_PREVIEW_CHIPS = [
    { id: "daily", icon: "bi-stars", labelKey: "home.stylistPreview.chips.dailySuggestion", labelDefault: "Daily Suggestion" },
    { id: "event", icon: "bi-calendar-event", labelKey: "home.stylistPreview.chips.planEventOutfit", labelDefault: "Plan Event Outfit" },
    { id: "trend", icon: "bi-graph-up", labelKey: "home.stylistPreview.chips.trendScout", labelDefault: "Trend-Scout" },
  ];
  const HOW_IT_WORKS_STEPS = [
    {
      id: "capture",
      number: "01",
      icon: Capture,
      altKey: "home.howItWorks.steps.capture.alt",
      altDefault: "capture cloth",
      titleKey: "home.howItWorks.steps.capture.title",
      titleDefault: "Capture Clothes",
      descriptionKey: "home.howItWorks.steps.capture.description",
      descriptionDefault:
        "Snap a quick photo of your actual garments. Works beautifully with all lightings and backgrounds.",
    },
    {
      id: "analysis",
      number: "02",
      icon: Analysis,
      altKey: "home.howItWorks.steps.analysis.alt",
      altDefault: "attribute analysis",
      titleKey: "home.howItWorks.steps.analysis.title",
      titleDefault: "AI Attribute Analysis",
      descriptionKey: "home.howItWorks.steps.analysis.description",
      descriptionDefault:
        "Our vision models detect colors, pattern, fabrics, cuts, and categories instantly and automatically.",
    },
    {
      id: "closet",
      number: "03",
      icon: Closet,
      altKey: "home.howItWorks.steps.closet.alt",
      altDefault: "smart closet",
      titleKey: "home.howItWorks.steps.closet.title",
      titleDefault: "Build Smart Closet",
      descriptionKey: "home.howItWorks.steps.closet.description",
      descriptionDefault:
        "Your clothing catalogs itself elegantly into categorization systems like Zara/COS online designs.",
    },
    {
      id: "styled",
      number: "04",
      icon: Effect,
      altKey: "home.howItWorks.steps.styled.alt",
      altDefault: "daily style",
      titleKey: "home.howItWorks.steps.styled.title",
      titleDefault: "Get Styled Daily",
      descriptionKey: "home.howItWorks.steps.styled.description",
      descriptionDefault:
        "Receive daily styled outfits contextualized to your precise geolocation weather and calendar meetings.",
    },
  ];
  const CLOSET_GARMENTS = [
  {
    id: "blazer",
    image: closet1,
    altKey: "home.closet.garments.blazer.alt",
    altDefault: "Navy blazer",
    categoryKey: "home.closet.garments.blazer.category",
    categoryDefault: "Outerwear",
    nameKey: "home.closet.garments.blazer.name",
    nameDefault: "Navy Tech Blazer",
    metaKey: "home.closet.garments.blazer.meta",
    metaDefault: "No. 014 — Waterproof",
  },
  {
    id: "sweater",
    image: closet2,
    altKey: "home.closet.garments.sweater.alt",
    altDefault: "Grey knit sweater",
    categoryKey: "home.closet.garments.sweater.category",
    categoryDefault: "Knitwear",
    nameKey: "home.closet.garments.sweater.name",
    nameDefault: "Merino Crewneck",
    metaKey: "home.closet.garments.sweater.meta",
    metaDefault: "No. 027 — Ash Grey",
  },
  {
    id: "shirt",
    image: closet3,
    altKey: "home.closet.garments.shirt.alt",
    altDefault: "White dress shirt",
    categoryKey: "home.closet.garments.shirt.category",
    categoryDefault: "Top Layer",
    nameKey: "home.closet.garments.shirt.name",
    nameDefault: "Cotton Dress Shirt",
    metaKey: "home.closet.garments.shirt.meta",
    metaDefault: "No. 041 — Chalk White",
  },
];

const RECENTLY_ADDED_THUMBS = [
  { id: "sneakers", image: added1, altKey: "home.closet.recent.sneakers", altDefault: "Sneakers" },
  { id: "jeans", image: added2, altKey: "home.closet.recent.jeans", altDefault: "Denim jeans" },
  { id: "bag", image: added3, altKey: "home.closet.recent.bag", altDefault: "Leather bag" },
  { id: "scarf", image: added4, altKey: "home.closet.recent.scarf", altDefault: "Scarf" },
];

// The "+18" badge — wire this to a real remaining-count if you have one
// (e.g. totalRecentCount - RECENTLY_ADDED_THUMBS.length); kept as a named
// constant so it isn't a bare magic number in the JSX.
const RECENTLY_ADDED_MORE_COUNT = 18;
  return (
    <>
      {/* Home-banner-start */}
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
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
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
                  {t("home.eyebrow", {
                    defaultValue: "AI wardrobe assistant for everyday styling",
                  })}
                </span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.3 }}
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
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.3 }}
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
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
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
          {/* ================= RIGHT IMAGE SLIDER ================= */}
          <div className="relative lg:col-span-7 h-full min-h-[560px] overflow-hidden lg:min-h-[calc(100vh-var(--header-height))]">
            <Swiper
              modules={[EffectFade, Autoplay, Navigation]}
              effect="fade"
              fadeEffect={{ crossFade: true }}
              loop={true}
              speed={1200}
              autoplay={{ delay: 4200, disableOnInteraction: false }}
              onSwiper={(swiper) => (bannerSwiperRef.current = swiper)}
              onSlideChange={(swiper) => setActiveSlide(swiper.realIndex)}
              className="banner-swiper absolute inset-0 h-full w-full"
            >
              {slides.map((image, index) => (
                <SwiperSlide key={image}>
                  <div
                    className="  absolute
              inset-0
              transition-all
              duration-[1200ms]
              ease-out"
                  >
                    <img
                      src={image}
                      alt={t("home.fashionSlideAlt", {
                        number: index + 1,
                        defaultValue: `Fashion slide ${index + 1}`,
                      })}
                      className="h-full w-full object-cover object-center"
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Image overlay */}
            <div
              className="
      pointer-events-none
      absolute
      inset-0
       z-10
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
                  onClick={() => bannerSwiperRef.current?.slideToLoop(index)}
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
                  {t("home.calenderesult", {
                    defaultValue: "  98% Match",
                  })}
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
      </section>
      {/* how-it-works-section-start */}
      <section
        id="how-it-works"
        className="w-full px-[40px] py-[80px] bg-white"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mx-auto mb-[42px] max-w-[700px] text-center">
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
            >
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              {t("home.howItWorks.tag", { defaultValue: "Seamless Process" })}
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
              className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]"
            >
              {t("home.howItWorks.heading", {
                defaultValue: "Revolutionizing Wardrobe Management",
              })}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
              className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand"
            >
              {t("home.howItWorks.description", {
                defaultValue:
                  "Getting beautifully dressed is now a four-step modern workflow managed by advanced Artificial Intelligence.",
              })}
            </motion.p>
          </div>
          {/* How Works Row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
                className="relative"
              >
                <div className="group relative h-full min-h-[209px] overflow-hidden rounded-[12px] bg-primary-shadow px-[30px] py-[30px] transition-smooth hover:-translate-y-[3px] hover:shadow-[var(--primary-shadow)]">
                  {/* Ghost Number */}
                  <span className="pointer-events-none absolute end-[18px] top-[8px] select-none text-[72px] font-extrabold leading-none text-[#66666617]">
                    {step.number}
                  </span>

                  {/* Icon */}
                  <div className="relative z-[1] mb-[22px] flex h-[48px] w-[48px] items-center justify-center">
                    <img
                      src={step.icon}
                      alt={t(step.altKey, { defaultValue: step.altDefault })}
                      className="h-[48px] w-[48px] object-contain transition-smooth group-hover:animate-reveal-png-icon"
                    />
                  </div>

                  <h4 className="relative z-[1] mb-[12px] text-[16px] font-bold leading-[1.3] text-black">
                    {t(step.titleKey, { defaultValue: step.titleDefault })}
                  </h4>

                  <p className="relative z-[1] m-0 max-w-[350px] text-[14px] leading-[1.7] text-[#68706e]">
                    {t(step.descriptionKey, {
                      defaultValue: step.descriptionDefault,
                    })}
                  </p>
                </div>

                {/* Arrow (hidden after the last card) */}
                {i < HOW_IT_WORKS_STEPS.length - 1 && (
                  <span className="absolute -end-[20px] top-1/2 z-[5] hidden h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full bg-primary-brand text-white shadow-[var(--primary-shadow)] lg:flex">
                    <ArrowRight size={16} className="rtl:rotate-180" />
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* how-it-works-section-end */}
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
                <motion.span
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
                >
                  <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
                  {t("home.closet.tag", { defaultValue: "Your Digital Wardrobe" })}
                </motion.span>

                <motion.h2
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                  className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]"
                >
                  {t("home.closet.heading", {
                    defaultValue: "Every Piece Finds Its Place",
                  })}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
                  className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand  mb-5"
                >
                  {t("home.closet.description1", {
                    defaultValue:
                      "Photograph anything you own — DressApp reads the fabric, the cut, the colour, and files it away like a stylist would: tagged, catalogued, ready to be pulled the moment you need it.",
                  })}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.4, ease: "easeOut" }}
                  className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5"
                >
                  {t("home.closet.description2", {
                    defaultValue:
                      "No more forgotten drawers. Search by keyword, or just describe a feeling — \"something warm for a rainy Monday\" — and the right piece finds its way back to you.",
                  })}
                </motion.p>

                {/* Button */}
                <motion.a
                  href="/closet"
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.5, ease: "easeOut" }}
                  className="mt-2 inline-flex items-center justify-center rounded-[50px] border-none bg-[var(--primary-color)] px-[30px] py-[20px] text-[14px] font-bold leading-none text-[var(--white)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-[var(--white)] hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  {t("home.closet.cta", {
                    defaultValue: "Start Building Your Closet",
                  })}
                  <i className="fa-solid fa-arrow-right ms-2 rtl:rotate-180" />
                </motion.a>
              </div>
            </div>
            {/* Right Visual */}
            <div className="md:col-span-8">
              <div className="relative w-full pt-[30px]">
                {/* Rail */}
                <div className="relative flex items-center">
                  <div className="h-[3px] w-full rounded-[3px] bg-[var(--dark-color)]" />
                  {/* Closet Count Badge */}
                  <span className="absolute end-0 top-[-46px] inline-flex items-center gap-[6px] rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-[0.72rem] font-semibold text-[var(--dark-color)] shadow-[0_10px_25px_-12px_rgba(23,20,15,0.25)]">
                    <i className="bi bi-stars text-[var(--primary-color)]" />
                    {!closet.lastFullSync &&
                      (closet.loading || counts === null) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        {counts?.closet ?? 0} : {t("home.piecesInCloset")}
                      </>
                    )}
                  </span>
                </div>
                {/* Garments */}
                <div className="flex items-start justify-between gap-6 max-[991px]:gap-[14px] max-[575px]:flex-wrap max-[575px]:justify-center">
                  {CLOSET_GARMENTS.map((garment) => (
                    <div
                      key={garment.id}
                      className="group relative flex flex-1 flex-col items-center transition-transform duration-300 ease-in hover:-translate-y-2 max-[575px]:basis-[45%]"
                    >
                      <div className="h-[26px] w-[2px] bg-[var(--dark-color)]" />
                      <div className="aspect-[4/5] w-full max-w-[190px] overflow-hidden rounded-[14px] border-[6px] border-white bg-white shadow-[0_22px_40px_-18px_rgba(23,20,15,0.35)] max-[991px]:max-w-[140px]">
                        <img
                          src={garment.image}
                          alt={t(garment.altKey, {
                            defaultValue: garment.altDefault,
                          })}
                          className="block h-full w-full object-cover"
                        />
                      </div>
                      <div className="relative mt-[22px] w-[88%] rounded-[8px] border border-[#e5e5e5] bg-white px-[14px] pb-3 pt-[10px] text-left shadow-[0_12px_22px_-14px_rgba(23,20,15,0.25)] max-[991px]:px-[10px] max-[991px]:pb-[10px] max-[991px]:pt-2">
                        <span className="absolute left-1/2 top-[-22px] h-[22px] w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,var(--dark-color)_0,var(--dark-color)_3px,transparent_3px,transparent_6px)]" />
                        <span className="absolute left-1/2 top-[-3px] h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-[var(--primary-color)]" />
                        <span className="mb-[3px] block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--primary-color)]">
                          {t(garment.categoryKey, {
                            defaultValue: garment.categoryDefault,
                          })}
                        </span>
                        <span className="block text-[0.92rem] font-bold leading-[1.3] text-[var(--dark-color)] max-[991px]:text-[0.8rem]">
                          {t(garment.nameKey, {
                            defaultValue: garment.nameDefault,
                          })}
                        </span>
                        <span className="mt-1 block text-[0.65rem] text-[var(--text-color)]">
                          {t(garment.metaKey, {
                            defaultValue: garment.metaDefault,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Recently Added */}
                <div className="mt-[56px] flex flex-wrap items-center gap-[18px] border-t border-dashed border-[#e5e5e5] pt-[26px] max-[575px]:mt-0 max-[575px]:flex-col max-[575px]:items-start max-[575px]:border-0">
                  <span className="whitespace-nowrap text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-color)]">
                    {t("home.closet.recentlyAdded", {
                      defaultValue: "Recently added",
                    })}
                  </span>
                  <div className="flex items-center">
                    {RECENTLY_ADDED_THUMBS.map((thumb, i) => (
                      <div
                        key={thumb.id}
                        className={
                          i === 0
                            ? "h-[52px] w-[52px] overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-white shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]"
                            : "-ms-[14px] h-[52px] w-[52px] overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-white shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]"
                        }
                      >
                        <img
                          src={thumb.image}
                          alt={t(thumb.altKey, { defaultValue: thumb.altDefault })}
                          className="block h-full w-full object-cover"
                        />
                      </div>
                    ))}
                    <div className="-ms-[14px] flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[12px] border-[3px] border-[var(--accent-beige)] bg-[var(--dark-color)] text-[0.68rem] font-bold text-[var(--accent-beige)] shadow-[0_6px_14px_-6px_rgba(23,20,15,0.3)]">
                      {t("home.closet.recentlyAddedMore", {
                        count: RECENTLY_ADDED_MORE_COUNT,
                        defaultValue: "+{{count}}",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* closet-section-end */}
      {/* stylist-section-start */}
      <section
        id="stylist"
        className="w-full overflow-hidden bg-white px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          <div className="grid grid-cols-1 items-center gap-x-8 gap-y-8 md:grid-cols-2">
            {/* Chat */}
            <div>
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                className="relative overflow-hidden rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[var(--primary-shadow)] transition-smooth shadow-[0_20px_45px_rgba(23,20,15,0.12)]"
              >
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
                          {t("home.stylistPreview.brandName", {
                            defaultValue: "DressApp AI Personal Stylist",
                          })}
                        </h5>

                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-color)]">
                          <span className="h-[7px] w-[7px] rounded-full bg-[#3ca76b]" />
                          {t("home.stylistPreview.activeStatus", {
                            defaultValue: "Active & Ready to Consult",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 rounded-full bg-accent-beige p-1 max-[575px]:w-full">
                      {STYLIST_PREVIEW_TABS.map((tab) => (
                        <span
                          key={tab.id}
                          className={
                            tab.id === "chat"
                              ? "rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--primary-color)] shadow-sm"
                              : "px-3 py-1.5 text-[12px] font-bold text-[var(--text-color)]"
                          }
                        >
                          {t(tab.labelKey, { defaultValue: tab.labelDefault })}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* User Message */}
                <div className="mb-3 ml-auto w-fit max-w-[75%] rounded-[12px] rounded-br-[0px] bg-[var(--primary-color)] px-4 py-3 text-[12px] leading-[1.5] text-white">
                  {t("home.stylistPreview.userMessage", {
                    defaultValue: "“What should I wear tomorrow?”",
                  })}
                </div>

                {/* AI Message */}
                <div className="mb-4 max-w-[90%] rounded-[12px] rounded-bl-[0px] font-semibold bg-accent-beige px-4 py-3 text-[12px] leading-[1.6] text-[var(--text-color)]">
                  {t("home.stylistPreview.aiMessagePrefix", {
                    defaultValue: "“Tomorrow is forecast for",
                  })}{" "}
                  <strong className="font-bold text-[var(--dark-color)]">
                    {t("home.stylistPreview.aiMessageWeather", {
                      defaultValue: "18°C with light morning rain",
                    })}
                  </strong>{" "}
                  {t("home.stylistPreview.aiMessageCalendarLead", {
                    defaultValue: "and your calendar notes a",
                  })}{" "}
                  <strong className="font-bold text-[var(--dark-color)]">
                    {t("home.stylistPreview.aiMessageMeeting", {
                      defaultValue: "10 AM Business Meeting",
                    })}
                  </strong>
                  {t("home.stylistPreview.aiMessageSuffix", {
                    defaultValue:
                      ". I recommend structuring a clean professional look built with technical weather protection.”",
                  })}
                </div>

                {/* Recommendations */}
                <div className="mt-4 flex flex-col gap-3">
                  {STYLIST_PREVIEW_RECOMMENDATIONS.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-3 rounded-[12px] border border-black/[0.06] bg-white p-3 transition-smooth shadow-sm"
                    >
                      <div className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[9px] bg-[#f1f5f4]">
                        <img
                          src={rec.image}
                          alt={t(rec.titleKey, {
                            defaultValue: rec.titleDefault,
                          })}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--primary-color)]">
                          {t(rec.categoryKey, {
                            defaultValue: rec.categoryDefault,
                          })}
                        </span>

                        <h6 className="m-0 text-[13px] font-bold leading-[1.35] text-[var(--dark-color)]">
                          {t(rec.titleKey, { defaultValue: rec.titleDefault })}
                        </h6>

                        <p className="mt-1 mb-0 text-[11px] leading-[1.4] text-[var(--text-color)]">
                          {t(rec.descriptionKey, {
                            defaultValue: rec.descriptionDefault,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Chips */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {STYLIST_PREVIEW_CHIPS.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-primary-shadow px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                    >
                      <i
                        className={`bi ${chip.icon} text-[var(--primary-color)]`}
                      />
                      {t(chip.labelKey, { defaultValue: chip.labelDefault })}
                    </span>
                  ))}
                </div>

                {/* Input */}
                <div className="mt-5 flex items-center gap-2 rounded-full border border-black/[0.08] bg-accent-beige p-1.5">
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-color)] transition-smooth hover:bg-white hover:text-[var(--primary-color)]"
                    aria-label={t("home.stylistPreview.addImageAria", {
                      defaultValue: "Add image",
                    })}
                  >
                    <i className="bi bi-image" />
                  </button>

                  <input
                    type="text"
                    placeholder={t("home.stylistPreview.inputPlaceholder", {
                      defaultValue: "Tell your stylist what you need…",
                    })}
                    className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[12px] text-[var(--dark-color)] outline-none placeholder:text-black/40 focus:ring-0"
                  />

                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-color)] transition-smooth hover:bg-white hover:text-[var(--primary-color)]"
                    aria-label={t("home.stylistPreview.micAria", {
                      defaultValue: "Use microphone",
                    })}
                  >
                    <i className="bi bi-mic" />
                  </button>

                  <button
                    type="submit"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)]"
                    aria-label={t("home.stylistPreview.sendAria", {
                      defaultValue: "Send message",
                    })}
                  >
                    <i className="bi bi-send-fill text-[11px]" />
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Right Content */}
            <div>
              <div className="max-w-[560px]">
                {/* Section Tag */}
                <motion.span
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
                >
                  <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
                  {t("home.stylist.tag", {
                    defaultValue: "Empathetic Design Intelligence",
                  })}
                </motion.span>

                <motion.h2
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                  className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]"
                >
                  {t("home.stylist.heading", {
                    defaultValue: "The AI Stylist That Understands Life",
                  })}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
                  className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5"
                >
                  {t("home.stylist.description1", {
                    defaultValue:
                      "Your fashion choices shouldn't exist in a vacuum. DressApp connects directly to your calendar feeds and precise localized weather forecasts to design optimal outfits every day.",
                  })}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.4, ease: "easeOut" }}
                  className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5"
                >
                  {t("home.stylist.description2", {
                    defaultValue:
                      "Never step out under-dressed for high stakes business sessions or unprepared for sudden rainfall. It feels like having a world-class sartorial advisor living in your phone, with complete access to what you own.",
                  })}
                </motion.p>

                {/* CTA */}
                <motion.a
                  href="/stylist"
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.5, ease: "easeOut" }}
                  className="inline-flex items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[18px] text-[14px] font-bold leading-none text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  <i className="bi bi-stars mr-2" />
                  {t("home.stylist.cta", { defaultValue: "Ask the stylist" })}
                </motion.a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* stylist-section-end */}
      {/* marketplace-section-start */}
      <section
        id="marketplace"
        className="w-full overflow-hidden bg-[var(--accent-beige)] px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mb-8">
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
            >
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              {t("home.marketplace.tag", {
                defaultValue: "Zero Waste Initiative",
              })}
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
              className="mb-0 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]"
            >
              {t("home.marketplace.heading", {
                defaultValue: "Circular Wardrobe Marketplace",
              })}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
              className="flex items-center justify-between gap-8 max-[991px]:flex-col max-[991px]:items-start"
            >
              <p className="max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-0">
                {t("home.marketplace.description", {
                  defaultValue:
                    "Buy, sell, or donate. Our integrated marketplace allows you to monetize under-utilized garments natively from your digital closet.",
                })}
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
                    {t("home.marketplace.activeListings", {
                      defaultValue: "Active listings",
                    })}
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
                    {t("home.marketplace.buySwap", {
                      defaultValue: "Buy, swap",
                    })}
                    <small className="text-[11px] text-[var(--text-color)]">
                      {t("home.marketplace.orDonate", {
                        defaultValue: "or donate",
                      })}
                    </small>
                  </span>
                </div>

                {/* Explore */}
                <Link
                  to="/market"
                  className="inline-flex items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[18px] text-[14px] font-bold leading-none text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  {t("home.marketplace.explore", {
                    defaultValue: "Explore Marketplace",
                  })}
                  <i className="bi bi-arrow-right ms-2 rtl:rotate-180" />
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Marketplace Swiper */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="market-swiper relative"
          >
            <Swiper
              modules={[Navigation, Autoplay]}
              slidesPerView={1.15}
              spaceBetween={15}
              loop={true}
              speed={800}
              autoplay={{
                delay: 2500,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
              breakpoints={{
                576: { slidesPerView: 2, spaceBetween: 15 },
                992: { slidesPerView: 3, spaceBetween: 15 },
                1200: { slidesPerView: 4, spaceBetween: 15 },
              }}
              onBeforeInit={(swiper) => {
                swiper.params.navigation.prevEl = marketPrevRef.current;
                swiper.params.navigation.nextEl = marketNextRef.current;
              }}
              navigation={{ prevEl: null, nextEl: null }}
            >
              {marketplaceItems.map((item, i) => (
                <SwiperSlide key={item.id} className="h-full">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{
                      duration: 0.5,
                      delay: (i % 4) * 0.1,
                      ease: "easeOut",
                    }}
                    className="group overflow-hidden rounded-[12px] border border-black/[0.06] my-[20px] bg-white transition-smooth hover:-translate-y-[5px] hover:shadow-md"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      <span className="absolute start-3 top-3 rounded-full bg-[var(--primary-color)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-[var(--primary-shadow)]">
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
                        {t("home.marketplace.conditionLine", {
                          condition: item.condition,
                          defaultValue: "Condition: {{condition}}",
                        })}
                        <br />
                        {t("home.marketplace.locationLine", {
                          location: item.location,
                          defaultValue: "Located in {{location}}",
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-[50px] border border-[var(--primary-color)] bg-[var(--primary-color)] px-3 py-2.5 text-[12px] font-bold text-white transition-smooth hover:-translate-y-[1px] hover:bg-[var(--primary-hover)]"
                        >
                          {t("home.marketplace.buy", { defaultValue: "Buy" })}
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-[50px] border border-black/10 bg-white px-3 py-2.5 text-[12px] font-bold text-[var(--dark-color)] transition-smooth hover:-translate-y-[1px] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                        >
                          {t("home.marketplace.swap", { defaultValue: "Swap" })}
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-[50px] border border-black/10 bg-white px-3 py-2.5 text-[12px] font-bold text-[var(--dark-color)] transition-smooth hover:-translate-y-[1px] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                        >
                          {t("home.marketplace.donate", {
                            defaultValue: "Donate",
                          })}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Previous Button */}
            <button
              ref={marketPrevRef}
              type="button"
              className="market-swiper-prev !absolute !start-2 !top-1/2 !z-20 !m-0 !flex !h-10 !w-10 !-translate-y-1/2 !items-center !justify-center !rounded-full !border !border-black/10 !bg-primary-brand !text-[var(--dark-color)] !shadow-[0_8px_20px_rgba(23,20,15,0.15)] transition-smooth hover:!bg-dark-brand hover:!text-white"
              aria-label={t("home.marketplace.prevAria", {
                defaultValue: "Previous marketplace slide",
              })}
            >
              <i className="bi bi-chevron-left rtl:rotate-180 text-[14px]" />
            </button>

            {/* Next Button */}
            <button
              ref={marketNextRef}
              type="button"
              className="market-swiper-next !absolute !end-2 !top-1/2 !z-20 !m-0 !flex !h-10 !w-10 !-translate-y-1/2 !items-center !justify-center !rounded-full !border !border-black/10 !bg-primary-brand !text-[var(--dark-color)] !shadow-[0_8px_20px_rgba(23,20,15,0.15)] transition-smooth hover:!bg-dark-brand hover:!text-white"
              aria-label={t("home.marketplace.nextAria", {
                defaultValue: "Next marketplace slide",
              })}
            >
              <i className="bi bi-chevron-right rtl:rotate-180 text-[14px]" />
            </button>
          </motion.div>

          {/* Fee Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="mt-12 flex justify-center"
          >
            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-[var(--dark-color)] px-4 py-2 text-[12px] font-medium text-white">
              <i className="bi bi-info-circle text-[var(--primary-color)]" />
              {t("home.marketplace.feeNotice", {
                defaultValue:
                  "Transparent 7% platform fee after payment processing. Zero hidden charges.",
              })}
            </p>
          </motion.div>
        </div>
      </section>
      {/* marketplace-section-end */}
      {/* ai-fashion-editor-section-start*/}
      <section
        id="ai-editor"
        className="w-full overflow-hidden bg-white px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          <div className="grid grid-cols-1 items-center gap-x-8 gap-y-8 md:grid-cols-12">
            {/* Editor - Right Side */}
            <div className="md:col-span-7 md:order-2">
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                className="relative overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[var(--primary-shadow)] transition-smooth shadow-[0_20px_45px_rgba(23,20,15,0.12)]"
              >
                {/* Editor Topbar */}
                <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-4 max-[575px]:flex-col max-[575px]:items-start">
                  <div>
                    <h5 className="m-0 flex items-center text-[14px] font-black text-[var(--dark-color)]">
                      <i className="bi bi-magic mr-2 text-[var(--primary-color)]" />
                      {t("home.aiEditor.title", {
                        defaultValue: "AI Styled Fashion Editor",
                      })}
                    </h5>

                    <p className="mt-1 mb-0 text-[11px] font-medium text-[var(--text-color)]">
                      {t("home.aiEditor.renderingLivePreview", {
                        defaultValue: "Rendering live preview",
                      })}
                    </p>
                  </div>

                  {/* Export */}
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[11px] font-bold text-[var(--dark-color)] transition-smooth hover:-translate-y-[1px] hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                  >
                    <i className="bi bi-download mr-2" />
                    {t("home.aiEditor.exportLook", {
                      defaultValue: "Export Look",
                    })}
                  </button>
                </div>

                {/* Editor Body */}
                <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.35fr_0.65fr]">
                  {/* Canvas */}
                  <div className="relative min-h-[450px] overflow-hidden bg-[#f2eee8] max-[767px]:min-h-[400px]">
                    <img
                      src={editor}
                      alt={t("home.aiEditor.previewAlt", {
                        defaultValue: "AI styled outfit preview",
                      })}
                      className="block h-full min-h-[500px] w-full object-cover object-center max-[767px]:min-h-[400px]"
                    />

                    {/* AI Match Badge */}
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-[10px] font-black text-[var(--primary-color)] shadow-[0_8px_20px_rgba(23,20,15,0.12)] backdrop-blur-sm">
                      <i className="bi bi-stars" />
                      {t("home.aiEditor.aiMatch", {
                        percent: AI_MATCH_PERCENT,
                        defaultValue: "AI Match {{percent}}%",
                      })}
                    </span>
                  </div>

                  {/* Editor Tools */}
                  <div className="flex flex-col bg-white p-5">
                    {/* Tabs */}
                    <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-black/[0.06]">
                      {EDITOR_TABS.map((tab) => (
                        <span
                          key={tab.id}
                          className={
                            tab.id === activeEditorTab
                              ? "whitespace-nowrap border-b-2 border-[var(--primary-color)] px-3 pb-2.5 text-[11px] font-black text-[var(--primary-color)]"
                              : "whitespace-nowrap px-3 pb-2.5 text-[11px] font-semibold text-[var(--text-color)] transition-smooth hover:text-[var(--primary-color)]"
                          }
                        >
                          {t(tab.labelKey, { defaultValue: tab.labelDefault })}
                        </span>
                      ))}
                    </div>

                    {/* Fabric Tone */}
                    <div className="mb-6">
                      <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.08em] text-[var(--dark-color)]">
                        {t("home.aiEditor.fabricTone", {
                          defaultValue: "Fabric Tone",
                        })}
                      </span>

                      <div className="flex items-center gap-2.5">
                        {FABRIC_TONES.map((tone) => (
                          <span
                            key={tone.hex}
                            aria-label={t(tone.labelKey, {
                              defaultValue: tone.labelDefault,
                            })}
                            style={{ backgroundColor: tone.hex }}
                            className={
                              tone.active
                                ? "h-8 w-8 cursor-pointer rounded-full border-[3px] border-white shadow-[0_0_0_1px_var(--primary-color)] transition-smooth hover:scale-110"
                                : "h-8 w-8 cursor-pointer rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-smooth hover:scale-110"
                            }
                          />
                        ))}
                      </div>
                    </div>

                    {/* Style Intensity */}
                    <div className="mb-6">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--dark-color)]">
                          {t("home.aiEditor.styleIntensity", {
                            defaultValue: "Style Intensity",
                          })}
                        </span>

                        <span className="text-[10px] font-semibold text-[var(--text-color)]">
                          {t("home.aiEditor.percentValue", {
                            percent: STYLE_INTENSITY_PERCENT,
                            defaultValue: "{{percent}}%",
                          })}
                        </span>
                      </div>

                      <div className="relative h-[5px] w-full rounded-full bg-[#e8e8e5]">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-[var(--primary-color)]"
                          style={{ width: `${STYLE_INTENSITY_PERCENT}%` }}
                        />

                        <span
                          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[var(--primary-color)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                          style={{ left: `${STYLE_INTENSITY_PERCENT}%` }}
                        />
                      </div>
                    </div>

                    {/* Silhouette */}
                    <div className="mb-6">
                      <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.08em] text-[var(--dark-color)]">
                        {t("home.aiEditor.silhouetteFit", {
                          defaultValue: "Silhouette Fit",
                        })}
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {SILHOUETTE_OPTIONS.map((option) => (
                          <span
                            key={option.id}
                            className={
                              option.id === activeSilhouette
                                ? "cursor-pointer rounded-full border border-[var(--primary-color)] bg-[var(--primary-color)] px-3 py-1.5 text-[10px] font-bold text-white"
                                : "cursor-pointer rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[10px] font-semibold text-[var(--text-color)] transition-smooth hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                            }
                          >
                            {t(option.labelKey, {
                              defaultValue: option.labelDefault,
                            })}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Regenerate */}
                    <button
                      type="button"
                      className="mt-auto flex w-full items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-5 py-3.5 text-[13px] font-black text-white shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                    >
                      <i className="bi bi-stars mr-2" />
                      {t("home.aiEditor.regenerate", {
                        defaultValue: "Regenerate with AI",
                      })}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Left Side Content */}
            <div className="md:col-span-5 md:order-1">
              <div className="max-w-[540px]">
                {/* Section Tag */}
                <motion.span
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
                >
                  <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
                  {t("home.aiEditor.tag", {
                    defaultValue: "Visual Styling Studio",
                  })}
                </motion.span>

                <motion.h2
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                  className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]"
                >
                  {t("home.aiEditor.heading", {
                    defaultValue: "Your AI Styled Fashion Editor",
                  })}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
                  className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5"
                >
                  {t("home.aiEditor.description1", {
                    defaultValue:
                      "Drag, swap, and recolor real garments from your closet on a live model canvas. The editor understands fit, fabric, and colour theory, so every combination it suggests already looks intentional.",
                  })}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.4, ease: "easeOut" }}
                  className="mx-auto max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand mb-5"
                >
                  {t("home.aiEditor.description2", {
                    defaultValue:
                      "Nudge the style intensity slider for a bolder edit, lock in a silhouette, and let the AI regenerate accessories and layering in real time — no design experience required.",
                  })}
                </motion.p>

                {/* CTA */}
                <motion.a
                  href="#"
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.65, delay: 0.5, ease: "easeOut" }}
                  className="inline-flex items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[18px] text-[14px] font-bold leading-none text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
                >
                  <i className="bi bi-magic mr-2" />
                  {t("home.aiEditor.cta", {
                    defaultValue: "Open Fashion Editor",
                  })}
                </motion.a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ai-fashion-editor-section-end */}
      {/* experts-section-start */}
      <section
        id="experts"
        className="w-full overflow-hidden bg-[var(--accent-beige)] px-[40px] py-[80px] max-[991px]:px-[20px] max-[991px]:py-[50px]"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mb-12">
            {/* Tag */}
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
            >
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              {t("home.experts.tag", { defaultValue: "Meet The Specialists" })}
            </motion.span>

            <a href="/experts" className="block no-underline">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] text-black md:text-[30px]"
              >
                {t("home.experts.title", {
                  defaultValue: "Talk To A Real Style Expert",
                })}
              </motion.h2>
            </a>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
              className="flex items-center justify-between gap-8 max-[767px]:flex-col max-[767px]:items-start"
            >
              <p className="max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand">
                {t("home.experts.description", {
                  defaultValue:
                    "Book a 1:1 session with a certified DressApp stylist whenever the AI needs a human, editorial finishing touch.",
                })}
              </p>

              <a
                href="/experts"
                className="inline-flex shrink-0 items-center justify-center rounded-[50px] bg-[var(--primary-color)] px-[30px] py-[15px] text-[14px] font-bold leading-[24px] text-white no-underline shadow-[var(--primary-shadow)] transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_8px_24px_rgba(31,92,69,0.25)]"
              >
                {t("home.experts.viewAll", {
                  defaultValue: "View All Experts",
                })}
                <i className="fa-solid fa-arrow-right ms-2 rtl:rotate-180" />
              </a>
            </motion.div>
          </div>

          {/* Experts Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {EXPERTS.map((expert, i) => (
              <motion.div
                key={expert.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              >
                <div className="group h-full rounded-[18px] border border-black/[0.06] bg-white p-6 text-center shadow-[0_15px_35px_-18px_rgba(23,20,15,0.3)] transition-smooth hover:-translate-y-[5px] hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]">
                  {/* Avatar */}
                  <div className="relative mx-auto mb-5 h-[105px] w-[105px]">
                    <img
                      src={expert.image}
                      alt={expert.name}
                      className="h-full w-full rounded-full object-cover ring-4 ring-[var(--primary-shadow)]"
                    />

                    <span className="absolute bottom-0 end-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--primary-color)] text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                      <i className="bi bi-patch-check-fill text-[13px]" />
                    </span>
                  </div>

                  <h5 className="m-0 mb-2 text-[17px] font-black text-[var(--dark-color)]">
                    {expert.name}
                  </h5>

                  <span className="inline-flex rounded-full bg-[var(--primary-shadow)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--primary-color)]">
                    {t(expert.roleKey, { defaultValue: expert.roleDefault })}
                  </span>

                  {/* Rating */}
                  <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[var(--dark-color)]">
                    <i className="bi bi-star-fill text-[#d8a84e]" />
                    <span>{expert.rating}</span>
                    <span className="font-medium text-[var(--text-color)]">
                      {t("home.experts.sessionsCount", {
                        count: expert.sessions,
                        defaultValue: "({{count}} sessions)",
                      })}
                    </span>
                  </div>

                  <p className="my-4 text-[13px] font-medium leading-[22px] text-[var(--text-color)]">
                    {t(expert.bioKey, { defaultValue: expert.bioDefault })}
                  </p>

                  <a
                    href="#"
                    className="inline-flex items-center justify-center gap-2 rounded-[50px] border border-[var(--primary-color)] bg-white px-5 py-2.5 text-[12px] font-bold text-[var(--primary-color)] no-underline transition-smooth hover:-translate-y-[2px] hover:bg-[var(--primary-color)] hover:text-white"
                  >
                    {t("home.experts.bookSession", {
                      defaultValue: "Book Session",
                    })}
                    <i className="bi bi-arrow-right rtl:rotate-180" />
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      {/* experts-section-end */}
      {/* trend-scout-section-start */}
      <section
        className="relative overflow-hidden bg-white px-[40px] py-[80px]"
        id="trend-scout"
      >
        <div className="w-full">
          {/* Section Heading */}
          <div className="mb-12">
            {/* Tag */}
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[12px] font-bold uppercase tracking-[1.5px] text-primary-brand"
            >
              <span className="h-[7px] w-[7px] rounded-full bg-primary-brand" />
              {t("home.trendScout.tag", {
                defaultValue: "Fashion Intelligence",
              })}
            </motion.span>

            {/* Heading + View More */}
            <Link to="/trends" className="">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                className="mb-3 text-[20px] font-extrabold leading-[40px] tracking-[0.5px] hover:underline hover:text-primary-brand text-black md:text-[30px]"
              >
                {t("home.trendScout", { defaultValue: "Trend-Scout" })}
              </motion.h2>
            </Link>

            <div className="flex items-end justify-between gap-8">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
                className="max-w-[620px] text-[16px] leading-[26px] font-semibold text-text-brand"
              >
                {t("home.trendScout.description", {
                  defaultValue:
                    "Get styled ahead of the global curve. Discover real-time stylistic shifts curated by computational trend models.",
                })}
              </motion.p>

              {/* View More */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, delay: 0.45, ease: "easeOut" }}
                className="flex items-center gap-2"
              >
                <div className="text-[12px] font-semibold text-text-brand">
                  {trendDate
                    ? t("home.dailyEditOn", { date: trendDate })
                    : t("home.dailyEdit")}
                </div>
                {/* Admin-only force-refresh button. Hidden for regular users
                — the daily 07:00 UTC cron + the auto-refresh on read in
                ``latest_trend_cards`` keep the feed fresh without manual
                intervention; this is just a triage / "I want it now"
                lever for the team. */}
                {isAdmin ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={refreshTrends}
                    disabled={refreshing}
                    aria-label={t("home.refreshTrends", {
                      defaultValue: "Refresh trends",
                    })}
                    title={t("home.refreshTrends", {
                      defaultValue: "Refresh trends",
                    })}
                    className="h-8 w-8 rounded-full text-primary-brand hover:text-dark-brand"
                    data-testid="home-trends-refresh-btn"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                  </Button>
                ) : null}
              </motion.div>
            </div>
          </div>

          {/* Swiper */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="trend-swiper relative !overflow-visible pb-2.5"
          >
            <Swiper
              modules={[Navigation, Autoplay]}
              slidesPerView={1.15}
              spaceBetween={15}
              loop={false}
              speed={800}
              autoplay={{
                delay: 2500,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
              breakpoints={{
                576: { slidesPerView: 2, spaceBetween: 15 },
                992: { slidesPerView: 3, spaceBetween: 15 },
                1200: { slidesPerView: 4, spaceBetween: 15 },
              }}
              onBeforeInit={(swiper) => {
                swiper.params.navigation.prevEl = trendPrevRef.current;
                swiper.params.navigation.nextEl = trendNextRef.current;
              }}
              navigation={{ prevEl: null, nextEl: null }}
            >
              {trends === null
                ? Array.from({ length: 4 }).map((_, i) => (
                  <SwiperSlide key={i} className="!h-auto">
                    <Skeleton className="h-full min-h-[300px] w-full rounded-xl" />
                  </SwiperSlide>
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
                      <SwiperSlide key={card.id || i} className="!h-auto">
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: false, amount: 0.3 }}
                          transition={{
                            duration: 0.5,
                            delay: i * 0.1,
                            ease: "easeOut",
                          }}
                          className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-xl bg-cover bg-top p-5 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(23,20,15,0.12)]"
                          style={{ backgroundImage: `url(${image})` }}
                        >
                          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black via-black/0 to-transparent transition-all duration-300 group-hover:from-black group-hover:via-black/30" />
                          <div className="relative z-[2]">
                            <span className="mb-2.5 inline-block rounded-full bg-black px-2 py-1 text-xs font-extrabold tracking-[0.5px] text-white">
                              {chip}
                            </span>
                            <h3 className="mb-0 text-[16px] font-extrabold leading-[26px] text-white">
                              {headline}
                            </h3>
                            {body && (
                              <p className="mb-0 text-[14px] leading-[24px] text-white">
                                {body}
                              </p>
                            )}
                            {sourceUrl && (
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2.5 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-white no-underline opacity-80 transition-all duration-300 group-hover:gap-3 group-hover:opacity-100"
                              >
                                {t("home.trendReadSource", {
                                  defaultValue: "Read Editorial",
                                })}
                                <i className="bi bi-arrow-right rtl:rotate-180" />
                              </a>
                            )}
                          </div>
                        </motion.div>
                      </SwiperSlide>
                    );
                  },
                )}
            </Swiper>

            {/* Navigation ONLY when MORE THAN 4 cards */}
            {trends &&
              (trends.length > 0 ? trends.length : FALLBACK_TRENDS.length) >
              4 && (
                <>
                  <button
                    ref={trendPrevRef}
                    type="button"
                    className="trend-swiper-prev !absolute !start-0 !top-1/2 !z-20 !m-0 !flex !h-11 !w-11 !-translate-y-1/2 !items-center !justify-center !rounded-full !border-0 !bg-[#1F6F6B] !text-white !shadow-md md:!-start-4"
                    aria-label={t("home.trendScout.prevAria", {
                      defaultValue: "Previous trend",
                    })}
                  >
                    <i className="bi bi-chevron-left rtl:rotate-180 text-sm" />
                  </button>
                  <button
                    ref={trendNextRef}
                    type="button"
                    className="trend-swiper-next !absolute !end-0 !top-1/2 !z-20 !m-0 !flex !h-11 !w-11 !-translate-y-1/2 !items-center !justify-center !rounded-full !border-0 !bg-[#1F6F6B] !text-white !shadow-md md:!-end-4"
                    aria-label={t("home.trendScout.nextAria", {
                      defaultValue: "Next trend",
                    })}
                  >
                    <i className="bi bi-chevron-right rtl:rotate-180 text-sm" />
                  </button>
                </>
              )}
          </motion.div>
        </div>
      </section>
      {/* trend-scout-section-end */}
      <div className="">
        <AdTicker placement="home-footer" className="-mx-4 sm:-mx-6 lg:-mx-8" />
      </div>
    </>
  );
}
