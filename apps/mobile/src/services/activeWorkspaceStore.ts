/**
 * Active workspace persistence via SecureStore.
 * Keeps the user's last-selected active workspace ID between app sessions.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'briefly-active-workspace-id';

/**
 * Returns the persisted active workspace ID, or null if none set.
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(KEY);
    } catch {
        return null;
    }
}

/**
 * Persists a workspace ID as the active workspace.
 */
export async function setActiveWorkspaceId(id: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, id);
}

/**
 * Clears the persisted active workspace ID.
 */
export async function clearActiveWorkspaceId(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(KEY);
    } catch {
        // Non-critical — ignore
    }
}
