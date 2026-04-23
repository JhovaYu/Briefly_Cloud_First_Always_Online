import * as Y from 'yjs';
import type { Task, TaskList } from '../domain/Entities';

export class TaskService {
    private doc: Y.Doc;

    constructor(doc: Y.Doc) {
        this.doc = doc;
    }

    createTaskList(name: string, poolId: string): TaskList {
        const lists = this.doc.getMap<TaskList>('task-lists');
        const id = Math.random().toString(36).substr(2, 9);
        const list: TaskList = {
            id,
            name,
            poolId,
            createdAt: Date.now()
        };
        this.doc.transact(() => {
            lists.set(id, list);
        });
        return list;
    }

    getTaskLists(poolId: string): TaskList[] {
        const lists = this.doc.getMap<TaskList>('task-lists');
        return Array.from(lists.values()).filter(l => l.poolId === poolId);
    }

    addTask(listId: string, text: string, assigneeId?: string, dueDate?: number): Task {
        const tasks = this.doc.getMap<Task>('tasks');
        const id = Math.random().toString(36).substr(2, 9);
        const task: Task = {
            id,
            listId,
            text,
            state: 'pending',
            assigneeId,
            dueDate,
            createdAt: Date.now()
        };
        this.doc.transact(() => {
            tasks.set(id, task);
        });
        return task;
    }

    updateTask(taskId: string, updates: Partial<Task>): void {
        const tasks = this.doc.getMap<Task>('tasks');
        const task = tasks.get(taskId);
        if (task) {
            this.doc.transact(() => {
                tasks.set(taskId, { ...task, ...updates });
            });
        }
    }

    deleteTask(taskId: string): void {
        const tasks = this.doc.getMap<Task>('tasks');
        this.doc.transact(() => {
            tasks.delete(taskId);
        });
    }

    deleteTaskList(listId: string): void {
        const lists = this.doc.getMap<TaskList>('task-lists');
        const tasks = this.doc.getMap<Task>('tasks');

        this.doc.transact(() => {
            lists.delete(listId);
            // Delete all tasks in this list
            Array.from(tasks.values()).forEach(t => {
                if (t.listId === listId) {
                    tasks.delete(t.id);
                }
            });
        });
    }

    getTasks(listId: string): Task[] {
        const tasks = this.doc.getMap<Task>('tasks');
        return Array.from(tasks.values()).filter(t => t.listId === listId);
    }
}
