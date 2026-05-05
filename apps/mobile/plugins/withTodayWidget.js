/**
 * withTodayWidget
 *
 * Expo Config Plugin que inyecta el TodayWidgetProvider Kotlin,
 * el layout XML y el appwidget-info XML en el proyecto Android
 * generado por prebuild.
 *
 * PM-10D.3: renderer + module ahora viven en modules/briefly-widget/
 * y se autoconectan via expo autolinking. Plugin solo copia lo
 * que debe existir en android/app/src/main/:
 *   - TodayWidgetProvider.kt (provider)
 *   - today_widget.xml (layout)
 *   - today_widget_info.xml (config)
 */

const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const PLUGIN_DIR = path.join(__dirname, 'today-widget');

const KOTLIN_SOURCE = path.join(PLUGIN_DIR, 'TodayWidgetProvider.kt');
const LAYOUT_SOURCE = path.join(PLUGIN_DIR, 'res', 'layout', 'today_widget.xml');
const XML_INFO_SOURCE = path.join(PLUGIN_DIR, 'res', 'xml', 'today_widget_info.xml');

const KOTLIN_TARGET = 'app/src/main/java/com/briefly/mobile/TodayWidgetProvider.kt';
const LAYOUT_TARGET = 'app/src/main/res/layout/today_widget.xml';
const XML_INFO_TARGET = 'app/src/main/res/xml/today_widget_info.xml';

const withTodayWidget = (config) => {
  // 1. Copy Kotlin + XML files via withDangerousMod
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      const copies = [
        [KOTLIN_SOURCE, KOTLIN_TARGET, 'Provider'],
        [LAYOUT_SOURCE, LAYOUT_TARGET, 'layout'],
        [XML_INFO_SOURCE, XML_INFO_TARGET, 'info XML'],
      ];

      for (const [source, relativeTarget, label] of copies) {
        const target = path.join(androidRoot, relativeTarget);
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(source, target);
        console.log(`[withTodayWidget] Copied ${label} → ${target}`);
      }

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
      (r) => r.$?.['android:name'] === 'com.briefly.mobile.TodayWidgetProvider'
    );
    if (alreadyRegistered) {
      console.log('[withTodayWidget] TodayWidgetProvider already registered, skipping');
      return config;
    }

    // Build the receiver element
    const receiverElement = {
      $: {
        'android:name': 'com.briefly.mobile.TodayWidgetProvider',
        'android:exported': 'true',
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