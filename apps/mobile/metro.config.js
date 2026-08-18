/**
 * apps/mobile/metro.config.js
 *
 * Metro bundler configuration for the DressApp Expo app.
 *
 * Key configuration:
 * - Resolves workspace packages (@dressapp/*) from the monorepo root
 * - Picks up platform-specific files (.native.js) for API client streaming
 *
 * CRITICAL FIX (EAS builds):
 * Expo's `getDefaultConfig` automatically reads the root package.json
 * `workspaces` field and adds ALL workspace directories + root node_modules
 * to watchFolders. On the EAS build server this causes two problems:
 *
 *   1. Non-existent directories (apps/web, apps/android-twa) — Metro crashes
 *      because it tries to set up inotify watches on paths that don't exist
 *      in the EAS archive.
 *
 *   2. Root node_modules — 1500+ packages → 50k+ subdirectories. Metro's
 *      inotify watch exhausts the default Linux limit (8192) or the
 *      initialization scan takes so long the EAS "Bundle JavaScript"
 *      phase times out before Metro can start.
 *
 * Solution: strip non-existent paths AND any node_modules directory from
 * watchFolders. Metro doesn't need to watch node_modules for changes during
 * a build (hot reload is disabled). Package resolution is handled separately
 * via nodeModulesPaths.
 *
 * CRITICAL FIX (dual React / invalid hook call):
 * In this Yarn workspace monorepo, `apps/mobile/node_modules/react` (v19.0.0)
 * and root `node_modules/react` (v19.2.8) are two separate copies. Metro's
 * hierarchical resolver picks whichever copy is nearest to the importing file,
 * so workspace packages (packages/*) get root React while app code gets the
 * mobile copy → two React instances → "Invalid hook call".
 *
 * Solution: use resolver.resolveRequest to redirect all imports of the React
 * singleton packages to one canonical location (apps/mobile/node_modules).
 *
 * NOTE: NativeWind removed — all screens use StyleSheet.create, and the
 * lightningcss native binary is platform-specific (Windows vs Linux), which
 * breaks EAS CLI when run from WSL against a Windows node_modules tree.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { existsSync } = require('fs');

// ── llama.rn stub ─────────────────────────────────────────────────────────────
// llama.rn is a peerDependency of @dressapp/eyes-native but is NOT installed on
// the EAS build server (its NDK-heavy postinstall is not viable in CI).
// We redirect Metro to a graceful JS stub so the bundle succeeds.
// At runtime, EyesEngine.load() rejects and ClosetAddScreen falls back to the
// server-side Eyes endpoint automatically — no user-visible crash.
const LLAMA_STUB = path.resolve(__dirname, 'stubs/llama-stub.js');

// Monorepo root (two levels up from apps/mobile)
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ── Monorepo: safe watchFolders (source trees only) ──────────────────────────
// Strip:
//   - non-existent paths  (apps/web, apps/android-twa absent from EAS archive)
//   - node_modules trees  (too many files → inotify exhaustion / EAS timeout)
// Keep: only workspace package source directories that actually exist.
config.watchFolders = (config.watchFolders ?? []).filter(
  (f) => existsSync(f) && !f.includes('node_modules'),
);

config.resolver = {
  ...config.resolver,
  // Allow Metro to resolve packages from the monorepo root node_modules.
  // This covers Yarn-hoisted packages that live at root rather than apps/mobile.
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Platform-specific file resolution.
  sourceExts: [
    ...config.resolver.sourceExts,
    'cjs',
  ],
  // Stub packages that are native-only / not installed on the EAS build server.
  // These stubs satisfy the import at bundle-time and reject gracefully at runtime.
  extraNodeModules: {
    // llama.rn: NDK-heavy; not installed in CI. EyesEngine falls back to server.
    'llama.rn': LLAMA_STUB,
  },
};

module.exports = config;
