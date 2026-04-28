/**
 * PlanningApiClient — stateless REST client for planning-service.
 * No React dependency. Token is obtained via callback.
 */

import type {
    PlanningTask,
    PlanningTaskList,
    CreatePlanningTaskListInput,
    CreatePlanningTaskInput,
    UpdatePlanningTaskInput,
} from '../domain/Entities';

const DEFAULT_TIMEOUT_MS = 5000;

function safeJson<T>(resp: Response, fallback: T): T {
    try {
        return resp.json() as T;
    } catch {
        return fallback;
    }
}

function safeError(status: number, message: string): Error {
    return new Error(`[PlanningApiClient] HTTP ${status}: ${message}`);
}

/**
 * Maps backend ISO datetime string to Unix timestamp (ms).
 * Returns undefined for null/undefined/missing values.
 */
export function isoToTimestamp(iso: string | null | undefined): number | undefined {
    if (!iso) return undefined;
    return new Date(iso).getTime();
}

/**
 * Maps Unix timestamp (ms) to ISO datetime string for API.
 * Returns undefined if input is null/undefined/0.
 */
export function timestampToIso(ts: number | null | undefined): string | undefined {
    if (!ts) return undefined;
    return new Date(ts).toISOString();
}

export class PlanningApiClient {
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
            throw safeError(401, 'No access token available');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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
                throw safeError(resp.status, `Request failed`);
            }

            // Handle 204 No Content
            if (resp.status === 204) {
                return undefined as unknown as T;
            }

            return safeJson(resp, undefined as unknown as T);
        } finally {
            clearTimeout(timeout);
        }
    }

    // ── Task Lists ────────────────────────────────────────────────

    async listTaskLists(workspaceId: string): Promise<PlanningTaskList[]> {
        const result = await this.request<{ task_lists: PlanningTaskList[] }>(
            'GET',
            `/workspaces/${workspaceId}/task-lists`,
        );
        return result.task_lists ?? [];
    }

    async createTaskList(
        workspaceId: string,
        input: CreatePlanningTaskListInput,
    ): Promise<PlanningTaskList> {
        return this.request<PlanningTaskList>(
            'POST',
            `/workspaces/${workspaceId}/task-lists`,
            input,
        );
    }

    // ── Tasks ─────────────────────────────────────────────────────

    async listTasks(workspaceId: string): Promise<PlanningTask[]> {
        const result = await this.request<{ tasks: PlanningTask[] }>(
            'GET',
            `/workspaces/${workspaceId}/tasks`,
        );
        return result.tasks ?? [];
    }

    async createTask(
        workspaceId: string,
        input: CreatePlanningTaskInput,
    ): Promise<PlanningTask> {
        return this.request<PlanningTask>(
            'POST',
            `/workspaces/${workspaceId}/tasks`,
            input,
        );
    }

    async updateTask(
        workspaceId: string,
        taskId: string,
        patch: UpdatePlanningTaskInput,
    ): Promise<PlanningTask> {
        return this.request<PlanningTask>(
            'PUT',
            `/workspaces/${workspaceId}/tasks/${taskId}`,
            patch,
        );
    }

    async deleteTask(workspaceId: string, taskId: string): Promise<void> {
        await this.request<void>(
            'DELETE',
            `/workspaces/${workspaceId}/tasks/${taskId}`,
        );
    }
}
