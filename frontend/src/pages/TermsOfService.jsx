import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';

function parseMarkdown(mdText) {
  if (!mdText) return null;

  const lines = mdText.split('\n');
  const elements = [];
  let listItems = [];

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 space-y-1.5 my-3 text-muted-foreground text-sm">
          {listItems.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  const parseInline = (text) => {
    const parts = [];
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    let match;
    let lastIndex = 0;
    let keyIdx = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(<strong key={keyIdx++} className="font-semibold text-foreground">{matchText.slice(2, -2)}</strong>);
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(<code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-secondary/50 text-xs font-mono">{matchText.slice(1, -1)}</code>);
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const label = matchText.substring(1, matchText.indexOf(']'));
        const href = matchText.substring(matchText.indexOf('](') + 2, matchText.length - 1);
        parts.push(
          <a key={keyIdx++} href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
            {label}
          </a>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  let inCode = false;
  let codeLines = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();

    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={`code-${idx}`} className="p-4 rounded-lg bg-secondary/30 border border-border/40 font-mono text-xs overflow-x-auto my-4 text-foreground">
            {codeLines.join('\n')}
          </pre>
        );
        inCode = false;
        codeLines = [];
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(lines[idx]);
      continue;
    }

    if (line.startsWith('# ')) {
      flushList(idx);
      elements.push(
        <h1 key={`h1-${idx}`} className="text-2xl font-bold text-primary mt-6 mb-3 pb-1 border-b border-border/50">
          {parseInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushList(idx);
      elements.push(
        <h2 key={`h2-${idx}`} className="text-xl font-bold text-foreground mt-5 mb-2.5">
          {parseInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      flushList(idx);
      elements.push(
        <h3 key={`h3-${idx}`} className="text-base font-semibold text-foreground mt-4 mb-2">
          {parseInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushList(idx);
      const match = line.match(/^\d+\.\s(.*)/);
      elements.push(
        <div key={`num-${idx}`} className="flex gap-3 my-2 text-sm text-muted-foreground">
          <span className="font-bold text-primary shrink-0">{line.match(/^\d+/)[0]}.</span>
          <p className="pt-0.5">{parseInline(match[1])}</p>
        </div>
      );
      continue;
    }

    if (line === '') {
      flushList(idx);
      continue;
    }

    if (line === '---') {
      flushList(idx);
      elements.push(<hr key={`hr-${idx}`} className="my-6 border-border/50" />);
      continue;
    }

    if (line.startsWith('> ')) {
      flushList(idx);
      elements.push(
        <blockquote key={`quote-${idx}`} className="pl-4 border-l-4 border-primary/50 text-muted-foreground text-sm italic my-4">
          {parseInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    flushList(idx);
    elements.push(
      <p key={`p-${idx}`} className="text-sm text-muted-foreground leading-relaxed my-3">
        {parseInline(line)}
      </p>
    );
  }

  flushList(lines.length);
  return elements;
}

export default function TermsOfService() {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTerms = async () => {
      setLoading(true);
      const lang = i18n.language?.startsWith('en') ? '' : i18n.language || '';
      const paths = lang ? [`/legal/TERMS_OF_SERVICE_${lang}.md`] : ['/legal/TERMS_OF_SERVICE.md'];

      try {
        for (const path of paths) {
          const res = await fetch(path);
          if (res.ok) {
            const text = await res.text();
            setContent(text);
            setLoading(false);
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

    loadTerms();
  }, [i18n.language]);

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