/**
 * withNetworkSecurityConfig
 *
 * Expo Config Plugin que inyecta network_security_config.xml en el proyecto
 * Android generado por prebuild para permitir HTTP cleartext ONLY hacia
 * briefly.ddns.net durante la fase de desarrollo/demo (HTTP temporal).
 *
 * PM-06B: Este plugin asegura que la configuración de cleartext sea
 * reproducible sin necesidad de versionar android/.
 *
 * NO usar en producción con HTTPS real (DEPLOY-01D).
 */

const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">briefly.ddns.net</domain>
  </domain-config>
</network-security-config>
`;

const XML_TARGET_PATH = 'app/src/main/res/xml/network_security_config.xml';

/**
 * Adds android:networkSecurityConfig="@xml/network_security_config"
 * to the <application> element in AndroidManifest.xml.
 */
const withNetworkSecurityConfig = (config) => {
  // 1. Inject android:networkSecurityConfig into <application>
  config = withAndroidManifest(config, async (config) => {
    // config.modResults is the full AndroidManifest object
    // The <application> tag is at config.modResults.manifest.application[0]
    const manifest = config.modResults;
    const appElement = manifest.manifest?.application?.[0];

    if (!appElement) {
      console.warn('[withNetworkSecurityConfig] No <application> element found in manifest');
      return config;
    }
    if (!appElement.$) appElement.$ = {};
    if (appElement.$['android:networkSecurityConfig']) {
      console.log('[withNetworkSecurityConfig] android:networkSecurityConfig already set');
      return config;
    }
    appElement.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    console.log('[withNetworkSecurityConfig] Injected android:networkSecurityConfig into manifest');
    return config;
  });

  // 2. Write the network_security_config.xml using withDangerousMod
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const targetPath = path.join(androidRoot, XML_TARGET_PATH);
      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, NETWORK_SECURITY_CONFIG_XML, 'utf8');
      console.log(`[withNetworkSecurityConfig] Wrote ${targetPath}`);
      return config;
    },
  ]);

  return config;
};

module.exports = withNetworkSecurityConfig;
