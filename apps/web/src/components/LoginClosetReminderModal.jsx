import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Sparkles, UploadCloud, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import OnboardingMigrationModal from './OnboardingMigrationModal';

export default function LoginClosetReminderModal({ isOpen, onClose, user }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [showMigrateForm, setShowMigrateForm] = useState(false);

  if (showMigrateForm) {
    return (
      <OnboardingMigrationModal
        isOpen={true}
        onClose={() => {
          setShowMigrateForm(false);
          onClose();
        }}
        onFlagUpdated={() => {
          setShowMigrateForm(false);
          onClose();
        }}
      />
    );
  }

  const isMigrateUser = user?.migration_flag === 'Migrate';

  const handleLetsStart = () => {
    onClose();
    nav('/upload');
  };

  const handleOpenHelpDoc = (e) => {
    e.preventDefault();
    onClose();
    // Open in-app help drawer or navigate to closet page
    nav('/closet');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-6 bg-card border border-border shadow-2xl">
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>

          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-bold font-display">
              {isMigrateUser
                ? t('login_reminder.migrateTitle', { defaultValue: 'Import Your Closet to Start Styling!' })
                : t('login_reminder.newTitle', { defaultValue: 'Your Closet is Empty — Let\'s Add Your First Item!' })}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {isMigrateUser
                ? t('login_reminder.migrateSub', { defaultValue: 'Adding your garments is essential for the AI Stylist, Outfit Canvas, and Recommendations to perform properly. Complete your migration or add items manually.' })
                : t('login_reminder.newSub', { defaultValue: 'Your closet currently has 0 items. Adding your garments allows the AI Stylist to generate tailored daily recommendations, packing lists, and weather outfits.' })}
            </DialogDescription>
          </DialogHeader>

          {/* Help doc link */}
          <div className="text-center pt-1">
            <a
              href="#help"
              onClick={handleOpenHelpDoc}
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
              data-testid="login-reminder-help-link"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {t('login_reminder.helpDocLink', { defaultValue: 'Learn how adding clothes works in DressApp' })}
            </a>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border/50">
            {isMigrateUser ? (
              // Case B: Users flagged as 'Migrate' (Let's start, Migrate, Dismiss)
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={handleLetsStart}
                  className="rounded-xl h-10 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1"
                  data-testid="login-reminder-start-btn"
                >
                  {t('login_reminder.letsStart', { defaultValue: 'Let\'s start' })}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if ('ontouchstart' in window) {
                      toast.info(t('profile.mobileDesktopGuide', { defaultValue: 'Wardrobe import is available on the desktop version of DressApp. Please open your account on a desktop browser to continue.' }), { duration: 8000 });
                    } else {
                      setShowMigrateForm(true);
                    }
                  }}
                  className="rounded-xl h-10 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-1"
                  data-testid="login-reminder-migrate-btn"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {t('login_reminder.migrateBtn', { defaultValue: 'Migrate' })}
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="rounded-xl h-10 text-xs font-medium text-muted-foreground hover:bg-muted"
                  data-testid="login-reminder-dismiss-btn"
                >
                  {t('common.dismiss', { defaultValue: 'Dismiss' })}
                </Button>
              </div>
            ) : (
              // Case A: Users flagged as 'New' (Let's start, Dismiss)
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleLetsStart}
                  className="rounded-xl h-11 text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5"
                  data-testid="login-reminder-start-btn"
                >
                  {t('login_reminder.letsStart', { defaultValue: 'Let\'s start' })}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="rounded-xl h-11 text-sm font-medium border-border hover:bg-muted"
                  data-testid="login-reminder-dismiss-btn"
                >
                  {t('common.dismiss', { defaultValue: 'Dismiss' })}
                </Button>
              </div>
            )}
          </div>
        </div>
        {/* Action Buttons */}
        {isMigrateUser ? (
          // Case B: Users flagged as 'Migrate' (Let's start, Migrate, Dismiss)
          <div className="hero-actions">
            <Button
              onClick={handleLetsStart}
              className="rounded-xl h-10 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1"
              data-testid="login-reminder-start-btn"
            >
              {t('login_reminder.letsStart', { defaultValue: 'Let\'s start' })}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if ('ontouchstart' in window) {
                  toast.info(t('profile.mobileDesktopGuide', { defaultValue: 'Wardrobe import is available on the desktop version of DressApp. Please open your account on a desktop browser to continue.' }), { duration: 8000 });
                } else {
                  setShowMigrateForm(true);
                }
              }}
              className="rounded-xl h-10 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-1"
              data-testid="login-reminder-migrate-btn"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {t('login_reminder.migrateBtn', { defaultValue: 'Migrate' })}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="rounded-xl h-10 text-xs font-medium text-muted-foreground hover:bg-muted"
              data-testid="login-reminder-dismiss-btn"
            >
              {t('common.dismiss', { defaultValue: 'Dismiss' })}
            </Button>
          </div>
        ) : (
          // Case A: Users flagged as 'New' (Let's start, Dismiss)
          <div className="modalaction">
            <Button onClick={handleLetsStart} className="custm-btn" data-testid="login-reminder-start-btn">
              <i className="bi bi-stars me-2"></i>{t('login_reminder.letsStart', { defaultValue: 'Let\'s start' })}
            </Button>
            <Button variant="outline" onClick={onClose} className="custm-btn2" data-testid="login-reminder-dismiss-btn">
              {t('common.dismiss', { defaultValue: 'Dismiss' })} <i className="fa-solid fa-arrow-right ms-2"></i>
            </Button>
          </div>
        )}
    </DialogContent>
    </Dialog >
  );
}
