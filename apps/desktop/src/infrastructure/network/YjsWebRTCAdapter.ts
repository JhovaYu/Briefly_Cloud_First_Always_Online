import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import type { NetworkAdapter } from '../../core/ports/Ports';
import type { Peer } from '@tuxnotas/shared';

/**
 * ICE Servers: STUN (conectividad directa) + TURN (relay para redes restringidas).
 */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN fallback usando variables de entorno (Metered)
    {
        urls: import.meta.env.VITE_TURN_URL || 'turn:free.metered.ca:80',
        username: import.meta.env.VITE_TURN_USERNAME || 'default_user',
        credential: import.meta.env.VITE_TURN_PASSWORD || 'default_pass',
    }
];

/**
 * Signaling server para descubrimiento de peers.
 * SOLO usamos el signaling LOCAL en ws://localhost:4444.
 */
const DEFAULT_SIGNALING = [
    import.meta.env.VITE_SIGNALING_SERVER || 'ws://localhost:4444',
];

export interface NetworkConfig {
    signalingServers?: string[];
    iceServers?: RTCIceServer[];
}

export class YjsWebRTCAdapter implements NetworkAdapter {
    private doc: Y.Doc;
    public provider: WebrtcProvider | null = null;
    private onPeerJoinCallback: ((peer: Peer) => void) | null = null;
    private onPeerLeaveCallback: ((peerId: string) => void) | null = null;
    private config: NetworkConfig;
    private connected = false;

    constructor(doc: Y.Doc, config?: NetworkConfig) {
        this.doc = doc;
        this.config = config || {};
    }

    async connect(poolId: string, signalingUrl?: string): Promise<void> {
        // Guard: don't connect twice to the same room
        if (this.connected && this.provider) {
            console.log(`[Briefly] Already connected to: ${poolId}, skipping`);
            return;
        }

        // En transición a Cloud: Ignoramos el signalingUrl local heredado para forzar que todos usen Railway (.env)
        // excepto si el usuario pasa explícitamente una URL remota distinta (como otro host Railway)
        const isLegacyLocal = signalingUrl && (signalingUrl.includes('localhost') || signalingUrl.includes('127.0.0.1') || signalingUrl.match(/\d+\.\d+\.\d+\.\d+/));
        const finalSignalingUrl = (signalingUrl && !isLegacyLocal) ? [signalingUrl] : undefined;
        
        const signaling = finalSignalingUrl || this.config.signalingServers || DEFAULT_SIGNALING;
        const iceServers = this.config.iceServers || DEFAULT_ICE_SERVERS;

        this.provider = new WebrtcProvider(poolId, this.doc, {
            signaling: signaling,
            password: null as any,
            peerOpts: {
                config: {
                    iceServers: iceServers,
                },
            },
        } as any);

        this.connected = true;

        this.provider.awareness.on('change', () => {
            this.handleAwarenessUpdate();
        });

        console.log(`[Briefly] Conectado al pool P2P: ${poolId}`);
        console.log(`[Briefly] Signaling servers:`, signaling);
        console.log(`[Briefly] ICE Servers configurados:`, iceServers.length);
    }

    disconnect(): void {
        if (this.provider) {
            try {
                this.provider.destroy();
            } catch (err) {
                console.warn('[Briefly] Error during provider.destroy():', err);
            }
            this.provider = null;
        }
        this.connected = false;
    }

    broadcast(_message: any): void {
        // Yjs uses Shared Types for sync
    }

    onPeerJoin(callback: (peer: Peer) => void): void {
        this.onPeerJoinCallback = callback;
    }

    onPeerLeave(callback: (peerId: string) => void): void {
        this.onPeerLeaveCallback = callback;
    }

    getAwarenessState(): any {
        return this.provider?.awareness.getStates();
    }

    getPeerCount(): number {
        const states = this.provider?.awareness.getStates();
        return states ? states.size : 0;
    }

    private handleAwarenessUpdate() {
        const states = this.provider?.awareness.getStates();
        if (!states) return;
        if (this.onPeerJoinCallback) { /* TODO */ }
        if (this.onPeerLeaveCallback) { /* TODO */ }
    }
}
