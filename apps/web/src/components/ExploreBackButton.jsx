import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function ExploreBackButton({ to = '/stylist' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate(to)}
      className="rounded-full shadow-none border-none bg-transparent hover:!bg-transparent hover:text-primary-brand flex items-center gap-1.5 px-0 py-0 !font-bold !text-[14px] text-dark-brand mb-5"
      data-testid="back-to-explore"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{t('common.back', { defaultValue: 'Back' })}</span>
    </Button>
  );
}
