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
const path = require('path');

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
// Yarn hoists everything to root node_modules. Prevent hierarchical duplicate resolution.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules/expo/node_modules'),
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

// llama.rn stub + singleton packages to prevent dual React / Expo runtime instances
config.resolver.extraNodeModules = {
  '@mobile': path.resolve(projectRoot, 'src'),
  '@dressapp/api-client': path.resolve(workspaceRoot, 'packages/api-client/src/index.js'),
  '@dressapp/i18n': path.resolve(workspaceRoot, 'packages/i18n/src/index.js'),
  '@dressapp/types': path.resolve(workspaceRoot, 'packages/types/src/index.js'),
  '@dressapp/eyes-native': path.resolve(workspaceRoot, 'packages/eyes-native/src/index.ts'),
  'llama.rn': LLAMA_STUB,
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  'react-native-safe-area-context': path.resolve(workspaceRoot, 'node_modules/react-native-safe-area-context'),
  'react-native-reanimated': path.resolve(workspaceRoot, 'node_modules/react-native-reanimated'),
  'react-native-screens': path.resolve(workspaceRoot, 'node_modules/react-native-screens'),
  'react-native-svg': path.resolve(workspaceRoot, 'node_modules/react-native-svg'),
  expo: path.resolve(workspaceRoot, 'node_modules/expo'),
  'expo-modules-core': path.resolve(workspaceRoot, 'node_modules/expo/node_modules/expo-modules-core'),
  '@expo/vector-icons': path.resolve(workspaceRoot, 'node_modules/@expo/vector-icons'),
  '@react-navigation/native': path.resolve(workspaceRoot, 'node_modules/@react-navigation/native'),
  '@react-navigation/native-stack': path.resolve(workspaceRoot, 'node_modules/@react-navigation/native-stack'),
  '@react-navigation/bottom-tabs': path.resolve(workspaceRoot, 'node_modules/@react-navigation/bottom-tabs'),
  axios: path.resolve(workspaceRoot, 'node_modules/axios'),
  i18next: path.resolve(workspaceRoot, 'node_modules/i18next'),
  'react-i18next': path.resolve(workspaceRoot, 'node_modules/react-i18next'),
};

module.exports = config;




