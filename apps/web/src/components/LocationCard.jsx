import { useTranslation } from "react-i18next";
import { useState } from "react";
import { MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocation } from "@/lib/location";

/**
 * Self-contained "Location" settings card. Mirrors the Calendar card's
 * ergonomics: a rationale, a connected/not-connected indicator, and a
 * primary action. Uses `useLocation` for state + commands so the Profile
 * page stays declarative.
 */
export const LocationCard = () => {
  const { t } = useTranslation();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);

  const connected = !!loc.coords;
  const unavailable = !loc.available || loc.permissionState === "unavailable";
  const denied = loc.permissionState === "denied";

  const request = async () => {
    setBusy(true);
    try {
      await loc.request();
      toast.success(t("location.granted"));
    } catch (err) {
      if (err?.code === 1) toast.error(t("location.denied"));
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    try {
      await loc.forget();
      toast.success(t("location.forgotten"));
    } finally {
      setBusy(false);
    }
  };

  const fmtCoord = (v) =>
    typeof v === "number" ? v.toFixed(4) : String(v || "—");

  const cityLine =
    [loc.city, loc.country_code || loc.country].filter(Boolean).join(" · ") ||
    "—";

  return (
    <AccordionItem
      value="location"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
      data-testid="location-card"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(142_70%_94%)] text-[hsl(142_70%_35%)] dark:bg-[hsl(142_30%_15%)] dark:text-[hsl(142_70%_60%)] shrink-0 transition-transform duration-200">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold block text-dark-brand">
                {t("location.title", { defaultValue: "Location" })}
              </span>
              {connected ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] rounded-full py-0.5 px-2 font-semibold"
                  data-testid="location-connected-badge"
                >
                  <CheckCircle2 className="h-3 w-3 me-1 inline" />
                  {t("location.granted")}
                </Badge>
              ) : denied ? (
                <Badge
                  variant="outline"
                  className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] rounded-full py-0.5 px-2 font-semibold"
                >
                  {t("location.denied")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] rounded-full py-0.5 px-2 font-semibold"
                >
                  {t("location.notNow")}
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t("location.description", {
                defaultValue:
                  "Used for weather-accurate outfit recommendations and sunrise/sunset sync",
              })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-text-brand text-start">
            {t("location.rationale")}
          </p>
          {connected ? (
            <dl
              className="text-[11px] text-text-brand grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 bg-card p-3 rounded-[12px] border border-border shadow-sm"
              data-testid="location-details"
            >
              <div>
                <dt className="caps-label text-[9px]">
                  {t("location.cityLabel")}
                </dt>
                <dd className="font-medium text-foreground">{cityLine}</dd>
              </div>
              <div>
                <dt className="caps-label text-[9px]">
                  {t("location.lastKnown")}
                </dt>
                <dd className="font-mono">
                  {fmtCoord(loc.coords.lat)}, {fmtCoord(loc.coords.lng)}
                </dd>
              </div>
              {loc.accuracy_m ? (
                <div>
                  <dt className="caps-label text-[9px]">
                    {t("location.accuracyLabel")}
                  </dt>
                  <dd className="font-mono">
                    ±{Math.round(loc.accuracy_m)} {t("location.metersShort")}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {denied ? (
            <div className="flex items-start gap-2 text-[12px] text-primary-brand font-bold">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{t("location.deniedHint")}</span>
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[12px] font-semibold text-text-brand text-start">
              {connected
                ? t("location.statusActive", {
                  defaultValue:
                    "Weather data is synced based on your coordinates.",
                })
                : t("location.statusInactive", {
                  defaultValue:
                    "Weather feature is using offline default values.",
                })}
            </div>
            <div className="shrink-0 flex gap-2 w-full sm:w-auto">
              {unavailable ? (
                <Badge variant="outline">{t("location.unavailable")}</Badge>
              ) : connected ? (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={request}
                    className="!gap-1 rounded-xl w-full sm:w-auto bg-card"
                    data-testid="location-refresh-btn"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("location.retry")
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={forget}
                    className="!gap-1 rounded-xl w-full sm:w-auto"
                    data-testid="location-forget-btn"
                  >
                    {t("location.forget")}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || denied}
                  onClick={request}
                  className="!gap-1"
                  data-testid="location-enable-btn"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <MapPin className="h-4 w-4" />
                      {t("location.allow")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
