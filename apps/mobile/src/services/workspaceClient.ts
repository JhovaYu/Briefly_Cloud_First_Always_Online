/**
 * Workspace client for React Native.
 *
 * Wraps workspace-service REST calls. Unlike the shared WorkspaceService,
 * this does NOT use localStorage (not available in RN) — it keeps the
 * active workspace ID in memory for the session lifetime.
 *
 * Endpoints:
 *   GET    /workspaces
 *   POST   /workspaces
 *   GET    /workspaces/{workspaceId}
 */

import { fetchWithAuth } from '../api/fetchWithAuth';
import type { Workspace } from '@tuxnotas/shared/src/domain/Entities';

const BASE_URL =
    (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://briefly.ddns.net') + '/api/workspace';

const DEFAULT_TIMEOUT_MS = 5000;

function safeJson<T>(resp: Response, fallback: T): T {
    try {
        return resp.json() as T;
    } catch {
        return fallback;
    }
}

function safeError(status: number, message: string): Error {
    return new Error(`[workspaceClient] HTTP ${status}: ${message}`);
}

let _activeWorkspaceId: string | null = null;
let _getTokenImpl: (() => string | null) | null = null;

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

export function createWorkspaceClient(getAccessToken: () => string | null) {
    return {
        async listWorkspaces(): Promise<Workspace[]> {
            const result = await request<{ workspaces: Workspace[] }>(
                'GET',
                '/workspaces',
                getAccessToken,
            );
            return result.workspaces ?? [];
        },

        async createWorkspace(name: string): Promise<Workspace> {
            return request<Workspace>('POST', '/workspaces', getAccessToken, { name });
        },

        async getWorkspace(workspaceId: string): Promise<Workspace> {
            return request<Workspace>('GET', `/workspaces/${workspaceId}`, getAccessToken);
        },

        /**
         * Returns the active workspace ID, getting or creating one if needed.
         * Uses in-memory cache (session lifetime only — no localStorage in RN).
         */
        async ensureActiveWorkspace(): Promise<string> {
            if (_activeWorkspaceId) {
                try {
                    await this.getWorkspace(_activeWorkspaceId);
                    return _activeWorkspaceId;
                } catch {
                    _activeWorkspaceId = null;
                }
            }

            const workspaces = await this.listWorkspaces();
            if (workspaces.length > 0) {
                _activeWorkspaceId = workspaces[0].id;
                return _activeWorkspaceId;
            }

            const created = await this.createWorkspace('Personal Workspace');
            _activeWorkspaceId = created.id;
            return created.id;
        },

        async getSharedText(workspaceId: string): Promise<{ content: string } | null> {
            try {
                return await request<{ content: string }>(
                    'GET',
                    `/workspaces/${workspaceId}/shared-text`,
                    getAccessToken,
                );
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('404')) return null;
                throw err;
            }
        },

        async updateSharedText(workspaceId: string, content: string): Promise<void> {
            await request<void>(
                'PUT',
                `/workspaces/${workspaceId}/shared-text`,
                getAccessToken,
                { content },
            );
        },
    };
}

export { BASE_URL as WORKSPACE_API_BASE_URL };

/**
 * Fetches workspaces using a fresh token per request via fetchWithAuth.
 * Uses supabase.auth.getSession() to obtain a current access token.
 */
export async function fetchWorkspacesWithAuth(): Promise<Workspace[]> {
    const response = await fetchWithAuth(`${BASE_URL}/workspaces`);
    if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
    }
    const json = await response.json() as { workspaces: Workspace[] };
    return json.workspaces ?? [];
}

/**
 * Joins a workspace by UUID. Idempotent: returns workspace even if already a member.
 * @throws Error if workspace not found (404) or unauthorized (401/403)
 */
export async function joinWorkspaceWithAuth(workspaceId: string): Promise<{
    workspace: Workspace;
    already_member: boolean;
}> {
    const response = await fetchWithAuth(
        `${BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/join`,
        { method: 'POST' },
    );
    if (!response.ok) {
        throw new Error(`Failed to join workspace: ${response.status}`);
    }
    return response.json() as Promise<{ workspace: Workspace; already_member: boolean }>;
}

/**
 * Creates a new workspace using a fresh token per request via fetchWithAuth.
 */
export async function createWorkspaceWithAuth(name: string): Promise<Workspace> {
    const response = await fetchWithAuth(`${BASE_URL}/workspaces`, {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        throw new Error(`Failed to create workspace: ${response.status}`);
    }
    return response.json() as Promise<Workspace>;
}