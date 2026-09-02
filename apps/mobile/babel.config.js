/**
 * apps/mobile/babel.config.js
 *
 * NOTE: jsxImportSource 'NativeWind' removed — NativeWind's Metro CSS interop
 * was disabled to fix EAS build compatibility (LightningCSS native binary is
 * platform-specific). All screens use StyleSheet.create instead of className.
 *
 * All @dressapp/* workspace packages are aliased here so that Babel's
 * module-resolver can find them regardless of Metro's resolution order.
 */
const path = require('path');

module.exports = function (api) {
  api.cache(true);
  const srcDir = path.resolve(__dirname, 'src');
  const repoRoot = path.resolve(__dirname, '../..');

  return {
    presets: [
      'babel-preset-expo',
    ],
    plugins: [
      ['module-resolver', {
        root: [srcDir],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.cjs', '.mjs'],
        alias: {
          '@mobile': srcDir,
          '@dressapp/api-client': path.resolve(repoRoot, 'packages/api-client/src/index.js'),
          '@dressapp/i18n': path.resolve(repoRoot, 'packages/i18n/src/index.js'),
          '@dressapp/types': path.resolve(repoRoot, 'packages/types/src/index.js'),
          '@dressapp/eyes-native': path.resolve(repoRoot, 'packages/eyes-native/src/index.ts'),
        },
      }],
      'react-native-reanimated/plugin',
    ],
  };
};
