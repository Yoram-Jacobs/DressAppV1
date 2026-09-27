import {
  checkListingFit,
  compareSizes,
  normalizeGender,
  inferListingGender,
} from '../fitCompatibility';

describe('fitCompatibility', () => {
  describe('normalizeGender and inferListingGender', () => {
    it('normalizes gender values', () => {
      expect(normalizeGender("men's")).toBe('men');
      expect(normalizeGender('MALE')).toBe('men');
      expect(normalizeGender('female')).toBe('women');
      expect(normalizeGender('Women')).toBe('women');
      expect(normalizeGender('Unisex')).toBe('unisex');
      expect(normalizeGender('kids')).toBe('kids');
      expect(normalizeGender('unknown')).toBeNull();
    });

    it('infers gender from title and tags when explicit field is missing', () => {
      expect(inferListingGender({ title: "Vintage Men's Leather Jacket" })).toBe('men');
      expect(inferListingGender({ title: 'Elegant Floral Summer Dress for Women' })).toBe('women');
      expect(inferListingGender({ tags: ['unisex', 'cotton'] })).toBe('unisex');
      expect(inferListingGender({ title: 'Toddler Denim Overalls' })).toBe('kids');
    });
  });

  describe('compareSizes', () => {
    it('handles exact letter matches', () => {
      expect(compareSizes('M', 'M')).toEqual({ match: true, difference: 'exact' });
      expect(compareSizes('xl', 'XL')).toEqual({ match: true, difference: 'exact' });
    });

    it('detects letter scale larger/smaller', () => {
      expect(compareSizes('L', 'M')).toEqual({ match: false, difference: 'too_large' });
      expect(compareSizes('S', 'XL')).toEqual({ match: false, difference: 'too_small' });
      expect(compareSizes('XXL', '2XL')).toEqual({ match: true, difference: 'exact' });
    });

    it('handles numeric sizes', () => {
      expect(compareSizes('32', '32')).toEqual({ match: true, difference: 'exact' });
      expect(compareSizes('34', '32')).toEqual({ match: false, difference: 'too_large' });
      expect(compareSizes('9.5', '10')).toEqual({ match: false, difference: 'too_small' });
    });

    it('handles One Size', () => {
      expect(compareSizes('One Size', 'M')).toEqual({ match: true, difference: 'one_size' });
      expect(compareSizes('OS', '32')).toEqual({ match: true, difference: 'one_size' });
    });
  });

  describe('checkListingFit', () => {
    const mockT = (key, params) => {
      if (key === 'market.fitCheck.reasoningMenOnWomen') {
        return "Tailored for Men's proportions.";
      }
      if (key === 'market.fitCheck.reasoningWomenOnMen') {
        return "Tailored for Women's proportions.";
      }
      if (key === 'market.fitCheck.reasoningTooLarge') {
        return `Listing is ${params?.listingSize}, larger than ${params?.userSize}.`;
      }
      if (key === 'market.fitCheck.reasoningTooSmall') {
        return `Listing is ${params?.listingSize}, smaller than ${params?.userSize}.`;
      }
      return key;
    };

    it('detects gender mismatch for Men listing on Female user', () => {
      const listing = {
        category: 'Top',
        gender: 'men',
        size: 'M',
      };
      const user = {
        sex: 'female',
        body_measurements: {
          shirt_size: 'M',
        },
      };

      const result = checkListingFit(listing, user, mockT);
      expect(result.hasGenderMismatch).toBe(true);
      expect(result.hasSizeMismatch).toBe(false);
      expect(result.hasMismatch).toBe(true);
      expect(result.isCompatible).toBe(false);
      expect(result.reasoning).toContain("Tailored for Men's proportions.");
    });

    it('detects size mismatch when listing is larger', () => {
      const listing = {
        category: 'Top',
        gender: 'unisex',
        size: 'XL',
      };
      const user = {
        sex: 'male',
        body_measurements: {
          shirt_size: 'M',
        },
      };

      const result = checkListingFit(listing, user, mockT);
      expect(result.hasGenderMismatch).toBe(false);
      expect(result.hasSizeMismatch).toBe(true);
      expect(result.hasMismatch).toBe(true);
      expect(result.reasoning).toContain('Listing is XL, larger than M.');
    });

    it('detects both gender and size mismatch together', () => {
      const listing = {
        category: 'Bottom',
        gender: 'men',
        size: '36',
      };
      const user = {
        sex: 'female',
        body_measurements: {
          pants_size: '30',
        },
      };

      const result = checkListingFit(listing, user, mockT);
      expect(result.hasGenderMismatch).toBe(true);
      expect(result.hasSizeMismatch).toBe(true);
      expect(result.hasMismatch).toBe(true);
      expect(result.reasoningPoints.length).toBe(2);
    });

    it('confirms compatibility when size and gender match', () => {
      const listing = {
        category: 'Top',
        gender: 'women',
        size: 'S',
      };
      const user = {
        sex: 'female',
        body_measurements: {
          shirt_size: 'S',
        },
      };

      const result = checkListingFit(listing, user, mockT);
      expect(result.hasGenderMismatch).toBe(false);
      expect(result.hasSizeMismatch).toBe(false);
      expect(result.hasMismatch).toBe(false);
      expect(result.isCompatible).toBe(true);
    });
  });
});
