import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useLegalPage({ basePath, filename, fallbackToDefault = true }) {
  const { i18n } = useTranslation();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const lang = i18n.language?.startsWith('en') ? '' : (i18n.language || '').split('-')[0] || '';
      const paths = lang && fallbackToDefault
        ? [`${basePath}/${filename}_${lang}.md`, `${basePath}/${filename}.md`]
        : lang
          ? [`${basePath}/${filename}_${lang}.md`]
          : [`${basePath}/${filename}.md`];

      try {
        for (const path of paths) {
          const res = await fetch(path);
          if (res.ok) {
            setContent(await res.text());
            return;
          }
        }
        setContent(null);
      } catch {
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [i18n.language, basePath, filename, fallbackToDefault]);

  return { content, loading };
}
