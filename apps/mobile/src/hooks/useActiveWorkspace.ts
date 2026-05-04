/**
 * useActiveWorkspace — resolves the active workspace ID with fallback logic.
 *
 * Reads persisted active workspace from SecureStore, validates it against
 * the current workspaces list, and falls back to the first workspace if needed.
 *
 * Exposes: activeWorkspaceId, activeWorkspace, loading
 */

import { useState, useEffect } from 'react';
import { useWorkspaces } from './useWorkspaces';
import { getActiveWorkspaceId, setActiveWorkspaceId } from '../services/activeWorkspaceStore';

export interface ActiveWorkspaceInfo {
    activeWorkspaceId: string | null;
    activeWorkspaceName: string;
    setActiveWorkspace: (id: string) => Promise<void>;
    loading: boolean;
}

/**
 * Hook to resolve and set the active workspace.
 * Reads stored ID → validates against workspaces list → falls back to first.
 */
export function useActiveWorkspace(): ActiveWorkspaceInfo {
    const { data: workspaces, isLoading } = useWorkspaces();
    const [activeWorkspaceId, setActiveId] = useState<string | null>(null);

    // Sync stored ID on mount
    useEffect(() => {
        getActiveWorkspaceId().then(id => {
            if (id) setActiveId(id);
        });
    }, []);

    // Validate stored ID still exists in workspaces list
    useEffect(() => {
        if (!workspaces || activeWorkspaceId === null) return;
        const exists = workspaces.some(ws => ws.id === activeWorkspaceId);
        if (!exists) {
            // Stored ID no longer valid — clear it (will fallback below)
            setActiveId(null);
        }
    }, [workspaces, activeWorkspaceId]);

    // Determine effective workspace (runs whenever id/list changes)
    const activeWorkspace = workspaces?.find(ws => ws.id === activeWorkspaceId) ?? workspaces?.[0] ?? null;

    const setActiveWorkspace = async (id: string) => {
        await setActiveWorkspaceId(id);
        setActiveId(id);
    };

    return {
        activeWorkspaceId: activeWorkspace?.id ?? null,
        activeWorkspaceName: activeWorkspace?.name ?? '',
        setActiveWorkspace,
        loading: isLoading && activeWorkspaceId === null,
    };
}
