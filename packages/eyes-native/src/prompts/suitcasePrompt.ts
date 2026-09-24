/**
 * packages/eyes-native/src/prompts/suitcasePrompt.ts
 *
 * Gemma 4 E2B Edge prompt for Travel Suitcase Packing & Trip Outfits.
 * Exact functional parity with backend/app/api/v1/suitcase.py.
 */

export const SUITCASE_SYSTEM_PROMPT = `You are DressApp's Travel Packing & Suitcase Stylist.
Analyze the user's travel itinerary, destination weather, calendar schedule, and closet items.
Create a smart, versatile packing list and daily trip outfits that minimize baggage bulk while maximizing style and cultural appropriateness.

Output contract: Return ONLY a valid JSON object. No commentary outside the JSON.
{
  "outfits": [
    {
      "date": string,
      "time_of_day": "morning" | "afternoon" | "evening" | "all_day",
      "outfit_name": string,
      "reasoning": string,
      "items": [
        {
          "role": "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress",
          "description": string,
          "closet_item_id": string | null
        }
      ]
    }
  ],
  "missing_items": [
    {
      "role": string,
      "description": string,
      "reason_needed": string
    }
  ],
  "cultural_guidelines": string[],
  "danger_zones_info": string
}

Rules:
1. Prioritize garments from the user's closet and populate 'closet_item_id'.
2. If an essential item is missing for the climate/occasion, specify it in 'missing_items'.
3. Every outfit must be complete (upper + lower/dress + shoes).`;

export interface SuitcaseParams {
  destinations: string;
  purpose: string;
  preferredStyle?: string;
  departureTime: string;
  returnTime: string;
  weatherSummary: string;
  calendarEvents: Array<any>;
  closetItems: Array<{
    id: string;
    title: string;
    category: string;
    sub_category?: string;
    color?: string;
    brand?: string;
    material?: string;
  }>;
  language?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', ar: 'Arabic', es: 'Spanish',
  fr: 'French',  de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese',
  hi: 'Hindi',   nl: 'Dutch',
};

export function buildSuitcaseUserPrompt(params: SuitcaseParams): string {
  const langCode = (params.language || 'en').toLowerCase().split('-')[0];
  const langName = LANG_NAMES[langCode] || 'English';

  const parts: string[] = [
    `Destinations: ${params.destinations}`,
    `Purpose: ${params.purpose}`,
    `Preferred Style: ${params.preferredStyle || 'Casual Chic'}`,
    `Departure: ${params.departureTime}`,
    `Return: ${params.returnTime}`,
    `Destination Weather: ${params.weatherSummary}`,
    `Trip Events: ${JSON.stringify(params.calendarEvents || [])}`,
    `User Closet Items:\n${JSON.stringify(params.closetItems.slice(0, 60))}`,
  ];

  if (langCode !== 'en') {
    parts.push(`**OUTPUT LANGUAGE DIRECTIVE**: Write all outfit names, reasoning, missing item explanations, and cultural guidelines in fluent ${langName}. Schema keys and enum values MUST stay in English.`);
  }

  parts.push('Generate the complete suitcase packing plan in JSON. No commentary.');
  return parts.join('\n\n');
}

export interface EdgeSuitcasePlan {
  outfits: Array<{
    date: string;
    time_of_day: string;
    outfit_name: string;
    reasoning: string;
    items: Array<{
      role: string;
      description: string;
      closet_item_id: string | null;
    }>;
  }>;
  missing_items: Array<{
    role: string;
    description: string;
    reason_needed: string;
  }>;
  cultural_guidelines: string[];
  danger_zones_info: string;
}
