import * as Y from 'yjs';
import { YjsWebRTCAdapter } from './network/YjsWebRTCAdapter';
import { YjsIndexedDBAdapter } from './persistence/IndexedDBAdapter';
import type { CollaborationService } from '../core/ports/Ports';
import type { Note, Pool, Notebook } from '@tuxnotas/shared';

let noteCounter = 0;

/**
 * Singleton cache: one AppServices instance per poolId.
 * This prevents React StrictMode's double-invoke from creating
 * duplicate WebRTC rooms (which causes "A Yjs Doc connected to room already exists!").
 */
const instanceCache = new Map<string, { svc: AppServices; refCount: number }>();

import { TaskService } from '@tuxnotas/shared';

export class AppServices implements CollaborationService {
    public doc: Y.Doc;
    public network: YjsWebRTCAdapter;
    public persistence: YjsIndexedDBAdapter;
    public tasks: TaskService;

    constructor() {
        this.doc = new Y.Doc();
        this.network = new YjsWebRTCAdapter(this.doc);
        this.persistence = new YjsIndexedDBAdapter(this.doc);
        this.tasks = new TaskService(this.doc);
    }

    async initialize(poolId: string = 'fluent-default-pool', signalingUrl?: string): Promise<void> {
        await this.persistence.initialize(poolId);
        await this.network.connect(poolId, signalingUrl);
    }

    /**
     * Get or create a singleton AppServices for a given poolId.
     * Keeps a reference count so React StrictMode double-mounting is safe.
     */
    static async getOrCreate(poolId: string, signalingUrl?: string): Promise<AppServices> {
        const existing = instanceCache.get(poolId);
        if (existing) {
            existing.refCount++;
            console.log(`[Fluent] Reusing existing connection for pool: ${poolId} (refs: ${existing.refCount})`);
            return existing.svc;
        }

        const svc = new AppServices();
        await svc.initialize(poolId, signalingUrl);
        instanceCache.set(poolId, { svc, refCount: 1 });
        return svc;
    }

    /**
     * Release a reference. Only actually disconnects when refCount hits 0.
     */
    static release(poolId: string): void {
        const entry = instanceCache.get(poolId);
        if (!entry) return;
        entry.refCount--;
        console.log(`[Fluent] Released pool ref: ${poolId} (refs: ${entry.refCount})`);
        if (entry.refCount <= 0) {
            entry.svc.network.disconnect();
            instanceCache.delete(poolId);
            console.log(`[Fluent] Disconnected from pool: ${poolId}`);
        }
    }

    // ─── Pool Metadata (synced via Y.Doc so joining peers see the name) ───

    setPoolMeta(name: string): void {
        const meta = this.doc.getMap<string>('pool-meta');
        this.doc.transact(() => {
            meta.set('name', name);
        });
    }

    getPoolName(): string | undefined {
        const meta = this.doc.getMap<string>('pool-meta');
        return meta.get('name');
    }

    // ─── Notes CRUD ───

    async createPool(name: string): Promise<Pool> {
        const poolId = `pool-${Math.random().toString(36).substr(2, 9)}`;
        const pool: Pool = {
            id: poolId,
            name: name,
            peers: [],
            createdAt: Date.now(),
            theme: 'system'
        };
        return pool;
    }

    async joinPool(poolId: string, signalingUrl?: string): Promise<void> {
        this.network.disconnect();
        this.doc = new Y.Doc();
        this.network = new YjsWebRTCAdapter(this.doc);
        this.persistence = new YjsIndexedDBAdapter(this.doc);
        await this.initialize(poolId, signalingUrl);
    }

    async createNote(title?: string): Promise<Note> {
        noteCounter++;
        const note: Note = {
            id: Math.random().toString(36).substr(2, 9),
            title: title || `Página ${noteCounter}`,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: [],
            titleLocked: false,
        };
        await this.persistence.saveNote(note);
        return note;
    }

    async createNoteInNotebook(notebookId: string, title?: string): Promise<Note> {
        noteCounter++;
        const note: Note = {
            id: Math.random().toString(36).substr(2, 9),
            title: title || `Página ${noteCounter}`,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: [],
            notebookId,
            titleLocked: false,
        };
        await this.persistence.saveNote(note);
        return note;
    }

    async createSubPage(parentId: string, title?: string): Promise<Note> {
        noteCounter++;
        const parent = await this.persistence.getNote(parentId);
        const note: Note = {
            id: Math.random().toString(36).substr(2, 9),
            title: title || `Sub-página ${noteCounter}`,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: [],
            parentId,
            notebookId: parent?.notebookId,
            titleLocked: false,
        };
        await this.persistence.saveNote(note);
        return note;
    }

    async duplicateNote(noteId: string): Promise<Note | null> {
        const original = await this.persistence.getNote(noteId);
        if (!original) return null;
        noteCounter++;
        const copy: Note = {
            ...original,
            id: Math.random().toString(36).substr(2, 9),
            title: `${original.title} (copia)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await this.persistence.saveNote(copy);
        return copy;
    }

    async createNotebook(name: string): Promise<Notebook> {
        const notebook: Notebook = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            icon: 'notebook',
            createdAt: Date.now(),
        };
        await this.persistence.saveNotebook(notebook);
        return notebook;
    }

    async updateNote(id: string, _content: any): Promise<void> {
        const note = await this.persistence.getNote(id);
        if (note) {
            note.updatedAt = Date.now();
            await this.persistence.saveNote(note);
        }
    }

    getProvider() {
        return this.network;
    }
}

export const services = new AppServices();
