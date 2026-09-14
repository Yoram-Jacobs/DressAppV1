import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguagePicker } from "@/components/LanguagePicker";
import loginimg from "../assets/img/loginimg.webp";

export default function Login() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { devBypass } = useAuth();
  const [busy, setBusy] = useState(false);
  const [withCalendar, setWithCalendar] = useState(false);

  const dev = async () => {
    setBusy(true);
    try {
      await devBypass();
      toast.success(t("auth.signedInAsDev"));
      nav("/home");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("auth.devDisabled"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-[100dvh] grid-rows-[auto_1fr] overflow-x-hidden bg-accent-beige md:grid-rows-none md:grid-cols-[3fr_2fr]">
      {/* Floating language "bulb" — top-end so guests can flip language
          before signing in. Stays above image + form on every breakpoint. */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] end-3 z-30 sm:end-4">
        <LanguagePicker
          className="rounded-full bg-card/80 backdrop-blur-sm border-border shadow-sm hover:bg-card"
          testIdSuffix="login"
        />
      </div>

      {/* Editorial image — compact hero on mobile, full-height column on md+ */}
      <div className="relative order-1 h-[38vh] max-h-[280px] min-h-[176px] md:h-full md:max-h-none md:min-h-0">
        <figure className="relative h-full w-full overflow-hidden">
          <img
            src={loginimg}
            alt={t("pages.login.editorial_street_style")}
            className="absolute inset-0 h-full w-full object-cover object-[center_28%] md:object-center"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:h-40" />

          <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 md:inset-x-6 md:bottom-6">
            <div className="w-full rounded-[12px] bg-white p-3.5 shadow-editorial sm:w-fit sm:p-5">
              <h6 className="mb-1.5 text-[14px] font-bold text-primary-brand sm:mb-[10px] sm:text-[16px]">
                {t("auth.tagline")}
              </h6>
              <p className="max-w-md text-[12px] font-semibold italic leading-snug text-text-brand sm:text-[14px]">
                {t("auth.editorial")}
              </p>
            </div>
          </div>
        </figure>
      </div>

      <div className="order-2 flex flex-col justify-center px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-8 sm:py-8 md:p-10">
        <div className="mx-auto w-full max-w-md min-w-0 md:mx-0">
          <div className="mb-4 sm:mb-5">
            <BrandLogo size="lg" testId="brand-logo" className="max-[380px]:[&_span]:text-2xl" />
          </div>
          <h1 className="mb-1 text-[16px] font-extrabold text-dark-brand">
            {t("auth.welcomeBack")}
          </h1>
          <p className="mb-5 text-[14px] font-bold text-text-brand">
            {t("auth.signInSub")}
          </p>

          <div className="mb-4 space-y-3 sm:mb-6" data-testid="google-signin-block">
            <GoogleAuthButton
              withCalendar={withCalendar}
              next="/home"
              label={t("auth.continueWithGoogle")}
              testId="login-google-button"
              className="w-full min-h-11"
            />
            <label
              className="flex min-h-11 cursor-pointer select-none items-center gap-2 text-[12px] font-semibold text-text-brand"
              data-testid="login-with-calendar-row"
            >
              <Checkbox
                checked={withCalendar}
                onCheckedChange={(v) => setWithCalendar(Boolean(v))}
                data-testid="login-with-calendar-checkbox"
              />
              <span className="leading-snug">{t("auth.alsoConnectCalendar")}</span>
            </label>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={dev}
            disabled={busy}
            className="mt-2 min-h-11 w-full whitespace-normal rounded-xl text-muted-foreground hover:text-foreground"
            data-testid="login-dev-bypass-button"
          >
            <Sparkles className="h-4 w-4 me-2 shrink-0" /> {t("auth.continueAsDev")}
          </Button>
        </div>
      </div>
    </div>
  );
}
