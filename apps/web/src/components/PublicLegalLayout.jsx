import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { LanguageSync } from '@/components/LanguageSync';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export const PublicLegalLayout = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="page-shell flex min-h-screen flex-col bg-background text-foreground">
      <LanguageSync />
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to={user ? "/home" : "/"} aria-label="DressApp">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <LanguagePicker />
            {user ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/home">{t('nav.home', { defaultValue: 'Home' })}</Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link to="/login">{t('nav.signIn', { defaultValue: 'Sign In' })}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
export default PublicLegalLayout;
