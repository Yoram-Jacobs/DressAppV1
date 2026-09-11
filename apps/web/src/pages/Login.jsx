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
    <div className="min-h-[100dvh] grid md:grid-cols-[3fr_2fr] relative bg-accent-beige">
      {/* Floating language "bulb" — fixed to the top-end so guests can
          flip the UI to their language *before* signing in. ``z-30`` so
          it stays above both the form and the image on every layout. */}
      <div className="absolute top-4 end-4 z-30">
        <LanguagePicker
          className="rounded-full bg-card/80 backdrop-blur-sm border-border shadow-sm hover:bg-card"
          testIdSuffix="login"
        />
      </div>

      {/* Editorial image panel — LEFT, and wider (3fr vs 2fr) */}
      <div className="order-1 relative hidden md:block">
        <figure className="relative h-full w-full overflow-hidden">
          <img
            src={loginimg}
            alt={t("pages.login.editorial_street_style")}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Subtle scrim so the logo card stays legible over the image */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Logo card — overlaps the bottom edge of the image */}
          <div className="absolute inset-x-6 bottom-6">
            <div className="rounded-[12px] bg-white shadow-editorial p-5 w-fit">
              <h6 className="text-[16px] text-primary-brand font-bold mb-[10px]">
                {t("auth.tagline")}
              </h6>
              <p className="text-[14px] text-text-brand max-w-md font-semibold italic">
                {t("auth.editorial")}
              </p>
            </div>
          </div>
        </figure>
      </div>

      {/* Form panel — RIGHT */}
      {/* <div className="caps-label text-muted-foreground mt-1">
            {t("auth.signIn")}
          </div> */}
      <div className="order-2 flex flex-col justify-center md:p-10">
        <div className="mb-5">
          <BrandLogo size="lg" testId="brand-logo" />
        </div>
        <h1 className="text-[16px] text-dark-brand font-extrabold mb-1">
          {t("auth.welcomeBack")}
        </h1>
        <p className="text-[14px] text-text-brand font-bold mb-5">
          {t("auth.signInSub")}
        </p>

        <div className="space-y-3 mb-6" data-testid="google-signin-block">
          <GoogleAuthButton
            withCalendar={withCalendar}
            next="/home"
            label={t("auth.continueWithGoogle")}
            testId="login-google-button"
          />
          <label
            className="flex items-center gap-2 text-[12px] text-text-brand font-semibold cursor-pointer select-none"
            data-testid="login-with-calendar-row"
          >
            <Checkbox
              checked={withCalendar}
              onCheckedChange={(v) => setWithCalendar(Boolean(v))}
              data-testid="login-with-calendar-checkbox"
            />
            <span>{t("auth.alsoConnectCalendar")}</span>
          </label>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={dev}
          disabled={busy}
          className="w-full rounded-xl mt-4 text-muted-foreground hover:text-foreground"
          data-testid="login-dev-bypass-button"
        >
          <Sparkles className="h-4 w-4 me-2" /> {t("auth.continueAsDev")}
        </Button>
      </div>
    </div>
  );
}
