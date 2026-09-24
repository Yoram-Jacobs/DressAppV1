/**
 * packages/eyes-native/src/prompts/stylistPrompt.ts
 *
 * Gemma 4 E2B Edge prompt for AI Stylist & Outfit Synthesis.
 * Exact functional parity with backend/app/services/gemini_stylist.py.
 */

export const STYLIST_SYSTEM_PROMPT = `You are a senior fashion designer, celebrity stylist, and wardrobe consultant with 30 years of multicultural fashion expertise.
You speak with warmth and sophistication, never condescending, always grounding advice in the user's actual closet items, local weather, schedule, and cultural constraints.

Output contract: Return ONLY a valid JSON object matching this schema. No markdown, no commentary outside the JSON.

{
  "reasoning_summary": string,
  "outfit_recommendations": [
    {
      "name": string,
      "items": [
        {
          "role": "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress" | "belt" | "headwear" | "glasses",
          "description": string,
          "closet_item_id": string | null
        }
      ],
      "why": string,
      "confidence": number
    }
  ],
  "shopping_suggestions": string[],
  "do_dont": string[],
  "spoken_reply": string
}

Hard rules:
1. FULL OUTFIT REQUIREMENT: Every outfit recommendation MUST be complete: 1) either ('top' AND 'bottom') OR 'dress', and 2) 'shoes'.
2. ROLE & ANATOMICAL ORDER: In the 'items' array, list pieces strictly in top-to-bottom order: 'top' (or 'dress') first, 'outerwear' second, 'bottom' third, 'shoes' fourth, 'accessory'/'belt' fifth.
3. PREFER CLOSET ITEMS: Always ground recommendations in the user's provided closet items and populate 'closet_item_id'. Only suggest shopping if a crucial piece is missing.
4. WEATHER & OCCASION HARMONY: Never recommend items contradicting the weather or occasion.
5. CULTURAL CONSTRAINTS: Any provided modesty or cultural requirements are absolute and non-negotiable.`;

export interface StylistRequestParams {
  userText: string;
  closetSummary: Array<{
    id: string;
    title: string;
    category: string;
    sub_category?: string;
    color?: string;
    brand?: string;
    material?: string;
    tags?: string[];
  }>;
  weatherSummary?: string;
  calendarEvents?: Array<any>;
  userProfile?: {
    gender?: string;
    stylePreferences?: string[];
    bodyType?: string;
    culturalConstraints?: string[];
    conversationHistory?: Array<{ role: string; content: string }>;
  };
  language?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', ar: 'Arabic', es: 'Spanish',
  fr: 'French',  de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese',
  hi: 'Hindi',   nl: 'Dutch',
};

export function buildStylistUserPrompt(params: StylistRequestParams): string {
  const langCode = (params.language || 'en').toLowerCase().split('-')[0];
  const langName = LANG_NAMES[langCode] || 'English';

  const parts: string[] = [
    `User Query: "${params.userText}"`,
    `Weather Context: ${params.weatherSummary || 'Moderate / Indoors'}`,
    `Calendar Events Today: ${params.calendarEvents && params.calendarEvents.length > 0 ? JSON.stringify(params.calendarEvents) : 'Normal routine'}`,
  ];

  if (params.userProfile) {
    parts.push(`User Profile: Gender=${params.userProfile.gender || 'Not specified'}, Style=${(params.userProfile.stylePreferences || []).join(', ') || 'Smart Casual'}, Constraints=${(params.userProfile.culturalConstraints || []).join(', ') || 'None'}`);
    if (params.userProfile.conversationHistory && params.userProfile.conversationHistory.length > 0) {
      const recent = params.userProfile.conversationHistory.slice(-4);
      parts.push(`Recent Dialogue:\n${recent.map((m) => `${m.role}: ${m.content}`).join('\n')}`);
    }
  }

  parts.push(`Available Closet Items (${params.closetSummary.length} pieces):\n${JSON.stringify(params.closetSummary.slice(0, 50))}`);

  if (langCode !== 'en') {
    parts.push(`**OUTPUT LANGUAGE DIRECTIVE**: Write all conversational explanations, outfit names, 'why', and 'spoken_reply' in fluent, natural ${langName}. Schema keys and 'role' enums MUST remain in English.`);
  }

  parts.push('Create the perfect outfit recommendations in JSON. No commentary.');
  return parts.join('\n\n');
}

export interface EdgeStylistResponse {
  reasoning_summary: string;
  outfit_recommendations: Array<{
    name: string;
    items: Array<{
      role: string;
      description: string;
      closet_item_id: string | null;
    }>;
    why: string;
    confidence: number;
  }>;
  shopping_suggestions: string[];
  do_dont: string[];
  spoken_reply: string;
}
