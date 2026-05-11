/**
 * usePlanningTasks — React hook for cloud planning tasks.
 *
 * Supports two scopes:
 * - 'workspace': fetches tasks for a single workspaceId (original behavior)
 * - 'global': fetches tasks from all workspaces, merges and filters by user
 *
 * When disabled, returns empty state and no-ops.
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
import type { WorkspaceService } from '@tuxnotas/shared';

export type TaskScope = 'workspace' | 'global';

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

interface UsePlanningTasksConfig {
    scope: TaskScope;
    workspaceId: string | null;
    enabled: boolean;
    /** Used in global scope to list all workspaces */
    workspaceService?: WorkspaceService | null;
    /** Current user ID for filtering global tasks */
    currentUserId?: string;
    /** Stable workspace ID used as creation target in global scope */
    globalDefaultWorkspaceId?: string | null;
    /** Timeout in ms for global scope requests (default 10000) */
    globalTimeoutMs?: number;
}

export function usePlanningTasks(
    client: PlanningApiClient,
    config: UsePlanningTasksConfig,
): UsePlanningTasksResult {
    const {
        scope,
        workspaceId,
        enabled,
        workspaceService,
        currentUserId,
        globalDefaultWorkspaceId,
        globalTimeoutMs = 10000,
    } = config;

    const [taskLists, setTaskLists] = useState<PlanningTaskList[]>([]);
    const [tasks, setTasks] = useState<PlanningTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isGlobal = scope === 'global';

    const loadWorkspaceTasks = useCallback(
        async (wsId: string): Promise<{ lists: PlanningTaskList[]; tasks: PlanningTask[] }> => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), globalTimeoutMs);

            try {
                const [lists, wsTasks] = await Promise.all([
                    client.listTaskLists(wsId),
                    client.listTasks(wsId),
                ]);
                return { lists, tasks: wsTasks };
            } finally {
                clearTimeout(timeout);
            }
        },
        [client, globalTimeoutMs],
    );

    const loadGlobalTasks = useCallback(async () => {
        if (!workspaceService || !currentUserId) return;

        setIsLoading(true);
        setError(null);

        try {
            const workspaces = await workspaceService.listWorkspaces();

            const results = await Promise.allSettled(
                workspaces.map(ws => loadWorkspaceTasks(ws.id)),
            );

            const allLists: PlanningTaskList[] = [];
            const allTasks: PlanningTask[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allLists.push(...result.value.lists);
                    allTasks.push(...result.value.tasks);
                } else {
                    console.warn('[usePlanningTasks] Workspace fetch failed:', result.reason);
                }
            }

            // Filter tasks belonging to current user
            const userTasks = allTasks.filter(
                t => t.assignee_id === currentUserId || t.created_by === currentUserId,
            );

            // Sort by due_date ASC, nulls last
            userTasks.sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return a.due_date.localeCompare(b.due_date);
            });

            setTaskLists(allLists);
            setTasks(userTasks);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setIsLoading(false);
            setIsInitialized(true);
        }
    }, [workspaceService, currentUserId, loadWorkspaceTasks]);

    const loadWorkspaceTasksForScope = useCallback(async () => {
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

    const loadAll = useCallback(async () => {
        if (isGlobal) {
            await loadGlobalTasks();
        } else {
            await loadWorkspaceTasksForScope();
        }
    }, [isGlobal, loadGlobalTasks, loadWorkspaceTasksForScope]);

    // Auto-fetch when config changes
    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const refresh = useCallback(async () => {
        await loadAll();
    }, [loadAll]);

    const createTaskList = useCallback(
        async (input: CreatePlanningTaskListInput): Promise<PlanningTaskList | null> => {
            if (!enabled) return null;
            const targetWorkspaceId = isGlobal ? (globalDefaultWorkspaceId ?? null) : workspaceId;
            if (!targetWorkspaceId) return null;
            try {
                const created = await client.createTaskList(targetWorkspaceId, input);
                setTaskLists(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId, isGlobal, globalDefaultWorkspaceId],
    );

    const createTask = useCallback(
        async (input: CreatePlanningTaskInput): Promise<PlanningTask | null> => {
            if (!enabled) return null;
            const targetWorkspaceId = isGlobal ? (globalDefaultWorkspaceId ?? null) : workspaceId;
            if (!targetWorkspaceId) return null;
            try {
                const created = await client.createTask(targetWorkspaceId, input);
                setTasks(prev => [...prev, created]);
                return created;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId, isGlobal, globalDefaultWorkspaceId],
    );

    const updateTask = useCallback(
        async (taskId: string, patch: UpdatePlanningTaskInput): Promise<PlanningTask | null> => {
            const targetWorkspaceId = isGlobal
                ? (tasks.find(t => t.id === taskId)?.workspace_id ?? null)
                : workspaceId;
            if (!enabled || !targetWorkspaceId) return null;
            try {
                const updated = await client.updateTask(targetWorkspaceId, taskId, patch);
                setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
                return updated;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return null;
            }
        },
        [client, enabled, workspaceId, isGlobal, tasks],
    );

    const deleteTask = useCallback(
        async (taskId: string): Promise<boolean> => {
            const targetWorkspaceId = isGlobal
                ? (tasks.find(t => t.id === taskId)?.workspace_id ?? null)
                : workspaceId;
            if (!enabled || !targetWorkspaceId) return false;
            try {
                await client.deleteTask(targetWorkspaceId, taskId);
                setTasks(prev => prev.filter(t => t.id !== taskId));
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                return false;
            }
        },
        [client, enabled, workspaceId, isGlobal, tasks],
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