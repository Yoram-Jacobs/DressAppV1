import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Info,
  ShieldAlert,
  Sparkles,
  User,
  BarChart4,
  MapPin,
  Phone,
  CircleHelp as HelpCircle,
  AlertTriangle,
  Layers,
  Wallet,
  ShoppingBag,
  Search,
  ClipboardList,
  Camera,
  Mic,
  Grid,
  TrendingUp,
  UserRound,
  Loader2,
  Bell,
  Megaphone,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ONBOARDING_TOUR_PENDING_KEY } from "@/lib/onboardingStore";

export function resolveHelpTabForLocation(location, viewerIsPro = false) {
  const rawPath = (
    location?.pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "/") ||
    "/"
  ).toLowerCase();
  const path = rawPath.replace(/\/+$/, "") || "/";
  const search =
    location?.search ??
    (typeof window !== "undefined" ? window.location.search : "") ??
    "";
  const params = new URLSearchParams(search);

  // 1. Adding Clothes vs. Import Wardrobe vs. Closet Page
  if (path === "/closet/add") {
    if (params.get("mode") === "import" || params.get("tab") === "import") {
      return "import-wardrobe";
    }
    return "adding-clothes";
  }
  if (path === "/closet" || path.startsWith("/closet/")) {
    return "closet-page";
  }

  // 2. Outfit Planner (Dress Up / Match) vs. AI Stylist Chat
  if (path === "/outfits") {
    return "dress-up";
  }
  if (path === "/stylist" || path.startsWith("/stylist/")) {
    const urlTab = params.get("tab");
    if (urlTab === "match" || urlTab === "planner" || urlTab === "outfits") {
      return "dress-up";
    }
    if (!urlTab && typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("dressapp.stylist.activeTab");
        if (stored && stored.replace(/^"|"$/g, "") === "match") {
          return "dress-up";
        }
      } catch {
        // ignore storage errors
      }
    }
    return "ai-stylist";
  }

  // 3. Suitcase Packing
  if (path === "/suitcase" || path.startsWith("/suitcase/")) {
    return "suitcase";
  }

  // 4. Marketplace & Transactions
  if (
    path === "/market" ||
    path.startsWith("/market/") ||
    path === "/transactions" ||
    path.startsWith("/transactions/")
  ) {
    return "marketplace";
  }

  // 5. Trend Scout
  if (path === "/trends" || path.startsWith("/trends/")) {
    return "trend-scout";
  }

  // 6. Certified Experts Directory
  if (path === "/experts" || path.startsWith("/experts/")) {
    return "experts";
  }

  // 7. Campaigns & Ads
  if (path === "/campaigns/create") {
    return viewerIsPro ? "create-campaign" : "campaigns";
  }
  if (
    path === "/campaigns" ||
    path.startsWith("/campaigns/") ||
    path === "/ads" ||
    path.startsWith("/ads/")
  ) {
    return viewerIsPro ? "expert-campaigns" : "campaigns";
  }

  // 8. Wardrobe Insights / Statistics
  if (path === "/me/stats" || path.startsWith("/me/stats/")) {
    return "wardrobe-stats";
  }

  // 9. Profile, Avatar & Scheduler
  if (
    path === "/me" ||
    path.startsWith("/me/") ||
    path === "/avatar" ||
    path === "/delete-account"
  ) {
    if (params.get("section") === "scheduler" || location?.hash === "#scheduler") {
      return "scheduler-push";
    }
    return "profile-matters";
  }

  // 10. Shopping Assistant / Browser Extension
  if (path === "/extension/connect" || path.startsWith("/extension/")) {
    return "shopping-assistant";
  }

  // 11. Subscription Tiers & Pricing
  if (path === "/pricing" || path.startsWith("/pricing/")) {
    return "tiers";
  }

  // 12. Auth / Prerequisites
  if (path === "/login" || path === "/register" || path === "/auth/callback") {
    return "prerequisites";
  }

  // 13. Admin / Troubleshooting
  if (path === "/admin" || path.startsWith("/admin/")) {
    return "troubleshooting";
  }

  // Default (/home, /, /about, /onboarding, etc.)
  return "overview";
}

export default function HelpMenu({ initialTab, onClose }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const viewerIsPro = !!user?.professional?.is_professional;
  const activeTabRef = useRef(null);

  const handleLaunchGrandTour = () => {
    try {
      localStorage.setItem(ONBOARDING_TOUR_PENDING_KEY, "true");
    } catch {}
    if (typeof onClose === "function") {
      onClose();
    }
    if (!user) {
      navigate("/onboarding");
      return;
    }
    if (window.location.pathname === "/closet") {
      window.dispatchEvent(new CustomEvent("dressapp:start-grand-tour"));
    } else if (window.location.pathname === "/stylist") {
      window.dispatchEvent(new CustomEvent("dressapp:start-stylist-tour"));
    } else {
      navigate("/closet?tour=1");
    }
  };

  const [activeTab, setActiveTab] = useState(
    () => initialTab || resolveHelpTabForLocation(location, viewerIsPro),
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      setActiveTab(resolveHelpTabForLocation(location, viewerIsPro));
    }
  }, [initialTab, location.pathname, location.search, location.hash, viewerIsPro]);

  useEffect(() => {
    if (activeTabRef.current) {
      try {
        activeTabRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch {
        // ignore scrollIntoView errors in older browsers
      }
    }
  }, [activeTab]);

  const langCode = String(i18n.language || "en").split("-")[0].toLowerCase();
  const isRtl = langCode === "he" || langCode === "ar" || i18n.dir?.() === "rtl";

  const isolateBidiSegment = (str, baseKey = "bdi") => {
    if (!isRtl || typeof str !== "string" || !str) return str;
    const tokenRegex = /([A-Za-z0-9$€£₪¥+%/@._-]+(?:\s+[A-Za-z0-9$€£₪¥+%/@._-]+)*)/g;
    const out = [];
    let last = 0;
    let m;
    let k = 0;
    while ((m = tokenRegex.exec(str)) !== null) {
      if (m.index > last) {
        out.push(str.slice(last, m.index));
      }
      out.push(
        <bdi key={`${baseKey}-${k++}`} dir="ltr" className="[unicode-bidi:isolate]">
          {m[0]}
        </bdi>,
      );
      last = tokenRegex.lastIndex;
    }
    if (last < str.length) {
      out.push(str.slice(last));
    }
    return out.length > 0 ? out : str;
  };

  const renderFormattedText = (rawStr, strongClassName = "text-foreground font-semibold") => {
    const str = String(rawStr ?? "");
    return str.split("**").map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className={strongClassName}>
          {isolateBidiSegment(part, `b-${i}`)}
        </strong>
      ) : (
        <span key={i}>{isolateBidiSegment(part, `t-${i}`)}</span>
      ),
    );
  };

  const SECTIONS = [
    {
      id: "overview",
      label: t("help.overview_title"),
      icon: BookOpen,
      wiki: "overview",
    },
    {
      id: "best-practice",
      label: t("help.best_practice_title", { defaultValue: "Best Practices" }),
      icon: CheckCircle2,
      wiki: "best-practice",
    },
    {
      id: "qa",
      label: t("help.qa_title", { defaultValue: "Q&A & FAQ" }),
      icon: HelpCircle,
      wiki: "Q&A",
    },
    {
      id: "prerequisites",
      label: t("help.prereq_title"),
      icon: ClipboardList,
      wiki: "prerequisites",
    },
    {
      id: "adding-clothes",
      label: t("help.add_clothes_title"),
      icon: Camera,
      wiki: "adding_clothes",
    },
    {
      id: "closet-page",
      label: t("help.closet_page_title"),
      icon: Grid,
      wiki: "closet_management",
    },
    {
      id: "ai-stylist",
      label: t("help.stylist_title"),
      icon: Mic,
      wiki: "ai_stylist",
    },
    {
      id: "scheduler-push",
      label: t("help.scheduler_push_title"),
      icon: Bell,
      wiki: "scheduler",
    },
    {
      id: "profile-matters",
      label: t("help.profile_title"),
      icon: User,
      wiki: "profile_management",
    },
    {
      id: "wardrobe-stats",
      label: t("help.stats_title"),
      icon: BarChart4,
      wiki: "wardrobe_insights",
    },
    {
      id: "dress-up",
      label: t("help.planner_title"),
      icon: Layers,
      wiki: "outfit_planner",
    },
    {
      id: "suitcase",
      label: t("help.suitcase_title"),
      icon: MapPin,
      wiki: "suitcase_packing",
    },
    {
      id: "marketplace",
      label: t("help.market_title"),
      icon: ShoppingBag,
      wiki: "marketplace_listing",
    },
    {
      id: "shopping-assistant",
      label: t("help.shopping_assistant_title"),
      icon: Globe,
      wiki: "chrome_extension",
    },
    {
      id: "import-wardrobe",
      label: t("help.import_wardrobe_title"),
      icon: Search,
      wiki: "import_wardrobe",
    },
    {
      id: "trend-scout",
      label: t("help.trend_scout_title"),
      icon: TrendingUp,
      wiki: "trend_scout",
    },
    {
      id: "experts",
      label: t("help.experts_title"),
      icon: UserRound,
      wiki: "experts_registry",
    },
    ...(viewerIsPro
      ? [
          {
            id: "expert-campaigns",
            label: t("help.expert_campaigns_title", {
              defaultValue: "My Campaigns (Expert)",
            }),
            icon: Megaphone,
            wiki: "expert_campaigns",
          },
          {
            id: "create-campaign",
            label: t("help.create_campaign_title", {
              defaultValue: "New Campaign (Expert)",
            }),
            icon: Sparkles,
            wiki: "create_campaign",
          },
        ]
      : [
          {
            id: "campaigns",
            label: t("help.campaigns_help_title"),
            icon: Megaphone,
            wiki: "campaigns",
          },
        ]),
    {
      id: "tiers",
      label: t("help.tiers_title", { defaultValue: "Subscription Tiers" }),
      icon: Wallet,
      wiki: "monetization",
    },
    {
      id: "troubleshooting",
      label: t("help.trouble_title"),
      icon: HelpCircle,
      wiki: "troubleshooting",
    },
  ];

  const activeSection = SECTIONS.find((s) => s.id === activeTab);

  const [viewingGuide, setViewingGuide] = useState(false);
  const [guideContent, setGuideContent] = useState("");
  const [loadingGuide, setLoadingGuide] = useState(false);

  useEffect(() => {
    setViewingGuide(false);
    setGuideContent("");
  }, [activeTab]);

  const loadGuide = async () => {
    if (!activeSection) return;
    setLoadingGuide(true);
    try {
      const res = await fetch(
        `/wiki/${i18n.language || "en"}/${activeSection.wiki}.md`,
      );
      if (res.ok) {
        const text = await res.text();
        setGuideContent(text);
        setViewingGuide(true);
      } else {
        const fallbackRes = await fetch(`/wiki/en/${activeSection.wiki}.md`);
        if (fallbackRes.ok) {
          const text = await fallbackRes.text();
          setGuideContent(text);
          setViewingGuide(true);
        }
      }
    } catch (err) {
      console.error("Failed to load guide:", err);
    } finally {
      setLoadingGuide(false);
    }
  };

  const parseMarkdown = (mdText) => {
    if (!mdText) return null;

    const lines = mdText.split("\n");
    const elements = [];
    let listItems = [];
    let tableRows = [];

    const flushTable = (key) => {
      if (tableRows.length > 0) {
        const headerCells = tableRows[0];
        const bodyRows = tableRows.slice(1).filter(
          (row) => !row.every((cell) => /^[-:\s]+$/.test(cell))
        );
        elements.push(
          <div key={`table-${key}`} className="my-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  {headerCells.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3 py-2 font-bold text-foreground text-start">
                      {parseInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-secondary/20">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-muted-foreground align-top">
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        tableRows = [];
      }
    };

    const flushList = (key) => {
      flushTable(key);
      if (listItems.length > 0) {
        elements.push(
          <ul
            key={`list-${key}`}
            dir={isRtl ? "rtl" : "ltr"}
            className={cn(
              "list-disc space-y-1.5 my-3 text-muted-foreground text-sm",
              isRtl ? "pr-5 text-right" : "pl-5 text-left",
            )}
          >
            {listItems.map((item, i) => (
              <li key={i} dir={isRtl ? "rtl" : "ltr"}>
                {parseInline(item)}
              </li>
            ))}
          </ul>,
        );
        listItems = [];
      }
    };

    const parseInline = (rawText) => {
      const text = String(rawText ?? "")
        .replace(/&rarr;/g, "→")
        .replace(/&larr;/g, "←")
        .replace(/&amp;/g, "&");
      const parts = [];
      const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
      let match;
      let lastIndex = 0;
      let keyIdx = 0;

      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
          parts.push(isolateBidiSegment(text.substring(lastIndex, matchIndex), `pi-${keyIdx++}`));
        }

        if (matchText.startsWith("**") && matchText.endsWith("**")) {
          parts.push(
            <strong key={keyIdx++} className="font-semibold text-foreground">
              {isolateBidiSegment(matchText.slice(2, -2), `pib-${keyIdx}`)}
            </strong>,
          );
        } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
          parts.push(
            <code
              key={keyIdx++}
              dir="auto"
              className="px-1.5 py-0.5 rounded bg-secondary/50 text-xs font-mono [unicode-bidi:isolate]"
            >
              {matchText.slice(1, -1)}
            </code>,
          );
        } else if (matchText.startsWith("[") && matchText.includes("](")) {
          const label = matchText.substring(1, matchText.indexOf("]"));
          const href = matchText.substring(
            matchText.indexOf("](") + 2,
            matchText.length - 1,
          );
          parts.push(
            <a
              key={keyIdx++}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {label}
            </a>,
          );
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        parts.push(isolateBidiSegment(text.substring(lastIndex), `pie-${keyIdx++}`));
      }

      return parts.length > 0 ? parts : isolateBidiSegment(text, "pi-all");
    };

    let inCode = false;
    let codeLines = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();

      if (line.startsWith("```")) {
        if (inCode) {
          elements.push(
            <pre
              key={`code-${idx}`}
              dir="ltr"
              className="p-4 rounded-lg bg-secondary/30 border border-border/40 font-mono text-xs overflow-x-auto my-4 text-foreground text-left"
            >
              {codeLines.join("\n")}
            </pre>,
          );
          inCode = false;
          codeLines = [];
        } else {
          inCode = true;
        }
        continue;
      }

      if (inCode) {
        codeLines.push(lines[idx]);
        continue;
      }

      if (line.startsWith("|") && line.endsWith("|")) {
        if (listItems.length > 0) {
          elements.push(
            <ul
              key={`list-pre-tbl-${idx}`}
              dir={isRtl ? "rtl" : "ltr"}
              className={cn(
                "list-disc space-y-1.5 my-3 text-muted-foreground text-sm",
                isRtl ? "pr-5 text-right" : "pl-5 text-left",
              )}
            >
              {listItems.map((item, i) => (
                <li key={i} dir={isRtl ? "rtl" : "ltr"}>
                  {parseInline(item)}
                </li>
              ))}
            </ul>,
          );
          listItems = [];
        }
        const cells = line
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        tableRows.push(cells);
        continue;
      } else if (tableRows.length > 0) {
        flushTable(idx);
      }

      if (line.startsWith("# ")) {
        flushList(idx);
        elements.push(
          <h1
            key={`h1-${idx}`}
            className="text-2xl font-bold text-primary mt-6 mb-3 pb-1 border-b border-border/50"
          >
            {parseInline(line.slice(2))}
          </h1>,
        );
        continue;
      }

      if (line.startsWith("## ")) {
        flushList(idx);
        elements.push(
          <h2
            key={`h2-${idx}`}
            className="text-xl font-bold text-foreground mt-5 mb-2.5"
          >
            {parseInline(line.slice(3))}
          </h2>,
        );
        continue;
      }

      if (line.startsWith("### ")) {
        flushList(idx);
        elements.push(
          <h3
            key={`h3-${idx}`}
            className="text-base font-semibold text-foreground mt-4 mb-2"
          >
            {parseInline(line.slice(4))}
          </h3>,
        );
        continue;
      }

      if (line.startsWith("- ") || line.startsWith("* ")) {
        listItems.push(line.slice(2));
        continue;
      }

      if (/^\d+\.\s/.test(line)) {
        flushList(idx);
        const match = line.match(/^\d+\.\s(.*)/);
        elements.push(
          <div
            key={`num-${idx}`}
            dir={isRtl ? "rtl" : "ltr"}
            className={cn(
              "flex gap-3 my-2 text-sm text-muted-foreground",
              isRtl ? "text-right" : "text-left",
            )}
          >
            <span dir="ltr" className="font-bold text-primary shrink-0 [unicode-bidi:isolate]">
              {line.match(/^\d+/)[0]}.
            </span>
            <p dir={isRtl ? "rtl" : "ltr"} className="pt-0.5">
              {parseInline(match[1])}
            </p>
          </div>,
        );
        continue;
      }

      if (line === "") {
        flushList(idx);
        continue;
      }

      if (line === "---") {
        flushList(idx);
        elements.push(
          <hr key={`hr-${idx}`} className="my-6 border-border/50" />,
        );
        continue;
      }

      if (line.startsWith("> ")) {
        flushList(idx);
        elements.push(
          <blockquote
            key={`quote-${idx}`}
            dir={isRtl ? "rtl" : "ltr"}
            className={cn(
              "border-primary/50 text-muted-foreground text-sm italic my-4",
              isRtl ? "pr-4 border-r-4 text-right" : "pl-4 border-l-4 text-left",
            )}
          >
            {parseInline(line.slice(2))}
          </blockquote>,
        );
        continue;
      }

      flushList(idx);
      elements.push(
        <p
          key={`p-${idx}`}
          dir={isRtl ? "rtl" : "ltr"}
          className="text-sm text-muted-foreground leading-relaxed my-3"
        >
          {parseInline(line)}
        </p>,
      );
    }

    flushList(lines.length);
    return elements;
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn("", isRtl ? "text-right" : "text-left")}
    >
      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-1/3 max-[480px]:hidden">
          <div className={cn("border-border", isRtl ? "md:border-l md:pl-4" : "md:border-r md:pr-4")}>
            <div>
              <h6 className="text-base font-extrabold text-foreground mb-2.5">
                {t("help.tableOfContents", {
                  defaultValue: "Table of Contents",
                })}
              </h6>
            </div>
            <ScrollArea>
              <nav className="flex flex-col">
                {SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      ref={isActive ? activeTabRef : null}
                      onClick={() => setActiveTab(sec.id)}
                      className={cn(
                        "group flex w-full items-center gap-2 border-0 text-[13px] font-bold leading-[23px] my-[10px] transition-colors",
                        isRtl ? "text-right" : "text-left",
                        isActive
                          ? "text-primary-brand font-extrabold"
                          : "text-text-brand hover:text-primary-brand",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isActive
                            ? "text-primary-brand"
                            : "text-text-brand group-hover:text-primary-brand",
                        )}
                      />
                      {sec.label}
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </div>
        </div>
        {/* Content Area */}
        <div className="w-full md:w-2/3">
          {/* Mobile quick tabs selection dropdown */}
          <div className="md:hidden border-b border-border py-5 my-5">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full border border-border rounded-[12px] h-11 px-5 py-2 text-[12px] font-semibold focus:outline-none focus:ring-0 focus:ring-offset-0"
            >
              {SECTIONS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>
          <ScrollArea>
            {viewingGuide ? (
              <div className="">
                <button onClick={() => setViewingGuide(false)}>
                  {isRtl ? "→" : "←"}{" "}
                  {t("help.backToSummary", {
                    defaultValue: "Back to Summary",
                  })}
                </button>
                <div className="">{parseMarkdown(guideContent)}</div>
              </div>
            ) : (
              <>
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <BookOpen className="h-5 w-5" />{" "}
                      {t("help.overview_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.overview_p1"))}
                    </p>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.overview_p2"))}
                    </p>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.overview_p3"))}
                    </p>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.overview_onboarding", {
                        defaultValue:
                          "Getting started takes under 60 seconds: calibrate your style DNA, 3D avatar measurements, and 24-piece Starter Capsule to see your first weather-aware AI outfit before you even sign in.",
                      })}
                    </p>
                    {user && (
                      <div className="p-3.5 rounded-[12px] border border-[var(--primary-color)]/30 bg-[var(--primary-color)]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[13px] font-bold text-dark-brand flex items-center gap-1.5">
                            <Compass className="h-4 w-4 text-[var(--primary-color)] shrink-0" />
                            <span>
                              {t("help.launchGrandTourTitle", {
                                defaultValue: "Interactive Getting Started Grand Tour",
                              })}
                            </span>
                          </div>
                          <p className="text-[12px] text-text-brand font-semibold">
                            {t("help.launchGrandTourDesc", {
                              defaultValue:
                                "Take a 4-step guided spotlight tour of AI Cutout & Cluster Upload, Calendar Stylist, Smart Search, and Profile Power-Up.",
                            })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleLaunchGrandTour}
                          data-testid="help-launch-grand-tour-btn"
                          className="rounded-full bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold shrink-0"
                        >
                          <Compass className="h-3.5 w-3.5 me-1.5" />
                          {t("help.launchGrandTourBtn", {
                            defaultValue: "Start Grand Tour",
                          })}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "best-practice" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <CheckCircle2 className="h-5 w-5" />{" "}
                      {t("help.best_practice_title", {
                        defaultValue: "Best Practices",
                      })}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(
                        t("help.best_practice_p1", {
                          defaultValue:
                            "Follow these simple habits to build an accurate digital closet, make the most of your daily credits, and get tailored outfit recommendations every day.",
                        }),
                      )}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.best_practice_step1", {
                          defaultValue:
                            "**Complete Your Profile First**: Set your body measurements, favorite colors, style preferences, and modesty level in your **Profile** before uploading clothes.",
                        }),
                        t("help.best_practice_step2", {
                          defaultValue:
                            "**Capture Clear Photos**: Upload a single item laid flat, a full-outfit mirror photo, or — on Manager and Professional plans, or Free accounts with 15+ AI reconstruction credits — photograph garments hanging in your closet, on a hanger, on a shoe rack, or in a folded pile.",
                        }),
                        t("help.best_practice_step3", {
                          defaultValue:
                            "**Know When to Use Cluster Upload**: Cluster garment upload is ideal for solid colors and simple plaid or striped items, but it consumes reconstruction credits, may skip some items, rarely reflects garment wear condition, and can hallucinate fine prints or colors.",
                        }),
                        t("help.best_practice_step4", {
                          defaultValue:
                            "**Build Your Closet in 5 Days**: Free users can use their 10 daily credits (accumulating up to 300 over 30 days) to add 10 items a day and digitize a 50-item core wardrobe in 5 days.",
                        }),
                        t("help.best_practice_step5", {
                          defaultValue:
                            "**Review Your Item Card (10 Seconds)**: Quickly verify the detected category, color, warmth, and dress code — especially after cluster reconstruction — so your stylist always has accurate details.",
                        }),
                        t("help.best_practice_step6", {
                          defaultValue:
                            "**Give the Stylist 4 Clues**: Mention your **occasion**, **setting**, **weather**, and **desired look** when asking the AI Stylist for an outfit.",
                        }),
                      ]
                        .filter(Boolean)
                        .map((text, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                              {idx + 1}
                            </span>
                            <span className="text-[14px] text-text-brand font-semibold">
                              {renderFormattedText(text)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {activeTab === "qa" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <HelpCircle className="h-5 w-5" />{" "}
                      {t("help.qa_title", {
                        defaultValue: "Q&A & FAQ",
                      })}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(
                        t("help.qa_p1", {
                          defaultValue:
                            "Quick answers to the most common questions about getting started, managing your credits, digitizing your wardrobe, and styling outfits.",
                        }),
                      )}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.qa_step1", {
                          defaultValue:
                            "**How do I start on Day 1?** Complete your **Profile** measurements and style preferences first, then add your 10 most-worn everyday items.",
                        }),
                        t("help.qa_step2", {
                          defaultValue:
                            "**How do free credits work?** Free accounts receive **10 daily credits** (accumulating up to 300 over 30 days) for single-item and outfit scans plus stylist chats, along with **5 one-time AI reconstruction onboarding bonus credits** to try studio repairs (these do not renew monthly; additional credits never expire and can be purchased in credit packs).",
                        }),
                        t("help.qa_step3", {
                          defaultValue:
                            "**How do Free users unlock Cluster Upload?** Cluster uploading (closets, hangers, shoe racks, or shirt piles) uses Nano Banana AI studio reconstruction and can process up to 15 garments per photo. Free users unlock the Cluster pipeline whenever they hold **15 or more AI reconstruction credits** (by purchasing an AI credit pack on the Pricing page), or by upgrading to a Manager or Professional plan.",
                        }),
                        t("help.qa_step4", {
                          defaultValue:
                            "**What can Cluster Upload digitize, and what are its limitations?** With 15+ AI reconstruction credits or a Manager/Professional plan, you can photograph clothes hanging in your closet, a rack of shoes, or a pile of shirts to digitize your closet in no time. Note that it works best on solid or simple plaid/striped items, cannot read hidden prints or fine details, rarely reflects wear condition, may skip some items, can hallucinate patterns or colors, and consumes 1 reconstruction credit per reconstructed item.",
                        }),
                        t("help.qa_step5", {
                          defaultValue:
                            "**What happens to my closet if I demote from Manager or Professional to the Free plan?** Demoting to the Free plan removes extra closet slots, **leaving only the last 50 added items** in your closet and permanently deleting older closet assets after you confirm the demotion warning.",
                        }),
                        t("help.qa_step6", {
                          defaultValue:
                            "**Is my wardrobe private?** Yes. Your photos and measurements are private to your account, and **DressApp's on-premises AI model** processes your wardrobe directly within our private environment.",
                        }),
                      ]
                        .filter(Boolean)
                        .map((text, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                              {idx + 1}
                            </span>
                            <span className="text-[14px] text-text-brand font-semibold">
                              {renderFormattedText(text)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {activeTab === "prerequisites" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <ClipboardList className="h-5 w-5" />{" "}
                      {t("help.prereq_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.prereq_p1")}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.prereq_item1"),
                        t("help.prereq_item2"),
                        t("help.prereq_item3"),
                        t("help.prereq_item4"),
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                            {idx + 1}
                          </span>
                          <span className="text-[14px] text-text-brand font-semibold">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "adding-clothes" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Camera className="h-5 w-5" />
                      {t("help.add_clothes_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.add_clothes_p1"))}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.add_clothes_step1"),
                        t("help.add_clothes_step2"),
                        t("help.add_clothes_step3"),
                        t("help.add_clothes_step4"),
                        t("help.add_clothes_step5"),
                        t("help.add_clothes_step6"),
                      ].map((text, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                            {idx + 1}
                          </span>

                          <span className="text-[14px] text-text-brand font-semibold">
                            {renderFormattedText(text)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "closet-page" && (
                  <div className="space-y-4">
                    <h6 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Grid className="h-5 w-5" /> {t("help.closet_page_title")}
                    </h6>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.closet_page_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.closet_view_title"),
                          desc: t("help.closet_view_desc"),
                        },
                        {
                          title: t("help.closet_select_title"),
                          desc: t("help.closet_select_desc"),
                        },
                        {
                          title: t("help.closet_group_title"),
                          desc: t("help.closet_group_desc"),
                        },
                        {
                          title: t("help.closet_edit_title"),
                          desc: t("help.closet_edit_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "ai-stylist" && (
                  <div className="space-y-4">
                    <h6 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Mic className="h-5 w-5" /> {t("help.stylist_title")}
                    </h6>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.stylist_p1"))}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.stylist_step1"),
                        t("help.stylist_step2"),
                        t("help.stylist_step3"),
                        t("help.stylist_step4"),
                        t("help.stylist_step5"),
                        t("help.stylist_step6"),
                        t("help.stylist_step7", { defaultValue: "" }),
                      ]
                        .filter(Boolean)
                        .map((text, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                              {idx + 1}
                            </span>
                            <span className="text-[14px] text-text-brand font-semibold">
                              {text
                                .split("**")
                                .map((part, i) =>
                                  i % 2 === 1 ? (
                                    <strong key={i}>{part}</strong>
                                  ) : (
                                    part
                                  ),
                                )}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {activeTab === "scheduler-push" && (
                  <div className="space-y-4">
                    <h6 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Bell className="h-5 w-5 text-foreground" />{" "}
                      {t("help.scheduler_push_title")}
                    </h6>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.scheduler_push_p1"))}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.scheduler_push_step1"),
                        t("help.scheduler_push_step2"),
                        t("help.scheduler_push_step3"),
                        t("help.scheduler_push_step4"),
                        t("help.scheduler_push_step5"),
                        t("help.scheduler_push_step6"),
                      ].map((text, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                            {idx + 1}
                          </span>
                          <span className="text-[14px] text-text-brand font-semibold">
                            {text
                              .split("**")
                              .map((part, i) =>
                                i % 2 === 1 ? (
                                  <strong key={i}>{part}</strong>
                                ) : (
                                  part
                                ),
                              )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "profile-matters" && (
                  <div className="space-y-4">
                    <h6 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <User className="h-5 w-5 text-foreground" />{" "}
                      {t("help.profile_title")}
                    </h6>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(t("help.profile_p1"))}
                    </p>
                    <div className="flex flex-col gap-4">
                      {Array.from({ length: 16 }, (_, i) => i + 1)
                        .map((num) => ({
                          title: t(`help.profile_item${num}_title`, {
                            defaultValue: "",
                          }),
                          desc: t(`help.profile_item${num}_desc`, {
                            defaultValue: "",
                          }),
                        }))
                        .filter((item) => item.title && item.desc)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                          >
                            <h4 className="font-bold text-[14px] text-text-brand">
                              {item.title}
                            </h4>
                            <p
                              className={cn(
                                "text-[12px] text-text-brand font-semibold leading-relaxed",
                                isRtl ? "pr-6" : "pl-6",
                              )}
                            >
                              <strong className="text-primary-brand">
                                {t("help.whyItMatters", {
                                  defaultValue: "Why it matters:",
                                })}
                              </strong>{" "}
                              {item.desc}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {activeTab === "wardrobe-stats" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <BarChart4 className="h-5 w-5" /> {t("help.stats_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.stats_p1")}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.stats_worth"),
                        t("help.stats_util"),
                        t("help.stats_cpw"),
                        t("help.stats_palette"),
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="text-[14px] text-text-brand font-semibold">
                            {item.split(":").map((part, i) =>
                              i === 0 ? (
                                <strong key={i} className="text-primary-brand">
                                  {part}:
                                </strong>
                              ) : (
                                part
                              ),
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "dress-up" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Layers className="h-5 w-5" /> {t("help.planner_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.planner_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.planner_item1_title"),
                          desc: t("help.planner_item1_desc"),
                        },
                        {
                          title: t("help.planner_item2_title"),
                          desc: t("help.planner_item2_desc"),
                        },
                        {
                          title: t("help.planner_item3_title"),
                          desc: t("help.planner_item3_desc"),
                        },
                        {
                          title: t("help.planner_item4_title"),
                          desc: t("help.planner_item4_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "suitcase" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <MapPin className="h-5 w-5" /> {t("help.suitcase_title")}
                    </h2>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.suitcase_step1"),
                        t("help.suitcase_step2"),
                        t("help.suitcase_step3"),
                        t("help.suitcase_step4"),
                        t("help.suitcase_step5"),
                      ].map((text, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                            {idx + 1}
                          </span>
                          <span className="text-[14px] text-text-brand font-semibold">
                            {text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "marketplace" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <ShoppingBag className="h-5 w-5" />{" "}
                      {t("help.market_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.market_p1")}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[t("help.market_step1"), t("help.market_step2")].map(
                        (text, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                              {idx + 1}
                            </span>
                            <span className="text-[14px] text-text-brand font-semibold">
                              {text.split(":").map((part, i) =>
                                i === 0 ? (
                                  <strong
                                    key={i}
                                    className="text-primary-brand"
                                  >
                                    {part}:
                                  </strong>
                                ) : (
                                  part
                                ),
                              )}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
                {activeTab === "shopping-assistant" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Globe className="h-5 w-5" />{" "}
                      {t("help.shopping_assistant_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.shopping_assistant_p1")}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.shopping_assistant_step1"),
                        t("help.shopping_assistant_step2"),
                        t("help.shopping_assistant_step3"),
                        t("help.shopping_assistant_step4"),
                        t("help.shopping_assistant_step5"),
                        t("help.shopping_assistant_step6"),
                      ].map((text, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                            {idx + 1}
                          </span>
                          <span className="text-[14px] text-text-brand font-semibold">
                            {text.split("**").map((part, i) =>
                              i % 2 === 1 ? (
                                <strong key={i} className="text-primary-brand">
                                  {part}
                                </strong>
                              ) : (
                                part
                              ),
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "import-wardrobe" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Search className="h-5 w-5" />{" "}
                      {t("help.import_wardrobe_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.import_wardrobe_p1")}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.import_wardrobe_step1"),
                        t("help.import_wardrobe_step2"),
                        t("help.import_wardrobe_step3"),
                        t("help.import_wardrobe_step4"),
                        t("help.import_wardrobe_step5"),
                        t("help.import_wardrobe_step6"),
                      ].map((text, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                            {idx + 1}
                          </span>
                          <span className="text-[14px] text-text-brand font-semibold">
                            {text.split("**").map((part, i) =>
                              i % 2 === 1 ? (
                                <strong key={i} className="text-primary-brand">
                                  {part}
                                </strong>
                              ) : (
                                part
                              ),
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === "trend-scout" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <TrendingUp className="h-5 w-5" />{" "}
                      {t("help.trend_scout_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.trend_scout_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.trend_feed_title"),
                          desc: t("help.trend_feed_desc"),
                        },
                        {
                          title: t("help.trend_buckets_title"),
                          desc: t("help.trend_buckets_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "experts" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <UserRound className="h-5 w-5" />{" "}
                      {t("help.experts_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.experts_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.experts_dir_title"),
                          desc: t("help.experts_dir_desc"),
                        },
                        {
                          title: t("help.experts_search_title"),
                          desc: t("help.experts_search_desc"),
                        },
                        {
                          title: t("help.experts_contact_title"),
                          desc: t("help.experts_contact_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "campaigns" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Megaphone className="h-5 w-5" />{" "}
                      {t("help.campaigns_help_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.campaigns_help_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.campaigns_feed_help_title"),
                          desc: t("help.campaigns_feed_help_desc"),
                        },
                        {
                          title: t("help.campaigns_maps_help_title"),
                          desc: t("help.campaigns_maps_help_desc"),
                        },
                        {
                          title: t("help.campaigns_save_help_title"),
                          desc: t("help.campaigns_save_help_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "expert-campaigns" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Megaphone className="h-5 w-5" />{" "}
                      {t("help.expert_campaigns_help_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.expert_campaigns_help_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.expert_campaigns_status_title"),
                          desc: t("help.expert_campaigns_status_desc"),
                        },
                        {
                          title: t("help.expert_campaigns_extend_title"),
                          desc: t("help.expert_campaigns_extend_desc"),
                        },
                        {
                          title: t("help.expert_campaigns_pause_title"),
                          desc: t("help.expert_campaigns_pause_desc"),
                        },
                        {
                          title: t("help.expert_campaigns_delete_title"),
                          desc: t("help.expert_campaigns_delete_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "create-campaign" && (
                  <div className="space-y-4">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Sparkles className="h-5 w-5" />{" "}
                      {t("help.create_campaign_help_title")}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.create_campaign_help_p1")}
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          title: t("help.create_campaign_button_title"),
                          desc: t("help.create_campaign_button_desc"),
                        },
                        {
                          title: t("help.create_campaign_step_title"),
                          desc: t("help.create_campaign_step_desc"),
                        },
                        {
                          title: t("help.create_campaign_fee_title"),
                          desc: t("help.create_campaign_fee_desc"),
                        },
                        {
                          title: t("help.create_campaign_submit_title"),
                          desc: t("help.create_campaign_submit_desc"),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1"
                        >
                          <h4 className="font-bold text-[14px] text-text-brand">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "troubleshooting" && (
                  <div className="space-y-6">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <AlertTriangle className="h-5 w-5" />{" "}
                      {t("help.trouble_title")}
                    </h2>
                    <div className="space-y-4">
                      <div className="p-4 rounded-[12px] border border-yellow-border bg-yellow-shadow space-y-2">
                        <h4 className="font-bold text-[14px] flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          {renderFormattedText(t("help.trouble_full_q"))}
                        </h4>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(t("help.trouble_full_why"))}
                        </p>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(t("help.trouble_full_fix"))}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h4 className="font-bold text-[14px] text-text-brand flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                          {renderFormattedText(t("help.trouble_cam_q"))}
                        </h4>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(t("help.trouble_cam_why"))}
                        </p>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(t("help.trouble_cam_fix"))}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h4 className="font-bold text-[14px] text-text-brand flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                          {renderFormattedText(t("help.trouble_slow_q"))}
                        </h4>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(t("help.trouble_slow_why"))}
                        </p>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(t("help.trouble_slow_fix"))}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h3 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                          {renderFormattedText(t("help.limit_title"))}
                        </h3>
                        <ul className="space-y-2 pl-1 pr-1">
                          <li className="flex items-start gap-3">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-brand mt-2 shrink-0"></span>
                            <span className="text-[12px] text-text-brand font-semibold">
                              {renderFormattedText(t("help.limit_item1"))}
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-brand mt-2 shrink-0"></span>
                            <span className="text-[12px] text-text-brand font-semibold">
                              {renderFormattedText(t("help.limit_item2"))}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "tiers" && (
                  <div className="space-y-6">
                    <h2 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Wallet className="h-5 w-5" />{" "}
                      {t("help.tiers_title", {
                        defaultValue: "Subscription Tiers",
                      })}
                    </h2>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {renderFormattedText(
                        t("help.tiers_p1", {
                          defaultValue:
                            "DressApp offers flexible subscription tiers tailored to your closet size and styling needs. Upgrade on the Pricing page to unlock unlimited features.",
                        }),
                      )}
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h3 className="font-bold text-[14px] text-text-brand">
                          {t("help.tiers_free_title", {
                            defaultValue: "Free Plan",
                          })}
                        </h3>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(
                            t("help.tiers_free_desc", {
                              defaultValue:
                                "Baseline limit of 50 items (expandable up to 150 items via friend referrals), 10 daily On-Premises AI credits (up to 300 over 30 days), and 5 one-time AI reconstruction onboarding bonus credits. Purchase AI credit packs (15+ credits) to unlock Cluster Upload.",
                            }),
                          )}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h3 className="font-bold text-[14px] text-text-brand">
                          {t("help.tiers_manager_title", {
                            defaultValue: "Manager Plan",
                          })}
                        </h3>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(
                            t("help.tiers_manager_desc", {
                              defaultValue:
                                "Costs $10/mo (or $100/yr). Removes closet size limits entirely, unlocks morning outfit push scheduler, calendar synchronization, circular marketplace selling, and Trend Scout ranking filters.",
                            }),
                          )}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-yellow-border bg-yellow-shadow space-y-1">
                        <h3 className="font-bold text-[14px] text-primary-brand">
                          {t("help.tiers_pro_title", {
                            defaultValue: "Professional Plan",
                          })}
                        </h3>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {renderFormattedText(
                            t("help.tiers_pro_desc", {
                              defaultValue:
                                "Costs $15/mo (or $150/yr). Built for style experts and fashion creators. Allows registration in the stylist directory, creation of fashion campaigns, priority support, and 100 monthly styling credits.",
                            }),
                          )}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-rose-200 bg-rose-50/70 space-y-1">
                        <h3 className="font-bold text-[14px] text-rose-800">
                          {t("help.tiers_demotion_title", {
                            defaultValue: "Plan Demotion & Closet Retention Warning",
                          })}
                        </h3>
                        <p className="text-[12px] text-rose-900 font-semibold leading-relaxed">
                          {renderFormattedText(
                            t("help.tiers_demotion_desc", {
                              defaultValue:
                                "Manager and Professional users who demote to the Free plan lose their extra closet slots, leaving only the last 50 added items in their closet. Older closet assets beyond the 50 most recently added items are permanently removed after you confirm the demotion warning.",
                            }),
                          )}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h4 className="font-bold text-[14px] text-text-brand">
                          {t("help.tiers_how_to_upgrade_title", {
                            defaultValue: "How to upgrade:",
                          })}
                        </h4>
                        <ol className={cn("list-decimal text-[12px] text-text-brand font-semibold space-y-1", isRtl ? "pr-5" : "pl-4")}>
                          <li>
                            {t("help.tiers_step1", {
                              defaultValue: "Go to your Profile settings page.",
                            })}
                          </li>
                          <li>
                            {t("help.tiers_step2", {
                              defaultValue:
                                "Scroll down to the System Preferences section.",
                            })}
                          </li>
                          <li>
                            {t("help.tiers_step3", {
                              defaultValue:
                                "Locate Closet & Subscription Limits and click on the Pricing Page link.",
                            })}
                          </li>
                          <li>
                            {t("help.tiers_step4", {
                              defaultValue:
                                "Select your preferred plan and complete checkout securely.",
                            })}
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
                {/* Wiki Link Footer */}
                {activeSection && (
                  <div className="mt-5">
                    <Button
                      onClick={loadGuide}
                      disabled={loadingGuide}
                      className="disabled:opacity-70"
                    >
                      {loadingGuide ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t("common.loading", { defaultValue: "Loading..." })}
                        </>
                      ) : (
                        <>
                          {t("help.learnMore", { defaultValue: "Learn more" })}
                          <i className="fa-solid fa-arrow-right"></i>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
