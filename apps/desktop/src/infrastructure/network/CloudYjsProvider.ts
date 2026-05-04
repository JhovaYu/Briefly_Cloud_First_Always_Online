/**
 * CloudYjsProvider — connects a Y.Doc to the collaboration-service cloud backend.
 *
 * Used when COLLAB_USE_CLOUD_PROVIDER=true.
 * Replaces y-webrtc WebRTC transport with y-websocket WebSocket transport.
 *
 * Architecture:
 *   1. Obtain an opaque ticket via POST /collab/{wsId}/{docId}/ticket (JWT auth)
 *      - In dev (VITE_DEV_PROXY_TARGET unset): Vite proxy → localhost:8002/collab/...
 *      - In dev with cloud proxy: Vite proxy → https://briefly.ddns.net/collab/...
 *      - In prod: Nginx /collab/* → collaboration-service:8002
 *   2. Connect WebsocketProvider to /collab/crdt/{wsId}/{docId}?ticket={opaque}
 *   3. TipTap Collaboration binds to the same Y.Doc used here
 *
 * This is an EXPERIMENTAL spike adapter for PM-08A.
 * It does NOT replace y-webrtc when the flag is OFF.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * Ticket REST endpoint path (proxied by Vite dev server or Nginx).
 * Used via window.origin so it works in both dev and prod:
 *   - Dev:    window.origin/collab/...  → Vite proxy → localhost:8002
 *   - Cloud:  window.origin/collab/...  → Vite proxy → https://briefly.ddns.net
 *   - Prod:   window.origin/collab/...  → Nginx → collaboration-service
 */
const COLLAB_REST_PATH = '/collab';
const COLLAB_WS_PATH = '/collab/crdt';

/**
 * Build the WebSocket URL for the collab service.
 * Uses current host/protocol so Vite proxy in dev or Nginx in prod both work.
 * WebsocketProvider connects to:
 *   window.location.protocol === 'http:' ? ws:// : wss://
 *   + window.location.host + COLLAB_WS_PATH
 */
function getCollabWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${COLLAB_WS_PATH}`;
}

export interface CloudUser {
    name: string;
    color: string;
}

export interface CloudProviderConfig {
    /** Returns a valid Supabase JWT access token. */
    getAccessToken: () => Promise<string | null>;
    /** Cloud workspace UUID. */
    workspaceId: string;
    /** Note document ID within the workspace. */
    documentId: string;
    /** Awareness user info (name, color). */
    user: CloudUser;
}

export class CloudYjsProvider {
    public readonly doc: Y.Doc;
    private provider: WebsocketProvider | null = null;
    private getAccessToken: () => Promise<string | null>;
    private workspaceId: string;
    private documentId: string;
    private user: CloudUser;
    private connected = false;
    /** Guard against double-connect: if connect() is in-flight, return that promise. */
    private connectPromise: Promise<void> | null = null;
    /** AbortController to cancel in-flight ticket fetch on disconnect/destroy. */
    private abortController: AbortController | null = null;
    /** Set to true after first connection attempt (success or fail). Used to detect unwanted retry attempts. */
    private connectionAttempted = false;

    constructor(doc: Y.Doc, config: CloudProviderConfig) {
        this.doc = doc;
        this.getAccessToken = config.getAccessToken;
        this.workspaceId = config.workspaceId;
        this.documentId = config.documentId;
        this.user = config.user;
    }

    /**
     * Obtain a short-lived collab ticket from the collaboration-service.
     * Requires a valid Supabase JWT (access token).
     * Path: /collab/{workspaceId}/{documentId}/ticket
     */
    private async fetchTicket(): Promise<string> {
        const token = await this.getAccessToken();
        if (!token) {
            throw new Error('[CloudYjsProvider] No access token — cannot obtain collab ticket');
        }

        const ticketUrl = `${window.location.origin}${COLLAB_REST_PATH}/${this.workspaceId}/${this.documentId}/ticket`;
        console.info('[CloudYjsProvider] ticket_fetch attempted', { room: `${this.workspaceId}/${this.documentId}`, mode: 'cloud' });

        this.abortController = new AbortController();
        const resp = await fetch(ticketUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
            signal: this.abortController.signal,
        });

        if (!resp.ok) {
            console.error('[CloudYjsProvider] ticket_fetch failed', { status: resp.status, room: `${this.workspaceId}/${this.documentId}` });
            throw new Error(`[CloudYjsProvider] Ticket endpoint returned ${resp.status}`);
        }
        console.info('[CloudYjsProvider] ticket_fetch success', { room: `${this.workspaceId}/${this.documentId}`, mode: 'cloud' });

        const data = await resp.json() as { ticket: string; expires_in: number; ws_path: string; role: string };
        return data.ticket;
    }

    /**
     * Connect to the cloud collab room.
     * 1. Fetch ticket (JWT auth) — idempotent: concurrent calls share one promise
     * 2. Connect WebsocketProvider
     * 3. Set awareness
     */
    async connect(): Promise<void> {
        if (this.connected) return;
        if (this.connectPromise) return this.connectPromise;
        // PM-08A.2: StrictMode fires effect→cleanup→effect. After first attempt,
        // reject all subsequent connect() calls for this instance — no more providers, no retries.
        if (this.connectionAttempted) {
            console.log('[CloudYjsProvider] connect() called after first attempt — rejecting (single-attempt mode)');
            return;
        }
        this.connectionAttempted = true;

        this.connectPromise = this._doConnect();
        await this.connectPromise;
    }

    private async _doConnect(): Promise<void> {
        try {
            const ticket = await this.fetchTicket();

            const wsUrl = getCollabWsUrl();
            const roomName = `${this.workspaceId}/${this.documentId}`;
            console.info('[CloudYjsProvider] WS connecting', { room: roomName, mode: 'cloud', url: wsUrl });

            this.provider = new WebsocketProvider(
                wsUrl,
                roomName,
                this.doc,
                {
                    params: { ticket },
                    maxBackoffTime: 0,
                },
            );

            // PM-08A.2 single-attempt mode: intercept error/close BEFORE y-websocket's
            // onclose retry fires. y-websocket schedules retry via setTimeout(setupWS, backoff)
            // so we must set shouldConnect=false synchronously in these handlers.
            this.provider.on('connection-error', (err: unknown) => {
                console.warn('[CloudYjsProvider] ws_connection_error', { room: `${this.workspaceId}/${this.documentId}`, err });
                this._stopRetries();
            });
            this.provider.on('connection-close', (_event: unknown) => {
                console.warn('[CloudYjsProvider] ws_disconnected', { room: `${this.workspaceId}/${this.documentId}` });
                this._stopRetries();
            });

            this.provider.on('status', ({ status }: { status: string }) => {
                if (status === 'connected' || status === 'synced') {
                    this.connected = true;
                    console.info('[CloudYjsProvider] ws_connected', { room: `${this.workspaceId}/${this.documentId}`, mode: 'cloud' });
                    // Success — remove error listeners to avoid double-stop
                    this.provider?.off('connection-error', () => {});
                    this.provider?.off('connection-close', () => {});
                }
            });

            if (this.provider.awareness) {
                this.provider.awareness.setLocalStateField('user', {
                    name: this.user.name,
                    color: this.user.color,
                });
            }
        } finally {
            this.connectPromise = null;
        }
    }

    /**
     * Stop y-websocket retry loop immediately.
     * Sets shouldConnect=false before y-websocket's onclose setTimeout fires,
     * then disconnect+destroys the provider.
     * NO-OP if already connected (don't destroy a valid session).
     */
    private _stopRetries(): void {
        if (!this.provider) return;
        // Don't destroy a session that already established — close after 'connected' is normal
        if (this.connected) {
            console.log('[CloudYjsProvider] connection-close after success — ignoring (normal disconnect)');
            return;
        }
        // @ts-ignore — y-websocket internal, but the only way to truly stop retries
        this.provider.shouldConnect = false;
        try {
            this.provider.disconnect();
        } catch (e) {
            console.warn('[CloudYjsProvider] disconnect error:', e);
        }
        try {
            this.provider.destroy();
        } catch (e) {
            console.warn('[CloudYjsProvider] destroy error:', e);
        }
        this.provider = null;
        console.log('[CloudYjsProvider] Retries stopped, provider destroyed');
    }

    /**
     * Disconnect and destroy the WebsocketProvider.
     * Cancels any in-flight ticket fetch via AbortController.
     */
    disconnect(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        if (this.provider) {
            try {
                this.provider.destroy();
            } catch (err) {
                console.warn('[CloudYjsProvider] Error during destroy:', err);
            }
            this.provider = null;
        }
        this.connected = false;
        this.connectPromise = null;
        console.info('[CloudYjsProvider] Disconnected', { room: `${this.workspaceId}/${this.documentId}`, mode: 'cloud' });
    }

    /**
     * Explicit destroy — alias for disconnect() for callers that want a clear cleanup contract.
     * Idempotent: safe to call multiple times.
     */
    destroy(): void {
        this.disconnect();
    }

    /**
     * Returns the WebsocketProvider instance, for awareness queries.
     */
    getProvider(): WebsocketProvider | null {
        return this.provider;
    }

    isConnected(): boolean {
        return this.connected;
    }
}
