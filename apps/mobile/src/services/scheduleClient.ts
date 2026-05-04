/**
 * Schedule client for React Native.
 *
 * Wraps schedule-service REST calls with Supabase JWT Bearer auth.
 * In-memory MVP — data persists only while schedule-service container is alive.
 *
 * Endpoints:
 *   GET    /api/schedule/workspaces/{workspace_id}/schedule-blocks
 *   POST   /api/schedule/workspaces/{workspace_id}/schedule-blocks
 *   PUT    /api/schedule/workspaces/{workspace_id}/schedule-blocks/{block_id}
 *   DELETE /api/schedule/workspaces/{workspace_id}/schedule-blocks/{block_id}
 */

import { fetchWithAuth } from '../api/fetchWithAuth';
import { createUuid } from '@tuxnotas/shared/src/logic/uuid';

const BASE_URL =
    (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://briefly.ddns.net') + '/api/schedule';

const DEFAULT_TIMEOUT_MS = 5000;

// ── Domain types ─────────────────────────────────────────────────────────────

export interface ScheduleBlock {
    id: string;
    workspace_id: string;
    title: string;
    day_of_week: number; // 0=Monday, 6=Sunday
    start_time: string; // "HH:MM"
    duration_minutes: number; // 5-480
    color: string | null;
    location: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    created_by: string;
}

export interface CreateScheduleBlockInput {
    id: string;
    title: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    color?: string | null;
    location?: string | null;
    notes?: string | null;
}

export interface UpdateScheduleBlockInput {
    title?: string;
    day_of_week?: number;
    start_time?: string;
    duration_minutes?: number;
    color?: string | null;
    location?: string | null;
    notes?: string | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeJson<T>(resp: Response, fallback: T): T {
    try {
        return resp.json() as T;
    } catch {
        return fallback;
    }
}

function safeError(status: number, message: string): Error {
    return new Error(`[scheduleClient] HTTP ${status}: ${message}`);
}

async function request<T>(
    method: string,
    path: string,
    getAccessToken: () => string | null,
    body?: unknown,
): Promise<T> {
    const token = getAccessToken();
    if (!token) {
        throw safeError(401, 'No access token available');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const resp = await fetch(`${BASE_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        if (!resp.ok) {
            throw safeError(resp.status, 'Request failed');
        }

        if (resp.status === 204) {
            return undefined as unknown as T;
        }

        return safeJson(resp, undefined as unknown as T);
    } finally {
        clearTimeout(timeout);
    }
}

// ── Public client factory ────────────────────────────────────────────────────

export function createScheduleClient(getAccessToken: () => string | null) {
    return {
        async listScheduleBlocks(workspaceId: string): Promise<ScheduleBlock[]> {
            const result = await request<{ blocks: ScheduleBlock[] }>(
                'GET',
                `/workspaces/${workspaceId}/schedule-blocks`,
                getAccessToken,
            );
            return result.blocks ?? [];
        },

        async createScheduleBlock(
            workspaceId: string,
            input: CreateScheduleBlockInput,
        ): Promise<ScheduleBlock> {
            return request<ScheduleBlock>(
                'POST',
                `/workspaces/${workspaceId}/schedule-blocks`,
                getAccessToken,
                input,
            );
        },

        async updateScheduleBlock(
            workspaceId: string,
            blockId: string,
            patch: UpdateScheduleBlockInput,
        ): Promise<ScheduleBlock> {
            return request<ScheduleBlock>(
                'PUT',
                `/workspaces/${workspaceId}/schedule-blocks/${blockId}`,
                getAccessToken,
                patch,
            );
        },

        async deleteScheduleBlock(workspaceId: string, blockId: string): Promise<void> {
            await request<void>(
                'DELETE',
                `/workspaces/${workspaceId}/schedule-blocks/${blockId}`,
                getAccessToken,
            );
        },
    };
}

export { BASE_URL as SCHEDULE_API_BASE_URL };

/**
 * Fetches schedule blocks filtered by date using the fresh token per request.
 * date: YYYY-MM-DD string. If omitted, returns all blocks (backward compatible).
 */
export async function fetchScheduleBlocksWithDate(
    workspaceId: string,
    date?: string,
): Promise<ScheduleBlock[]> {
    let url = `${BASE_URL}/workspaces/${workspaceId}/schedule-blocks`;
    if (date) {
        url += `?date=${date}`;
    }
    const response = await fetchWithAuth(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch schedule blocks: ${response.status}`);
    }
    const json = await response.json() as { blocks: ScheduleBlock[] };
    return json.blocks ?? [];
}