import {
  generateDescriptiveOutfitTitle,
  generateDescriptiveOutfitDescription,
  formatOutfitTitle,
  formatOutfitDescription,
} from '../outfitLocalization';
import heLocale from '../../locales/he.json';
import enLocale from '../../locales/en.json';

function createTranslator(localeData) {
  return function t(key, options = {}) {
    const parts = key.split('.');
    let cur = localeData;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p];
      } else {
        cur = null;
        break;
      }
    }
    let res = typeof cur === 'string' ? cur : (options.defaultValue || key);
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        if (k !== 'defaultValue') {
          res = res.replace(new RegExp(`{{${k}}}`, 'g'), v);
        }
      }
    }
    return res;
  };
}

describe('outfitLocalization', () => {
  const tHe = createTranslator(heLocale);
  const tEn = createTranslator(enLocale);

  describe('formatOutfitTitle (normalizing legacy/English titles to current locale)', () => {
    it('converts "Casua שחור & כחול נייבי Daily Hangout" to natural Hebrew', () => {
      const input = 'Casua שחור & כחול נייבי Daily Hangout';
      const output = formatOutfitTitle(input, tHe);
      expect(output).toBe('מפגש קז\'ואל יומיומי בצבעי שחור וכחול נייבי');
    });

    it('converts "Casual Black & Navy Blue Daily Hangout" to Hebrew', () => {
      const input = 'Casual Black & Navy Blue Daily Hangout';
      const output = formatOutfitTitle(input, tHe);
      // In heLocale, 'color.black' is 'שחור'
      expect(output).toContain('מפגש קז\'ואל יומיומי');
      expect(output).toContain('שחור');
    });

    it('converts "Casual Black & Navy Blue Daily Hangout" to English', () => {
      const input = 'Casual Black & Navy Blue Daily Hangout';
      const output = formatOutfitTitle(input, tEn);
      expect(output).toContain('Casual Black &');
      expect(output).toContain('Daily Hangout');
    });

    it('converts "Sporty Black Winter Workout" to Hebrew', () => {
      const input = 'Sporty Black Winter Workout';
      const output = formatOutfitTitle(input, tHe);
      expect(output).toBe('אימון ספורטיבי חורפי בצבעי שחור');
    });

    it('converts "Casual Daily Hangout" (without colors) to Hebrew', () => {
      const input = 'Casual Daily Hangout';
      const output = formatOutfitTitle(input, tHe);
      expect(output).toBe('מפגש קז\'ואל יומיומי');
    });
  });

  describe('formatOutfitDescription (normalizing legacy descriptions)', () => {
    it('translates English wrapper description into pure Hebrew with RTL protection', () => {
      const input =
        'A carefully styled combination featuring קרדיגן שחור ארוך וצנוע בגזרה פתוחה, חולצת טריקו שחורה מחויטת בגזרה צמודה, חצאית ג\'ינס פליסה באינדיגו כהה, סניקרס נמוכות בלבן וכחול נייבי. Perfect for a coordinated and comfortable look.';
      const output = formatOutfitDescription(input, tHe);
      expect(output).toBe(
        'שילוב מוקפד הכולל קרדיגן שחור ארוך וצנוע בגזרה פתוחה, חולצת טריקו שחורה מחויטת בגזרה צמודה, חצאית ג\'ינס פליסה באינדיגו כהה, סניקרס נמוכות בלבן וכחול נייבי. מושלם למראה מתואם ונוח.'
      );
      // Ensure no English words leaked through
      expect(output).not.toMatch(/carefully|styled|combination|featuring|Perfect|comfortable/i);
    });

    it('formats English description when in English locale', () => {
      const input =
        'A carefully styled combination featuring Black Cardigan, White Sneakers. Perfect for a coordinated and comfortable look.';
      const output = formatOutfitDescription(input, tEn);
      expect(output).toBe(
        'A carefully styled combination featuring Black Cardigan, White Sneakers. Perfect for a coordinated and comfortable look.'
      );
    });
  });

  describe('generateDescriptiveOutfitTitle (new outfit generation)', () => {
    it('generates a localized Hebrew title for a casual outfit', () => {
      const items = [
        { title: 'חולצה', color: 'black' },
        { title: 'מכנסיים', color: 'navy blue' },
      ];
      const title = generateDescriptiveOutfitTitle(items, tHe);
      expect(title).toContain('קז\'ואל');
      expect(title).toContain('יומיומי');
      expect(title).toContain('בצבעי');
    });

    it('generates a localized English title for a casual outfit', () => {
      const items = [
        { title: 'Shirt', color: 'black' },
        { title: 'Jeans', color: 'blue' },
      ];
      const title = generateDescriptiveOutfitTitle(items, tEn);
      expect(title).toContain('Classic');
      expect(title).toContain('Daily');
    });
  });

  describe('generateDescriptiveOutfitDescription (new outfit generation)', () => {
    it('generates a Hebrew description for given garment titles', () => {
      const items = [
        { title: 'קרדיגן שחור' },
        { title: 'חצאית ג\'ינס' },
      ];
      const desc = generateDescriptiveOutfitDescription(items, tHe);
      expect(desc).toBe('שילוב מוקפד הכולל קרדיגן שחור, חצאית ג\'ינס. מושלם למראה מתואם ונוח.');
    });
  });
});
