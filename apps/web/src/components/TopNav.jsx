import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Home, Shirt, Sparkles, Store, LogOut, Settings, Receipt, Shield, UserRound, Megaphone, HelpCircle, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BrandLogo } from '@/components/BrandLogo';
import HelpMenu from '@/components/HelpMenu';

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
      className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border"
    >
      {/* Desktop Header */}
      <div className="hidden md:flex mx-auto max-w-6xl px-6 h-16 items-center gap-8">
        <Link to="/home" data-testid="brand-logo" aria-label={t('brand')}>
          <BrandLogo size="md" testId="brand-logo-mark" />
        </Link>
        <nav aria-label={t('nav.primary')} className="flex items-center gap-1">
          {LINKS.map(({ to, icon: Icon, key, label }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`topnav-link-${key}`}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                  isActive
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            onClick={() => setHelpOpen(true)}
            data-testid="topnav-help-button"
            aria-label="Open Help Menu"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" aria-label={t('nav.openUserMenu')} className="rounded-full h-10 w-10 p-0 overflow-hidden" data-testid="topnav-avatar-button">
                {(user?.face_photo_url || user?.avatar_url) ? (
                  <img
                    src={user.face_photo_url || user.avatar_url}
                    alt={user?.display_name || 'User'}
                    className="h-9 w-9 rounded-full object-cover border border-border/80 shadow-sm"
                  />
                ) : (
                  <span className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium">
                    {initials}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2 text-sm flex items-center gap-3">
                {(user?.face_photo_url || user?.avatar_url) ? (
                  <img
                    src={user.face_photo_url || user.avatar_url}
                    alt={user?.display_name || 'User'}
                    className="h-9 w-9 rounded-full object-cover border border-border/80 shadow-sm shrink-0"
                  />
                ) : (
                  <span className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium shrink-0">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{user?.display_name || t('nav.guest')}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav('/transactions')} data-testid="topnav-menu-transactions">
                <Receipt className="h-4 w-4 me-2" /> {t('nav.transactions')}
              </DropdownMenuItem>
              {isPro && (
                <DropdownMenuItem onClick={() => nav('/ads')} data-testid="topnav-menu-ads">
                  <Megaphone className="h-4 w-4 me-2" /> {t('nav.ads')}
                </DropdownMenuItem>
              )}
              {(user.roles || []).includes('admin') && (
                <DropdownMenuItem onClick={() => nav('/admin')} data-testid="topnav-menu-admin">
                  <Shield className="h-4 w-4 me-2" /> {t('nav.admin')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => nav('/me')} data-testid="topnav-menu-settings">
                <Settings className="h-4 w-4 me-2" /> {t('nav.settings')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { logout(); nav('/login'); }} data-testid="topnav-menu-logout">
                <LogOut className="h-4 w-4 me-2" /> {t('nav.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="flex md:hidden h-14 items-center justify-between px-4">
        <Link to="/home" data-testid="mobile-brand-logo" aria-label={t('brand')}>
          <BrandLogo size="sm" testId="mobile-brand-logo-mark" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          onClick={() => setHelpOpen(true)}
          data-testid="mobile-help-button"
          aria-label="Open Help Menu"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <HelpMenu />
        </DialogContent>
      </Dialog>
    </header>
  );
};
