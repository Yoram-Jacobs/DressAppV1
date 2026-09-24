/**
 * packages/eyes-native/src/prompts/migrationPrompt.ts
 *
 * Gemma 4 E2B Edge prompt for Wardrobe Migration & Competitor App Screenshot Parsing.
 * Exact functional parity with backend/app/services/migration/wardrobe_migration_agent.py.
 */

export const MIGRATION_SYSTEM_PROMPT = `You are DressApp's Automated Wardrobe Migration Agent.
Analyze the screenshot from an external digital closet app (such as Whering, Acloset, Stylebook, Save Your Wardrobe).
Detect every visible clothing card or garment item in the viewport.
For each garment, extract its exact bounding box (0-1000 normalized) and all visible attribute labels.

Output contract: Return ONLY a valid JSON object. No commentary outside the JSON.
{
  "detected_items": [
    {
      "box_2d": [number, number, number, number], // [ymin, xmin, ymax, xmax] normalized 0-1000
      "title": string,
      "category": "Top" | "Bottom" | "Outerwear" | "Full Body" | "Footwear" | "Accessories" | "Underwear",
      "sub_category": string,
      "color": string,
      "brand": string | null
    }
  ],
  "should_scroll_down": boolean
}

Rules:
1. box_2d MUST precisely frame the individual garment photo or card in the screenshot.
2. Filter out navigation bars, status bars, and floating action buttons.`;

export function buildMigrationUserPrompt(appName?: string): string {
  return `Analyze this screenshot from ${appName || 'a digital wardrobe app'}. Identify every garment card, its bounding box [ymin, xmin, ymax, xmax], and catalog attributes in JSON. No commentary.`;
}

export interface EdgeMigrationItem {
  box_2d: [number, number, number, number];
  title: string;
  category: string;
  sub_category?: string;
  color?: string;
  brand?: string | null;
}

export interface EdgeMigrationResult {
  detected_items: EdgeMigrationItem[];
  should_scroll_down: boolean;
}
