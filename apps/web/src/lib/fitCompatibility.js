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
 * Parse a letter size or range like "M/L" / "S-M" / "6 / M" into an index range [minIdx, maxIdx].
 */
function parseLetterRange(str) {
  if (!str) return null;
  const cleaned = String(str).trim().toUpperCase();
  if (LETTER_SIZE_MAP[cleaned] !== undefined) {
    const idx = LETTER_SIZE_MAP[cleaned];
    return [idx, idx];
  }
  const rangeMatch = cleaned.match(/^(XXXL|XXL|XXS|XS|XL|4XL|3XL|2XL|3X|2X|1XL|1X|S|M|L)\s*[\/\-]\s*(XXXL|XXL|XXS|XS|XL|4XL|3XL|2XL|3X|2X|1XL|1X|S|M|L)$/);
  if (rangeMatch) {
    const a = LETTER_SIZE_MAP[rangeMatch[1]];
    const b = LETTER_SIZE_MAP[rangeMatch[2]];
    if (a !== undefined && b !== undefined) {
      return [Math.min(a, b), Math.max(a, b)];
    }
  }
  // Composite label e.g. "6 / M" or "10 / L"
  const compMatch = cleaned.match(/\/\s*(XXXL|XXL|XXS|XS|XL|4XL|3XL|2XL|3X|2X|1XL|1X|S|M|L)\b/);
  if (compMatch && LETTER_SIZE_MAP[compMatch[1]] !== undefined) {
    const idx = LETTER_SIZE_MAP[compMatch[1]];
    return [idx, idx];
  }
  return null;
}

/**
 * Extract size system ('EU' | 'US' | 'UK' | 'CM' | null) and clean numeric value.
 */
function parseSystemAndNumber(str) {
  if (!str) return { system: null, value: null };
  const raw = String(str).trim();
  const sysMatch = raw.match(/\b(EU|EUR|IT|FR|US|UK|CM)\b/i);
  let system = null;
  if (sysMatch) {
    const token = sysMatch[1].toUpperCase();
    system = token === 'EUR' ? 'EU' : token;
  }
  const numMatch = raw.match(/(\d+(?:\.\d+)?)/);
  const value = numMatch ? parseFloat(numMatch[1]) : null;
  return { system, value: value !== null && !isNaN(value) ? value : null };
}

function isFootwearCategory(category) {
  const c = String(category || '').toLowerCase();
  return /footwear|shoe|sneaker|boot|sandal|heel|loafer|נעל/.test(c);
}

/**
 * Normalize shoe or apparel numeric sizes to comparable US units when systems differ.
 */
function toComparableNumeric(parsed, otherParsed, category) {
  if (parsed.value === null) return null;
  const sys = parsed.system;
  const otherSys = otherParsed.system;
  if (isFootwearCategory(category) || sys === 'EU' || otherSys === 'EU' || sys === 'UK' || otherSys === 'UK') {
    const v = parsed.value;
    if (isFootwearCategory(category)) {
      if (sys === 'EU' || (!sys && v >= 32 && v <= 50)) {
        return v - 33.0;
      }
      if (sys === 'UK') {
        return v + 1.0;
      }
      return v;
    }
    // Non-footwear apparel explicit EU/IT/FR vs US (e.g. EU 38 ≈ US 6)
    if (sys === 'EU' || sys === 'IT' || sys === 'FR') {
      return v - 32.0;
    }
    if (sys === 'UK') {
      return v - 4.0;
    }
  }
  return parsed.value;
}

/**
 * Compare two size strings with letter range and EU/US/UK unit awareness.
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

  // One size check (including embedded one-size variants)
  if (
    ONE_SIZE_STRINGS.has(normListing.toLowerCase()) ||
    ONE_SIZE_STRINGS.has(normUser.toLowerCase()) ||
    /\bone[\s-]*size\b|\bosfa\b/i.test(normListing) ||
    /\bone[\s-]*size\b|\bosfa\b/i.test(normUser)
  ) {
    return { match: true, difference: 'one_size' };
  }

  // Exact match
  if (lUpper === uUpper) {
    return { match: true, difference: 'exact' };
  }

  // Letter scale comparison (supports single and combined ranges like 'M/L' or '6 / M')
  const lRange = parseLetterRange(lUpper);
  const uRange = parseLetterRange(uUpper);
  if (lRange && uRange) {
    if (lRange[0] <= uRange[1] && uRange[0] <= lRange[1]) {
      return { match: true, difference: 'exact' };
    }
    return {
      match: false,
      difference: lRange[0] > uRange[1] ? 'too_large' : 'too_small',
    };
  }

  // Unit-aware numeric size comparison (EU/US/UK shoes, pants, etc.)
  const lParsed = parseSystemAndNumber(normListing);
  const uParsed = parseSystemAndNumber(normUser);
  if (lParsed.value !== null && uParsed.value !== null) {
    const lComp =
      lParsed.system && uParsed.system && lParsed.system === uParsed.system
        ? lParsed.value
        : toComparableNumeric(lParsed, uParsed, category);
    const uComp =
      lParsed.system && uParsed.system && lParsed.system === uParsed.system
        ? uParsed.value
        : toComparableNumeric(uParsed, lParsed, category);

    if (lComp !== null && uComp !== null) {
      if (Math.abs(lComp - uComp) <= 0.5) {
        return { match: true, difference: 'exact' };
      }
      return {
        match: false,
        difference: lComp > uComp ? 'too_large' : 'too_small',
      };
    }
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
