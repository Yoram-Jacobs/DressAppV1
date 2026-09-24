/**
 * apps/mobile/src/services/edge/EdgeAiService.ts
 *
 * Edge AI Orchestrator for DressApp Mobile.
 * Coordinates on-device Gemma 4 E2B inference across all app domains:
 *   - The Eyes (Garment Scanner)
 *   - AI Stylist Brain (Multi-Turn Chat & Looks)
 *   - Daily Outfit Proposals (Scheduler)
 *   - Travel Suitcase Packing
 *   - Wardrobe Migration (Competitor App Imports)
 *   - Conversation Title Generation
 *
 * Implements a transparent fallback to the cloud API (api.*) whenever
 * the device is unsupported (<8 GB RAM), the model is not downloaded,
 * or on-device inference throws/times out.
 */

import { AppState, Platform, Image as RNImage, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '@mobile/lib/api';
import i18n from '@mobile/lib/i18n';
import {
  labelForCategory,
  labelForSubCategory,
  labelForColor,
  labelForDressCode,
  labelForPattern,
  labelForSeason,
  canonicalSubCategoryKey,
} from '@mobile/lib/taxonomy';

const { GarmentVision } = NativeModules;
const STORAGE_EDGE_ENABLED = 'dressapp.edge_ai.enabled';


// Lazy-require @dressapp/eyes-native so web/simulators or environments
// without compiled llama.rn fall back cleanly without bundling errors.
let sharedEyes: any = null;
let isDeviceSupported: () => boolean = () => false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const eyesNative = require('@dressapp/eyes-native');
  sharedEyes = eyesNative.sharedEyes;
  isDeviceSupported = eyesNative.isDeviceSupported;
} catch (e) {
  console.warn('[EdgeAiService] @dressapp/eyes-native not available:', e);
}

export class EdgeAiService {
  private static instance: EdgeAiService;
  private edgeEnabled: boolean = true;
  private isInitialized: boolean = false;

  private constructor() {
    this.init();
  }

  public static getInstance(): EdgeAiService {
    if (!EdgeAiService.instance) {
      EdgeAiService.instance = new EdgeAiService();
    }
    return EdgeAiService.instance;
  }

  private async init() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_EDGE_ENABLED);
      if (stored !== null) {
        this.edgeEnabled = stored === 'true';
      } else {
        // Default to enabled if hardware is qualified
        this.edgeEnabled = this.isSupported();
      }
    } catch {
      this.edgeEnabled = true;
    }

    // Bind AppState listener to release memory instantly when app is backgrounded
    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (sharedEyes?.isLoaded) {
          sharedEyes.unload().catch((err: any) => console.warn('[EdgeAiService] Unload error:', err));
        }
      }
    });

    this.isInitialized = true;
  }

  public isSupported(): boolean {
    return Boolean(isDeviceSupported && isDeviceSupported());
  }

  public async isModelReady(): Promise<boolean> {
    if (!sharedEyes?.modelDownloader) return false;
    try {
      return await sharedEyes.modelDownloader.isComplete();
    } catch {
      return false;
    }
  }

  public isEdgeEnabled(): boolean {
    return this.edgeEnabled;
  }

  public async getEdgeEnabled(): Promise<boolean> {
    if (!this.isInitialized) await this.init();
    return this.edgeEnabled;
  }

  public async setEdgeEnabled(enabled: boolean): Promise<void> {
    this.edgeEnabled = enabled;
    await AsyncStorage.setItem(STORAGE_EDGE_ENABLED, enabled ? 'true' : 'false');
    if (!enabled && sharedEyes?.isLoaded) {
      await sharedEyes.unload();
    }
  }

  public async shouldUseEdge(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const enabled = await this.getEdgeEnabled();
    if (!enabled) return false;
    return await this.isModelReady();
  }

  public get modelDownloader() {
    return sharedEyes?.modelDownloader ?? null;
  }

  // ── 1. Garment Scanner (The Eyes) ───────────────────────────────────────────

  public async analyzeGarment(
    imageBase64: string,
    language?: string,
    cloudCallbacks?: any
  ): Promise<any> {
    const lang = (language || 'en').split('-')[0].toLowerCase();
    // 1. Client-side compression before transmission (~150KB - 200KB)
    let sendB64 = imageBase64;
    try {
      const uri = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;
      const comp = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (comp.base64) {
        sendB64 = comp.base64;
      }
    } catch (compErr) {
      console.warn('[EdgeAiService] Image pre-compression failed, using original base64:', compErr);
    }

    // 2. Call backend analyze endpoint:
    // Backend runs alpha matting & masking (SegFormer / U2-Net), and forwards
    // clean image + clues to Eyes container (http://eyes:7860) when no key entered,
    // or to user's AI supplier (Gemini, OpenAI, Anthropic) if custom key entered.
    const rawRes: any = await api.analyzeItemImage(
      {
        image_base64: sendB64,
        multi: true,
        language: lang,
        cutout_only: false,
      },
      cloudCallbacks
    );

    // 3. Enrich items with client-side localization (Hebrew / i18next taxonomy)
    if (rawRes && Array.isArray(rawRes.items)) {
      const enrichedItems = rawRes.items.map((item: any, idx: number) => {
        const itemMeta = rawRes.detect?.items_meta?.[item.index ?? idx] || {};
        const cropB64 = item.crop_base64 || itemMeta.crop_base64 || item.image_base64;
        const cropMime = item.crop_mime || itemMeta.crop_mime;
        const analysis = item.analysis || item;
        const enriched = this.localizeAndEnrichAnalysis(analysis, lang);
        return {
          ...item,
          crop_base64: cropB64,
          crop_mime: cropMime,
          analysis: {
            ...enriched,
            crop_base64: cropB64,
            crop_mime: cropMime,
          },
        };
      });
      return {
        ...rawRes,
        items: enrichedItems,
      };
    }

    return rawRes;
  }

  private async optimizeCropForGemma(cropBase64: string): Promise<string> {
    try {
      const uri = cropBase64.startsWith('data:')
        ? cropBase64
        : `data:image/png;base64,${cropBase64}`;
      const comp = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 448 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (comp.base64) {
        return comp.base64;
      }
    } catch (e) {
      console.warn('[EdgeAiService] optimizeCropForGemma failed, using original:', e);
    }
    return cropBase64;
  }

  /**
   * Analyze an isolated garment crop produced by semantic segmentation (SegFormer)
   * using the on-device Gemma 4 E2B engine.
   */
  public async analyzeGarmentCrop(
    cropBase64: string,
    opts?: { kind?: string; label?: string; language?: string }
  ): Promise<any> {
    if (!sharedEyes) return null;
    const isReady = await this.isModelReady();
    if (!isReady) return null;
    try {
      const gemmaInputB64 = await this.optimizeCropForGemma(cropBase64);
      return await sharedEyes.analyzeGarmentCrop(gemmaInputB64, {
        kind: opts?.kind,
        label: opts?.label,
        langCode: opts?.language,
      });
    } catch (err) {
      console.warn('EdgeAiService.analyzeGarmentCrop error:', err);
      return null;
    }
  }

  // ── 2. AI Stylist Brain ─────────────────────────────────────────────────────

  public async adviseStylist(
    params: {
      userText: string;
      closetSummary: any[];
      weatherSummary?: string;
      calendarEvents?: any[];
      userProfile?: any;
      language?: string;
      attachedImageB64?: string;
      formDataFallback?: FormData;
    }
  ): Promise<any> {
    if (await this.shouldUseEdge()) {
      try {
        const edgeAdvice = await sharedEyes.adviseStylist(
          {
            userText: params.userText,
            closetSummary: params.closetSummary,
            weatherSummary: params.weatherSummary,
            calendarEvents: params.calendarEvents,
            userProfile: params.userProfile,
            language: params.language,
          },
          params.attachedImageB64
        );

        if (edgeAdvice) {
          return {
            advice: edgeAdvice,
            source: 'edge_gemma4',
            session: {
              id: `edge_session_${Date.now()}`,
              title: edgeAdvice.outfit_recommendations?.[0]?.name || 'Stylist Look',
            },
          };
        }
      } catch (err) {
        console.warn('[EdgeAiService] adviseStylist failed on-device, falling back to cloud:', err);
      }
    }

    // Cloud Fallback
    if (params.formDataFallback) {
      return await api.stylist(params.formDataFallback);
    }
    const fd = new FormData();
    fd.append('text', params.userText);
    fd.append('language', (params.language || 'en').toLowerCase().split('-')[0]);
    fd.append('skip_tts', 'true');
    return await api.stylist(fd);
  }

  // ── 3. Daily Scheduled Outfits ──────────────────────────────────────────────

  public async generateDailyProposal(params: {
    dayLabel: 'today' | 'tomorrow';
    dateStr: string;
    weatherSummary: string;
    calendarEvents: any[];
    closetItems: any[];
    styleDressFor?: string;
    language?: string;
  }): Promise<any> {
    if (await this.shouldUseEdge()) {
      try {
        const proposal = await sharedEyes.generateDailyProposal(params);
        if (proposal) {
          return {
            proposal,
            source: 'edge_gemma4',
          };
        }
      } catch (err) {
        console.warn('[EdgeAiService] generateDailyProposal failed on-device, falling back to cloud:', err);
      }
    }

    // Cloud Fallback
    try {
      return await (api as any).dailyProposals?.(params.dayLabel);
    } catch {
      return null;
    }
  }

  // ── 4. Travel Suitcase Packing ──────────────────────────────────────────────

  public async planSuitcase(params: {
    destinations: string;
    purpose: string;
    preferredStyle?: string;
    departureTime: string;
    returnTime: string;
    weatherSummary: string;
    calendarEvents: any[];
    closetItems: any[];
    language?: string;
    rawPayloadFallback?: any;
  }): Promise<any> {
    if (await this.shouldUseEdge()) {
      try {
        const plan = await sharedEyes.planSuitcase(params);
        if (plan) {
          return {
            ...plan,
            source: 'edge_gemma4',
          };
        }
      } catch (err) {
        console.warn('[EdgeAiService] planSuitcase failed on-device, falling back to cloud:', err);
      }
    }

    // Cloud Fallback
    return await (api as any).packSuitcase?.(params.rawPayloadFallback || {
      destinations: params.destinations,
      purpose: params.purpose,
      preferred_style: params.preferredStyle,
      departure_time: params.departureTime,
      return_time: params.returnTime,
      language: params.language,
    });
  }

  // ── 5. Wardrobe Migration & Screenshot Parsing ──────────────────────────────

  public async migrateWardrobeScreenshot(
    screenshotB64: string,
    appName?: string
  ): Promise<any> {
    if (await this.shouldUseEdge()) {
      try {
        const result = await sharedEyes.migrateWardrobeScreenshot(screenshotB64, appName);
        if (result) {
          return {
            ...result,
            source: 'edge_gemma4',
          };
        }
      } catch (err) {
        console.warn('[EdgeAiService] migrateWardrobeScreenshot failed on-device, falling back to cloud:', err);
      }
    }

    // Cloud Fallback
    return await (api as any).migrationProcessStep?.({
      screenshot_base64: screenshotB64,
      app_name: appName,
    });
  }

  // ── 6. Conversation Title Generator ─────────────────────────────────────────

  public async generateSessionTitle(
    firstUserMessage: string,
    language?: string
  ): Promise<string> {
    if (await this.shouldUseEdge()) {
      try {
        const title = await sharedEyes.generateSessionTitle(firstUserMessage, language);
        if (title) return title;
      } catch (err) {
        console.warn('[EdgeAiService] generateSessionTitle failed on-device:', err);
      }
    }
    // Simple heuristic fallback
    const words = firstUserMessage.trim().split(/\s+/).slice(0, 4).join(' ');
    return words || 'Stylist Chat';
  }

  /**
   * Deterministically localizes and enriches garment analysis into the user's active language.
   * Translates taxonomy attributes (sub_category, colors, tags, dress_code, pattern) and
   * synthesizes an idiomatic localized title and caption if Gemma 4 returned English or generic labels.
   */
  public localizeAndEnrichAnalysis(analysis: any, langCode?: string): any {
    if (!analysis) return analysis;
    const targetLang = (langCode || i18n.language || 'en').split('-')[0].toLowerCase();
    const isEn = targetLang === 'en';

    // 1. Localize Colors
    const rawColors = Array.isArray(analysis.colors) ? analysis.colors : [];
    const localizedColors = rawColors.map((c: any) => {
      const origName = c?.name || '';
      const localizedName = isEn ? origName : labelForColor(origName, i18n.t);
      return {
        ...c,
        name: localizedName || origName,
      };
    });

    const primaryColorName = localizedColors[0]?.name || '';

    // 2. Canonical Subcategory & Localized Subcategory
    const subCatRaw = analysis.sub_category || analysis.item_type || analysis.label || '';
    const canonicalKey = canonicalSubCategoryKey(subCatRaw) || String(subCatRaw).toLowerCase().replace(/\s+/g, '_');
    const localizedSubCat = isEn ? (subCatRaw || analysis.category || '') : labelForSubCategory(canonicalKey, i18n.t);

    // 3. Check if Title / Name needs localization
    const rawTitle = (analysis.title || analysis.name || '').trim();
    const hasTargetScript =
      (targetLang === 'he' || targetLang === 'iw')
        ? /[\u0590-\u05FF]/.test(rawTitle)
        : (targetLang === 'ar')
        ? /[\u0600-\u06FF]/.test(rawTitle)
        : !isEn;

    let finalTitle = rawTitle;
    let finalName = analysis.name || rawTitle;

    // Check if title is overly generic (e.g. "shorts", "pants", "shirt", "garment")
    const isBareGeneric = !rawTitle || /^(shorts|pants|trousers|shirt|t-shirt|jacket|coat|dress|garment|clothing|item|bottom|top)$/i.test(rawTitle);

    if (!isEn && (!hasTargetScript || isBareGeneric)) {
      // Synthesize rich localized title: e.g. "מכנסיים קצרים כחול נייבי"
      const parts: string[] = [];
      if (localizedSubCat) parts.push(localizedSubCat);
      if (primaryColorName && !localizedSubCat.includes(primaryColorName)) {
        parts.push(primaryColorName);
      }
      if (parts.length > 0) {
        finalTitle = parts.join(' ');
        finalName = parts.join(' ');
      }
    } else if (isEn && isBareGeneric) {
      const parts: string[] = [];
      const primaryColorEn = rawColors[0]?.name || '';
      if (primaryColorEn) parts.push(primaryColorEn);
      if (subCatRaw) parts.push(subCatRaw);
      if (parts.length > 0) {
        finalTitle = parts.join(' ');
        finalName = parts.join(' ');
      }
    }

    // 4. Localize Tags
    const incomingTags: string[] = Array.isArray(analysis.tags) ? analysis.tags : [];
    const localizedTagsSet = new Set<string>();

    if (localizedSubCat) localizedTagsSet.add(localizedSubCat);
    if (primaryColorName) localizedTagsSet.add(primaryColorName);

    // Filter out spurious tags (e.g. "swimwear" on cotton fleece sweat shorts)
    const isCottonFleece = /cotton|fleece|sweat|terry/i.test(
      `${analysis.fabric_materials?.map((m: any) => m.name).join(' ')} ${rawTitle}`
    );

    for (const t of incomingTags) {
      const tagLower = String(t).trim().toLowerCase();
      if (!tagLower) continue;
      if (isCottonFleece && (tagLower === 'swimwear' || tagLower === 'swim' || tagLower === 'בגדי ים')) {
        continue;
      }

      if (isEn) {
        localizedTagsSet.add(t);
      } else {
        const translatedTag =
          labelForSubCategory(tagLower, i18n.t) !== tagLower
            ? labelForSubCategory(tagLower, i18n.t)
            : labelForColor(tagLower, i18n.t) !== tagLower
            ? labelForColor(tagLower, i18n.t)
            : labelForDressCode(tagLower, i18n.t) !== tagLower
            ? labelForDressCode(tagLower, i18n.t)
            : labelForPattern(tagLower, i18n.t) !== tagLower
            ? labelForPattern(tagLower, i18n.t)
            : labelForSeason(tagLower, i18n.t) !== tagLower
            ? labelForSeason(tagLower, i18n.t)
            : t;

        localizedTagsSet.add(translatedTag);
      }
    }

    // 5. Localize Caption if generic
    let finalCaption = (analysis.caption || '').trim();
    const isGenericCaption =
      !finalCaption ||
      /garment crop analysis/i.test(finalCaption) ||
      /close-up of the/i.test(finalCaption) ||
      (!isEn && !hasTargetScript && /^[A-Za-z0-9\s\-_,.'"]+$/.test(finalCaption));

    if (isGenericCaption && !isEn) {
      if (targetLang === 'he' || targetLang === 'iw') {
        const dressCodeHebrew = labelForDressCode(analysis.dress_code || 'casual', i18n.t);
        const seasonHebrew = Array.isArray(analysis.season) && analysis.season.length > 0
          ? labelForSeason(analysis.season[0], i18n.t)
          : '';
        finalCaption = `${localizedSubCat || 'פריט'} בגוון ${primaryColorName || 'קלאסי'} בסגנון ${dressCodeHebrew || 'יומיומי'}${seasonHebrew ? `, מתאים לעונת ה${seasonHebrew}` : ''}.`;
      } else if (targetLang === 'ar') {
        const dressCodeAr = labelForDressCode(analysis.dress_code || 'casual', i18n.t);
        finalCaption = `${localizedSubCat || 'قطعة ملابس'} بلون ${primaryColorName || 'كلاسيكي'} بتصميم ${dressCodeAr || 'يومي'}.`;
      }
    }

    return {
      ...analysis,
      name: finalName,
      title: finalTitle,
      caption: finalCaption,
      colors: localizedColors,
      tags: Array.from(localizedTagsSet),
    };
  }
}

export const edgeAi = EdgeAiService.getInstance();
