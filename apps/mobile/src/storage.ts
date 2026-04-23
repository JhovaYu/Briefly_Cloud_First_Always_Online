import * as SecureStore from 'expo-secure-store';
import type { UserProfile, PoolInfo } from '@tuxnotas/shared';

const USER_KEY = 'fluent-user-profile';
const POOLS_KEY = 'fluent-pools';

export async function getUserProfile(): Promise<UserProfile | null> {
    try {
        const json = await SecureStore.getItemAsync(USER_KEY);
        return json ? JSON.parse(json) : null;
    } catch { return null; }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profile));
}

export type AppSettings = {
    fontSizeMultiplier: number;
};
const SETTINGS_KEY = 'fluent-settings';

export async function getSettings(): Promise<AppSettings> {
    try {
        const json = await SecureStore.getItemAsync(SETTINGS_KEY);
        return json ? JSON.parse(json) : { fontSizeMultiplier: 1 };
    } catch { return { fontSizeMultiplier: 1 }; }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
}

export async function getSavedPools(): Promise<PoolInfo[]> {
    try {
        const json = await SecureStore.getItemAsync(POOLS_KEY);
        return json ? JSON.parse(json) : [];
    } catch { return []; }
}

export async function savePools(pools: PoolInfo[]): Promise<void> {
    await SecureStore.setItemAsync(POOLS_KEY, JSON.stringify(pools));
}

export async function addPool(pool: PoolInfo): Promise<void> {
    const pools = await getSavedPools();
    const existing = pools.findIndex(p => p.id === pool.id);
    if (existing >= 0) {
        pools[existing] = pool;
    } else {
        pools.push(pool);
    }
    await savePools(pools);
}

export async function updatePoolLastOpened(poolId: string): Promise<void> {
    const pools = await getSavedPools();
    const existing = pools.find(p => p.id === poolId);
    if (existing) {
        existing.lastOpened = Date.now();
        await savePools(pools);
    }
}

export async function removePool(poolId: string): Promise<void> {
    const pools = await getSavedPools();
    const filtered = pools.filter(p => p.id !== poolId);
    await savePools(filtered);
}
