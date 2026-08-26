# Project Inspection Problems - 2026-08-21

This document summarizes the current errors and warnings found in the DressApp mobile application's Android configuration. These issues need to be resolved to ensure successful builds and proper IDE functionality.

## AndroidManifest.xml Issues

Located at: `apps/mobile/android/app/src/main/AndroidManifest.xml`

### 1. Unresolved Class References
- **MainApplication**: The class `.MainApplication` is unresolved. 
  - *Location*: Line 18
  - *Context*: `<application android:name=".MainApplication" ...>`
- **MainActivity**: The class `.MainActivity` is unresolved.
  - *Location*: Line 26
  - *Context*: `<activity android:name=".MainActivity" ...>`

*Potential Cause*: Package name mismatch or incorrect source set configuration in the IDE/Gradle.

### 2. Invalid Attribute Placement Errors
The IDE flags several standard Android attributes as "not allowed here". This may indicate a schema validation issue or structural error in the XML that confuses the analyzer.

- **Queries Tag**: `android:scheme` is flagged as not allowed in `<data android:scheme="https"/>` inside the `<queries>` block. (Line 15)
- **Application Tag**: The following attributes are flagged as "not allowed here" on the `<application>` tag (Line 18):
    - `android:icon`
    - `android:roundIcon`
    - `android:allowBackup`
    - `android:supportsRtl`
    - `android:fullBackupContent`
    - `android:dataExtractionRules`
- **Activity Tag**: The following attributes are flagged as "not allowed here" on the `<activity>` tag (Line 26):
    - `android:configChanges`
    - `android:launchMode`
    - `android:windowSoftInputMode`
    - `android:theme`
    - `android:screenOrientation`

### 3. Resource Resolution Warnings
While not explicitly listed as errors, the unresolved attributes often point to missing or unindexed resources:
- `@string/app_name`
- `@mipmap/ic_launcher`
- `@mipmap/ic_launcher_round`
- `@style/AppTheme`
- `@xml/secure_store_backup_rules`
- `@xml/secure_store_data_extraction_rules`

---

## Gradle Configuration Warnings

### build.gradle
- **Link Reference**: A warning exists on Line 62 regarding a link to React Native CLI documentation.
  - *Context*: `// See https://github.com/react-native-community/cli/blob/main/docs/commands.md#bundle`

---

## Suggested Actions for Resolution
1. **Verify Package Names**: Ensure the `package="co.dressapp.mobile"` in `AndroidManifest.xml` matches the `namespace` in `build.gradle` and the actual directory structure of the Kotlin files.
2. **Sync Project with Gradle**: Perform a "Sync Project with Gradle Files" to refresh the IDE's internal model and resolve class references.
3. **Invalidate Caches**: If the "not allowed here" errors persist despite correct XML structure, try "Invalidate Caches / Restart".
4. **Check Resource Files**: Verify that all `@xml`, `@string`, and `@style` resources referenced in the manifest actually exist in `res/` directories.
