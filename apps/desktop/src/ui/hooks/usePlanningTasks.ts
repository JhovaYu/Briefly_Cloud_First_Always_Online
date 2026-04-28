/**
 * usePlanningTasks — React hook for cloud planning tasks.
 *
 * Requires workspaceId to be non-null and enabled=true to function.
 * When disabled or workspaceId is null, returns empty state and no-ops.
 */

import { useState, useCallback, useEffect } from 'react';
import { PlanningApiClient } from '@tuxnotas/shared';
import type {
    PlanningTask,
    PlanningTaskList,
    CreatePlanningTaskListInput,
    CreatePlanningTaskInput,
    UpdatePlanningTaskInput,
} from '@tuxnotas/shared';

export interface UsePlanningTasksResult {
    taskLists: PlanningTaskList[];
    tasks: PlanningTask[];
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createTaskList: (input: CreatePlanningTaskListInput) => Promise<PlanningTaskList | null>;
    createTask: (input: CreatePlanningTaskInput) => Promise<PlanningTask | null>;
    updateTask: (taskId: string, patch: UpdatePlanningTaskInput) => Promise<PlanningTask | null>;
    deleteTask: (taskId: string) => Promise<boolean>;
}

export function usePlanningTasks(
    client: PlanningApiClient,
    workspaceId: string | null,
    enabled: boolean,
): UsePlanningTasksResult {
    const [taskLists, setTaskLists] = useState<PlanningTaskList[]>([]);
    const [tasks, setTasks] = useState<PlanningTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAll = useCallback(async () => {
        if (!enabled || !workspaceId) return;
        setIsLoading(true);
        setError(null);
        try {
            const [lists, allTasks] = await Promise.all([
                client.listTaskLists(workspaceId),
                client.listTasks(workspaceId),
            ]);
            setTaskLists(lists);
            setTasks(allTasks);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setIsLoading(false);
            setIsInitialized(true);
        }
    }, [client, enabled, workspaceId]);

    // Auto-fetch when workspaceId appears (null → real id after bootstrap)
    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const refresh = useCallback(async () => {
        await loadAll();
    }, [loadAll]);

    const createTaskList = useCallback(
        async (input: CreatePlanningTaskListInput): Promise<PlanningTaskList | null> => {
            if (!enabled || !workspaceId) return null;
            try {
                const created = await client.createTaskList(workspaceId, input);
                setTaskLists(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId],
    );

    const createTask = useCallback(
        async (input: CreatePlanningTaskInput): Promise<PlanningTask | null> => {
            if (!enabled || !workspaceId) return null;
            try {
                const created = await client.createTask(workspaceId, input);
                setTasks(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId],
    );

    const updateTask = useCallback(
        async (taskId: string, patch: UpdatePlanningTaskInput): Promise<PlanningTask | null> => {
            if (!enabled || !workspaceId) return null;
            try {
                const updated = await client.updateTask(workspaceId, taskId, patch);
                setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
                return updated;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId],
    );

    const deleteTask = useCallback(
        async (taskId: string): Promise<boolean> => {
            if (!enabled || !workspaceId) return false;
            try {
                await client.deleteTask(workspaceId, taskId);
                setTasks(prev => prev.filter(t => t.id !== taskId));
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return false;
            }
        },
        [client, enabled, workspaceId],
    );

    return {
        taskLists,
        tasks,
        isLoading,
        isInitialized,
        error,
        refresh,
        createTaskList,
        createTask,
        updateTask,
        deleteTask,
    };
}
