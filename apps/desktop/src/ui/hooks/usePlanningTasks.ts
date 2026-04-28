/**
 * usePlanningTasks — React hook for cloud planning tasks.
 *
 * Requires workspaceId to be non-null and enabled=true to function.
 * When disabled or workspaceId is null, returns empty state and no-ops.
 */

import { useState, useCallback, useRef } from 'react';
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
    const [error, setError] = useState<string | null>(null);

    const workspaceIdRef = useRef(workspaceId);
    workspaceIdRef.current = workspaceId;

    const loadAll = useCallback(async () => {
        if (!enabled || !workspaceIdRef.current) return;
        setIsLoading(true);
        setError(null);
        try {
            const [lists, allTasks] = await Promise.all([
                client.listTaskLists(workspaceIdRef.current),
                client.listTasks(workspaceIdRef.current),
            ]);
            setTaskLists(lists);
            setTasks(allTasks);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [client, enabled]);

    const refresh = useCallback(async () => {
        await loadAll();
    }, [loadAll]);

    const createTaskList = useCallback(
        async (input: CreatePlanningTaskListInput): Promise<PlanningTaskList | null> => {
            if (!enabled || !workspaceIdRef.current) return null;
            try {
                const created = await client.createTaskList(workspaceIdRef.current, input);
                setTaskLists(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled],
    );

    const createTask = useCallback(
        async (input: CreatePlanningTaskInput): Promise<PlanningTask | null> => {
            if (!enabled || !workspaceIdRef.current) return null;
            try {
                const created = await client.createTask(workspaceIdRef.current, input);
                setTasks(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled],
    );

    const updateTask = useCallback(
        async (taskId: string, patch: UpdatePlanningTaskInput): Promise<PlanningTask | null> => {
            if (!enabled || !workspaceIdRef.current) return null;
            try {
                const updated = await client.updateTask(workspaceIdRef.current, taskId, patch);
                setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
                return updated;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled],
    );

    const deleteTask = useCallback(
        async (taskId: string): Promise<boolean> => {
            if (!enabled || !workspaceIdRef.current) return false;
            try {
                await client.deleteTask(workspaceIdRef.current, taskId);
                setTasks(prev => prev.filter(t => t.id !== taskId));
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return false;
            }
        },
        [client, enabled],
    );

    return {
        taskLists,
        tasks,
        isLoading,
        error,
        refresh,
        createTaskList,
        createTask,
        updateTask,
        deleteTask,
    };
}
