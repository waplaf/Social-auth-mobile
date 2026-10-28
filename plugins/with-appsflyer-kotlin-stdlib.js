const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '// Keep AppsFlyer Kotlin stdlib aligned with Expo SDK 57.';
const SETTING = `${MARKER}\next.kotlin_stdlib_version = "2.1.20"`;

module.exports = function withAppsFlyerKotlinStdlib(config) {
  return withProjectBuildGradle(config, (config) => {
    const { modResults } = config;

    if (!modResults.contents.includes(MARKER)) {
      modResults.contents = `${modResults.contents.trimEnd()}\n\n${SETTING}\n`;
    }

    return config;
  });
};
