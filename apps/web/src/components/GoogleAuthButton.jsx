import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/**
 * Google "G" mark — official 4-colour glyph rendered as inline SVG so we
 * don't ship a remote image (CSP-friendly, fully offline).
 */
const GoogleGlyph = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
    />
  </svg>
);

/**
 * "Continue with Google" button. Resolves the Google OAuth start URL from
 * the backend, then does a full-page redirect — no popup, no PKCE library
 * needed.
 */
export const GoogleAuthButton = ({
  withCalendar = false,
  next = null,
  label,
  testId = 'google-auth-button',
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await api.googleLoginStart({
        withCalendar,
        next,
      });
      if (res?.authorization_url) {
        window.location.assign(res.authorization_url);
        return;
      }
    } catch (err) {
      console.warn('googleLoginStart via client failed, trying direct fetch:', err);
      try {
        const qs = new URLSearchParams();
        if (withCalendar) qs.set('with_calendar', 'true');
        if (next) qs.set('next', next);
        const qStr = qs.toString();
        const fRes = await fetch(`/api/v1/auth/google/login/start${qStr ? `?${qStr}` : ''}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (fRes.ok) {
          const data = await fRes.json();
          if (data?.authorization_url) {
            window.location.assign(data.authorization_url);
            return;
          }
        }
      } catch (fallbackErr) {
        console.error('googleLoginStart direct fetch error:', fallbackErr);
      }
      setBusy(false);
      const msg = err?.response?.data?.detail || err?.message || 'Failed to connect to Google sign-in. Please check your network.';
      toast.error(msg);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full rounded-xl border-border bg-background hover:bg-accent/5"
      data-testid={testId}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 me-2 animate-spin" />
      ) : (
        <GoogleGlyph className="h-4 w-4 me-2" />
      )}
      {label}
    </Button>
  );
};
