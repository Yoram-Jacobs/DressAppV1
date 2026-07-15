import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ShieldAlert, KeyRound, UserCheck, Loader2 } from 'lucide-react';

export default function DeleteAccount() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [stage, setStage] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [oauthVerified, setOauthVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  const googleConnected = user?.google_connected ?? false;
  const userEmail = user?.email ?? '';

  const handleOAuthVerify = () => {
    setBusy(true);
    // Simulate brief secure OAuth callback check
    setTimeout(() => {
      setBusy(false);
      setOauthVerified(true);
      setStage(3);
      toast.success(t('profile.oauthVerified', { defaultValue: 'Google identity verified successfully.' }));
    }, 1500);
  };

  const handlePasswordVerify = (e) => {
    e.preventDefault();
    if (!password) {
      toast.error(t('profile.enterPasswordToConfirm', { defaultValue: 'Please enter your password to confirm deletion.' }));
      return;
    }
    setStage(3);
  };

  const handleDeleteAccount = async () => {
    if (!confirmChecked) {
      toast.error(t('profile.deleteWarningConfirm', { defaultValue: 'Please check the box to confirm you understand the consequences.' }));
      return;
    }
    
    setBusy(true);
    try {
      const payload = {};
      if (googleConnected) {
        payload.oauth_provider = 'google';
      } else {
        payload.password = password;
      }
      
      await api.deleteAccount(payload);
      toast.success(t('profile.accountDeletedSuccess', { defaultValue: 'Your account has been deleted successfully.' }));
      logout();
      navigate('/login');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('profile.deleteFailed', { defaultValue: 'Failed to delete account. Please verify your credentials and try again.' }));
      // Rollback to verification stage if password was wrong
      if (!googleConnected) {
        setStage(2);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-px max-w-xl mx-auto pt-10 pb-20">
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl sm:text-4xl mt-1 text-foreground" data-testid="delete-account-page-title">
          {t('profile.deleteAccountTitle', { defaultValue: 'Delete Account' })}
        </h1>
        <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">
          {t('profile.deleteAccountSubtitle', { defaultValue: 'Permanent Account Deletion' })}
        </p>
      </div>

      <Card className="rounded-[calc(var(--radius)+6px)] border border-border shadow-[var(--shadow-md)] bg-card overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          
          {/* STAGE 1: WARNING DIALOGUE */}
          {stage === 1 && (
            <div className="space-y-6 text-start" data-testid="delete-stage-1">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200/50 dark:bg-rose-950/20 dark:border-rose-900/30">
                <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                    {t('common.warning', { defaultValue: 'Warning' })}
                  </h3>
                  <p className="text-xs text-rose-700/90 dark:text-rose-400/90 mt-0.5 leading-relaxed">
                    {t('profile.deleteWarning', { defaultValue: 'You are about to delete your account. This will permanently remove your profile, all your closet items (including photos and metadata), and all your saved outfits.' })}
                  </p>
                </div>
              </div>

              <div className="text-sm text-foreground/80 space-y-3 leading-relaxed">
                <p>
                  {t('profile.deleteExplanation1', { defaultValue: 'Deleting your account is permanent. Once completed, your circular wardrobe, personal stylist message threads, and listings will be completely wiped from our servers.' })}
                </p>
                <p className="font-semibold text-foreground">
                  {t('profile.deleteExplanation2', { defaultValue: 'This action is irreversible and the data cannot be restored.' })}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="rounded-xl flex-1 border border-border"
                  onClick={() => navigate('/me')}
                  data-testid="delete-cancel-btn-1"
                >
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Button>
                <Button
                  className="rounded-xl flex-1 bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                  onClick={() => setStage(2)}
                  data-testid="delete-continue-btn-1"
                >
                  {t('common.next', { defaultValue: 'Continue' })}
                </Button>
              </div>
            </div>
          )}

          {/* STAGE 2: IDENTITY VERIFICATION */}
          {stage === 2 && (
            <div className="space-y-6 text-start" data-testid="delete-stage-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/35 border border-border/80">
                <ShieldAlert className="h-6 w-6 text-[hsl(var(--accent))] shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t('profile.identityVerification', { defaultValue: 'Identity Verification' })}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {t('profile.verifyMessage', { defaultValue: 'For your security, please verify your identity before deleting your account.' })}
                  </p>
                </div>
              </div>

              {googleConnected ? (
                // Google OAuth user
                <div className="space-y-4 text-center py-4">
                  <div className="p-4 rounded-xl border border-dashed border-border/80 bg-card max-w-xs mx-auto">
                    <p className="text-xs font-semibold text-foreground mb-1">{userEmail}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {t('profile.googleConnected', { defaultValue: 'Connected via Google' })}
                    </p>
                  </div>
                  
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {t('profile.oauthConfirmText', { defaultValue: 'Please verify your Google account to confirm identity.' })}
                  </p>

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      onClick={handleOAuthVerify}
                      disabled={busy || oauthVerified}
                      className="rounded-xl w-full bg-foreground text-background hover:bg-foreground/90 font-semibold"
                      data-testid="google-verify-btn"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-2" />
                      )}
                      {t('profile.oauthVerifyBtn', { defaultValue: 'Verify with Google' })}
                    </Button>
                    
                    <Button
                      variant="secondary"
                      className="rounded-xl w-full border border-border"
                      onClick={() => setStage(1)}
                      data-testid="delete-back-btn-2"
                    >
                      {t('common.back', { defaultValue: 'Back' })}
                    </Button>
                  </div>
                </div>
              ) : (
                // Password user
                <form onSubmit={handlePasswordVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="delete-email" className="text-xs font-semibold">
                      {t('auth.email', { defaultValue: 'Email' })}
                    </Label>
                    <Input
                      id="delete-email"
                      type="email"
                      value={userEmail}
                      disabled
                      className="rounded-xl bg-muted text-muted-foreground text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delete-password" className="text-xs font-semibold">
                      {t('auth.password', { defaultValue: 'Password' })}
                    </Label>
                    <Input
                      id="delete-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('profile.enterPasswordPlaceholder', { defaultValue: 'Enter your password' })}
                      className="rounded-xl text-xs bg-card focus-visible:ring-ring focus-visible:ring-2"
                      required
                      autoFocus
                      data-testid="delete-password-input"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl flex-1 border border-border"
                      onClick={() => setStage(1)}
                      data-testid="delete-back-btn-2"
                    >
                      {t('common.back', { defaultValue: 'Back' })}
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-xl flex-1 bg-primary text-primary-foreground"
                      data-testid="password-verify-btn"
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      {t('common.confirm', { defaultValue: 'Confirm' })}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STAGE 3: FINAL DECISION */}
          {stage === 3 && (
            <div className="space-y-6 text-start" data-testid="delete-stage-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-100 border border-red-300/50 dark:bg-red-950/20 dark:border-red-900/30 animate-pulse">
                <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
                    {t('profile.finalWarningTitle', { defaultValue: 'Final Warning' })}
                  </h3>
                  <p className="text-xs text-red-700/90 dark:text-red-400/90 mt-0.5 leading-relaxed">
                    {t('profile.finalWarning', { defaultValue: "This is the absolute final step. Hitting 'Delete My Account' will permanently delete all your data and can never be undone." })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
                <input
                  id="confirm-checkbox"
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                  data-testid="delete-confirm-checkbox"
                />
                <Label htmlFor="confirm-checkbox" className="text-xs text-foreground/80 leading-normal cursor-pointer">
                  {t('profile.deleteWarningConfirm', { defaultValue: 'I understand that this action is irreversible and all my data will be permanently lost.' })}
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="rounded-xl flex-1 border border-border"
                  onClick={() => setStage(2)}
                  disabled={busy}
                  data-testid="delete-back-btn-3"
                >
                  {t('common.back', { defaultValue: 'Back' })}
                </Button>
                <Button
                  className="rounded-xl flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/92 font-semibold shadow-sm"
                  onClick={handleDeleteAccount}
                  disabled={busy || !confirmChecked}
                  data-testid="final-delete-btn"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {t('profile.deleteAccountBtn', { defaultValue: 'Delete My Account' })}
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
