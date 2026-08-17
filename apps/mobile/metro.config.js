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

// ── Singleton React packages — always resolve from apps/mobile/node_modules ──
// These packages maintain global state (hooks, context, etc.) and MUST exist
// as a single instance in the bundle. Pin them to the app's own node_modules
// so the same physical file is used regardless of which workspace package
// triggers the import.
const REACT_SINGLETONS = [
  'react',
  'react-native',
  'react-dom',
  'react-is',
  'scheduler',
];

config.resolver = {
  ...config.resolver,
  // Allow Metro to resolve packages from the monorepo root node_modules.
  // This covers Yarn-hoisted packages that live at root rather than apps/mobile.
  // NOTE: nodeModulesPaths is for RESOLUTION; watchFolders is for HOT-RELOAD.
  //       These two are intentionally decoupled here.
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Platform-specific file resolution:
  // Metro picks .native.js over .js automatically for React Native targets.
  // This is how streamNdjson.native.js is selected over streamNdjson.js.
  sourceExts: [
    ...config.resolver.sourceExts,
    // Ensure .cjs files from workspace packages are handled
    'cjs',
  ],
  // Force singleton packages to always resolve from apps/mobile/node_modules.
  // This prevents multiple React instances when workspace packages (packages/*)
  // are imported: without this fix they resolve React from root node_modules
  // (v19.2.8) while app code uses apps/mobile/node_modules (v19.0.0).
  resolveRequest: (context, moduleName, platform) => {
    const base = moduleName.split('/')[0];
    if (REACT_SINGLETONS.includes(base)) {
      const localPath = path.resolve(projectRoot, 'node_modules', moduleName);
      if (existsSync(localPath) || existsSync(localPath + '.js') || existsSync(localPath + '/index.js')) {
        return context.resolveRequest(
          {
            ...context,
            originModulePath: path.join(projectRoot, '_singleton_pin.js'),
          },
          moduleName,
          platform,
        );
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
