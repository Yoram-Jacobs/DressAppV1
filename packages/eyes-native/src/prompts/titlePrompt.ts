/**
 * packages/eyes-native/src/prompts/titlePrompt.ts
 *
 * Gemma 4 E2B Edge prompt for Stylist Session Title Generation.
 * Exact functional parity with backend/app/services/session_titles.py.
 */

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', ar: 'Arabic', es: 'Spanish',
  fr: 'French',  de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese',
  hi: 'Hindi',   nl: 'Dutch',
};

export function buildTitlePrompt(firstUserMessage: string, langCode?: string): string {
  const code = (langCode || 'en').toLowerCase().split('-')[0];
  const langName = LANG_NAMES[code] || 'English';

  return `You are a fashion stylist thread title generator.
Based on this opening user message: "${firstUserMessage.trim()}"
Generate a concise, catchy, descriptive 2 to 4 word title in ${langName}.
Return ONLY the plain title text without quotes, punctuation, markdown, emoji, or prefixes. Maximum 35 characters.`;
}
