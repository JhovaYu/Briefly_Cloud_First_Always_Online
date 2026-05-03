/**
 * ScheduleApiClient — stateless REST client for schedule-service.
 * No React dependency. Token is obtained via async callback.
 */

import type {
    ScheduleBlock,
    CreateScheduleBlockInput,
    UpdateScheduleBlockInput,
} from '../domain/Entities';

const DEFAULT_TIMEOUT_MS = 8000; // 8s — generous enough for cold-start on EC2

async function safeJsonAsync<T>(resp: Response, fallback: T): Promise<T> {
    try {
        const text = await resp.text();
        if (!text) return fallback;
        return JSON.parse(text) as T;
    } catch {
        return fallback;
    }
}

function safeError(status: number): Error {
    return new Error(`[ScheduleApiClient] HTTP ${status}: Request failed`);
}

async function readErrorBody(resp: Response): Promise<string> {
    try {
        const text = await resp.text();
        return text ? ` — ${text}` : '';
    } catch {
        return '';
    }
}

export class ScheduleApiClient {
    private baseUrl: string;
    private getToken: () => Promise<string | null>;

    constructor(config: {
        baseUrl: string;
        getAccessToken: () => Promise<string | null>;
    }) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.getToken = config.getAccessToken;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<T> {
        const token = await this.getToken();
        if (!token) {
            throw safeError(401);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            const resp = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            if (!resp.ok) {
                const bodyNote = await readErrorBody(resp);
                throw new Error(`[ScheduleApiClient] HTTP ${resp.status}: Request failed${bodyNote}`);
            }

            if (resp.status === 204) {
                return undefined as unknown as T;
            }

            // Safe to await — timeout timer keeps running until we clear it in finally
            const data = await safeJsonAsync(resp, undefined as unknown as T);
            return data;
        } finally {
            // Clear AFTER fetch + json parsing complete
            clearTimeout(timer);
        }
    }

    async listScheduleBlocks(workspaceId: string): Promise<ScheduleBlock[]> {
        const result = await this.request<{ blocks: ScheduleBlock[] }>(
            'GET',
            `/workspaces/${workspaceId}/schedule-blocks`,
        );
        return result.blocks ?? [];
    }

    async createScheduleBlock(
        workspaceId: string,
        input: CreateScheduleBlockInput,
    ): Promise<ScheduleBlock> {
        return this.request<ScheduleBlock>(
            'POST',
            `/workspaces/${workspaceId}/schedule-blocks`,
            input,
        );
    }

    async updateScheduleBlock(
        workspaceId: string,
        blockId: string,
        patch: UpdateScheduleBlockInput,
    ): Promise<ScheduleBlock> {
        return this.request<ScheduleBlock>(
            'PUT',
            `/workspaces/${workspaceId}/schedule-blocks/${blockId}`,
            patch,
        );
    }

    async deleteScheduleBlock(workspaceId: string, blockId: string): Promise<void> {
        await this.request<void>(
            'DELETE',
            `/workspaces/${workspaceId}/schedule-blocks/${blockId}`,
        );
    }
}