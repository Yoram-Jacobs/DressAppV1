const { withAndroidManifest, withDangerousMod, withGradleProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to enforce Google Play Store Android 15 & 16 requirements:
 * 1. Remove orientation restrictions & enable resizability for large screens (tablets/foldables).
 * 2. Override GmsBarcodeScanningDelegateActivity orientation to unspecified & resizeable.
 * 3. Provide clean values-v35/styles.xml without deprecated bar coloring APIs.
 * 4. Enable edge-to-edge support in gradle properties.
 */
const withGooglePlayRequirements = (config) => {
  // 1. AndroidManifest modifications
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = manifest.application?.[0];
    if (application) {
      application.$['android:resizeableActivity'] = 'true';

      if (Array.isArray(application.activity)) {
        for (const act of application.activity) {
          if (act.$ && (act.$['android:name'] === '.MainActivity' || act.$['android:name'] === 'co.dressapp.mobile.MainActivity')) {
            act.$['android:screenOrientation'] = 'unspecified';
            act.$['android:resizeableActivity'] = 'true';
          }
        }

        // Add or replace GmsBarcodeScanningDelegateActivity override
        const gmsIdx = application.activity.findIndex(
          (act) => act.$ && act.$['android:name'] === 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity'
        );
        const gmsOverride = {
          $: {
            'android:name': 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity',
            'tools:replace': 'android:screenOrientation,android:resizeableActivity',
            'android:screenOrientation': 'unspecified',
            'android:resizeableActivity': 'true',
          },
        };

        if (gmsIdx >= 0) {
          application.activity[gmsIdx] = gmsOverride;
        } else {
          application.activity.push(gmsOverride);
        }
      }
    }

    return modConfig;
  });

  // 2. Add gradle property for edgeToEdge
  config = withGradleProperties(config, (modConfig) => {
    const properties = modConfig.modResults;
    const exists = properties.some((prop) => prop.type === 'property' && prop.key === 'expo.edgeToEdgeEnabled');
    if (!exists) {
      properties.push({
        type: 'property',
        key: 'expo.edgeToEdgeEnabled',
        value: 'true',
      });
    }
    return modConfig;
  });

  // 3. Add values-v35/styles.xml for clean edge-to-edge on Android 15+ (API 35+)
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const v35Dir = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/values-v35');
      if (!fs.existsSync(v35Dir)) {
        fs.mkdirSync(v35Dir, { recursive: true });
      }
      const stylesContent = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
    <item name="colorPrimary">@color/colorPrimary</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@drawable/ic_launcher_background</item>
  </style>
</resources>
`;
      fs.writeFileSync(path.join(v35Dir, 'styles.xml'), stylesContent, 'utf8');
      return modConfig;
    },
  ]);

  return config;
};

module.exports = withGooglePlayRequirements;
