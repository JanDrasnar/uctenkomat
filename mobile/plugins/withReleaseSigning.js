// Release build podepsaný vlastním upload klíčem (Google Play). Klíč se do
// repozitáře nikdy nedává — CI ho dostane z GitHub secrets a předá cestou
// a hesly v proměnných prostředí. Bez nich zůstane podpis debug klíčem
// (testovací APK), takže lokální build i test-build fungují jako dřív.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (System.getenv('UPLOAD_KEYSTORE_PATH')) {
                storeFile file(System.getenv('UPLOAD_KEYSTORE_PATH'))
                storePassword System.getenv('UPLOAD_KEYSTORE_PASSWORD')
                keyAlias System.getenv('UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("UPLOAD_KEYSTORE_PATH")) return cfg;

    // 1) přidej signingConfigs.release vedle debug
    gradle = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_SIGNING}`);

    // 2) buildTypes.release: vlastní klíč, pokud je k dispozici
    const bt = gradle.indexOf('buildTypes');
    const head = gradle.slice(0, bt);
    const tail = gradle.slice(bt).replace(
      /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('UPLOAD_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug",
    );
    if (tail === gradle.slice(bt)) {
      throw new Error('withReleaseSigning: v build.gradle nenalezen release signingConfig');
    }
    cfg.modResults.contents = head + tail;
    return cfg;
  });
};
