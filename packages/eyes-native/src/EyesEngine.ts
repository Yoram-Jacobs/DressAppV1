/**
 * packages/eyes-native/src/EyesEngine.ts
 *
 * On-device garment analysis and multi-domain edge inference using llama.rn.
 *
 * Capabilities:
 *   1. analyzeGarmentCrop: Attribute extraction on isolated garment crops
 *   2. analyzeGarment / analyze: Full photo detection + attribute analysis
 *   3. adviseStylist: Local AI stylist multi-turn advice & look synthesis
 *   4. generateDailyProposal: Daily scheduled outfit recommendation
 *   5. planSuitcase: Travel suitcase packing and itinerary styling
 *   6. migrateWardrobeScreenshot: Screenshot parsing for competitor migration
 *   7. generateSessionTitle: 2-4 word stylist session titles
 *
 * Memory & Threading:
 *   - Automatic unload on backgrounding via EdgeAiService
 *   - Multi-threaded CPU execution tuned for Android big/mid cores (default 4 threads)
 *   - Multimodal projection support (BF16 mmproj)
 */

import { initLlama, LlamaContext } from 'llama.rn';
import { Platform } from 'react-native';
import { EYES_SYSTEM_PROMPT, buildUserPrompt, EyesGarmentResult } from './prompt';
import {
  CROP_ANALYSIS_SYSTEM_PROMPT,
  buildCropUserPrompt,
  GARMENT_SYSTEM_PROMPT,
  buildGarmentUserPrompt,
  EdgeGarmentResult,
  STYLIST_SYSTEM_PROMPT,
  buildStylistUserPrompt,
  StylistRequestParams,
  EdgeStylistResponse,
  SCHEDULER_SYSTEM_PROMPT,
  buildSchedulerUserPrompt,
  SchedulerParams,
  SUITCASE_SYSTEM_PROMPT,
  buildSuitcaseUserPrompt,
  SuitcaseParams,
  MIGRATION_SYSTEM_PROMPT,
  buildMigrationUserPrompt,
  EdgeMigrationResult,
  buildTitlePrompt,
} from './prompts';
import { ModelDownloader, DEFAULT_MODEL_CONFIG, EyesModelConfig } from './ModelDownloader';

// ── Device RAM check ──────────────────────────────────────────────────────────

const MIN_RAM_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

/** Returns true if the device likely has enough RAM for the 3.42 GB Q4 model. */
export function isDeviceSupported(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device') as typeof import('expo-device');
    const totalBytes = Device.totalMemory ?? 0;
    return totalBytes >= MIN_RAM_BYTES;
  } catch {
    return true;
  }
}

function toPosixPath(uriOrPath: string): string {
  return (uriOrPath || '').replace(/^file:\/\//, '');
}

// ── JSON cleanup & repair ─────────────────────────────────────────────────────

function cleanModelOutput(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<\|think\|>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?\|?think\|?>/gi, '')
    .replace(/<start_of_turn>(?:model)?/gi, '')
    .replace(/<end_of_turn>/gi, '')
    .replace(/<\|turn>model/gi, '')
    .replace(/<\|turn_end\|>/gi, '')
    .replace(/<\|im_start\|>(?:model)?/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .trim();
}

function repairJson(jsonStr: string): string {
  let s = jsonStr.trim();
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Track brackets and strings
  let inString = false;
  let escaped = false;
  const openBrackets: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && inString) {
      escaped = !escaped;
      continue;
    }
    if (ch === '"' && !escaped) {
      inString = !inString;
    } else if (!inString) {
      if (ch === '{' || ch === '[') {
        openBrackets.push(ch);
      } else if (ch === '}') {
        if (openBrackets.length && openBrackets[openBrackets.length - 1] === '{') {
          openBrackets.pop();
        }
      } else if (ch === ']') {
        if (openBrackets.length && openBrackets[openBrackets.length - 1] === '[') {
          openBrackets.pop();
        }
      }
    }
    escaped = false;
  }

  if (inString) {
    s += '"';
  }

  while (openBrackets.length > 0) {
    const last = openBrackets.pop();
    if (last === '{') s += '}';
    else if (last === '[') s += ']';
  }

  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
}

function extractJson<T = any>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = cleanModelOutput(raw);

  // 1) ```json fenced```
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      try {
        return JSON.parse(repairJson(fenced[1]));
      } catch { /* fall through */ }
    }
  }

  // 2) Find outermost brackets
  const aFirst = cleaned.indexOf('[');
  const oFirst = cleaned.indexOf('{');

  // Case A: Array appears first
  if (aFirst !== -1 && (oFirst === -1 || aFirst < oFirst)) {
    const aLast = cleaned.lastIndexOf(']');
    const candidate = aLast > aFirst ? cleaned.slice(aFirst, aLast + 1) : cleaned.slice(aFirst);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairJson(candidate));
      } catch { /* fall through */ }
    }
  }

  // Case B: Object appears first
  if (oFirst !== -1) {
    const oLast = cleaned.lastIndexOf('}');
    const candidate = oLast > oFirst ? cleaned.slice(oFirst, oLast + 1) : cleaned.slice(oFirst);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairJson(candidate));
      } catch { /* fall through */ }
    }
  }

  // 3) Try repair on full cleaned string
  try {
    return JSON.parse(repairJson(cleaned));
  } catch {
    return null;
  }
}

// ── EyesEngine ────────────────────────────────────────────────────────────────

export interface EyesEngineConfig {
  modelConfig?: EyesModelConfig;
  /** Context size — default 4096. */
  contextSize?: number;
  /** Max tokens to generate — default 1024. */
  maxTokens?: number;
  /** Temperature — default 0.1. */
  temperature?: number;
  /** Number of CPU threads — default 4 on Android for big/mid cores. */
  threads?: number;
}

export class EyesEngine {
  private readonly cfg: Required<EyesEngineConfig>;
  private readonly downloader: ModelDownloader;
  private context: LlamaContext | null = null;

  constructor(config: EyesEngineConfig = {}) {
    this.cfg = {
      modelConfig: config.modelConfig ?? DEFAULT_MODEL_CONFIG,
      contextSize:  config.contextSize  ?? 4096,
      maxTokens:    config.maxTokens    ?? 350,
      temperature:  config.temperature  ?? 0.1,
      threads:      config.threads      ?? (Platform.OS === 'android' ? 6 : 2),
    };
    this.downloader = new ModelDownloader(this.cfg.modelConfig);
  }

  /** Expose the downloader so callers can show progress UI. */
  get modelDownloader(): ModelDownloader {
    return this.downloader;
  }

  /** True if both model files exist on-device. */
  async isModelReady(): Promise<boolean> {
    return this.downloader.isComplete();
  }

  /**
   * Load the model into memory. Must be called before inference.
   */
  async load(): Promise<void> {
    if (this.context) return; // Already loaded

    const [mainReady, mmprojPath] = [
      await this.downloader.isComplete(),
      this.downloader.mmprojPath,
    ];
    if (!mainReady) {
      throw new Error('EyesEngine: model files not downloaded yet. Call modelDownloader.download() first.');
    }

    this.context = await initLlama({
      model: toPosixPath(this.downloader.mainModelPath),
      use_mlock: false,
      n_ctx:     this.cfg.contextSize,
      n_threads: this.cfg.threads,
      n_batch:   512,
      n_ubatch:  256,
      n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,
    });

    if (mmprojPath) {
      console.log('[EyesEngine] Initializing multimodal vision projector from:', mmprojPath);
      await this.context.initMultimodal({
        path: toPosixPath(mmprojPath),
        use_gpu: false,
        image_max_tokens: 258,
      });
      console.log('[EyesEngine] Multimodal vision projector initialized successfully (image_max_tokens: 258)');
    }
  }

  /**
   * Release the model context to free RAM.
   */
  async unload(): Promise<void> {
    if (this.context) {
      try {
        await this.context.releaseMultimodal();
      } catch (e) {
        console.warn('[EyesEngine] Error releasing multimodal:', e);
      }
      await this.context.release();
      this.context = null;
    }
  }

  get isLoaded(): boolean {
    return this.context !== null;
  }

  // ── 1. Garment Crop Analysis ────────────────────────────────────────────────

  /**
   * Analyze an isolated garment crop (e.g. from SegFormer or IS-Net).
   */
  async analyzeGarmentCrop(
    cropBase64: string,
    opts?: { kind?: string; label?: string; langCode?: string }
  ): Promise<EdgeGarmentResult | null> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const cleanB64 = cropBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const userPrompt = buildCropUserPrompt(opts?.langCode, { kind: opts?.kind, label: opts?.label });

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: CROP_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${cleanB64}` },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      n_predict:   this.cfg.maxTokens,
      temperature: this.cfg.temperature,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = completionResult.text ?? '';
    console.log('[EyesEngine] analyzeGarmentCrop raw output length:', raw.length, 'preview:', raw.slice(0, 300));
    return extractJson<EdgeGarmentResult>(raw);
  }

  // ── 2. Full Photo Garment Detection & Attributes ────────────────────────────

  /**
   * Detect garments and extract full attributes from an uncropped photograph.
   */
  async analyzeGarment(
    imageBase64: string,
    langCode?: string
  ): Promise<EdgeGarmentResult | EdgeGarmentResult[] | null> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const cleanB64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const userPrompt = buildGarmentUserPrompt(langCode);

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: GARMENT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${cleanB64}` },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      n_predict:   this.cfg.maxTokens,
      temperature: this.cfg.temperature,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = completionResult.text ?? '';
    console.log('[EyesEngine] analyzeGarment raw output length:', raw.length, 'preview:', raw.slice(0, 300));
    return extractJson<EdgeGarmentResult | EdgeGarmentResult[]>(raw);
  }

  /** Legacy alias for backward compatibility. */
  async analyze(imageBase64: string, langCode?: string): Promise<EyesGarmentResult | null> {
    const res = await this.analyzeGarment(imageBase64, langCode);
    if (!res) return null;
    return Array.isArray(res) ? (res.length > 0 ? res[0] : null) : res;
  }

  // ── 3. AI Stylist Brain ─────────────────────────────────────────────────────

  /**
   * On-device AI Stylist multi-turn conversation and outfit synthesis.
   */
  async adviseStylist(
    params: StylistRequestParams,
    attachedImageB64?: string
  ): Promise<EdgeStylistResponse | null> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const userPrompt = buildStylistUserPrompt(params);

    const userContent: any = attachedImageB64
      ? [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${attachedImageB64.replace(/^data:image\/[^;]+;base64,/, '')}`,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ]
      : userPrompt;

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: STYLIST_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      n_predict:   Math.max(1200, this.cfg.maxTokens),
      temperature: 0.2,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = completionResult.text ?? '';
    return extractJson<EdgeStylistResponse>(raw);
  }

  // ── 4. Daily Scheduled Outfit Proposal ──────────────────────────────────────

  /**
   * Generate next-day/same-day scheduled outfit recommendation.
   */
  async generateDailyProposal(params: SchedulerParams): Promise<any> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const userPrompt = buildSchedulerUserPrompt(params);

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: SCHEDULER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      n_predict:   800,
      temperature: 0.1,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = completionResult.text ?? '';
    return extractJson(raw);
  }

  // ── 5. Travel Suitcase Packing ──────────────────────────────────────────────

  /**
   * Generate travel packing list and coordinated trip outfits.
   */
  async planSuitcase(params: SuitcaseParams): Promise<any> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const userPrompt = buildSuitcaseUserPrompt(params);

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: SUITCASE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      n_predict:   1400,
      temperature: 0.1,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = completionResult.text ?? '';
    return extractJson(raw);
  }

  // ── 6. Wardrobe Migration Screenshot Parsing ────────────────────────────────

  /**
   * Parse competitor wardrobe app screenshots for seamless migration.
   */
  async migrateWardrobeScreenshot(
    screenshotB64: string,
    appName?: string
  ): Promise<EdgeMigrationResult | null> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const cleanB64 = screenshotB64.replace(/^data:image\/[^;]+;base64,/, '');
    const userPrompt = buildMigrationUserPrompt(appName);

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: MIGRATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${cleanB64}` },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      n_predict:   1000,
      temperature: 0.1,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = completionResult.text ?? '';
    return extractJson<EdgeMigrationResult>(raw);
  }

  // ── 7. Session Title Generation ─────────────────────────────────────────────

  /**
   * Generate a concise 2-4 word stylist session title.
   */
  async generateSessionTitle(firstUserMessage: string, language?: string): Promise<string> {
    if (!this.context) await this.load();
    if (!this.context) throw new Error('EyesEngine: failed to initialize context.');

    const userPrompt = buildTitlePrompt(firstUserMessage, language);

    const completionResult = await this.context.completion({
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      n_predict:   40,
      temperature: 0.3,
      top_p:       0.9,
      enable_thinking: false,
      reasoning_format: 'none',
      force_pure_content: true,
      stop: ['<end_of_turn>', '<|turn_end|>', '<|im_end|>', '```'],
    });

    const raw = (completionResult.text ?? '').trim();
    const clean = raw.replace(/^["'`]|["'`]$/g, '').replace(/\n[\s\S]*/, '').trim();
    return clean || 'Stylist Chat';
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
export const sharedEyes = new EyesEngine();
