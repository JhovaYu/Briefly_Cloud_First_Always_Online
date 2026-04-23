import type { Note, Pool, Peer, Notebook } from '@tuxnotas/shared';

// Puerto de Persistencia (Driven)
export interface NoteRepository {
    getNote(id: string): Promise<Note | null>;
    saveNote(note: Note): Promise<void>;
    getAllNotes(): Promise<Note[]>;
    deleteNote(id: string): Promise<void>;

    // Notebooks
    getNotebook(id: string): Promise<Notebook | null>;
    saveNotebook(notebook: Notebook): Promise<void>;
    getAllNotebooks(): Promise<Notebook[]>;
    deleteNotebook(id: string): Promise<void>;

    // Snapshots / Versioning
    saveSnapshot(poolId: string, state: Uint8Array): Promise<void>;
    getSnapshots(poolId: string): Promise<{ timestamp: number; state: Uint8Array }[]>;
}

// Puerto de Red / Colaboración (Driven)
export interface NetworkAdapter {
    connect(poolId: string): Promise<void>;
    disconnect(): void;
    broadcast(message: any): void;
    onPeerJoin(callback: (peer: Peer) => void): void;
    onPeerLeave(callback: (peerId: string) => void): void;
    getAwarenessState(): any;
}

// Puerto de Cifrado (Driven)
export interface CryptoProvider {
    generateKey(): Promise<string>;
    encrypt(data: any, key: string): Promise<string>;
    decrypt(data: string, key: string): Promise<any>;
}

// Servicio de Aplicación (Driving Port / Use Cases)
export interface CollaborationService {
    createPool(name: string): Promise<Pool>;
    joinPool(poolId: string, key?: string): Promise<void>;
    createNote(title?: string): Promise<Note>;
    updateNote(id: string, content: any): Promise<void>;
    createNotebook(name: string, icon?: string): Promise<Notebook>;
}
