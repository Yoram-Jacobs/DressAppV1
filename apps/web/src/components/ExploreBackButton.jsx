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
      className="rounded-full shadow-none border-none bg-transparent hover:!bg-transparent hover:text-primary-brand flex items-center gap-1.5 transition-all active:scale-95 px-0 py-0 font-semibold text-xs text-dark-brand mb-3"
      data-testid="back-to-explore"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{t('common.back', { defaultValue: 'Back' })}</span>
    </Button>
  );
}
