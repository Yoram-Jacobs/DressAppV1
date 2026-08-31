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
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
    ],
    plugins: [
      'react-native-reanimated/plugin',
      ['module-resolver', {
        root: ['./'],
        alias: {
          '@mobile': './src',
          '@dressapp/api-client': '../../packages/api-client/src/index.js',
          '@dressapp/i18n': '../../packages/i18n/src/index.js',
          '@dressapp/types': '../../packages/types/src/index.js',
          '@dressapp/eyes-native': '../../packages/eyes-native/src/index.ts',
        },
      }],
    ],
  };
};
