import { useState, useEffect } from 'react';
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
  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector(".navbar-premium");

      if (!navbar) return;

      if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll);

    // Page refresh hone par bhi check ho jaye
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header data-testid="top-nav">
      <nav aria-label={t('nav.primary')} className="fixed top-0 left-0 right-0 z-50 w-full bg-white shadow-md">
        <div className="w-full py-[10px] px-[40px]">
          <div className="flex min-h-16 items-center justify-between">
            {/* Logo */}
            <Link
              to="/home"
              data-testid="brand-logo"
              aria-label={t('brand')}
              className="shrink-0"
            >
              <BrandLogo size="md" testId="brand-logo-mark" />
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-secondary lg:hidden"
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list text-2xl text-foreground" />
            </button>

            {/* Desktop Navigation */}
            <div className="hidden flex-1 items-center justify-between lg:flex">

              {/* Navigation Links */}
              <ul className="mx-auto flex items-center gap-1">
                {LINKS.map(({ to, icon: Icon, key, label }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      data-testid={`topnav-link-${key}`}
                      className={({ isActive }) =>
                        cn(
                          "inline-flex items-center gap-2 text-[14px] font-bold m-0 px-5 py-[10px]",
                          isActive
                            ? "text-[var(--primary-color)]"
                            : "text-dark-brand hover:text-[var(--primary-color)]"
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>

              {/* Right Actions */}
              <div className="flex items-center gap-3">

                <LanguagePicker
                  className="langmain"
                  testIdSuffix="home"
                />

                {/* Help */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
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
                      className="h-10 w-10 overflow-hidden rounded-full p-0"
                      data-testid="topnav-avatar-button"
                    >
                      {(user?.face_photo_url || user?.avatar_url) ? (
                        <img
                          src={user.face_photo_url || user.avatar_url}
                          alt={user?.display_name || 'User'}
                          className="h-9 w-9 rounded-full border border-border/80 object-cover shadow-sm"
                        />
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]">
                          {initials}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className="w-56"
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3 px-2 py-2 text-sm">
                      {(user?.face_photo_url || user?.avatar_url) ? (
                        <img
                          src={user.face_photo_url || user.avatar_url}
                          alt={user?.display_name || 'User'}
                          className="h-9 w-9 shrink-0 rounded-full border border-border/80 object-cover shadow-sm"
                        />
                      ) : (
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]">
                          {initials}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
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
                      <Receipt className="mr-2 h-4 w-4" />
                      {t('nav.transactions')}
                    </DropdownMenuItem>

                    {isPro && (
                      <DropdownMenuItem
                        onClick={() => nav('/ads')}
                        data-testid="topnav-menu-ads"
                      >
                        <Megaphone className="mr-2 h-4 w-4" />
                        {t('nav.ads')}
                      </DropdownMenuItem>
                    )}

                    {(user.roles || []).includes('admin') && (
                      <DropdownMenuItem
                        onClick={() => nav('/admin')}
                        data-testid="topnav-menu-admin"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {t('nav.admin')}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={() => nav('/me')}
                      data-testid="topnav-menu-settings"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {t('nav.settings')}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => {
                        logout();
                        nav('/login');
                      }}
                      data-testid="topnav-menu-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('nav.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <div className="flex h-14 items-center justify-between px-4 lg:hidden">
        <Link
          to="/home"
          data-testid="mobile-brand-logo"
          aria-label={t('brand')}
        >
          <BrandLogo
            size="sm"
            testId="mobile-brand-logo-mark"
          />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full p-0 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          onClick={() => setHelpOpen(true)}
          data-testid="mobile-help-button"
          aria-label="Open Help Menu"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* Help Modal */}
      <Dialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
      >
        <DialogContent className="helpmodal">
          <HelpMenu />
        </DialogContent>
      </Dialog>
    </header>
  );
};
