/**
 * WorkspaceService — client for workspace-service (port 8001).
 * Provides ensureActiveWorkspace() which implements the bootstrap logic:
 *   1. Check localStorage cached ID
 *   2. Validate with GET /workspaces/{id}
 *   3. If invalid/missing, list workspaces and pick first, or create default
 *
 * IMPORTANT: workspace.name is a display name only. It is NOT unique.
 * workspace.id is the source of truth. Do NOT use name as an identity key.
 *
 * This module has NO React dependency.
 */

import type { Workspace } from '../domain/Entities';

const DEFAULT_TIMEOUT_MS = 5000;
const WORKSPACE_CACHE_KEY = 'briefly.activeWorkspaceId';

function safeJson<T>(resp: Response, fallback: T): T {
    try {
        return resp.json() as T;
    } catch {
        return fallback;
    }
}

function safeError(status: number, message: string): Error {
    return new Error(`[WorkspaceService] HTTP ${status}: ${message}`);
}

export class WorkspaceService {
    private baseUrl: string;
    private getToken: () => Promise<string | null>;

    constructor(config: {
        workspaceBaseUrl: string;
        getAccessToken: () => Promise<string | null>;
    }) {
        this.baseUrl = config.workspaceBaseUrl.replace(/\/$/, '');
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

            if (resp.status === 204) {
                return undefined as unknown as T;
            }

            return safeJson(resp, undefined as unknown as T);
        } finally {
            clearTimeout(timeout);
        }
    }

    async listWorkspaces(): Promise<Workspace[]> {
        const result = await this.request<{ workspaces: Workspace[] }>(
            'GET',
            '/workspaces',
        );
        return result.workspaces ?? [];
    }

    async getWorkspace(workspaceId: string): Promise<Workspace> {
        return this.request<Workspace>('GET', `/workspaces/${workspaceId}`);
    }

    async createWorkspace(name: string): Promise<Workspace> {
        return this.request<Workspace>(
            'POST',
            '/workspaces',
            { name },
        );
    }

    /**
     * Retrieves the cached active workspace ID from localStorage.
     * Returns null if no key is set.
     */
    private getCachedWorkspaceId(): string | null {
        try {
            return localStorage.getItem(WORKSPACE_CACHE_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Stores a workspace ID as the active one in localStorage.
     */
    private setCachedWorkspaceId(id: string): void {
        try {
            localStorage.setItem(WORKSPACE_CACHE_KEY, id);
        } catch {
            // localStorage may be unavailable in some environments
        }
    }

    /**
     * Clears the cached workspace ID.
     */
    clearCachedWorkspaceId(): void {
        try {
            localStorage.removeItem(WORKSPACE_CACHE_KEY);
        } catch {
            // ignore
        }
    }

    /**
     * ensureActiveWorkspace — bootstrap logic for the first cloud workspace.
     *
     * Flow:
     *  1. If cached ID exists, validate with GET /workspaces/{id}
     *     - If 200: use it (cached valid workspace)
     *     - If 404/403/err: clear cache, proceed to step 2
     *  2. GET /workspaces — list all user workspaces
     *     - If workspaces exist: pick the first one, cache its ID, return it
     *     - If none: create "Personal Workspace", cache its ID, return it
     *
     * The first workspace in the list is chosen as "active" deterministically
     * but arbitrarily. A proper Workspace Selector UI will come later.
     *
     * workspace.name is a display name only — it may repeat across users or
     * across creation attempts. Do NOT use name as identity or idempotency key.
     */
    async ensureActiveWorkspace(): Promise<string> {
        // Step 1: check cached ID
        const cachedId = this.getCachedWorkspaceId();
        if (cachedId) {
            try {
                await this.getWorkspace(cachedId);
                // Valid — return cached
                return cachedId;
            } catch {
                // Invalid/404 — clear and fall through
                this.clearCachedWorkspaceId();
            }
        }

        // Step 2: list existing workspaces
        const workspaces = await this.listWorkspaces();
        if (workspaces.length > 0) {
            // Pick first as active
            const active = workspaces[0];
            this.setCachedWorkspaceId(active.id);
            return active.id;
        }

        // Step 3: no workspaces exist — create default
        const created = await this.createWorkspace('Personal Workspace');
        this.setCachedWorkspaceId(created.id);
        return created.id;
    }
}
