/**
 * useTodaySummary — aggregates schedule + task data for the Today Dashboard.
 *
 * Migrated to React Query hooks in PM-10B.1c.
 * - Uses useWorkspaces() / useTasks() / useSchedule() for data fetching
 * - date param uses LOCAL device date (getLocalDateString), NOT UTC
 * - Maintains identical return shape: loading, error, refresh,
 *   nextScheduleBlock, pendingTasksCount, topTasks, workspaceName
 *
 * Does NOT accept getAccessToken — fetchWithAuth handles tokens internally
 * via supabase.auth.getSession() per request.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaces } from './useWorkspaces';
import { useTasks } from './useTasks';
import { useSchedule } from './useSchedule';
import { getLocalDateString } from '../utils/dateUtils';
import type { ScheduleBlock } from '../services/scheduleClient';
import type { PlanningTask } from '@tuxnotas/shared/src/domain/Entities';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDayOfWeek(): number {
    // JS: 0=Sun, 1=Mon ... 6=Sat; ScheduleBlock: 0=Monday ... 6=Sunday
    const jsDow = new Date().getDay(); // 0=Sun
    if (jsDow === 0) return 6; // Sun → 6
    return jsDow - 1; // Mon(1)→0, Tue(2)→1, ...
}

function parseHhmm(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function nowMinutes(): number {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

function findNextScheduleBlock(blocks: ScheduleBlock[]): ScheduleBlock | null {
    const todayDow = getTodayDayOfWeek();
    const todayBlocks = blocks.filter(b => b.day_of_week === todayDow);
    if (todayBlocks.length === 0) return null;

    todayBlocks.sort((a, b) => a.start_time.localeCompare(b.start_time));

    const now = nowMinutes();
    for (const block of todayBlocks) {
        const start = parseHhmm(block.start_time);
        if (start >= now) return block;
    }

    // All passed today — return first (wrap not needed for MVP)
    return todayBlocks[0];
}

// ── Interface ───────────────────────────────────────────────────────────────

export interface TodaySummary {
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    nextScheduleBlock: ScheduleBlock | null;
    pendingTasksCount: number;
    topTasks: PlanningTask[];
    workspaceName: string;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTodaySummary(): TodaySummary {
    const queryClient = useQueryClient();
    const todayDate = getLocalDateString();

    // Fetch workspaces — derive workspaceId from first workspace
    const {
        data: workspaces,
        isLoading: wsLoading,
        error: wsError,
    } = useWorkspaces();

    const workspaceId = workspaces?.[0]?.id;
    const workspaceName = workspaces?.[0]?.name ?? '';

    // Fetch tasks for today (local date filter)
    const {
        data: tasksData,
        isLoading: tasksLoading,
        error: tasksError,
    } = useTasks(workspaceId, todayDate);

    // Fetch schedule blocks for today (local date → day_of_week filter)
    const {
        data: blocksData,
        isLoading: scheduleLoading,
        error: scheduleError,
    } = useSchedule(workspaceId, todayDate);

    // Combine loading state — true while any query is loading
    const loading = wsLoading || tasksLoading || scheduleLoading;

    // First non-null error from any query
    const firstError = wsError ?? tasksError ?? scheduleError;
    const error = firstError
        ? firstError instanceof Error
            ? firstError.message
            : String(firstError)
        : null;

    // Derive task stats from fetched data
    const pendingTasks = (tasksData ?? []).filter(t => t.state !== 'done');
    const topTasks = pendingTasks.slice(0, 3);
    const pendingTasksCount = pendingTasks.length;

    // Find next schedule block from today's blocks
    const nextScheduleBlock = findNextScheduleBlock(blocksData ?? []);

    const refresh = async () => {
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
        await queryClient.invalidateQueries({ queryKey: ['schedule'] });
    };

    return {
        loading,
        error,
        refresh,
        nextScheduleBlock,
        pendingTasksCount,
        topTasks,
        workspaceName,
    };
}
