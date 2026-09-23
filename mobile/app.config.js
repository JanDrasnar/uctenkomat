// Dynamická část konfigurace nad app.json: číslo verze pro Google Play
// (versionCode musí u každého nahrání růst — CI ho bere z čísla běhu)
// a podpis release buildu vlastním klíčem.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.VERSION_CODE) || 1,
  },
  plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning'],
});
