/**
 * packages/eyes-native/src/ModelDownloader.ts
 *
 * Downloads the two GGUF files needed for on-device Eyes inference and
 * caches them to the app's document directory using expo-file-system's
 * resumable download API (handles backgrounded and killed apps).
 *
 * Directory layout on-device:
 *   <DocumentDirectory>/eyes-models/
 *     gemma-4-e2b-it.Q4_K_M-002.gguf      (3.27 GB, LLM weights)
 *     gemma-4-e2b-it.BF16-mmproj.gguf     (941 MB, vision projector)
 *
 * Production URLs default to the HuggingFace repo that mirrors the
 * same files used by the inference-server container. Override via
 * EyesModelConfig for staging/dev builds.
 */

import * as FileSystem from 'expo-file-system';
import { NativeModules, Platform } from 'react-native';
import { EventEmitter } from './EventEmitter';

const { GarmentVision } = NativeModules;

// ── Model config ─────────────────────────────────────────────────────────────

export interface EyesModelConfig {
  /** Base URL with trailing slash — files are appended to this path. */
  baseUrl: string;
  mainModel:  { filename: string; sha256?: string };
  mmprojModel: { filename: string; sha256?: string };
}

export const DEFAULT_MODEL_CONFIG: EyesModelConfig = {
  baseUrl: 'https://huggingface.co/Yoram-Jacobs/Eyes-Clean/resolve/main/',
  mainModel:  { filename: 'gemma-4-e2b-it.Q4_K_M-002.gguf' },
  mmprojModel: { filename: 'gemma-4-e2b-it.BF16-mmproj.gguf' },
};

// ── Progress events ───────────────────────────────────────────────────────────

export type DownloadPhase = 'idle' | 'main-model' | 'mmproj' | 'done' | 'error';

export interface DownloadProgress {
  phase: DownloadPhase;
  /** 0–1 for current file; 0–1 overall across both files. */
  fileFraction: number;
  overallFraction: number;
  bytesLoaded: number;
  bytesTotal: number;
  error?: string;
}

export type ProgressListener = (p: DownloadProgress) => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODEL_DIR = `${FileSystem.documentDirectory}eyes-models/`;

function modelPath(filename: string): string {
  return `${MODEL_DIR}${filename}`;
}

async function ensureModelDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
}

async function fileExists(path: string): Promise<boolean> {
  if (!path) return false;
  try {
    const formatted = path.startsWith('/') ? `file://${path}` : path;
    const info = await FileSystem.getInfoAsync(formatted);
    return Boolean(info.exists && (info.size === undefined || info.size > 0));
  } catch {
    return false;
  }
}

// ── ModelDownloader ───────────────────────────────────────────────────────────

export class ModelDownloader {
  private readonly cfg: EyesModelConfig;
  private readonly emitter = new EventEmitter<DownloadProgress>();
  private _aborted = false;
  private _resolvedMainPath: string | null = null;
  private _resolvedMmprojPath: string | null = null;

  constructor(cfg: EyesModelConfig = DEFAULT_MODEL_CONFIG) {
    this.cfg = cfg;
  }

  private async findExistingPath(filename: string): Promise<string | null> {
    const candidates = [
      `file:///storage/emulated/0/Android/data/com.project.dressapp/files/eyes-models/${filename}`,
      `/storage/emulated/0/Android/data/com.project.dressapp/files/eyes-models/${filename}`,
      `${FileSystem.documentDirectory}eyes-models/${filename}`,
      `${FileSystem.cacheDirectory}eyes-models/${filename}`,
    ];
    for (const cand of candidates) {
      if (await fileExists(cand)) {
        return cand.replace(/^file:\/\//, '');
      }
    }
    return null;
  }

  /** Absolute paths for consumers (llama.rn needs these). */
  get mainModelPath(): string {
    return this._resolvedMainPath || modelPath(this.cfg.mainModel.filename).replace(/^file:\/\//, '');
  }

  get mmprojPath(): string {
    return this._resolvedMmprojPath || modelPath(this.cfg.mmprojModel.filename).replace(/^file:\/\//, '');
  }

  onProgress(fn: ProgressListener): () => void {
    return this.emitter.on(fn);
  }

  /** True if both files are already present on-device. */
  async isComplete(): Promise<boolean> {
    // 1. Try native GarmentVision module on Android
    if (Platform.OS === 'android' && GarmentVision && typeof GarmentVision.getEyesModelPaths === 'function') {
      try {
        const paths = await GarmentVision.getEyesModelPaths();
        if (paths?.isReady && paths.mainModelPath && paths.mmprojPath) {
          this._resolvedMainPath = paths.mainModelPath;
          this._resolvedMmprojPath = paths.mmprojPath;
          return true;
        }
      } catch (e) {
        console.warn('[ModelDownloader] GarmentVision.getEyesModelPaths check failed:', e);
      }
    }

    // 2. Check candidate filesystem paths
    const candidateMain = await this.findExistingPath(this.cfg.mainModel.filename);
    const candidateMmproj = await this.findExistingPath(this.cfg.mmprojModel.filename);
    if (candidateMain && candidateMmproj) {
      this._resolvedMainPath = candidateMain;
      this._resolvedMmprojPath = candidateMmproj;
      return true;
    }

    // 3. Fallback to standard paths
    const mainOk = await fileExists(this.mainModelPath);
    const mmprojOk = await fileExists(this.mmprojPath);
    return mainOk && mmprojOk;
  }

  /** Cancel an in-progress download (no-op if not downloading). */
  abort(): void {
    this._aborted = true;
  }

  /**
   * Download both model files sequentially, emitting progress events.
   * Resumes a partial download if the file was partially fetched before.
   * Resolves when both files are on disk; rejects on network error or abort.
   */
  async download(): Promise<void> {
    this._aborted = false;
    await ensureModelDir();

    const files = [
      { phase: 'main-model' as DownloadPhase, ...this.cfg.mainModel,  path: this.mainModelPath  },
      { phase: 'mmproj'     as DownloadPhase, ...this.cfg.mmprojModel, path: this.mmprojPath     },
    ];

    // Main model is ~3.27 GB, mmproj is ~0.94 GB → weight overall progress
    const FILE_WEIGHTS = [3.27, 0.94];
    const TOTAL_WEIGHT = FILE_WEIGHTS.reduce((a, b) => a + b, 0);
    let completedWeight = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (await fileExists(file.path)) {
        // Already downloaded — skip
        completedWeight += FILE_WEIGHTS[i];
        this.emitter.emit({
          phase: file.phase,
          fileFraction: 1,
          overallFraction: completedWeight / TOTAL_WEIGHT,
          bytesLoaded: FILE_WEIGHTS[i] * 1024 * 1024 * 1024,
          bytesTotal:  FILE_WEIGHTS[i] * 1024 * 1024 * 1024,
        });
        continue;
      }

      if (this._aborted) throw new Error('Download aborted');

      const url = `${this.cfg.baseUrl}${file.filename}`;
      const resumeUri = `${file.path}.partial`;
      const resumeInfo = await FileSystem.getInfoAsync(resumeUri);
      const startByte  = resumeInfo.exists ? (resumeInfo as FileSystem.FileInfo & { size?: number }).size ?? 0 : 0;

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        file.path,
        {
          headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
        },
        (downloadProgress) => {
          if (this._aborted) return;
          const loaded = downloadProgress.totalBytesWritten;
          const total  = downloadProgress.totalBytesExpectedToWrite;
          const fileFraction    = total > 0 ? loaded / total : 0;
          const fileWeight      = FILE_WEIGHTS[i];
          const overallFraction = (completedWeight + fileWeight * fileFraction) / TOTAL_WEIGHT;
          this.emitter.emit({
            phase: file.phase,
            fileFraction,
            overallFraction,
            bytesLoaded: loaded,
            bytesTotal:  total,
          });
        },
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        const err = `Download failed for ${file.filename}: status ${result?.status ?? 'unknown'}`;
        this.emitter.emit({ phase: 'error', fileFraction: 0, overallFraction: completedWeight / TOTAL_WEIGHT, bytesLoaded: 0, bytesTotal: 0, error: err });
        throw new Error(err);
      }

      completedWeight += FILE_WEIGHTS[i];
    }

    this.emitter.emit({ phase: 'done', fileFraction: 1, overallFraction: 1, bytesLoaded: 0, bytesTotal: 0 });
  }

  /** Delete both model files from disk (freeing ~4.1 GB). */
  async deleteModels(): Promise<void> {
    for (const p of [this.mainModelPath, this.mmprojPath]) {
      if (await fileExists(p)) {
        await FileSystem.deleteAsync(p, { idempotent: true });
      }
    }
  }
}
