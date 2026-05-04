import { useQuery } from '@tanstack/react-query';
import { fetchScheduleBlocksWithDate } from '../services/scheduleClient';

/**
 * useSchedule — fetches schedule blocks for a workspace, optionally filtered by date.
 *
 * @param workspaceId - workspace to fetch blocks for (required)
 * @param date - YYYY-MM-DD string (optional). If provided, filters blocks by day_of_week
 *               derived from the date. If omitted, returns all blocks (backward compatible).
 */
export function useSchedule(
    workspaceId: string | undefined,
    date: string | undefined,
) {
    return useQuery({
        queryKey: ['schedule', workspaceId, date],
        queryFn: () => {
            if (!workspaceId) throw new Error('workspaceId required');
            return fetchScheduleBlocksWithDate(workspaceId, date);
        },
        enabled: !!workspaceId,
    });
}
