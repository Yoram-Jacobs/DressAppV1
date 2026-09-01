import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Home, Shirt, Sparkles, Store, LogOut, Settings, Receipt, Shield, UserRound, Megaphone, CircleHelp as HelpCircle, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BrandLogo } from '@/components/BrandLogo';
import HelpMenu from '@/components/HelpMenu';
import { LanguagePicker } from '@/components/LanguagePicker';

export const TopNav = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const initials = (user?.display_name || user?.email || 'U').slice(0, 1).toUpperCase();
  const isPro = !!user?.professional?.is_professional;

  const LINKS = [
    { to: '/home', icon: Home, key: 'home', label: t('nav.home') },
    { to: '/closet', icon: Shirt, key: 'closet', label: t('nav.closet') },
    { to: '/stylist', icon: Sparkles, key: 'stylist', label: t('nav.stylist') },
    { to: '/market', icon: Store, key: 'market', label: t('nav.market') },
    { to: '/experts', icon: UserRound, key: 'experts', label: t('nav.experts') },
    { to: '/pricing', icon: CreditCard, key: 'pricing', label: t('nav.pricing', { defaultValue: 'Pricing' }) },
  ];

  return (
    <header
      data-testid="top-nav"
      className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-border shadow-xs"
    >
      {/* Desktop Header */}
      <div className="hidden md:flex mx-auto max-w-7xl px-6 h-18 items-center justify-between gap-6">
        <Link
          to="/home"
          data-testid="brand-logo"
          aria-label={t('brand')}
          className="shrink-0"
        >
          <BrandLogo size="md" testId="brand-logo-mark" />
        </Link>

        {/* Navigation Links */}
        <nav aria-label={t('nav.primary')} className="flex items-center gap-1">
          {LINKS.map(({ to, icon: Icon, key, label }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`topnav-link-${key}`}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'text-[var(--primary-color)] bg-[var(--primary-color)]/10'
                    : 'text-foreground/75 hover:text-[var(--primary-color)] hover:bg-secondary/60'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <LanguagePicker testIdSuffix="home" />

          {/* Help */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 text-muted-foreground hover:text-[var(--primary-color)] hover:bg-secondary/60 transition-colors"
            onClick={() => setHelpOpen(true)}
            data-testid="topnav-help-button"
            aria-label="Open Help Menu"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label={t('nav.openUserMenu')}
                className="h-10 w-10 overflow-hidden rounded-full p-0 border border-border/80 focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]"
                data-testid="topnav-avatar-button"
              >
                {(user?.face_photo_url || user?.avatar_url) ? (
                  <img
                    src={user.face_photo_url || user.avatar_url}
                    alt={user?.display_name || 'User'}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-[hsl(var(--accent))] font-medium text-white">
                    {initials}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              {/* User Info */}
              <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
                {(user?.face_photo_url || user?.avatar_url) ? (
                  <img
                    src={user.face_photo_url || user.avatar_url}
                    alt={user?.display_name || 'User'}
                    className="h-9 w-9 shrink-0 rounded-full border border-border/80 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] font-medium text-white">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-foreground">
                    {user?.display_name || t('nav.guest')}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => nav('/transactions')}
                data-testid="topnav-menu-transactions"
              >
                <Receipt className="h-4 w-4 me-2" />
                {t('nav.transactions')}
              </DropdownMenuItem>

              {isPro && (
                <DropdownMenuItem
                  onClick={() => nav('/ads')}
                  data-testid="topnav-menu-ads"
                >
                  <Megaphone className="h-4 w-4 me-2" />
                  {t('nav.ads')}
                </DropdownMenuItem>
              )}

              {(user?.roles || []).includes('admin') && (
                <DropdownMenuItem
                  onClick={() => nav('/admin')}
                  data-testid="topnav-menu-admin"
                >
                  <Shield className="h-4 w-4 me-2" />
                  {t('nav.admin')}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => nav('/me')}
                data-testid="topnav-menu-settings"
              >
                <Settings className="h-4 w-4 me-2" />
                {t('nav.settings')}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  logout();
                  nav('/login');
                }}
                data-testid="topnav-menu-logout"
              >
                <LogOut className="h-4 w-4 me-2 text-destructive" />
                <span className="text-destructive font-medium">{t('nav.signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Header (< md) */}
      <div className="flex md:hidden h-14 items-center justify-between px-4">
        <Link
          to="/home"
          data-testid="mobile-brand-logo"
          aria-label={t('brand')}
        >
          <BrandLogo size="sm" testId="mobile-brand-logo-mark" />
        </Link>

        <div className="flex items-center gap-2">
          <LanguagePicker testIdSuffix="mobile" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full p-0 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            onClick={() => setHelpOpen(true)}
            data-testid="mobile-help-button"
            aria-label="Open Help Menu"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label={t('nav.openUserMenu')}
                className="h-8 w-8 overflow-hidden rounded-full p-0 border border-border"
                data-testid="mobile-avatar-button"
              >
                {(user?.face_photo_url || user?.avatar_url) ? (
                  <img
                    src={user.face_photo_url || user.avatar_url}
                    alt={user?.display_name || 'User'}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-medium text-white">
                    {initials}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 text-xs">
                <div className="font-bold truncate">{user?.display_name || t('nav.guest')}</div>
                <div className="text-muted-foreground truncate">{user?.email}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav('/me')}>
                <Settings className="h-4 w-4 me-2" />
                {t('nav.settings')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav('/transactions')}>
                <Receipt className="h-4 w-4 me-2" />
                {t('nav.transactions')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { logout(); nav('/login'); }}>
                <LogOut className="h-4 w-4 me-2 text-destructive" />
                <span className="text-destructive">{t('nav.signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Help Modal */}
      <Dialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
      >
        <DialogContent className="rounded-[12px] !max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <HelpMenu />
        </DialogContent>
      </Dialog>
    </header>
  );
};
