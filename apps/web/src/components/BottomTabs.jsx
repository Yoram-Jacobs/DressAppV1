import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Shirt, Sparkles, Store, User, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

export const BottomTabs = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userPhoto = user?.face_photo_url || user?.avatar_url;

  return (
    <nav
      data-testid="bottom-tabs"
      aria-label={t('nav.mobilePrimary')}
      className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 gap-1 px-2 py-2 items-center justify-between">
        {/* Column 1: Wardrobe / Closet */}
        <li className="flex">
          <NavLink
            to="/closet"
            data-testid="bottom-tab-closet"
            aria-label={t('nav.closet')}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center rounded-lg px-1 py-1 min-h-[52px]',
                isActive
                  ? 'text-[hsl(var(--accent))] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <motion.span
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-0.5"
              >
                <Shirt className={cn('h-5 w-5', isActive && 'stroke-[2.2]')} />
                <span className="text-[10px] tracking-wide">{t('nav.closet')}</span>
                {isActive && (
                  <motion.span
                    layoutId="active-tab-underline"
                    className="h-[2px] w-5 bg-[hsl(var(--accent))] rounded-full"
                  />
                )}
              </motion.span>
            )}
          </NavLink>
        </li>

        {/* Column 2: Stylist */}
        <li className="flex">
          <NavLink
            to="/stylist"
            data-testid="bottom-tab-stylist"
            aria-label={t('nav.stylist')}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center rounded-lg px-1 py-1 min-h-[52px]',
                isActive
                  ? 'text-[hsl(var(--accent))] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <motion.span
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-0.5"
              >
                <Sparkles className={cn('h-5 w-5', isActive && 'stroke-[2.2]')} />
                <span className="text-[10px] tracking-wide">{t('nav.stylist')}</span>
                {isActive && (
                  <motion.span
                    layoutId="active-tab-underline"
                    className="h-[2px] w-5 bg-[hsl(var(--accent))] rounded-full"
                  />
                )}
              </motion.span>
            )}
          </NavLink>
        </li>

        {/* Column 3: Floating Action Button (Capture) */}
        <li className="flex justify-center relative min-h-[52px]">
          <NavLink
            to="/closet/add?source=camera"
            data-testid="bottom-tab-capture"
            aria-label={t('closet.addItem', { defaultValue: 'Capture' })}
            className="absolute -top-7 h-14 w-14 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-lg border-4 border-background hover:scale-105 active:scale-95 transition-transform z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex items-center justify-center"
            >
              <Camera className="h-6 w-6 stroke-[2.2]" />
            </motion.div>
          </NavLink>
        </li>

        {/* Column 4: Marketplace / Market */}
        <li className="flex">
          <NavLink
            to="/market"
            data-testid="bottom-tab-market"
            aria-label={t('nav.market')}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center rounded-lg px-1 py-1 min-h-[52px]',
                isActive
                  ? 'text-[hsl(var(--accent))] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <motion.span
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-0.5"
              >
                <Store className={cn('h-5 w-5', isActive && 'stroke-[2.2]')} />
                <span className="text-[10px] tracking-wide">{t('nav.market')}</span>
                {isActive && (
                  <motion.span
                    layoutId="active-tab-underline"
                    className="h-[2px] w-5 bg-[hsl(var(--accent))] rounded-full"
                  />
                )}
              </motion.span>
            )}
          </NavLink>
        </li>

        {/* Column 5: Profile / Settings */}
        <li className="flex">
          <NavLink
            to="/me"
            data-testid="bottom-tab-me"
            aria-label={t('nav.me')}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center rounded-lg px-1 py-1 min-h-[52px]',
                isActive
                  ? 'text-[hsl(var(--accent))] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <motion.span
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-0.5"
              >
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={t('nav.me')}
                    className={cn('h-5 w-5 rounded-full object-cover border border-border/80', isActive && 'ring-2 ring-[hsl(var(--accent))]')}
                  />
                ) : (
                  <User className={cn('h-5 w-5', isActive && 'stroke-[2.2]')} />
                )}
                <span className="text-[10px] tracking-wide">{t('nav.me')}</span>
                {isActive && (
                  <motion.span
                    layoutId="active-tab-underline"
                    className="h-[2px] w-5 bg-[hsl(var(--accent))] rounded-full"
                  />
                )}
              </motion.span>
            )}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};
