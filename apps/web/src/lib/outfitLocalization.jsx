/**
 * Localized outfit title and description generator and formatter.
 * Handles generation for newly shuffled/matched outfits and
 * dynamic runtime localization for existing stored outfits across all 13 supported languages.
 */

export function translateColor(color, translator) {
  if (!color || typeof color !== 'string') return '';
  const trimmed = color.trim();
  // If it already has non-ASCII characters (e.g. Hebrew, Arabic, Cyrillic, CJK), it's already localized
  if (/[^\u0000-\u007F]/.test(trimmed)) {
    return trimmed;
  }

  const clean = trimmed.toLowerCase();
  const normalized = clean.replace(/[\s-]+/g, '_');

  const check = (k) => {
    const val = translator(k, { defaultValue: '' });
    if (val && val !== k) return val;
    return '';
  };

  let translated = check(`taxonomy.color.${normalized}`);
  if (!translated && normalized.includes('_')) {
    const first = normalized.split('_')[0];
    translated = check(`taxonomy.color.${first}`);
  }
  if (!translated) {
    translated = check(`taxonomy.color.${clean}`);
  }
  if (!translated) {
    translated = check(`color.${normalized}`);
  }
  if (!translated) {
    translated = check(`color.${clean}`);
  }
  return translated || trimmed;
}

export function generateDescriptiveOutfitTitle(items, translator) {
  if (!items || items.length === 0) {
    return translator('stylist.untitledConversation', { defaultValue: 'Untitled outfit' });
  }

  const colorList = items
    .map(it => {
      if (typeof it.color === 'string') return it.color;
      if (Array.isArray(it.colors) && it.colors.length > 0) {
        return typeof it.colors[0] === 'object' ? it.colors[0].name : it.colors[0];
      }
      return null;
    })
    .filter(Boolean);

  const uniqueColors = Array.from(new Set(colorList.map(c => c.toLowerCase()))).map(c => {
    const localized = translateColor(c, translator);
    return localized.charAt(0).toUpperCase() + localized.slice(1);
  });

  const colorConnector = translator('stylist.colorConnector', { defaultValue: ' & ' });
  let colorStr = '';
  if (uniqueColors.length === 1) {
    colorStr = uniqueColors[0];
  } else if (uniqueColors.length >= 2) {
    colorStr = uniqueColors.slice(0, 2).join(colorConnector);
  }

  const types = items.map(it => (it.item_type || it.title || it.name || '').toLowerCase());
  let vibeKey = 'casual';
  let seasonKey = 'daily';

  if (types.some(t => t.includes('hoodie') || t.includes('sweatpants') || t.includes('sneaker') || t.includes('sport'))) {
    vibeKey = 'sporty';
  } else if (types.some(t => t.includes('suit') || t.includes('blazer') || t.includes('dress shirt') || t.includes('formal'))) {
    vibeKey = 'formal';
  } else if (types.some(t => t.includes('jeans') || t.includes('denim') || t.includes('jacket'))) {
    vibeKey = 'classic';
  }

  if (types.some(t => t.includes('shorts') || t.includes('t-shirt') || t.includes('sandal') || t.includes('swim'))) {
    seasonKey = 'summer';
  } else if (types.some(t => t.includes('coat') || t.includes('sweater') || t.includes('wool') || t.includes('heavy'))) {
    seasonKey = 'winter';
  }

  const suffixKey = vibeKey === 'sporty'
    ? 'workout'
    : vibeKey === 'formal'
      ? 'attire'
      : 'hangout';

  const vibe = translator(`stylist.vibe.${vibeKey}`, { defaultValue: vibeKey.charAt(0).toUpperCase() + vibeKey.slice(1) });
  const season = translator(`stylist.season.${seasonKey}`, { defaultValue: seasonKey.charAt(0).toUpperCase() + seasonKey.slice(1) });
  const suffix = translator(`stylist.suffix.${suffixKey}`, { defaultValue: suffixKey.charAt(0).toUpperCase() + suffixKey.slice(1) });

  if (colorStr) {
    return translator('stylist.outfitTitleWithColorsPattern', {
      vibe,
      colors: colorStr,
      season,
      suffix,
      defaultValue: `${vibe} ${colorStr} ${season} ${suffix}`
    });
  }
  return translator('stylist.outfitTitlePattern', {
    vibe,
    season,
    suffix,
    defaultValue: `${vibe} ${season} ${suffix}`
  });
}

export function generateDescriptiveOutfitDescription(items, translator) {
  const titles = (items || []).map(it => it.title || it.name || it.caption).filter(Boolean);
  if (titles.length === 0) return '';
  const listSep = translator('common.listSeparator', { defaultValue: ', ' });
  return translator('stylist.outfitDescriptionPattern', {
    defaultValue: `A carefully styled combination featuring ${titles.join(', ')}. Perfect for a coordinated and comfortable look.`,
    items: titles.join(listSep)
  });
}

/**
 * Format and localize existing outfit names (handles database-stored legacy and English titles).
 */
export function formatOutfitTitle(name, translator) {
  if (!name) return '';
  let localized = name;
  localized = localized.replace('(Fallback. Quota exhausted)', translator('stylist.fallbackQuotaExhausted', { defaultValue: '(Fallback. Quota exhausted)' }));
  localized = localized.replace('(Fallback)', translator('stylist.fallbackLabel', { defaultValue: '(Fallback)' }));

  // Match English / legacy descriptive title:
  // e.g. "Casual שחור & כחול נייבי Daily Hangout", "Casua שחור & כחול נייבי Daily Hangout",
  // "Casual Black & Navy Blue Daily Hangout", "Sporty Black Winter Workout"
  const descriptiveMatch = localized.match(/^(Casual|Casua|Sporty|Formal|Classic)\s+(.*?)\s*(Daily|Summer|Winter)\s+(Hangout|Workout|Attire)$/i);
  if (descriptiveMatch) {
    const rawVibe = descriptiveMatch[1].toLowerCase();
    const vibeKey = rawVibe.startsWith('cas') ? 'casual' : rawVibe;
    const rawColors = descriptiveMatch[2]?.trim();
    const seasonKey = descriptiveMatch[3].toLowerCase();
    const suffixKey = descriptiveMatch[4].toLowerCase();

    const vibe = translator(`stylist.vibe.${vibeKey}`, { defaultValue: descriptiveMatch[1] });
    const season = translator(`stylist.season.${seasonKey}`, { defaultValue: descriptiveMatch[3] });
    const suffix = translator(`stylist.suffix.${suffixKey}`, { defaultValue: descriptiveMatch[4] });

    let colorStr = '';
    if (rawColors) {
      const colorConnector = translator('stylist.colorConnector', { defaultValue: ' & ' });
      const colorParts = rawColors.split(/\s*&\s*/).map(c => {
        const cTrim = c.trim();
        const translatedColor = translateColor(cTrim, translator);
        return translatedColor.charAt(0).toUpperCase() + translatedColor.slice(1);
      });
      colorStr = colorParts.join(colorConnector);
    }

    if (colorStr) {
      return translator('stylist.outfitTitleWithColorsPattern', {
        vibe,
        colors: colorStr,
        season,
        suffix,
        defaultValue: `${vibe} ${colorStr} ${season} ${suffix}`
      });
    }
    return translator('stylist.outfitTitlePattern', {
      vibe,
      season,
      suffix,
      defaultValue: `${vibe} ${season} ${suffix}`
    });
  }

  // Handle without colors: e.g. "Casual Daily Hangout"
  const noColorMatch = localized.match(/^(Casual|Casua|Sporty|Formal|Classic)\s+(Daily|Summer|Winter)\s+(Hangout|Workout|Attire)$/i);
  if (noColorMatch) {
    const rawVibe = noColorMatch[1].toLowerCase();
    const vibeKey = rawVibe.startsWith('cas') ? 'casual' : rawVibe;
    const seasonKey = noColorMatch[2].toLowerCase();
    const suffixKey = noColorMatch[3].toLowerCase();

    const vibe = translator(`stylist.vibe.${vibeKey}`, { defaultValue: noColorMatch[1] });
    const season = translator(`stylist.season.${seasonKey}`, { defaultValue: noColorMatch[2] });
    const suffix = translator(`stylist.suffix.${suffixKey}`, { defaultValue: noColorMatch[3] });

    return translator('stylist.outfitTitlePattern', {
      vibe,
      season,
      suffix,
      defaultValue: `${vibe} ${season} ${suffix}`
    });
  }

  // Convert legacy / fallback pattern "X Outfit: Top & Bottom" or "X Look: Dress"
  const outfitMatch = localized.match(/^(.+?)\s+Outfit:\s*(.+)$/i);
  if (outfitMatch) {
    const vibe = outfitMatch[1].trim();
    const items = outfitMatch[2].trim();
    return `${translator('stylist.lookOf', { defaultValue: 'מראה' })} ${vibe}: ${items}`;
  }
  const lookMatch = localized.match(/^(.+?)\s+Look:\s*(.+)$/i);
  if (lookMatch) {
    const vibe = lookMatch[1].trim();
    const items = lookMatch[2].trim();
    return `${translator('stylist.lookOf', { defaultValue: 'מראה' })} ${vibe}: ${items}`;
  }
  const tagOutfitMatch = localized.match(/^(\w+)\s+(.+)\s+Outfit$/i);
  if (tagOutfitMatch) {
    const tag = tagOutfitMatch[2].trim();
    return `${translator('stylist.lookOf', { defaultValue: 'מראה' })} ${tag}`;
  }

  return localized;
}

/**
 * Format and localize existing outfit descriptions.
 */
export function formatOutfitDescription(desc, translator, labelForDressCode) {
  if (!desc) return '';
  if (typeof desc !== 'string') return desc;

  // Pattern: "A carefully styled combination featuring <items>. Perfect for a coordinated and comfortable look."
  const carefullyStyledMatch = desc.match(/^A carefully styled combination featuring\s+(.+?)\.?\s*(?:Perfect for a coordinated and comfortable look\.?)?$/i);
  if (carefullyStyledMatch) {
    const rawItems = carefullyStyledMatch[1].trim();
    return translator('stylist.outfitDescriptionPattern', {
      defaultValue: 'A carefully styled combination featuring {{items}}. Perfect for a coordinated and comfortable look.',
      items: rawItems
    });
  }

  if (desc.startsWith("Curated strictly from your closet items tagged '")) {
    const tag = desc.replace("Curated strictly from your closet items tagged '", "").replace("'.", "");
    return translator('stylist.curatedFromTags', {
      defaultValue: "נבחר בקפידה מתוך הפריטים שלך בארון עם התגית '{{tag}}'.",
      tag
    });
  }
  if (desc.startsWith("Recommended based on ") && desc.endsWith(" style preference")) {
    const style = desc.replace("Recommended based on ", "").replace(" style preference", "");
    return translator('stylist.recommendedForStyle', {
      defaultValue: "המלצה המבוססת על העדפת הסגנון {{style}}",
      style
    });
  }
  const regex = /^A balanced daily outfit matching your preferred (.+) style and local weather\.$/i;
  const match = desc.match(regex);
  if (match) {
    const style = match[1].toLowerCase();
    const styleLabel = labelForDressCode ? labelForDressCode(style, translator) : style;
    return translator('stylist.fallbackDescriptionPattern', {
      defaultValue: 'A balanced daily outfit matching your preferred {{style}} style and local weather.',
      style: styleLabel
    });
  }
  return desc;
}
