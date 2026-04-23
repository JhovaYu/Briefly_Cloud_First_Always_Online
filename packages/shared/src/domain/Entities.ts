export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    tags: string[];
    notebookId?: string;     // Belongs to a notebook (null = uncategorized)
    parentId?: string;       // Sub-page parent (null = top-level)
    titleLocked?: boolean;   // If true, title was manually renamed from sidebar and won't auto-sync from editor
}

export interface Notebook {
    id: string;
    name: string;
    icon: string;            // Emoji or icon identifier
    createdAt: number;
    collapsed?: boolean;     // UI state: collapsed in sidebar
}

export type TaskState = 'pending' | 'working' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
    id: string;
    listId: string;
    text: string;
    state: TaskState;
    assigneeId?: string;
    dueDate?: number;        // Timestamp
    description?: string;
    createdAt: number;
    completedAt?: number;
    priority?: TaskPriority;
    tags?: string[];
}

export interface TaskList {
    id: string;
    name: string;
    poolId: string;
    createdAt: number;
    color?: string;
}

// Local storage structure for user preferences regarding lists
export interface TaskListPreference {
    listId: string;
    hidden: boolean;
}

export interface Pool {
    id: string;
    name: string;
    hostId?: string;
    peers: string[];
    encryptionKey?: string;
    createdAt: number;
    theme: 'light' | 'dark' | 'system';
}

export interface Peer {
    id: string;
    username: string;
    color: string;
    lastSeen: number;
}

export interface UserProfile {
    id: string; // The generated user ID or UUID from Supabase
    name: string;
    color: string;
    createdAt: number;
    // Identity fields:
    identityType?: 'seed' | 'cloud' | 'local';
    seedPhrase?: string; // Solo si es Seed Identity
    syncPoolId?: string; // El room invisible donde se sincronizan los pools
}

export interface PoolInfo {
    id: string;
    name: string;
    icon: string;
    lastOpened: number;
    createdAt: number;
    signalingUrl?: string;
}
