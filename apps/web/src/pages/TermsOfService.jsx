import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';
import { parseMarkdown } from '@/lib/parseMarkdown';
import { useLegalPage } from '@/lib/useLegalPage';
import TermsBanner from '../assets/img/inner6.webp';
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';

export default function TermsOfService() {
  const { t, i18n } = useTranslation();
  const { content, loading } = useLegalPage({
    basePath: '/legal',
    filename: 'TERMS_OF_SERVICE',
    fallbackToDefault: false,
  });

  const lang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isRTL = lang === 'ar';
  const canonicalUrl = lang === 'en'
    ? 'https://dressapp.co/terms'
    : `https://dressapp.co/terms?lang=${lang}`;

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
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>

      {/* Banner Section */}
      <PageHeroBanner image={TermsBanner}>
        <div className="relative z-10 w-full">
          <div
            className="
              px-10 py-20
              max-[991px]:px-[35px] max-[991px]:py-[45px]
              max-[767px]:px-5 max-[767px]:py-[38px]
              max-[480px]:px-4 max-[480px]:py-8
            "
          >
            <div className="max-w-[520px]">
              {/* Title */}
              <h1
                className="
                  m-0 mb-0
                  text-[40px] leading-[40px]
                  font-bold
                  tracking-normal
                  text-white
                  max-[767px]:text-[42px]
                  max-[480px]:text-[35px]
                "
              >
                {t('terms.bannerTitle', { defaultValue: 'Terms of Service' })}
              </h1>
              {/* Description */}
              <p
                className="
                  my-5
                  max-w-[450px]
                  text-[14px]
                  leading-6
                  tracking-[0.5px]
                  text-white/60
                  max-[767px]:max-w-full
                  max-[767px]:mt-[15px]
                "
              >
                {t('terms.bannerDescription', {
                  defaultValue: 'Please read these terms carefully before using DressApp. They outline the rules and conditions for using our services.',
                })}
              </p>
            </div>
          </div>
        </div>
      </PageHeroBanner>

      {/* Content Section */}
    <div className="px-[40px] py-[40px] bg-[var(--accent-beige)]">
        <Card className="bg-white rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.05)]">
          <CardContent className="p-5">
            {loading && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {!loading && content && (
              <div
                dir={isRTL ? 'rtl' : 'ltr'}
                className="space-y-2"
              >
                {parseMarkdown(content)}
              </div>
            )}
            {!loading && !content && (
              <p className="text-sm text-muted-foreground text-center py-12">
                {t('terms.loadError', { defaultValue: 'Terms of Service could not be loaded. Please try again later.' })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}