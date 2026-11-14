import fs from 'fs';
import path from 'path';
import { getCssBackground, translateColorName } from '../HarmonyBadge';
import enLocale from '../../../../../../packages/i18n/locales/en.json';
import heLocale from '../../../../../../packages/i18n/locales/he.json';

const VALID_CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|hsl\(\d+,\s*\d+%,\s*\d+%\)|linear-gradient\(.+\))$/;

function makeTranslator(locale) {
  return (key, opts = {}) => {
    const parts = key.split('.');
    let cur = locale;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p];
      } else {
        return opts.defaultValue ?? key;
      }
    }
    return typeof cur === 'string' ? cur : (opts.defaultValue ?? key);
  };
}

describe('HarmonyBadge color chip & localization coverage', () => {
  const enColors = enLocale.taxonomy.color;
  const heColors = heLocale.taxonomy.color;

  it('resolves a valid CSS chip background for every color key and English label', () => {
    for (const [key, enLabel] of Object.entries(enColors)) {
      const bgFromKey = getCssBackground(key);
      const bgFromLabel = getCssBackground(enLabel);
      expect(bgFromKey).toMatch(VALID_CSS_COLOR_RE);
      expect(bgFromLabel).toMatch(VALID_CSS_COLOR_RE);
    }
  });

  it('resolves a valid CSS chip background for every Hebrew color label', () => {
    for (const [key, heLabel] of Object.entries(heColors)) {
      const bg = getCssBackground(heLabel);
      expect(bg).toMatch(VALID_CSS_COLOR_RE);
      if (key === 'black') {
        expect(bg).toBe('#111827');
      }
      if (key === 'white') {
        expect(bg).toBe('#ffffff');
      }
    }
  });

  it('matches specific chip colors to their color names', () => {
    expect(getCssBackground('שחור')).toBe('#111827');
    expect(getCssBackground('black')).toBe('#111827');
    expect(getCssBackground('White')).toBe('#ffffff');
    expect(getCssBackground('Sage Green')).toBe('#8fa882');
    expect(getCssBackground('ירוק מרווה')).toBe('#8fa882');
    expect(getCssBackground('Light Blue')).toBe('hsl(205, 65%, 52%)');
    expect(getCssBackground('Black & White')).toContain('linear-gradient(');
    expect(getCssBackground('Black & White')).toContain('#111827');
    expect(getCssBackground('Black & White')).toContain('#ffffff');
  });

  it('localizes English color names (including Sage Green) into Hebrew', () => {
    const tHe = makeTranslator(heLocale);
    expect(translateColorName('Sage Green', tHe)).toBe('ירוק מרווה');
    expect(translateColorName('Black', tHe)).toBe('שחור');
    expect(translateColorName('Blue', tHe)).toBe('כחול');
    expect(translateColorName('Black & White', tHe)).toBe('שחור & לבן');
  });

  it('has all English taxonomy.color keys present in all 13 packages/i18n/locales files', () => {
    const localesDir = path.resolve(__dirname, '../../../../../../packages/i18n/locales');
    const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(13);
    const enKeys = Object.keys(enColors);
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
      const colorMap = data?.taxonomy?.color || {};
      for (const k of enKeys) {
        expect(colorMap[k]).toBeTruthy();
      }
    }
  });
});
