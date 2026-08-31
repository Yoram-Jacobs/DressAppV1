import { useState, useEffect } from "react";
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
  HelpCircle,
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
  Chrome,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function HelpMenu() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const isRtl = i18n.language === "he" || i18n.language === "ar";
  const viewerIsPro = !!user?.professional?.is_professional;

  const SECTIONS = [
    {
      id: "overview",
      label: t("help.overview_title"),
      icon: BookOpen,
      wiki: "overview",
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
      icon: Chrome,
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

    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(
          <ul
            key={`list-${key}`}
            className="list-disc pl-5 space-y-1.5 my-3 text-muted-foreground text-sm"
          >
            {listItems.map((item, i) => (
              <li key={i}>{parseInline(item)}</li>
            ))}
          </ul>,
        );
        listItems = [];
      }
    };

    const parseInline = (text) => {
      const parts = [];
      const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
      let match;
      let lastIndex = 0;
      let keyIdx = 0;

      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
          parts.push(text.substring(lastIndex, matchIndex));
        }

        if (matchText.startsWith("**") && matchText.endsWith("**")) {
          parts.push(
            <strong key={keyIdx++} className="font-semibold text-foreground">
              {matchText.slice(2, -2)}
            </strong>,
          );
        } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
          parts.push(
            <code
              key={keyIdx++}
              className="px-1.5 py-0.5 rounded bg-secondary/50 text-xs font-mono"
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
        parts.push(text.substring(lastIndex));
      }

      return parts.length > 0 ? parts : text;
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
              className="p-4 rounded-lg bg-secondary/30 border border-border/40 font-mono text-xs overflow-x-auto my-4 text-foreground"
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
            className="flex gap-3 my-2 text-sm text-muted-foreground"
          >
            <span className="font-bold text-primary shrink-0">
              {line.match(/^\d+/)[0]}.
            </span>
            <p className="pt-0.5">{parseInline(match[1])}</p>
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
            className="pl-4 border-l-4 border-primary/50 text-muted-foreground text-sm italic my-4"
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
        <div className="w-full md:w-1/3">
          <div className="border-r border-border md:pr-4">
            <div>
              <h6 className="text-base font-extrabold text-foreground mb-2.5">
                {isRtl
                  ? i18n.language === "he"
                    ? "תוכן העניינים"
                    : "جدول المحتويات"
                  : "Table of Contents"}
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
          <div className="md:hidden p-3 border-b border-border bg-secondary/15">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                  &larr; {isRtl ? "חזרה לתקציר" : "Back to Summary"}
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
                      {t("help.overview_p1")}
                    </p>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.overview_p2")}
                    </p>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.overview_p3")}
                    </p>
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
                      <li className="flex items-start gap-3">
                        <span className="h-6 w-6 shrink-0 rounded-full bg-primary-shadow flex items-center justify-center text-[12px] font-semibold text-primary-brand">
                          4
                        </span>
                        <span className="text-[14px] text-text-brand font-semibold">
                          {t("help.geminiKeyStep", {
                            defaultValue:
                              'A Gemini API Key. Get it for free on <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Google AI Studio</a>.',
                          })}
                        </span>
                      </li>
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
                      {t("help.add_clothes_p1")}
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
                            {text.split("**").map((part, i) =>
                              i % 2 === 1 ? (
                                <strong
                                  key={i}
                                  className="text-foreground font-semibold"
                                >
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
                      {t("help.stylist_p1")}
                    </p>
                    <ul className="space-y-3 pl-1 pr-1">
                      {[
                        t("help.stylist_step1"),
                        t("help.stylist_step2"),
                        t("help.stylist_step3"),
                        t("help.stylist_step4"),
                        t("help.stylist_step5"),
                        t("help.stylist_step6"),
                        t("help.stylist_step7"),
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
                {activeTab === "scheduler-push" && (
                  <div className="space-y-4">
                    <h6 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                      <Bell className="h-5 w-5 text-foreground" />{" "}
                      {t("help.scheduler_push_title")}
                    </h6>
                    <p className="text-[14px] leading-relaxed text-text-brand font-semibold">
                      {t("help.scheduler_push_p1")}
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
                      {t("help.profile_p1")}
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
                                {isRtl
                                  ? i18n.language === "he"
                                    ? "למה זה משנה:"
                                    : "لماذا يهم:"
                                  : "Why it matters:"}
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
                      <Chrome className="h-5 w-5" />{" "}
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
                          {t("help.trouble_full_q")}
                        </h4>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.trouble_full_why")}
                        </p>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.trouble_full_fix")}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h4 className="font-bold text-[14px] text-text-brand flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                          {t("help.trouble_cam_q")}
                        </h4>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.trouble_cam_why")}
                        </p>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.trouble_cam_fix")}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h4 className="font-bold text-[14px] text-text-brand flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                          {t("help.trouble_slow_q")}
                        </h4>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.trouble_slow_why")}
                        </p>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.trouble_slow_fix")}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h3 className="text-[16px] font-bold flex items-center gap-2 text-dark-brand">
                          {t("help.limit_title")}
                        </h3>
                        <ul className="space-y-2 pl-1 pr-1">
                          <li className="flex items-start gap-3">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-brand mt-2 shrink-0"></span>
                            <span className="text-[12px] text-text-brand font-semibold">
                              {t("help.limit_item1")}
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-brand mt-2 shrink-0"></span>
                            <span className="text-[12px] text-text-brand font-semibold">
                              {t("help.limit_item2")}
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
                      {t("help.tiers_p1", {
                        defaultValue:
                          "DressApp offers flexible subscription tiers tailored to your closet size and styling needs. Upgrade on the Pricing page to unlock unlimited features.",
                      })}
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h3 className="font-bold text-[14px] text-text-brand">
                          {t("help.tiers_free_title", {
                            defaultValue: "Free Plan",
                          })}
                        </h3>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.tiers_free_desc", {
                            defaultValue:
                              "Baseline limit of 50 items. Expandable up to 200 items by sharing your invite code with friends (+10 capacity slots per friend).",
                          })}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h3 className="font-bold text-[14px] text-text-brand">
                          {t("help.tiers_manager_title", {
                            defaultValue: "Manager Plan",
                          })}
                        </h3>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.tiers_manager_desc", {
                            defaultValue:
                              "Costs $4.99/mo. Removes closet size limits entirely, unlocks advanced stats, calendar synchronization, and Trend Scout ranking filters.",
                          })}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-yellow-border bg-yellow-shadow space-y-1">
                        <h3 className="font-bold text-[14px] text-primary-brand">
                          {t("help.tiers_pro_title", {
                            defaultValue: "Professional Plan",
                          })}
                        </h3>
                        <p className="text-[12px] text-text-brand font-semibold">
                          {t("help.tiers_pro_desc", {
                            defaultValue:
                              "Costs $9.99/mo. Built for style experts and fashion creators. Allows registration in the stylist directory and creation of fashion campaigns.",
                          })}
                        </p>
                      </div>
                      <div className="p-3 rounded-[12px] border border-border bg-primary-shadow space-y-1">
                        <h4 className="font-bold text-[14px] text-text-brand">
                          {t("help.tiers_how_to_upgrade_title", {
                            defaultValue: "How to upgrade:",
                          })}
                        </h4>
                        <ol className="list-decimal pl-4 text-[12px] text-text-brand font-semibold space-y-1">
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
                          {isRtl ? "טוען..." : "Loading..."}
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
