import { Outlet, Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PublicLegalLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>DressApp</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('common.backToApp', { defaultValue: 'Back to App' })}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-4 px-4">
          <Link to="/privacy" className="hover:underline">
            {t('privacy.title', { defaultValue: 'Privacy Policy' })}
          </Link>
          <span>•</span>
          <Link to="/terms" className="hover:underline">
            {t('terms.title', { defaultValue: 'Terms of Service' })}
          </Link>
          <span>•</span>
          <span>&copy; {new Date().getFullYear()} DressApp</span>
        </div>
      </footer>
    </div>
  );
}
