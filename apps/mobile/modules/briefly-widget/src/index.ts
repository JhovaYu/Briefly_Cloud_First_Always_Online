import { requireOptionalNativeModule } from 'expo-modules-core';

type BrieflyWidgetNative = {
    updateTodayWidget?: () => Promise<void>;
};

const NativeModule =
    requireOptionalNativeModule<BrieflyWidgetNative>('BrieflyWidget');

export async function updateTodayWidget(): Promise<void> {
    await NativeModule?.updateTodayWidget?.();
}