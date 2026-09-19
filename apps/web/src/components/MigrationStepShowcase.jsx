import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    Crown,
    ShieldCheck,
    Wand2,
    Eye,
    Lock,
    ArrowRight,
    CheckCircle2,
    Link2,
    RadioTower,
    Layers,
    XCircle,
    Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function MigrationStepShowcase({ t, setIsMigrationModalOpen }) {
    const [migrationStep, setMigrationStep] = useState(0);
    const [scanCount, setScanCount] = useState(5);
    const scanIntervalRef = useRef(null);

    const goToStep = (i) => {
        setMigrationStep(i);
    };

    const startScanCounter = () => {
        clearInterval(scanIntervalRef.current);
        setScanCount(5);
        scanIntervalRef.current = setInterval(() => {
            setScanCount((c) => (c >= 96 ? 12 : c + Math.ceil(Math.random() * 9)));
        }, 400);
    };

    const stopScanCounter = () => {
        clearInterval(scanIntervalRef.current);
        setScanCount(5);
    };

    const handleStepEnter = (i) => {
        goToStep(i);
        if (i === 1) startScanCounter();
        else stopScanCounter();
    };

    const steps = [
        {
            title: t("home.migration.step1Title", { defaultValue: "Connect your old wardrobe app" }),
            desc: t("home.migration.step1Desc", { defaultValue: "Pick Whering, Acloset, Stylebook & more." }),
        },
        {
            title: t("home.migration.step2Title", { defaultValue: "Watch the AI agent scan it live" }),
            desc: t("home.migration.step2Desc", { defaultValue: "Every card read, tagged & deduped on screen." }),
            locked: true,
        },
        {
            title: t("home.migration.step3Title", { defaultValue: "Your closet lands, fully tagged" }),
            desc: t("home.migration.step3Desc", { defaultValue: "Category, color, fabric & season — done." }),
        },
    ];

    // previously hardcoded — now translated
    const scanItems = [
        { nameKey: "home.migration.step2ItemBlazer", name: "Navy Blazer" },
        { nameKey: "home.migration.step2ItemShirt", name: "White Shirt" },
        null, // duplicate slot — uses dupeLabel instead
        { nameKey: "home.migration.step2ItemJeans", name: "Denim Jeans" },
    ];

    // previously hardcoded — now translated
    const closetCards = [
        { typeKey: "home.migration.closetCard1Type", type: "Top · Navy", nameKey: "home.migration.closetCard1Name", name: "Navy Tech Blazer" },
        { typeKey: "home.migration.closetCard2Type", type: "Top · White", nameKey: "home.migration.closetCard2Name", name: "Organic Cotton Shirt" },
        { typeKey: "home.migration.closetCard3Type", type: "Bottom · Charcoal", nameKey: "home.migration.closetCard3Name", name: "Straight Denim Jeans" },
        { typeKey: "home.migration.closetCard4Type", type: "Top · Black", nameKey: "home.migration.closetCard4Name", name: "Lime-Tipped Polo" },
    ];

    return (
        <section id="migration" className="relative w-full px-[40px] py-[80px] bg-white max-[991px]:px-[15px] max-[991px]:py-[30px] max-[767px]:px-[15px] max-[767px]:py-[30px] 
        max-[480px]:px-[15px] max-[480px]:py-[30px]">
            <div className="relative mx-auto max-w-7xl">
                {/* Section Heading */}
                <div className="mx-auto mb-[42px] max-w-[900px] text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.3 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="mb-4 flex gap-3 justify-center flex-wrap"
                    >
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e1de] bg-primary-shadow px-[15px] py-[5px] text-[10px] font-bold uppercase tracking-[1.5px] text-primary-brand">
                            <Sparkles className="h-3.5 w-3.5" />
                            {t("home.migration.eyebrow", {
                                defaultValue: "INDUSTRY-FIRST AI WARDROBE MIGRATION",
                            })}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-[15px] py-[5px] tracking-[1.5px] text-[10px] font-bold text-amber-700 border border-amber-500/30">
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                            {t("home.migration.proBadge", {
                                defaultValue: "PRO & MANAGER EXCLUSIVE",
                            })}
                        </span>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.3 }}
                        transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
                        className="mb-3 text-[30px] font-extrabold leading-[40px] tracking-[0.5px] text-black max-[480px]:text-[20px] max-[480px]:leading-[30px]"
                    >
                        {t("home.migration.title", {
                            defaultValue: "Migrate your Wardrobe in Seconds",
                        })}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.3 }}
                        transition={{ duration: 0.65, delay: 0.3, ease: "easeOut" }}
                        className="mx-auto max-w-[800px] text-[16px] leading-[26px] mb-4 font-semibold text-text-brand max-[480px]:text-[14px] max-[480px]:leading-[24px]"
                    >
                        {t("home.migration.subtitle", {
                            defaultValue:
                                "Import clothes seamlessly from Whering, Acloset, Stylebook & more. Our AI agent deduplicates your closet, fills in all item details automatically, and scans competitor apps live on screen.",
                        })}
                    </motion.p>
                    <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm font-bold text-[var(--dark-color)]">
                        <span className="inline-flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-[var(--primary-color)]" />
                            {t("home.migration.strip1", {
                                defaultValue: "Zero duplicate items",
                            })}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Wand2 className="h-4 w-4 text-[var(--primary-color)]" />
                            {t("home.migration.strip2", {
                                defaultValue: "Every detail auto-filled",
                            })}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Eye className="h-4 w-4 text-[var(--primary-color)]" />
                            {t("home.migration.strip3", {
                                defaultValue: "100% visible while it runs",
                            })}
                        </span>
                    </div>
                </div>
                {/* ================= STEP-BY-STEP LIVE SHOWCASE ================= */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="relative rounded-[12px] border border-border bg-accent-beige p-5 shadow-xl overflow-hidden mb-10"
                >
                    <div className="grid lg:grid-cols-[350px_1fr] gap-5 ">
                        {/* LEFT: numbered step nav */}
                        <div className="relative flex lg:flex-col gap-3 lg:gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                            {steps.map((step, i) => {
                                const isActive = migrationStep === i;
                                return (
                                    <button
                                        key={step.title}
                                        type="button"
                                        onMouseEnter={() => handleStepEnter(i)}
                                        onClick={() => handleStepEnter(i)}
                                        className={`relative flex-1 lg:flex-none min-w-[220px] lg:min-w-0 text-left rounded-[12px] border px-4 py-3.5 transition-colors ${isActive
                                            ? "border-primary-brand bg-primary-shadow"
                                            : "border-border bg-white hover:bg-primary-shadow"
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[12px] font-extrabold transition-colors ${isActive
                                                    ? "border-primary-brand bg-primary-brand text-white"
                                                    : "border-border text-text-brand"
                                                    }`}
                                            >
                                                {i + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <h6 className={`text-[12px] font-bold truncate ${isActive ? "text-dark-brand" : "text-text-brand"}`}>
                                                        {step.title}
                                                    </h6>
                                                    {step.locked && (
                                                        <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-semibold text-text-brand mt-0.5 leading-snug">
                                                    {step.desc}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {/* RIGHT: preview panel */}
                        <div className="relative">
                            <AnimatePresence mode="wait">
                                {migrationStep === 0 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="h-full rounded-[12px] border border-border bg-white p-20 max-[480px]:p-5"
                                    >
                                        <div className="text-center">
                                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-shadow text-primary-brand">
                                                <Sparkles className="h-6 w-6" />
                                            </div>
                                            <h4 className="text-[20px] font-bold text-dark-brand mb-2 max-[480px]:text-[14px]">
                                                {t("home.migration.modalTitle", {
                                                    defaultValue: "Import Your Existing Wardrobe?",
                                                })}
                                            </h4>
                                            <p className="text-[14px] text-text-brand mb-5 leading-relaxed font-semibold max-[480px]:text-[12px]">
                                                {t("home.migration.modalDesc", {
                                                    defaultValue:
                                                        "Already have a digital wardrobe on another app? We can bring your clothes over so you don't have to start from scratch.",
                                                })}
                                            </p>
                                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                                {["Whering", "Acloset", "Stylebook", "Smartli"].map(
                                                    (app) => (
                                                        <span
                                                            key={app}
                                                            className="rounded-full bg-primary-shadow px-3 py-1 text-[10px] font-semibold text-primary-brand"
                                                        >
                                                            {app}
                                                        </span>
                                                    ),
                                                )}
                                            </div>
                                            <div className="flex gap-3 justify-center flex-wrap">
                                                <span className="rounded-full border border-border px-4 py-2.5 text-[12px] font-bold text-text-brand">
                                                    {t("home.migration.modalSkip", {
                                                        defaultValue: "No, start fresh",
                                                    })}
                                                </span>
                                                <span className="rounded-full bg-primary-brand px-4 py-2.5 text-[12px] font-bold text-white">
                                                    {t("home.migration.modalGo", {
                                                        defaultValue: "Yes, import my wardrobe",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                {migrationStep === 1 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="h-full rounded-[12px] border border-border bg-white p-20 space-y-3 max-[480px]:p-5"
                                    >
                                        <div className="flex items-center justify-between flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex rounded-full h-2.5 w-2.5 bg-[var(--primary-color)]" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-[var(--dark-color)]">
                                                    {t("home.migration.liveStatus", {
                                                        defaultValue: "Competitor Tab — Live",
                                                    })}
                                                </span>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] font-semibold border-primary-brand text-white bg-primary-brand"
                                            >
                                                {t("home.migration.agentStatus", {
                                                    defaultValue: "DressApp Agent Active",
                                                })}
                                            </Badge>
                                        </div>
                                        <div className="relative rounded-[12px] border border-border bg-white shadow-sm overflow-hidden">
                                            <div className="flex items-center gap-1.5 border-b border-border bg-primary-shadow p-3">
                                                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                                                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                                                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                                                <span className="ms-2 text-[11px] text-text-brand font-semibold truncate">
                                                    app.whering.co.uk/closet
                                                </span>
                                            </div>
                                            <div className="relative p-3">
                                                <div className="w-fit flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2">
                                                    <RadioTower className="h-3.5 w-3.5 text-yellow-brand" />
                                                    <div className="leading-tight">
                                                        <p className="text-[10px] font-bold text-white mb-0.5">
                                                            {t("home.migration.agentWidgetTitle", {
                                                                defaultValue: "DressApp Agent",
                                                            })}
                                                        </p>
                                                        <p className="text-[9px] text-slate-400">
                                                            {t("home.migration.agentWidgetSubtitle", {
                                                                defaultValue: "Scanning closet…",
                                                            })}{" "}
                                                            {scanCount}{" "}
                                                            {t("home.migration.cardsFound", {
                                                                defaultValue: "cards found",
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 mt-3 max-[480px]:grid-cols-2">
                                                    {scanItems.map((item, idx) => {
                                                        const isDupe = !item;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`relative rounded-[12px] border p-2 text-center ${isDupe
                                                                    ? "border-amber-400/70 bg-white opacity-60"
                                                                    : "border-primary-brand bg-primary-shadow"
                                                                    }`}
                                                            >
                                                                <span
                                                                    className={`absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-white shadow ${isDupe
                                                                        ? "bg-amber-500"
                                                                        : "bg-primary-brand"
                                                                        }`}
                                                                >
                                                                    {isDupe ? (
                                                                        <XCircle className="h-3 w-3" />
                                                                    ) : (
                                                                        <Check className="h-3 w-3" />
                                                                    )}
                                                                </span>
                                                                <div className="h-14 w-full rounded bg-white mb-1" />
                                                                <span
                                                                    className={`text-[10px] font-bold block truncate ${isDupe ? "text-text-brand line-through" : "text-dark-brand"}`}
                                                                >
                                                                    {isDupe
                                                                        ? t("home.migration.dupeLabel", {
                                                                            defaultValue: "Duplicate — skipped",
                                                                        })
                                                                        : t(item.nameKey, { defaultValue: item.name })}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 rounded-[12px] bg-white border border-border shadow-sm px-3 py-2.5">
                                            <Eye className="h-4 w-4 text-primary-brand mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-text-brand font-semibold leading-relaxed">
                                                {t("home.migration.visibilityNote", {
                                                    defaultValue:
                                                        "Your competitor wardrobe stays visible on your own screen the whole time — you can watch every card get scanned.",
                                                })}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                                {migrationStep === 2 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="h-full rounded-[12px] border border-border bg-white p-20 space-y-3 max-[480px]:p-5"
                                    >
                                        <div className="flex items-center justify-between flex-wrap">
                                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--dark-color)]">
                                                {t("home.migration.dressappTarget", {
                                                    defaultValue: "Your DressApp Closet",
                                                })}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] font-semibold border-primary-brand text-white bg-primary-brand"
                                            >
                                                ✓ {t("home.migration.detailCardsFilled", {
                                                    defaultValue: "100% Detail Cards Filled",
                                                })}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {closetCards.map((card) => (
                                                <div
                                                    key={card.nameKey}
                                                    className="rounded-[12px] border border-border bg-white p-2 shadow-sm"
                                                >
                                                    <div className="h-20 w-full rounded-[12px] bg-primary-shadow mb-2" />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[8px] font-bold text-primary-brand uppercase tracking-wider truncate">
                                                            {t(card.typeKey, { defaultValue: card.type })}
                                                        </span>
                                                        <span className="text-[8px] bg-primary-brand text-white px-1 py-0.5 rounded-full font-bold shrink-0">
                                                            {t("home.migration.privateLabel", { defaultValue: "Private" })}
                                                        </span>
                                                    </div>
                                                    <div className="font-bold text-[12px] text-dark-brand truncate">
                                                        {t(card.nameKey, { defaultValue: card.name })}
                                                    </div>
                                                    <div className="text-[10px] text-text-brand font-semibold">
                                                        {t("home.migration.wearsCount", { count: 0, defaultValue: "{{count}} wears" })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="rounded-[12px] border border-border p-3 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-5 w-5 text-[var(--primary-color)] shrink-0" />
                                                <span className="text-xs font-semibold text-text-brand">
                                                    {t("home.migration.summaryNotice", {
                                                        defaultValue:
                                                            "Zero duplicates imported. All item attributes auto-populated.",
                                                    })}
                                                </span>
                                            </div>
                                            <span
                                                className="text-xs font-bold text-primary-brand underline cursor-pointer whitespace-nowrap"
                                                onClick={() => setIsMigrationModalOpen(true)}
                                            >
                                                {t("home.migration.testRun", {
                                                    defaultValue: "Try Live Import",
                                                })}
                                            </span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-6">
                        <span className="text-xs font-bold text-[var(--text-color)] me-1">
                            {t("home.migration.supportsApps", {
                                defaultValue: "Imports From:",
                            })}
                        </span>
                        {["Whering", "Acloset", "Stylebook", "Smartli", "Custom Web"].map(
                            (app) => (
                                <span
                                    key={app}
                                    className="rounded-full border border-primary-brand bg-white px-2.5 py-1 text-[10px] font-bold text-primary-brand"
                                >
                                    {app}
                                </span>
                            ),
                        )}
                    </div>
                </motion.div>
                {/* Action CTA Row */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                        type="button"
                        data-testid="home-migrate-wardrobe-closet-cta"
                        onClick={() => setIsMigrationModalOpen(true)}
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
                    >
                        <Sparkles className="h-4 w-4 text-white" />
                        <span>{t("home.closet.cta", { defaultValue: "Migrate your Wardrobe" })}</span>
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                </div>
            </div>
        </section>
    );
}
