/**
 * packages/eyes-native/src/types/llama.rn.d.ts
 *
 * Minimal ambient type declaration for llama.rn
 * (until the package is installed via npm install).
 *
 * The real declarations ship with the npm package itself.
 * These stubs are only used during tsc --noEmit in CI before node_modules
 * contains llama.rn. They will be superseded by the real declarations once
 * `npm install` runs.
 */

declare module 'llama.rn' {
  export interface LlamaCompletionParams {
    messages?: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: { url: string };
      }>;
    }>;
    prompt?: string;
    n_predict?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
  }

  export interface LlamaCompletionResult {
    text: string;
    tokens_predicted: number;
    tokens_evaluated: number;
    truncated: boolean;
    stopped_eos: boolean;
    stopped_word: boolean;
    stopped_limit: boolean;
    stopping_word: string;
    tokens_cached: number;
    timings: Record<string, number>;
  }

  export interface LlamaContext {
    completion(params: LlamaCompletionParams): Promise<LlamaCompletionResult>;
    tokenize(text: string): Promise<{ tokens: number[] }>;
    detokenize(tokens: number[]): Promise<string>;
    embedding(text: string): Promise<{ embedding: number[] }>;
    release(): Promise<void>;
    stopCompletion(): Promise<void>;
  }

  export interface LlamaContextParams {
    model: string;
    n_ctx?: number;
    n_threads?: number;
    n_gpu_layers?: number;
    use_mlock?: boolean;
    mmproj?: string;
    vocab_only?: boolean;
    embedding?: boolean;
    lora?: string;
    lora_scaled?: number;
    rope_freq_base?: number;
    rope_freq_scale?: number;
  }

  export function initLlama(params: LlamaContextParams): Promise<LlamaContext>;
  export function releaseAllLlama(): Promise<void>;
}
