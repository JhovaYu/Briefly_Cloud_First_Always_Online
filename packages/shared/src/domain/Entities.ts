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

// ─────────────────────────────────────────────
// Planning Service Types (cloud backend)
// ─────────────────────────────────────────────

export type PlanningTaskState = 'pending' | 'working' | 'done';
export type PlanningPriority = 'low' | 'medium' | 'high';

/**
 * Workspace from workspace-service.
 * workspace.id is the source of truth identifier.
 * workspace.name is a display name only — may be duplicated.
 */
export interface Workspace {
    id: string;
    name: string;
    owner_id: string;
    created_at: string; // ISO datetime string
    updated_at: string; // ISO datetime string
}

/**
 * Task list from planning-service.
 */
export interface PlanningTaskList {
    id: string;
    workspace_id: string;
    name: string;
    color?: string;
    created_at: string; // ISO datetime string
    updated_at: string; // ISO datetime string
    created_by: string;
}

/**
 * Task from planning-service.
 */
export interface PlanningTask {
    id: string;
    workspace_id: string;
    list_id?: string;
    text: string;
    state: PlanningTaskState;
    priority: PlanningPriority;
    assignee_id?: string;
    due_date?: string; // ISO datetime string | null
    description?: string;
    tags?: string[];
    created_at: string; // ISO datetime string
    updated_at: string; // ISO datetime string
    completed_at?: string; // ISO datetime string | null
    created_by: string;
}

// Request payloads

export interface CreatePlanningTaskListInput {
    id: string;
    name: string;
    color?: string;
}

export interface CreatePlanningTaskInput {
    id: string;
    list_id?: string;
    text: string;
    state: PlanningTaskState;
    priority: PlanningPriority;
    assignee_id?: string;
    due_date?: string; // ISO datetime string | null
    description?: string;
    tags?: string[];
}

export interface UpdatePlanningTaskInput {
    list_id?: string;
    text?: string;
    state?: PlanningTaskState;
    priority?: PlanningPriority;
    assignee_id?: string;
    due_date?: string | null;
    description?: string;
    tags?: string[];
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
