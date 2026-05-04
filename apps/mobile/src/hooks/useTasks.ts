import { useQuery } from '@tanstack/react-query';
import { fetchTasksWithDate } from '../services/planningClient';

/**
 * useTasks — fetches tasks for a workspace, optionally filtered by date.
 *
 * @param workspaceId - workspace to fetch tasks for (required)
 * @param date - YYYY-MM-DD string (optional). If provided, filters tasks by due_date.
 *               If omitted, returns all tasks (backward compatible).
 * @param getAccessToken - auth token getter from AuthContext
 */
export function useTasks(
    workspaceId: string | undefined,
    date: string | undefined,
    getAccessToken: () => string | null,
) {
    return useQuery({
        queryKey: ['tasks', workspaceId, date],
        queryFn: () => {
            if (!workspaceId) throw new Error('workspaceId required');
            return fetchTasksWithDate(workspaceId, date);
        },
        enabled: !!workspaceId,
    });
}
