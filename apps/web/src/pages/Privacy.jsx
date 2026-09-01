import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';
import { parseMarkdown } from '@/lib/parseMarkdown';
import { useLegalPage } from '@/lib/useLegalPage';
import PrivacyBanner from '../assets/img/inner6.webp';
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

      {/* Banner Section */}
      <section
        className="
          relative isolate overflow-hidden
          bg-cover bg-center bg-no-repeat
        "
        style={{
          backgroundImage: `url(${PrivacyBanner})`,
        }}
      >
        {/* Dark gradient overlay */}
        <div
          className="
            absolute inset-0 -z-0
            bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)]
          "
        />

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
                {t('privacy.bannerTitle', { defaultValue: 'Privacy Policy' })}
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
                {t('privacy.bannerDescription', {
                  defaultValue: 'Your trust matters to us. Learn how DressApp collects, uses, and protects your personal data.',
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

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
              <div className="space-y-2">
                {parseMarkdown(content)}
              </div>
            )}
            {!loading && !content && (
              <p className="text-sm text-dark-brand text-center py-12">
                {t('privacy.loadError', { defaultValue: 'Privacy policy could not be loaded. Please try again later.' })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}