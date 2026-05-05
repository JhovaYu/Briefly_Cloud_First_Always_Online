/**
 * withTodayWidget
 *
 * Expo Config Plugin que inyecta el TodayWidgetProvider Kotlin,
 * el layout XML y el appwidget-info XML en el proyecto Android
 * generado por prebuild.
 *
 * PM-10D.2: Plugin idempotente — puede correr varias veces sin duplicar.
 */

const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const KOTLIN_SOURCE = path.join(__dirname, 'TodayWidgetProvider.kt');
const LAYOUT_SOURCE = path.join(__dirname, 'res', 'layout', 'today_widget.xml');
const XML_INFO_SOURCE = path.join(__dirname, 'res', 'xml', 'today_widget_info.xml');

const KOTLIN_TARGET = 'app/src/main/java/com/briefly/widget/TodayWidgetProvider.kt';
const LAYOUT_TARGET = 'app/src/main/res/layout/today_widget.xml';
const XML_INFO_TARGET = 'app/src/main/res/xml/today_widget_info.xml';

const withTodayWidget = (config) => {
  // 1. Copy Kotlin + XML files via withDangerousMod
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      // Copy Kotlin source
      const kotlinTarget = path.join(androidRoot, KOTLIN_TARGET);
      const kotlinDir = path.dirname(kotlinTarget);
      if (!fs.existsSync(kotlinDir)) {
        fs.mkdirSync(kotlinDir, { recursive: true });
      }
      fs.copyFileSync(KOTLIN_SOURCE, kotlinTarget);
      console.log(`[withTodayWidget] Copied Kotlin → ${kotlinTarget}`);

      // Copy layout XML
      const layoutTarget = path.join(androidRoot, LAYOUT_TARGET);
      const layoutDir = path.dirname(layoutTarget);
      if (!fs.existsSync(layoutDir)) {
        fs.mkdirSync(layoutDir, { recursive: true });
      }
      fs.copyFileSync(LAYOUT_SOURCE, layoutTarget);
      console.log(`[withTodayWidget] Copied layout → ${layoutTarget}`);

      // Copy appwidget-info XML
      const xmlTarget = path.join(androidRoot, XML_INFO_TARGET);
      const xmlDir = path.dirname(xmlTarget);
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      fs.copyFileSync(XML_INFO_SOURCE, xmlTarget);
      console.log(`[withTodayWidget] Copied info XML → ${xmlTarget}`);

      return config;
    },
  ]);

  // 2. Register receiver in AndroidManifest
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const appElement = manifest.manifest?.application?.[0];

    if (!appElement) {
      console.warn('[withTodayWidget] No <application> element found in manifest');
      return config;
    }

    // Check if receiver already registered (idempotent guard)
    const existingReceivers = appElement['receiver'] ?? [];
    const alreadyRegistered = existingReceivers.some(
      (r) => r.$?.['android:name'] === 'com.briefly.widget.TodayWidgetProvider'
    );
    if (alreadyRegistered) {
      console.log('[withTodayWidget] TodayWidgetProvider already registered, skipping');
      return config;
    }

    // Build the receiver element
    const receiverElement = {
      $: {
        'android:name': 'com.briefly.widget.TodayWidgetProvider',
        'android:exported': 'false',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/today_widget_info',
          },
        },
      ],
    };

    appElement['receiver'] = [...(existingReceivers), receiverElement];
    console.log('[withTodayWidget] Registered TodayWidgetProvider in AndroidManifest');
    return config;
  });

  return config;
};

module.exports = withTodayWidget;