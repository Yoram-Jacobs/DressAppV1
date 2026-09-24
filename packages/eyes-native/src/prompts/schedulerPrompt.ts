/**
 * packages/eyes-native/src/prompts/schedulerPrompt.ts
 *
 * Gemma 4 E2B Edge prompt for Daily Scheduled Outfit Proposals & Rotation.
 * Exact functional parity with backend/app/services/stylist_scheduler_brain.py.
 */

export const SCHEDULER_SYSTEM_PROMPT = `You are DressApp's Automated Daily Outfit Scheduler.
Your job is to craft the single best outfit recommendation for the user's upcoming day.
You prioritize rotation freshness (celebrating less frequently worn garments), harmonize with the local weather, and match the day's calendar demands.

Output contract: Return ONLY a valid JSON object. No commentary outside the JSON.
{
  "outfit_name": string,
  "occasion": string,
  "harmony_score": number, // 80-100
  "reasoning": string,      // 2-3 sentences explaining the weather matching and rotation choice
  "items": [
    {
      "role": "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress",
      "closet_item_id": string,
      "description": string
    }
  ]
}

Hard rules:
1. Every item MUST refer to a valid 'id' from the user's provided closet items list.
2. Must include both upper body ('top' or 'dress'), lower body ('bottom', unless dress), and footwear ('shoes').
3. Strictly respect weather conditions (do not suggest shorts in cold rain or heavy wool in heat).`;

export interface SchedulerParams {
  dayLabel: 'today' | 'tomorrow';
  dateStr: string;
  weatherSummary: string;
  calendarEvents: Array<any>;
  styleDressFor?: string;
  closetItems: Array<{
    id: string;
    title: string;
    category: string;
    sub_category?: string;
    color?: string;
    season?: string[];
    wear_count?: number;
    last_worn?: string | null;
  }>;
  language?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', ar: 'Arabic', es: 'Spanish',
  fr: 'French',  de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese',
  hi: 'Hindi',   nl: 'Dutch',
};

export function buildSchedulerUserPrompt(params: SchedulerParams): string {
  const langCode = (params.language || 'en').toLowerCase().split('-')[0];
  const langName = LANG_NAMES[langCode] || 'English';

  const parts: string[] = [
    `Target Day: ${params.dayLabel.toUpperCase()} (${params.dateStr})`,
    `Weather Forecast: ${params.weatherSummary}`,
    `Daily Demands & Events: ${params.calendarEvents && params.calendarEvents.length > 0 ? JSON.stringify(params.calendarEvents) : 'Regular day / Casual routine'}`,
    `Target Style / Dress-for: ${params.styleDressFor || 'Smart Casual / Versatile'}`,
    `User Closet Items:\n${JSON.stringify(params.closetItems.slice(0, 60))}`,
  ];

  if (langCode !== 'en') {
    parts.push(`**OUTPUT LANGUAGE DIRECTIVE**: Write 'outfit_name', 'occasion', and 'reasoning' in fluent, natural ${langName}. Schema keys and 'role' enums MUST remain in English.`);
  }

  parts.push('Recommend the optimal scheduled look in JSON. No commentary.');
  return parts.join('\n\n');
}

export interface EdgeScheduledProposal {
  outfit_name: string;
  occasion: string;
  harmony_score: number;
  reasoning: string;
  items: Array<{
    role: string;
    closet_item_id: string;
    description: string;
  }>;
}
