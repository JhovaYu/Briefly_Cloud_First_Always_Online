/**
 * BrieflyWidgetService — JS bridge to Android native widget refresh.
 *
 * Calls BrieflyWidgetModule.updateTodayWidget() to force an immediate
 * widget update after a cache write. Safe no-op on non-Android.
 *
 * PM-10D.3
 */

import { Platform } from 'react-native';
import { NativeModules } from 'react-native';

type BrieflyWidgetNative = {
    updateTodayWidget?: () => Promise<void>;
};

export async function refreshTodayWidget(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
        const mod = (NativeModules as Record<string, unknown>)['BrieflyWidget'] as BrieflyWidgetNative | undefined;
        if (!mod?.updateTodayWidget) return;
        await mod.updateTodayWidget();
    } catch {
        // best-effort: never block cache writes
    }
}