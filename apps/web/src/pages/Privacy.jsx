import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';
import { parseMarkdown } from '@/lib/parseMarkdown';
import { useLegalPage } from '@/lib/useLegalPage';

export default function Privacy() {
  const { t, i18n } = useTranslation();
  const { content, loading } = useLegalPage({
    basePath: '/legal',
    filename: 'PRIVACY_POLICY',
    fallbackToDefault: true,
  });

  const lang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const canonicalUrl = lang === 'en'
    ? 'https://dressapp.co/privacy'
    : `https://dressapp.co/privacy?lang=${lang}`;

  return (
    <>
      <Helmet>
        <title>{t('privacy.title', { defaultValue: 'Privacy Policy — DressApp' })}</title>
        <meta
          name="description"
          content={t('privacy.description', {
            defaultValue: 'DressApp privacy policy — how we collect, use, and protect your data.',
          })}
        />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
          <CardContent className="p-6 md:p-10">
            {loading && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {!loading && content && (
              <div className="space-y-1">
                {parseMarkdown(content)}
              </div>
            )}
            {!loading && !content && (
              <p className="text-sm text-muted-foreground text-center py-12">
                {t('privacy.loadError', { defaultValue: 'Privacy policy could not be loaded. Please try again later.' })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
