/**
 * apps/mobile/metro.config.js
 *
 * Metro bundler configuration for the DressApp Expo app.
 *
 * Key design decisions:
 * - Yarn workspaces hoists ALL dependencies to root node_modules/.
 *   apps/mobile/node_modules/ is essentially empty (only .bin/).
 *   Therefore, nodeModulesPaths must list root node_modules.
 * - llama.rn is stubbed via extraNodeModules for EAS builds where
 *   the native NDK package is not installed.
 * - watchFolders includes packages/ so Metro can resolve @dressapp/*
 *   workspace packages. node_modules is NOT watched — Metro resolves
 *   it through nodeModulesPaths.
 * - On Windows, __dirname may have a lowercase drive letter (c:\...)
 *   which Metro internally prefixes with C:\ causing ENOENT. We
 *   normalize all paths to uppercase drive letter to prevent this.
 */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');
const path = require('path');
const { existsSync } = require('fs');

// ── Windows drive letter normalization ───────────────────────────────────────
// Metro on Windows can produce doubled paths (C:\c:\...) when the drive
// letter is lowercase. Normalize all base paths to uppercase drive letter.
function normalizePath(p) {
  if (process.platform === 'win32' && /^[a-z]:/.test(p)) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return p;
}

const projectRoot = normalizePath(__dirname);
const workspaceRoot = normalizePath(path.resolve(projectRoot, '../..'));

const LLAMA_STUB = path.resolve(projectRoot, 'stubs/llama-stub.js');

const config = getDefaultConfig(projectRoot);

// ── Monorepo watchFolders ────────────────────────────────────────────────────
// Watch workspace root and packages for hoisted monorepo dependencies.
config.watchFolders = [
  ...(config.watchFolders || []),
  workspaceRoot,
];

// ── Module resolution ────────────────────────────────────────────────────────
// Yarn hoists everything to root node_modules. List root FIRST since
// that's where all the packages actually live.
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

// Asset extensions
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}

// Source extensions
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
];

// llama.rn stub — the only extraNodeModules entry needed.
// Everything else resolves through normal hierarchical lookup + nodeModulesPaths.
config.resolver.extraNodeModules = {
  'llama.rn': LLAMA_STUB,
};

const finalConfig = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // We add className support manually
  globalClassNamePolyfill: false,
});

// ── Metro 0.81+ / react-native-css compatibility shim ────────────────────────
// react-native-css emits legacy { eventsQueue } on watcher 'change', but Metro
// 0.81+ (_onHasteChange) expects { changes: { addedFiles, modifiedFiles, removedFiles }, rootDir }.
const originalEnhanceMiddleware = finalConfig.server?.enhanceMiddleware;
finalConfig.server = {
  ...finalConfig.server,
  enhanceMiddleware(middleware, metroServer) {
    const app = originalEnhanceMiddleware
      ? originalEnhanceMiddleware(middleware, metroServer)
      : middleware;

    try {
      const bundler = metroServer?.getBundler?.()?.getBundler?.();
      if (bundler) {
        // Defensive check on DependencyGraph._onHasteChange
        if (bundler._depGraph && typeof bundler._depGraph._onHasteChange === 'function') {
          const origHasteChange = bundler._depGraph._onHasteChange.bind(bundler._depGraph);
          bundler._depGraph._onHasteChange = function (changeEvent) {
            if (!changeEvent || !changeEvent.changes) {
              this.emit?.('change');
              return;
            }
            return origHasteChange(changeEvent);
          };
        }

        // Intercept FileMap watcher.emit to provide valid changes structure
        const watcher = bundler.getWatcher?.();
        if (watcher && !watcher.__metro_v81_change_shimmed) {
          watcher.__metro_v81_change_shimmed = true;
          const originalEmit = watcher.emit.bind(watcher);
          watcher.emit = function (event, ...args) {
            if (event === 'change' && args[0] && !args[0].changes && args[0].eventsQueue) {
              const rootDir = bundler.projectRoot || workspaceRoot;
              const eventObj = args[0];
              eventObj.rootDir = rootDir;
              eventObj.changes = {
                addedFiles: [],
                modifiedFiles: (eventObj.eventsQueue || []).map((e) => [
                  path.relative(rootDir, e.filePath),
                  e.metadata || { modifiedTime: Date.now(), size: 1, type: 'virtual' },
                ]),
                removedFiles: [],
              };
            }
            return originalEmit(event, ...args);
          };
        }
      }
    } catch (err) {
      console.warn('[metro.config.js] Failed to install react-native-css watcher compatibility shim:', err);
    }

    return app;
  },
};

module.exports = finalConfig;

