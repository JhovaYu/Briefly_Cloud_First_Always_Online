/**
 * BrieflyWidgetService — JS bridge to Android native widget refresh.
 *
 * Imports the local briefly-widget Expo module which exposes
 * updateTodayWidget(). Safe no-op on non-Android.
 *
 * PM-10D.3
 */

import { Platform } from 'react-native';
import { updateTodayWidget as nativeUpdateTodayWidget } from '../../modules/briefly-widget/src';

export async function refreshTodayWidget(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
        await nativeUpdateTodayWidget();
        if (__DEV__) {
            console.log('[BrieflyWidgetService] widget refresh requested');
        }
    } catch {
        if (__DEV__) {
            console.log('[BrieflyWidgetService] widget refresh failed');
        }
    }
}