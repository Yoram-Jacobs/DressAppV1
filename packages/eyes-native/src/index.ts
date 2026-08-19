/**
 * packages/eyes-native/src/index.ts
 * Public API surface for @dressapp/eyes-native
 */
export { EyesEngine, sharedEyes, isDeviceSupported } from './EyesEngine';
export type { EyesEngineConfig } from './EyesEngine';
export { ModelDownloader, DEFAULT_MODEL_CONFIG } from './ModelDownloader';
export type { EyesModelConfig, DownloadProgress, DownloadPhase } from './ModelDownloader';
export { EYES_SYSTEM_PROMPT, buildUserPrompt } from './prompt';
export type { EyesGarmentResult } from './prompt';
