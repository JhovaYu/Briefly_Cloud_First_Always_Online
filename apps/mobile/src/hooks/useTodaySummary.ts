/**
 * useTodaySummary — aggregates schedule + task data for the Today Dashboard.
 *
 * Accepts getAccessToken so it can be called as a regular hook (useAuth
 * must be called at the top level of a component, not inside this hook).
 *
 * Exposes: loading, error, refresh, nextScheduleBlock, pendingTasksCount,
 * topTasks, workspaceName.
 */

import { useState, useCallback, useEffect } from 'react';
import { createPlanningClient } from '../services/planningClient';
import { createScheduleClient, type ScheduleBlock } from '../services/scheduleClient';
import { createWorkspaceClient } from '../services/workspaceClient';
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

// ── Hook ───────────────────────────────────────────────────────────────────

export interface TodaySummary {
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    nextScheduleBlock: ScheduleBlock | null;
    pendingTasksCount: number;
    topTasks: PlanningTask[];
    workspaceName: string;
}

export function useTodaySummary(
    getAccessToken: () => string | null,
    workspaceId?: string,
): TodaySummary {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
    const [tasks, setTasks] = useState<PlanningTask[]>([]);

    const load = useCallback(async () => {
        const token = getAccessToken();
        if (!token) {
            setError('No session');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const workspaceClient = createWorkspaceClient(getAccessToken);
            const scheduleClient = createScheduleClient(getAccessToken);
            const planningClient = createPlanningClient(getAccessToken);

            const wsId = workspaceId ?? await workspaceClient.ensureActiveWorkspace();

            const [ws, fetchedBlocks, fetchedTasks] = await Promise.all([
                workspaceClient.getWorkspace(wsId),
                scheduleClient.listScheduleBlocks(wsId),
                planningClient.listTasks(wsId),
            ]);

            setBlocks(fetchedBlocks);
            setTasks(fetchedTasks);
            setWorkspaceName(ws.name ?? 'Workspace');
        } catch (err: any) {
            setError(err?.message ?? 'Error loading dashboard');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, workspaceId]);

    useEffect(() => {
        load();
    }, [load]);

    const pendingTasks = tasks.filter(t => t.state !== 'done');
    const topTasks = pendingTasks.slice(0, 3);
    const nextScheduleBlock = findNextScheduleBlock(blocks);

    return {
        loading,
        error,
        refresh: load,
        nextScheduleBlock,
        pendingTasksCount: pendingTasks.length,
        topTasks,
        workspaceName,
    };
}