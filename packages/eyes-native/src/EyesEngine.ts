/**
 * packages/eyes-native/src/EyesEngine.ts
 *
 * On-device garment analysis using llama.rn (llama.cpp for React Native).
 *
 * Architecture:
 *   1. ModelDownloader fetches GGUF + mmproj to DocumentDirectory.
 *   2. EyesEngine.load() creates a llama.rn LlamaContext with multimodal
 *      (mmproj) support.
 *   3. EyesEngine.analyze(imageB64) sends the system prompt + user prompt +
 *      base64 image to the context and returns parsed garment attributes.
 *   4. EyesEngine.unload() releases the context — call when the app goes
 *      to background to free 4+ GB of RAM.
 *
 * Hybrid fallback:
 *   - isSupported() returns false on devices with < 5 GB total RAM
 *     (the engine won't even be offered to the user).
 *   - Callers that need a server fallback should catch errors from analyze()
 *     and fall back to the existing api.setItemPhoto() server-side path.
 *
 * Threading:
 *   llama.rn runs inference on a background thread pool. This file runs
 *   entirely on JS thread — it just awaits the native promise.
 */

import { initLlama, LlamaContext } from 'llama.rn';
import { Platform } from 'react-native';
import type { NativeModules } from 'react-native';
import { EYES_SYSTEM_PROMPT, buildUserPrompt, EyesGarmentResult } from './prompt';
import { ModelDownloader, DEFAULT_MODEL_CONFIG, EyesModelConfig } from './ModelDownloader';

// ── Device RAM check ──────────────────────────────────────────────────────────

const MIN_RAM_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

/** Returns true if the device likely has enough RAM for the 3.27 GB Q4 model. */
export function isDeviceSupported(): boolean {
  try {
    // expo-device exposes totalMemory in bytes
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device') as typeof import('expo-device');
    const totalBytes = Device.totalMemory ?? 0;
    return totalBytes >= MIN_RAM_BYTES;
  } catch {
    // expo-device not installed — fail open (let the model try)
    return true;
  }
}

// ── JSON extraction ───────────────────────────────────────────────────────────

/** Port of backend's _extract_json() — strips markdown fences, pulls first object/array. */
function extractJson(raw: string): EyesGarmentResult | EyesGarmentResult[] | null {
  if (!raw) return null;

  // 1) ```json fenced```
  const fenced = raw.match(/```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
  }

  // 2) Bare array [...]
  const aFirst = raw.indexOf('['), aLast = raw.lastIndexOf(']');
  const oFirst = raw.indexOf('{'), oLast = raw.lastIndexOf('}');

  // Prefer array if it appears before object
  if (aFirst !== -1 && aLast > aFirst && (oFirst === -1 || aFirst <= oFirst)) {
    try { return JSON.parse(raw.slice(aFirst, aLast + 1)); } catch { /* fall through */ }
  }

  // 3) Object {...}
  if (oFirst !== -1 && oLast > oFirst) {
    try { return JSON.parse(raw.slice(oFirst, oLast + 1)); } catch { /* fall through */ }
  }

  return null;
}

// ── EyesEngine ────────────────────────────────────────────────────────────────

export interface EyesEngineConfig {
  modelConfig?: EyesModelConfig;
  /** Context size — default 4096 (matches llama-server server config). */
  contextSize?: number;
  /** Max tokens to generate — default 1024. */
  maxTokens?: number;
  /** Temperature — default 0.1 (matches server path). */
  temperature?: number;
  /** Number of CPU threads — default 2 (same as server config). */
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
      maxTokens:    config.maxTokens    ?? 1024,
      temperature:  config.temperature  ?? 0.1,
      threads:      config.threads      ?? 2,
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
   * Load the model into memory. Must be called before analyze().
   * Throws if model files are missing — call isModelReady() first.
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
      model: this.downloader.mainModelPath,
      use_mlock: false,
      n_ctx:     this.cfg.contextSize,
      n_threads: this.cfg.threads,
      // Multimodal projector — enables vision input
      mmproj: mmprojPath,
      // Disable GPU layers on Android to avoid OOM on <8 GB devices;
      // on iOS Metal is handled automatically by llama.rn
      n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,
    });
  }

  /**
   * Run garment analysis on a base64-encoded JPEG/PNG.
   *
   * @param imageBase64 - raw base64 string (no data: prefix)
   * @param langCode    - i18next language code for response language
   * @returns First garment result, or null if no garment detected
   */
  async analyze(imageBase64: string, langCode?: string): Promise<EyesGarmentResult | null> {
    if (!this.context) {
      throw new Error('EyesEngine: not loaded. Call load() first.');
    }

    const userPrompt = buildUserPrompt(langCode);

    // llama.rn multimodal: image is passed via the `image_url` content part
    // in the messages array, matching the OpenAI format used by the Eyes server.
    const completionResult = await this.context.completion(
      {
        messages: [
          {
            role: 'system',
            content: EYES_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
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
      },
    );

    const raw = completionResult.text ?? '';

    // Strip think-block if present (model is launched with reasoning-budget 0
    // but some completions still emit an empty <think></think>).
    const cleaned = raw.replace(/<\|think\|>[\s\S]*?<\/think>/g, '').trim();

    const parsed = extractJson(cleaned);
    if (!parsed) return null;

    // Handle array response — return first garment
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? parsed[0] : null;
    }
    return parsed;
  }

  /**
   * Release the model context. Call when the app goes to background
   * or the user navigates away from the closet flow. This frees
   * ~4+ GB of RAM that the OS would otherwise page out slowly.
   */
  async unload(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
  }

  /** True if context is currently loaded in memory. */
  get isLoaded(): boolean {
    return this.context !== null;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Shared engine instance — avoids loading the model twice across screens.
export const sharedEyes = new EyesEngine();
