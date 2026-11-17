import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const PKG_LOCALES = path.join(REPO_ROOT, 'packages/i18n/locales');
const WEB_LOCALES = path.join(REPO_ROOT, 'apps/web/src/locales');
const WIKI_DIR = path.join(REPO_ROOT, 'wiki');
const PUB_WIKI_DIR = path.join(REPO_ROOT, 'apps/web/public/wiki');
const LEGAL_DIR = path.join(REPO_ROOT, 'apps/web/public/legal');

const LANGS = ['en', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'hi'];

function flattenKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}

describe('P2 Remediations — i18n, Wiki Sync, and Legal Version Parity', () => {
  test('packages/i18n and apps/web/src/locales share 100% key parity across all 13 languages', () => {
    const enJson = JSON.parse(fs.readFileSync(path.join(WEB_LOCALES, 'en.json'), 'utf8'));
    const enKeys = flattenKeys(enJson);

    for (const lang of LANGS) {
      const pkgRaw = fs.readFileSync(path.join(PKG_LOCALES, `${lang}.json`), 'utf8');
      const webRaw = fs.readFileSync(path.join(WEB_LOCALES, `${lang}.json`), 'utf8');
      const pkgJson = JSON.parse(pkgRaw);
      const webJson = JSON.parse(webRaw);
      expect(webJson).toEqual(pkgJson);

      const webKeys = flattenKeys(webJson);
      const missingFromEn = [...enKeys].filter((k) => !webKeys.has(k));
      expect({ lang, missingFromEn }).toEqual({ lang, missingFromEn: [] });
    }
  });

  test('wiki and apps/web/public/wiki are synchronized across all 13 languages without stale Gemini 2.5 references', () => {
    const enMdFiles = fs
      .readdirSync(path.join(WIKI_DIR, 'en'))
      .filter((f) => f.endsWith('.md'))
      .sort();

    for (const lang of LANGS) {
      const wDir = path.join(WIKI_DIR, lang);
      const pDir = path.join(PUB_WIKI_DIR, lang);
      const wFiles = fs.readdirSync(wDir).filter((f) => f.endsWith('.md')).sort();
      const pFiles = fs.readdirSync(pDir).filter((f) => f.endsWith('.md')).sort();

      expect(wFiles).toEqual(enMdFiles);
      expect(pFiles).toEqual(enMdFiles);

      for (const file of enMdFiles) {
        const wContent = fs.readFileSync(path.join(wDir, file), 'utf8').replace(/\r\n/g, '\n');
        const pContent = fs.readFileSync(path.join(pDir, file), 'utf8').replace(/\r\n/g, '\n');
        expect(pContent).toBe(wContent);
        expect(wContent).not.toMatch(/gemini[- ]2\.5/i);
      }
    }
  });

  test('legal markdown documents reference current app version 1.0.8 instead of 1.0.5', () => {
    const mdFiles = fs.readdirSync(LEGAL_DIR).filter((f) => f.endsWith('.md'));
    expect(mdFiles.length).toBeGreaterThanOrEqual(26);
    for (const f of mdFiles) {
      const content = fs.readFileSync(path.join(LEGAL_DIR, f), 'utf8');
      expect(content).not.toContain('1.0.5');
      expect(content).toContain('1.0.8');
    }
  });
});
