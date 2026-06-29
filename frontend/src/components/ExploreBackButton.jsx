import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function ExploreBackButton({ to = '/stylist' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      onClick={() => navigate(to)}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 rounded-full shadow-lg border border-border/80 bg-background/85 backdrop-blur-md hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-all active:scale-95 px-4 py-5 font-semibold text-xs text-foreground"
      data-testid="back-to-explore"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{t('common.back', { defaultValue: 'Back' })}</span>
    </Button>
  );
}
