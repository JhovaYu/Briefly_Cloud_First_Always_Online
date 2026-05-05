/**
 * TodayCacheService — atomic JSON cache writer for Android widget.
 *
 * Writes today_widget_cache.json to FileSystem.documentDirectory.
 * Atomic: write to .tmp, then move to final path.
 *
 * NO tokens, NO secrets, NO user data logged.
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { TodayData } from '../types/TodayData';
import { refreshTodayWidget } from './BrieflyWidgetService';

export const CACHE_FILE_NAME = 'today_widget_cache.json';

/** Full URI for the cache file inside the app sandbox. */
export function getTodayCacheUri(): string {
    return `${FileSystem.documentDirectory ?? ''}${CACHE_FILE_NAME}`;
}

/** Human-readable hint for ADB QA (no file:// prefix). */
export function getTodayCacheAdbPath(): string {
    return `files/${CACHE_FILE_NAME}`;
}

function getTmpUri(): string {
    return `${FileSystem.documentDirectory ?? ''}${CACHE_FILE_NAME}.tmp`;
}

/**
 * Writes TodayData atomically to the cache file.
 * 1. JSON-serialise the payload.
 * 2. Write to .tmp.
 * 3. Delete existing final (idempotent).
 * 4. Move .tmp → final.
 * 5. Log only path and byte count.
 *
 * Silently skips on error — widget will fall back to stale=true.
 */
export async function writeTodayCache(data: TodayData): Promise<void> {
    try {
        const finalUri = getTodayCacheUri();
        const tmpUri = getTmpUri();
        const json = JSON.stringify(data);
        const bytes = new TextEncoder().encode(json).length;

        await FileSystem.writeAsStringAsync(tmpUri, json, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        const finalInfo = await FileSystem.getInfoAsync(finalUri);
        if (finalInfo.exists) {
            await FileSystem.deleteAsync(finalUri, { idempotent: true });
        }

        await FileSystem.moveAsync({ from: tmpUri, to: finalUri });

        console.log(`TodayCache written: ${getTodayCacheAdbPath()} (${bytes} bytes)`);
        await refreshTodayWidget();
    } catch (err) {
        console.warn('[TodayCacheService] writeTodayCache failed:', String(err));
    }
}

/**
 * Reads the cache file (used by QA verification only).
 * Returns null if file doesn't exist or is unreadable.
 */
export async function readTodayCache(): Promise<TodayData | null> {
    try {
        const finalUri = getTodayCacheUri();
        const info = await FileSystem.getInfoAsync(finalUri);
        if (!info.exists) return null;
        const json = await FileSystem.readAsStringAsync(finalUri, {
            encoding: FileSystem.EncodingType.UTF8,
        });
        return JSON.parse(json) as TodayData;
    } catch {
        return null;
    }
}