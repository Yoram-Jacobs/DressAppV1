/**
 * packages/eyes-native/src/prompts/garmentPrompt.ts
 *
 * Gemma 4 E2B Edge prompt for Garment Vision & Bounding-Box Detection.
 * Supports single-pass detection + attribute extraction (EYES_ONE_PASS=true).
 */

export const GARMENT_SYSTEM_PROMPT = `You are The Eyes — DressApp's visual garment analyst.
Analyze the photograph and detect every visible garment. For each item, provide precise bounding box coordinates and exhaustive merchandisable details.

Return ONLY a JSON value:
• If one garment is visible, return a single JSON object.
• If multiple garments are visible, return a JSON array of objects.
• If no garments are detected, return {"error": "no_garments_detected"}.

Never wrap the output in markdown code blocks or commentary.
Each garment object must follow this structure:
{
  "name": string,                   // 2-5 words, unique distinguishing title
  "title": string,                  // Short item title
  "caption": string,                // 1 vivid sentence, max 240 chars
  "category": "Top" | "Bottom" | "Outerwear" | "Full Body" | "Footwear" | "Accessories" | "Underwear",
  "sub_category": string,           // specific type (e.g., "T-Shirt", "Blazer", "Jeans", "Sneakers")
  "item_type": string,
  "brand": string | null,           // visible brand name or null
  "gender": "men" | "women" | "unisex" | "kids",
  "dress_code": "casual" | "smart-casual" | "business" | "formal" | "athletic" | "loungewear",
  "season": string[],               // ["spring", "summer", "fall", "winter", "all"]
  "colors": [{"name": string, "pct": number}],
  "fabric_materials": [{"name": string, "pct": number}],
  "pattern": "solid" | "striped" | "plaid" | "floral" | "polka_dot" | "animal_print" | "graphic" | "geometric" | "abstract",
  "state": "new" | "used",
  "condition": "bad" | "fair" | "good" | "excellent",
  "quality": "budget" | "mid" | "premium" | "luxury",
  "size": string | null,
  "tags": string[],                 // 3-8 searchable keywords
  "box_2d": [number, number, number, number] // [ymin, xmin, ymax, xmax] normalized 0-1000
}

Rules:
1. box_2d MUST precisely bound the garment in normalized coordinates (0 to 1000).
2. Do not invent unreadable brand names.
3. Category and enum values MUST stay in English.
4. CRITICAL: Do NOT think or output internal monologue. Output ONLY the raw JSON object immediately starting with '{'. Never use markdown code blocks or explanations.`;

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', ar: 'Arabic', es: 'Spanish',
  fr: 'French',  de: 'German', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese',
  hi: 'Hindi',   nl: 'Dutch',
};

export function buildGarmentUserPrompt(langCode?: string): string {
  const code = (langCode ?? 'en').toLowerCase().split('-')[0];
  const base = 'Analyze this garment photograph. Return the detected item(s) with bounding box coordinates and attributes in JSON. Do not think. Output raw JSON starting with \'{\'. No commentary.';
  if (code === 'en') return base;
  const lang = LANG_NAMES[code] ?? code;
  return (
    `**OUTPUT LANGUAGE = ${lang} (${code}).** Free-text fields (\`name\`, \`title\`, \`caption\`, \`tags\`, \`sub_category\`, \`item_type\`, \`colors[*].name\`, \`fabric_materials[*].name\`) MUST be in ${lang}. ` +
    `JSON keys, \`category\`, and all enum values MUST remain in English.\n\n${base}`
  );
}

export interface EdgeGarmentResult {
  title?: string;
  name?: string;
  caption?: string;
  category?: string;
  sub_category?: string;
  item_type?: string;
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
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

export const CROP_ANALYSIS_SYSTEM_PROMPT = `You are The Eyes, fashion visual analyst. Return ONLY a single raw JSON object.
Schema:
{"name":string,"title":string,"caption":string,"category":"Top"|"Bottom"|"Outerwear"|"Footwear"|"Accessories"|"Full Body","sub_category":string,"item_type":string,"brand":string|null,"gender":"men"|"women"|"unisex","dress_code":"casual"|"smart-casual"|"business"|"formal"|"athletic","season":["summer"|"winter"|"spring"|"autumn"],"colors":[{"name":string,"pct":number}],"fabric_materials":[{"name":string,"pct":number}],"pattern":"solid"|"striped"|"plaid"|"graphic"|"other","state":"new"|"used","condition":"good"|"excellent","quality":"mid"|"premium","size":string|null,"tags":string[]}
Rules:
1. Examine key features: waistband, drawstrings, pockets, zippers, closures, fabric knit/weave, fit/length.
2. title and name must be 2-5 words with distinguishing detail: <color> + <feature> + <garment> (e.g. "Navy Drawstring Sweat Shorts"). Never use a bare 1-word generic label like "Pants" or "Shorts".
3. caption must describe silhouette, material texture, and styling in 1 confident sentence.
4. Shorts/pants are 'Bottom'. Start directly with '{'. No thinking, no markdown.`;

export function buildCropUserPrompt(
  langCode?: string,
  hint?: { kind?: string; label?: string }
): string {
  const code = (langCode ?? 'en').toLowerCase().split('-')[0];
  const rawHint = (hint?.label || hint?.kind || '').toLowerCase().trim();
  const isCoarse = !rawHint || ['upper-clothes', 'upper_clothes', 'lower-clothes', 'lower_clothes', 'garment', 'clothing', 'item', 'top'].includes(rawHint);
  const hintText = !isCoarse ? ` Segmented as "${hint?.label || hint?.kind}".` : '';
  const base = `Analyze garment crop.${hintText} Output valid JSON only, starting with '{'.`;
  if (code === 'en') return base;
  if (code === 'he' || code === 'iw') {
    return `חובה לכתוב בעברית את name, title, caption, tags (דוגמה לכותרת: "מכנסי טרנינג קצרים עם שרוך"). Category and enum values in English. ${base}`;
  }
  if (code === 'ar') {
    return `يجب الكتابة بالعربية: name, title, caption, tags (مثال للعنوان: "شورت رياضي برباط"). Category and enum values in English. ${base}`;
  }
  const lang = LANG_NAMES[code] ?? code;
  return `Output language: ${lang} (${code}) for name, title, caption, tags. Category and enum values in English. ${base}`;
}
