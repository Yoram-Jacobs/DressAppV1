/**
 * apps/mobile/stubs/llama-stub.js
 *
 * Metro stub for `llama.rn`.
 *
 * llama.rn is a native-only package that requires a precompiled GGUF model on
 * device. It is listed as a peerDependency of @dressapp/eyes-native but is NOT
 * installed in the EAS build (it requires NDK toolchain + model weights).
 *
 * Metro must be able to RESOLVE the import at bundle-time even when the native
 * package is absent. This stub satisfies the import and causes EyesEngine.load()
 * to reject gracefully — ClosetAddScreen catches that and falls back to the
 * server-side Eyes endpoint automatically.
 *
 * Wired into metro.config.js via resolver.extraNodeModules.
 */

const NOT_AVAILABLE = new Error(
  '[DressApp] On-device Eyes inference is not available in this build. ' +
  'The app will use the cloud Eyes endpoint instead.'
);

/** Minimal stand-in for LlamaContext returned by initLlama(). */
class StubLlamaContext {
  async completion() {
    throw NOT_AVAILABLE;
  }
  async release() {}
}

/**
 * initLlama — always rejects so EyesEngine.load() fails immediately.
 * The caller (ClosetAddScreen) catches this and uses the server fallback.
 */
async function initLlama() {
  throw NOT_AVAILABLE;
}

module.exports = {
  initLlama,
  LlamaContext: StubLlamaContext,
};
