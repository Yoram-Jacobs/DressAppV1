/**
 * apps/mobile/metro.config.js
 *
 * Metro bundler configuration for the DressApp Expo app.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { existsSync } = require('fs');

const LLAMA_STUB = path.resolve(__dirname, 'stubs/llama-stub.js');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ── Monorepo: safe watchFolders (source trees only) ──────────────────────────
config.watchFolders = (config.watchFolders ?? []).filter(
  (f) => existsSync(f) && !f.includes('node_modules'),
);

// ── Singleton packages ────────────────────────────────────────────────────────
// In Yarn workspace monorepos, root node_modules has React v19.2.8 while
// apps/mobile node_modules has React v19.0.0. To prevent "Invalid hook call"
// and silent black-screen crashes, all workspace packages (@dressapp/*) MUST
// resolve React and related singletons from apps/mobile/node_modules.
const SINGLETONS = [
  'react',
  'react-dom',
  'react-native',
  'react-native-paper',
  'react-native-safe-area-context',
  'react-i18next',
  'i18next',
  '@react-navigation/native',
  '@react-navigation/native-stack',
  '@react-navigation/bottom-tabs',
];

const extraNodeModules = {
  'llama.rn': LLAMA_STUB,
};

SINGLETONS.forEach((mod) => {
  extraNodeModules[mod] = path.resolve(projectRoot, 'node_modules', mod);
});

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  sourceExts: [
    ...config.resolver.sourceExts,
    'cjs',
  ],
  extraNodeModules,
  resolveRequest: (context, moduleName, platform) => {
    // Redirect all singleton imports across monorepo to apps/mobile/node_modules
    if (SINGLETONS.includes(moduleName) || moduleName.startsWith('react/') || moduleName.startsWith('react-native/')) {
      const canonical = path.resolve(projectRoot, 'node_modules', moduleName);
      if (existsSync(canonical)) {
        return context.resolveRequest(
          { ...context, originModulePath: path.resolve(projectRoot, 'package.json') },
          moduleName,
          platform,
        );
      }
    }

    if (moduleName === 'llama.rn') {
      return {
        type: 'sourceFile',
        filePath: LLAMA_STUB,
      };
    }

    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
