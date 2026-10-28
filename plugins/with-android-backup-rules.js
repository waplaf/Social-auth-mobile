const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidBackupRules(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.$['android:fullBackupContent'] = '@xml/secure_store_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/secure_store_data_extraction_rules';
    const replacements = new Set(
      (application.$['tools:replace'] || '').split(',').map((value) => value.trim()).filter(Boolean)
    );

    // Keep SecureStore's backup exclusions when AppsFlyer declares its own rules.
    for (const attribute of ['android:fullBackupContent', 'android:dataExtractionRules']) {
      if (application.$[attribute]) {
        replacements.add(attribute);
      }
    }

    if (replacements.size) {
      application.$['tools:replace'] = [...replacements].join(',');
    }
    return config;
  });
};
