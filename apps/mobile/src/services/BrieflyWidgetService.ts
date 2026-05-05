/**
 * BrieflyWidgetService — JS bridge to Android native widget refresh.
 *
 * Calls BrieflyWidgetModule.updateTodayWidget() via Expo Modules API
 * to force an immediate widget update after a cache write.
 * Safe no-op on non-Android or if module unavailable.
 *
 * PM-10D.3
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type BrieflyWidgetNative = {
    updateTodayWidget?: () => Promise<void>;
};

export async function refreshTodayWidget(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
        const mod = requireOptionalNativeModule<BrieflyWidgetNative>('BrieflyWidget');

        if (!mod?.updateTodayWidget) {
            if (__DEV__) {
                console.log('[BrieflyWidgetService] native module unavailable');
            }
            return;
        }

        if (__DEV__) {
            console.log('[BrieflyWidgetService] requested widget refresh');
        }

        await mod.updateTodayWidget();
    } catch {
        if (__DEV__) {
            console.log('[BrieflyWidgetService] widget refresh failed');
        }
    }
}