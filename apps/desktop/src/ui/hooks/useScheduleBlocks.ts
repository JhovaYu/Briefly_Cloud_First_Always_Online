/**
 * useScheduleBlocks — React hook for cloud schedule blocks.
 *
 * Requires workspaceId to be non-null and enabled=true to function.
 * When disabled or workspaceId is null, returns empty state and no-ops.
 */

import { useState, useCallback, useEffect } from 'react';
import { ScheduleApiClient } from '@tuxnotas/shared';
import type {
    ScheduleBlock,
    CreateScheduleBlockInput,
    UpdateScheduleBlockInput,
} from '@tuxnotas/shared';

export interface UseScheduleBlocksResult {
    blocks: ScheduleBlock[];
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createBlock: (input: CreateScheduleBlockInput) => Promise<ScheduleBlock | null>;
    updateBlock: (blockId: string, patch: UpdateScheduleBlockInput) => Promise<ScheduleBlock | null>;
    deleteBlock: (blockId: string) => Promise<boolean>;
}

export function useScheduleBlocks(
    client: ScheduleApiClient,
    workspaceId: string | null,
    enabled: boolean,
): UseScheduleBlocksResult {
    const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAll = useCallback(async () => {
        if (!enabled || !workspaceId) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetched = await client.listScheduleBlocks(workspaceId);
            setBlocks(fetched);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setIsLoading(false);
            setIsInitialized(true);
        }
    }, [client, enabled, workspaceId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const refresh = useCallback(async () => {
        await loadAll();
    }, [loadAll]);

    const createBlock = useCallback(
        async (input: CreateScheduleBlockInput): Promise<ScheduleBlock | null> => {
            if (!enabled || !workspaceId) return null;
            try {
                const created = await client.createScheduleBlock(workspaceId, input);
                setBlocks(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId],
    );

    const updateBlock = useCallback(
        async (blockId: string, patch: UpdateScheduleBlockInput): Promise<ScheduleBlock | null> => {
            if (!enabled || !workspaceId) return null;
            try {
                const updated = await client.updateScheduleBlock(workspaceId, blockId, patch);
                setBlocks(prev => prev.map(b => (b.id === blockId ? updated : b)));
                return updated;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId],
    );

    const deleteBlock = useCallback(
        async (blockId: string): Promise<boolean> => {
            if (!enabled || !workspaceId) return false;
            try {
                await client.deleteScheduleBlock(workspaceId, blockId);
                setBlocks(prev => prev.filter(b => b.id !== blockId));
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return false;
            }
        },
        [client, enabled, workspaceId],
    );

    return { blocks, isLoading, isInitialized, error, refresh, createBlock, updateBlock, deleteBlock };
}