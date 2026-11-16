const { withAndroidManifest, withDangerousMod, withGradleProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const R8_RULES_MARKER = '# --- DressApp R8 / Play Console Deobfuscation Rules ---';
const R8_KEEP_RULES = `
${R8_RULES_MARKER}
-keepattributes LineNumberTable,SourceFile
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class expo.modules.** { *; }
-keep class * extends expo.modules.kotlin.modules.Module { *; }
-keep class * extends expo.modules.kotlin.views.ViewManagerDefinition { *; }
-keep class com.swmansion.** { *; }
-keep class com.bumptech.glide.** { *; }
-dontwarn com.bumptech.glide.**
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class com.project.dressapp.** { *; }
-keep class co.dressapp.mobile.** { *; }
`;

function upsertGradleProperty(properties, key, value) {
  const existing = properties.find((prop) => prop.type === 'property' && prop.key === key);
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

/**
 * Expo Config Plugin to enforce Google Play Store Android 15 & 16 requirements:
 * 1. Remove orientation restrictions & enable resizability for large screens (tablets/foldables).
 * 2. Override GmsBarcodeScanningDelegateActivity orientation to unspecified & resizeable.
 * 3. Provide clean values-v35/styles.xml without deprecated bar coloring APIs.
 * 4. Enable edge-to-edge support, R8 code/resource shrinking, and ARM ABIs in gradle properties.
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

  // 2. Configure edge-to-edge, R8 minification/deobfuscation, resource shrinking, and ARM ABIs
  config = withGradleProperties(config, (modConfig) => {
    const gradleOverrides = {
      'expo.edgeToEdgeEnabled': 'true',
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableProguardInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableR8.fullMode': 'true',
      'android.r8.optimizedResourceShrinking': 'true',
      reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
    };
    for (const [key, value] of Object.entries(gradleOverrides)) {
      upsertGradleProperty(modConfig.modResults, key, value);
    }
    return modConfig;
  });

  // 3. Add values-v35/styles.xml and R8 keep rules for clean stack traces & runtime safety
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const platformRoot = modConfig.modRequest.platformProjectRoot;
      const v35Dir = path.join(platformRoot, 'app/src/main/res/values-v35');
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

      const proguardPath = path.join(platformRoot, 'app/proguard-rules.pro');
      const existingProguard = fs.existsSync(proguardPath) ? fs.readFileSync(proguardPath, 'utf8') : '';
      if (!existingProguard.includes(R8_RULES_MARKER)) {
        fs.writeFileSync(proguardPath, `${existingProguard.trimEnd()}\n${R8_KEEP_RULES}`, 'utf8');
      }
      return modConfig;
    },
  ]);

  return config;
};

module.exports = withGooglePlayRequirements;
