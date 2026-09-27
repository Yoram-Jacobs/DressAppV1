import { deriveSizeFromPreferences } from './size_preferences';

const LETTER_SIZE_MAP = {
  'XXS': 0,
  'XS': 1,
  'EXTRA SMALL': 1,
  'S': 2,
  'SMALL': 2,
  'M': 3,
  'MEDIUM': 3,
  'L': 4,
  'LARGE': 4,
  'XL': 5,
  'EXTRA LARGE': 5,
  '1X': 5,
  '1XL': 5,
  'XXL': 6,
  '2XL': 6,
  '2X': 6,
  'XXXL': 7,
  '3XL': 7,
  '3X': 7,
  '4XL': 8,
  '4X': 8,
};

const ONE_SIZE_STRINGS = new Set([
  'one size',
  'one size fits all',
  'one-size',
  'os',
  'osfa',
  'freesize',
  'free size',
  'free',
  'all',
  'uni',
  'unique',
]);

/**
 * Normalize gender string to 'men' | 'women' | 'unisex' | 'kids' | null
 */
export function normalizeGender(val) {
  if (!val) return null;
  const s = String(val).trim().toLowerCase();
  if (['men', 'mens', "men's", 'male', 'homme', 'herren', 'hombre', 'uomo'].includes(s)) {
    return 'men';
  }
  if (['women', 'womens', "women's", 'female', 'femme', 'damen', 'mujer', 'donna'].includes(s)) {
    return 'women';
  }
  if (['unisex', 'genderless', 'all'].includes(s)) {
    return 'unisex';
  }
  if (['kids', 'children', 'child', 'boy', 'boys', 'girl', 'girls', 'toddler', 'infant'].includes(s)) {
    return 'kids';
  }
  return null;
}

/**
 * Infer gender from listing attributes, title, or tags
 */
export function inferListingGender(listing) {
  if (!listing) return null;
  const explicit = normalizeGender(listing.gender);
  if (explicit) return explicit;

  const text = `${listing.title || ''} ${listing.description || ''} ${(listing.tags || []).join(' ')}`.toLowerCase();
  if (/\b(men['’]?s|mens|for men|herren|homme|uomo|hombre)\b/.test(text)) {
    return 'men';
  }
  if (/\b(women['’]?s|womens|for women|damen|femme|donna|mujer)\b/.test(text)) {
    return 'women';
  }
  if (/\b(kids?|children|boys?|girls?|toddler)\b/.test(text)) {
    return 'kids';
  }
  if (/\b(unisex)\b/.test(text)) {
    return 'unisex';
  }
  return null;
}

/**
 * Extract clean numeric size if available (e.g. "32x30" -> 32, "US 10.5" -> 10.5)
 */
function extractNumericSize(str) {
  if (!str) return null;
  const match = String(str).match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Compare two size strings
 * Returns: { match: boolean | null, difference: 'exact'|'too_large'|'too_small'|'different'|'one_size'|null }
 */
export function compareSizes(listingSizeRaw, userSizeRaw, category = '') {
  const normListing = String(listingSizeRaw || '').trim();
  const normUser = String(userSizeRaw || '').trim();

  if (!normListing) {
    return { match: null, difference: null, missingListing: true };
  }
  if (!normUser) {
    return { match: null, difference: null, missingUser: true };
  }

  const lUpper = normListing.toUpperCase();
  const uUpper = normUser.toUpperCase();

  // One size check
  if (ONE_SIZE_STRINGS.has(normListing.toLowerCase()) || ONE_SIZE_STRINGS.has(normUser.toLowerCase())) {
    return { match: true, difference: 'one_size' };
  }

  // Exact match
  if (lUpper === uUpper) {
    return { match: true, difference: 'exact' };
  }

  // Letter scale comparison
  const lLetterIdx = LETTER_SIZE_MAP[lUpper];
  const uLetterIdx = LETTER_SIZE_MAP[uUpper];

  if (lLetterIdx !== undefined && uLetterIdx !== undefined) {
    if (lLetterIdx === uLetterIdx) {
      return { match: true, difference: 'exact' };
    }
    return {
      match: false,
      difference: lLetterIdx > uLetterIdx ? 'too_large' : 'too_small',
    };
  }

  // Numeric size comparison (shoes, pants, etc.)
  const lNum = extractNumericSize(normListing);
  const uNum = extractNumericSize(normUser);

  if (lNum !== null && uNum !== null) {
    // If numbers are very close, count as match
    if (Math.abs(lNum - uNum) < 0.25) {
      return { match: true, difference: 'exact' };
    }
    return {
      match: false,
      difference: lNum > uNum ? 'too_large' : 'too_small',
    };
  }

  // Fallback string difference
  return { match: false, difference: 'different' };
}

/**
 * Check size and gender fit between a marketplace listing and an authenticated user.
 *
 * @param {object} listing - The marketplace listing object
 * @param {object} user - The authenticated user object (from useAuth())
 * @param {function} t - i18next translation function
 * @returns {object} Fit compatibility assessment with localized reasoning
 */
export function checkListingFit(listing, user, t = (k, opts) => opts?.defaultValue || k) {
  if (!listing) {
    return {
      isCompatible: true,
      hasMismatch: false,
      hasGenderMismatch: false,
      hasSizeMismatch: false,
      hasMissingData: false,
      reasoning: '',
      reasoningPoints: [],
    };
  }

  const listingGender = inferListingGender(listing);
  const userSex = user?.sex ? (user.sex.toLowerCase() === 'female' ? 'women' : 'men') : null;

  // 1. Gender Verification
  let genderMatch = true;
  let genderReasonKey = null;

  if (listingGender === 'kids') {
    genderMatch = false;
    genderReasonKey = 'reasoningKids';
  } else if (listingGender && listingGender !== 'unisex' && userSex) {
    if (listingGender === 'men' && userSex === 'women') {
      genderMatch = false;
      genderReasonKey = 'reasoningMenOnWomen';
    } else if (listingGender === 'women' && userSex === 'men') {
      genderMatch = false;
      genderReasonKey = 'reasoningWomenOnMen';
    }
  }

  // 2. Size Verification
  const userSize = deriveSizeFromPreferences(user, listing);
  const listingSize = listing.size || '';
  const rawCat = listing.category || 'Garment';
  const categoryLabel = t(`taxonomy.categories.${rawCat.toLowerCase()}`, { defaultValue: rawCat });

  const isAccessory = ['accessory', 'accessories', 'headwear', 'hat'].includes(
    String(rawCat).toLowerCase().trim()
  );

  let sizeMatch = true;
  let sizeReasonKey = null;
  let sizeDiff = 'exact';
  let missingListingSize = false;
  let missingUserSize = false;

  if (!isAccessory) {
    const sizeComp = compareSizes(listingSize, userSize, rawCat);
    if (sizeComp.missingListing) {
      missingListingSize = true;
      sizeMatch = null;
    } else if (sizeComp.missingUser) {
      missingUserSize = true;
      sizeMatch = null;
    } else {
      sizeMatch = sizeComp.match;
      sizeDiff = sizeComp.difference;
      if (sizeMatch === false) {
        if (sizeDiff === 'too_large') sizeReasonKey = 'reasoningTooLarge';
        else if (sizeDiff === 'too_small') sizeReasonKey = 'reasoningTooSmall';
        else sizeReasonKey = 'reasoningDifferent';
      }
    }
  }

  // 3. Assemble Localized Reasoning
  const reasoningPoints = [];

  const listingGenderText = listingGender
    ? t(`market.fitCheck.gender${listingGender.charAt(0).toUpperCase() + listingGender.slice(1)}`, {
        defaultValue: listingGender,
      })
    : t('market.fitCheck.genderNotSpecified', { defaultValue: 'Not specified' });

  const userGenderText = userSex
    ? t(`market.fitCheck.gender${userSex.charAt(0).toUpperCase() + userSex.slice(1)}`, {
        defaultValue: userSex,
      })
    : t('market.fitCheck.genderNotSpecified', { defaultValue: 'Not specified' });

  if (genderMatch === false && genderReasonKey) {
    const text = t(`market.fitCheck.${genderReasonKey}`, {
      defaultValue:
        genderReasonKey === 'reasoningMenOnWomen'
          ? "This garment is tailored for Men's proportions, while your profile is Female. Proportions may differ."
          : genderReasonKey === 'reasoningWomenOnMen'
          ? "This garment is tailored for Women's proportions, while your profile is Male. Proportions may differ."
          : "This item is sized for children/kids and will not fit adult dimensions.",
    });
    reasoningPoints.push({
      type: 'gender',
      title: t('market.fitCheck.genderMismatch', { defaultValue: 'Gender Mismatch' }),
      text,
    });
  }

  if (sizeMatch === false && sizeReasonKey) {
    const text = t(`market.fitCheck.${sizeReasonKey}`, {
      listingSize: listingSize || 'N/A',
      userSize: userSize || 'N/A',
      category: categoryLabel,
      defaultValue:
        sizeDiff === 'too_large'
          ? `The listing is size ${listingSize}, which is larger than your profile size (${userSize}) for ${categoryLabel}. It will likely fit loose or oversized.`
          : sizeDiff === 'too_small'
          ? `The listing is size ${listingSize}, which is smaller than your profile size (${userSize}) for ${categoryLabel}. It will likely fit too tight.`
          : `The listing is size ${listingSize}, while your profile size is ${userSize} for ${categoryLabel}.`,
    });
    reasoningPoints.push({
      type: 'size',
      title: t('market.fitCheck.sizeMismatch', { defaultValue: 'Size Mismatch' }),
      text,
    });
  }

  if (missingUserSize && listingSize && !isAccessory) {
    reasoningPoints.push({
      type: 'info',
      title: t('market.fitCheck.incompleteProfileTip', { defaultValue: 'Size preference missing' }),
      text: t('market.fitCheck.reasoningMissingUserSize', {
        category: categoryLabel,
        defaultValue: `Your profile does not have a saved size for ${categoryLabel}. Check your body measurements in Profile.`,
      }),
    });
  }

  const hasGenderMismatch = genderMatch === false;
  const hasSizeMismatch = sizeMatch === false;
  const hasMismatch = hasGenderMismatch || hasSizeMismatch;
  const hasMissingData = !user || !userSex || missingUserSize;
  const isCompatible = !hasMismatch;

  let title = t('market.fitCheck.fitMatchVerified', {
    defaultValue: 'Size & gender match your wardrobe profile',
  });
  if (hasGenderMismatch && hasSizeMismatch) {
    title = t('market.fitCheck.bothMismatch', { defaultValue: 'Gender & Size Mismatch' });
  } else if (hasGenderMismatch) {
    title = t('market.fitCheck.genderMismatch', { defaultValue: 'Gender Mismatch' });
  } else if (hasSizeMismatch) {
    title = t('market.fitCheck.sizeMismatch', { defaultValue: 'Size Mismatch' });
  } else if (hasMissingData) {
    title = t('market.fitCheck.title', { defaultValue: 'Fit & Compatibility Notice' });
  }

  const reasoning = reasoningPoints.map((p) => p.text).join(' ');

  let badgeVariant = 'outline';
  let badgeLabel = t('market.fitCheck.fitMatchVerified', { defaultValue: 'Verified Fit' });
  if (hasMismatch) {
    badgeVariant = 'destructive';
    badgeLabel = title;
  } else if (hasMissingData) {
    badgeVariant = 'secondary';
    badgeLabel = t('market.fitCheck.incompleteProfileTip', { defaultValue: 'Fit Unverified' });
  }

  return {
    isCompatible,
    hasMismatch,
    hasGenderMismatch,
    hasSizeMismatch,
    hasMissingData,
    listingGender,
    userGender: userSex,
    listingGenderText,
    userGenderText,
    listingSize: listingSize || t('market.fitCheck.genderNotSpecified', { defaultValue: 'Not specified' }),
    userSize: userSize || t('market.fitCheck.genderNotSpecified', { defaultValue: 'Not specified' }),
    category: categoryLabel,
    reasoning,
    reasoningPoints,
    title,
    badgeVariant,
    badgeLabel,
  };
}
