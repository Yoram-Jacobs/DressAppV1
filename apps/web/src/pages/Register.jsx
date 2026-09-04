import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import { LanguagePicker } from '@/components/LanguagePicker';

export default function Register() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] grid md:grid-cols-2 relative">
      {/* Same language bulb as /login — guests can flip the UI before
          they sign up. */}
      <div className="absolute top-4 end-4 z-20">
        <LanguagePicker
          className="rounded-full bg-card/80 backdrop-blur-sm border-border shadow-sm hover:bg-card"
          testIdSuffix="register"
        />
      </div>
      <div className="hidden md:block relative hero-wash-light noise" />
      <div className="flex items-center justify-center p-6 md:p-16">
        <Card className="w-full max-w-md rounded-[calc(var(--radius)+6px)] shadow-editorial">
          <CardContent className="p-6 md:p-8">
            <h1 className="font-display text-3xl md:text-4xl leading-[1.02] mb-2">{t('auth.createAccount')}</h1>
            <p className="text-sm text-muted-foreground mb-6">{t('auth.registerSub')}</p>

            <div className="mb-6" data-testid="google-signup-block">
              <GoogleAuthButton
                next="/home"
                label={t('auth.continueWithGoogle')}
                testId="register-google-button"
              />
            </div>
            <p className="mt-6 text-sm text-muted-foreground text-center">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-[hsl(var(--accent))] underline underline-offset-4" data-testid="register-login-link">
                {t('auth.signInLink')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
