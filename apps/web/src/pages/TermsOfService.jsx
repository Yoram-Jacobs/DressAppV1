import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';
import { parseMarkdown } from '@/lib/parseMarkdown';
import { useLegalPage } from '@/lib/useLegalPage';

export default function TermsOfService() {
  const { t } = useTranslation();
  const { content, loading } = useLegalPage({
    basePath: '/legal',
    filename: 'TERMS_OF_SERVICE',
    fallbackToDefault: false,
  });

  return (
    <>
      <Helmet>
        <title>{t('terms.title', { defaultValue: 'Terms of Service — DressApp' })}</title>
        <meta
          name="description"
          content={t('terms.description', {
            defaultValue: 'DressApp Terms of Service — rules and conditions for using our app.',
          })}
        />
        <link rel="canonical" href="https://dressapp.co/terms" />
      </Helmet>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
          <CardContent className="p-6 md:p-10 space-y-6">
            <h1 className="font-display text-3xl">
              {t('terms.title', { defaultValue: 'Terms of Service' })}
            </h1>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : content ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {parseMarkdown(content)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load Terms of Service.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
