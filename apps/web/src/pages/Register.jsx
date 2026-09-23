import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguagePicker } from '@/components/LanguagePicker';
import closet4 from '@/assets/img/closet4.webp';

export default function Register() {
  const { t } = useTranslation();

  return (
    <div className="relative grid min-h-[100dvh] grid-rows-[auto_1fr] overflow-x-hidden bg-accent-beige md:grid-rows-none md:grid-cols-[3fr_2fr]">
      {/* Floating language "bulb" — top-end so guests can flip language
          before signing up. Stays above image + form on every breakpoint. */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] end-3 z-30 sm:end-4">
        <LanguagePicker
          className="rounded-full bg-card/80 backdrop-blur-sm border-border shadow-sm hover:bg-card"
          testIdSuffix="register"
        />
      </div>

      {/* Editorial image — compact hero on mobile, full-height column on md+ */}
      <div className="relative order-1 h-[38vh] max-h-[280px] min-h-[176px] md:h-full md:max-h-none md:min-h-0">
        <figure className="relative h-full w-full overflow-hidden">
          <img
            src={closet4}
            alt={t('auth.createAccount')}
            className="absolute inset-0 h-full w-full object-cover object-[center_30%] md:object-center"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:h-40" />

          <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 md:inset-x-6 md:bottom-6">
            <div className="w-full rounded-[12px] bg-white p-3.5 shadow-editorial sm:w-fit sm:p-5">
              <h6 className="mb-1.5 text-[14px] font-bold text-primary-brand sm:mb-[10px] sm:text-[16px]">
                {t('auth.tagline')}
              </h6>
              <p className="max-w-md text-[12px] font-semibold italic leading-snug text-text-brand sm:text-[14px]">
                {t('auth.editorial')}
              </p>
            </div>
          </div>
        </figure>
      </div>

      {/* Form pane */}
      <div className="order-2 flex flex-col justify-center px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-8 sm:py-8 md:p-10">
        <div className="mx-auto w-full max-w-md min-w-0 md:mx-0">
          <div className="mb-4 sm:mb-5">
            <BrandLogo size="lg" testId="brand-logo" className="max-[380px]:[&_span]:text-2xl" />
          </div>
          <h1 className="mb-1 text-[16px] font-extrabold text-dark-brand sm:text-2xl">
            {t('auth.createAccount')}
          </h1>
          <p className="mb-5 text-[14px] font-bold text-text-brand">
            {t('auth.registerSub')}
          </p>

          <div className="mb-4 space-y-3 sm:mb-6" data-testid="google-signup-block">
            <GoogleAuthButton
              next="/home"
              label={t('auth.continueWithGoogle')}
              testId="register-google-button"
              className="w-full min-h-11"
            />
          </div>

          <p className="mt-6 text-sm text-muted-foreground text-start">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link
              to="/login"
              className="text-[hsl(var(--accent))] font-medium underline underline-offset-4"
              data-testid="register-login-link"
            >
              {t('auth.signInLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
