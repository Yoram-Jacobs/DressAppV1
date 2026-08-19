/**
 * apps/mobile/metro.config.js
 *
 * Metro bundler configuration for the DressApp Expo app.
 *
 * Key design decisions:
 * - Yarn workspaces hoists ALL dependencies to root node_modules/.
 *   apps/mobile/node_modules/ is essentially empty (only .bin/).
 *   Therefore, nodeModulesPaths must prioritize root node_modules.
 * - llama.rn is stubbed via extraNodeModules for EAS builds where
 *   the native NDK package is not installed.
 * - watchFolders includes the packages/ directory so Metro can
 *   resolve @dressapp/* workspace packages.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { existsSync } = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const LLAMA_STUB = path.resolve(projectRoot, 'stubs/llama-stub.js');

const config = getDefaultConfig(projectRoot);

// ── Monorepo watchFolders ────────────────────────────────────────────────────
// Include workspace packages so Metro can resolve @dressapp/* source files.
// Filter out non-existent paths (apps/web, apps/android-twa absent from EAS).
const packagesDir = path.resolve(workspaceRoot, 'packages');
config.watchFolders = [
  ...(config.watchFolders ?? []).filter(
    (f) => existsSync(f) && !f.includes('node_modules'),
  ),
  ...(existsSync(packagesDir) ? [packagesDir] : []),
];

// ── Module resolution ────────────────────────────────────────────────────────
// Yarn hoists everything to root node_modules. We list both paths
// (mobile-local first for any unhoist edge cases, root second).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

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

module.exports = config;
