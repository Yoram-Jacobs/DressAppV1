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
config.projectRoot = projectRoot;

// ── Monorepo watchFolders ────────────────────────────────────────────────────
// Watch workspace root for hoisted monorepo dependencies.
config.watchFolders = [
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

// Disable hierarchical lookup to prevent nested node_modules from instantiating duplicate react
config.resolver.disableHierarchicalLookup = true;

// Force singleton resolution for core packages in monorepo
config.resolver.extraNodeModules = {
  'llama.rn': LLAMA_STUB,
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  expo: path.resolve(workspaceRoot, 'node_modules/expo'),
  'react-native-safe-area-context': path.resolve(workspaceRoot, 'node_modules/react-native-safe-area-context'),
};

module.exports = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // We add className support manually
  globalClassNamePolyfill: false,
});
