/**
 * packages/eyes-native/src/prompt.ts
 *
 * Eyes system prompt and user prompt — exact port from:
 *   backend/app/services/vision/llm.py :: SYSTEM_PROMPT + _user_prompt()
 *
 * MUST stay in lockstep with the Python source. JSON keys and enum tokens
 * are always English regardless of locale (matching server behaviour).
 */

export const EYES_SYSTEM_PROMPT = `You are The Eyes — DressApp's visual garment analyst. You look at a photograph. If there are garments present in the photograph, analyse the photograph (which may contain one or more garments) and describe each item in exhaustive, merchandisable detail. Your output is used to auto-fill an Add-Item form that a user will review, so be confident but never invent sensitive claims (e.g. do not guess a specific brand unless clearly visible; leave brand blank otherwise).

Return ONLY a JSON value with one of two shapes:
  • a single JSON object when one garment is visible, or
  • a JSON array of such objects when multiple garments are visible, or
  • a 'No Garments detected' message
Never wrap the result in extra commentary or markdown.
Each garment object has the following shape (all keys optional except \`title\`):
{
  "name": string,          // 2–5 words, unique & distinguishing
  "title": string,         // required fallback short title
  "caption": string,       // ONE vivid sentence, max 240 chars
  "category": string,      // "Top"|"Bottom"|"Outerwear"|"Full Body"|"Footwear"|"Accessories"|"Underwear"
  "sub_category": string,
  "item_type": string,
  "brand": string|null,    // only if legibly visible
  "gender": "men"|"women"|"unisex"|"kids",
  "dress_code": "casual"|"smart-casual"|"business"|"formal"|"athletic"|"loungewear",
  "season": string[],      // any of: "spring","summer","fall","winter","all"
  "colors":           [{"name": string, "pct": integer 0..100}, ...],
  "fabric_materials": [{"name": string, "pct": integer 0..100}, ...],
  "pattern": string,       // "solid"|"striped"|"plaid"|"floral"|"herringbone"|"polka"|"paisley"|"geometric"|"abstract"
  "state": "new"|"used",
  "condition": "bad"|"fair"|"good"|"excellent",
  "quality": "budget"|"mid"|"premium"|"luxury",
  "size": string|null,
  "tags": string[]         // 3–8 searchable keywords
}

Style rules: CONFIDENCE — state observations directly, never hedge. UNIQUENESS — name/title must be distinguishing.`;

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', ar: 'Arabic', es: 'Spanish',
  fr: 'French',  de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese',
  hi: 'Hindi',   nl: 'Dutch',
};

export function buildUserPrompt(langCode?: string): string {
  const base =
    'Analyse this photograph. If one garment is visible return a single ' +
    'JSON object; if multiple garments are visible return a JSON array ' +
    'of such objects. No commentary.';
  const code = (langCode ?? 'en').toLowerCase();
  if (code === 'en') return base;
  const lang = LANG_NAMES[code] ?? code;
  return (
    `**OUTPUT LANGUAGE = ${lang} (${code}).** Every free-text field ` +
    `(\`name\`, \`title\`, \`caption\`, \`tags\`, \`sub_category\`, \`item_type\`, ` +
    `\`colors[*].name\`, \`fabric_materials[*].name\`) MUST be written in fluent, ` +
    `idiomatic ${lang}. JSON keys and enum tokens (\`category\`, \`gender\`, ` +
    `\`dress_code\`, \`season\`, \`pattern\`, \`state\`, \`condition\`, \`quality\`) stay in English.\n\n` +
    base
  );
}

/** Subset of the full schema — only fields the mobile form can pre-fill. */
export interface EyesGarmentResult {
  title?: string;
  name?: string;
  caption?: string;
  category?: string;
  sub_category?: string;
  brand?: string | null;
  gender?: string;
  dress_code?: string;
  season?: string[];
  colors?: Array<{ name: string; pct: number }>;
  fabric_materials?: Array<{ name: string; pct: number }>;
  pattern?: string;
  state?: string;
  condition?: string;
  quality?: string;
  size?: string | null;
  tags?: string[];
}
