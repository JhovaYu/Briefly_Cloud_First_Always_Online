import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { createPlanningClient } from '../src/services/planningClient';
import { createWorkspaceClient } from '../src/services/workspaceClient';
import { queryClient } from '../src/lib/queryClient';
import { createUuid } from '@tuxnotas/shared/src/logic/uuid';
import type { PlanningTask, PlanningTaskState } from '@tuxnotas/shared/src/domain/Entities';

function TaskItem({
    task,
    onToggle,
    onDelete,
}: {
    task: PlanningTask;
    onToggle: (id: string, state: PlanningTaskState) => void;
    onDelete: (id: string) => void;
}) {
    const isDone = task.state === 'done';
    return (
        <View style={styles.taskItem}>
            <TouchableOpacity
                style={[styles.checkbox, isDone && styles.checkboxDone]}
                onPress={() => onToggle(task.id, isDone ? 'pending' : 'done')}
            >
                {isDone && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={[styles.taskText, isDone && styles.taskTextDone]} numberOfLines={2}>
                {task.text}
            </Text>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(task.id)}>
                <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function TasksScreen() {
    const router = useRouter();
    const { workspaceId: workspaceIdParam } = useLocalSearchParams<{ workspaceId?: string }>();
    const { loading: authLoading, getAccessToken } = useAuth();
    const [tasks, setTasks] = useState<PlanningTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newTaskText, setNewTaskText] = useState('');
    const [creating, setCreating] = useState(false);

    const loadTasks = useCallback(async () => {
        const token = getAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const planningClient = createPlanningClient(getAccessToken);
            let workspaceId: string;

            if (workspaceIdParam) {
                workspaceId = workspaceIdParam;
            } else {
                const workspaceClient = createWorkspaceClient(getAccessToken);
                workspaceId = await workspaceClient.ensureActiveWorkspace();
            }

            const fetched = await planningClient.listTasks(workspaceId);
            setTasks(fetched);
        } catch (err: any) {
            setError(err?.message ?? 'Error cargando tareas');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, workspaceIdParam]);

    useEffect(() => {
        if (authLoading) return;
        const token = getAccessToken();
        if (!token) {
            router.replace('/login');
            return;
        }
        loadTasks();
    }, [authLoading, loadTasks, getAccessToken]);

    const handleCreate = async () => {
        const text = newTaskText.trim();
        if (!text) return;

        const token = getAccessToken();
        if (!token) return;

        const tempId = createUuid();
        const optimistic: PlanningTask = {
            id: tempId,
            workspace_id: '',
            text,
            state: 'pending',
            priority: 'medium',
            list_id: undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: '',
        };

        setTasks(prev => [...prev, optimistic]);
        setNewTaskText('');
        setCreating(true);

        try {
            const planningClient = createPlanningClient(getAccessToken);
            let workspaceId: string;

            if (workspaceIdParam) {
                workspaceId = workspaceIdParam;
            } else {
                const workspaceClient = createWorkspaceClient(getAccessToken);
                workspaceId = await workspaceClient.ensureActiveWorkspace();
            }

            const created = await planningClient.createTask(workspaceId, {
                id: tempId,
                text,
                state: 'pending',
                priority: 'medium',
            });
            setTasks(prev =>
                prev.map(t => (t.id === tempId ? { ...created, list_id: created.list_id ?? undefined } : t))
            );
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        } catch {
            setTasks(prev => prev.filter(t => t.id !== tempId));
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (taskId: string, newState: PlanningTaskState) => {
        const token = getAccessToken();
        if (!token) return;

        setTasks(prev =>
            prev.map(t => (t.id === taskId ? { ...t, state: newState } : t))
        );

        try {
            const planningClient = createPlanningClient(getAccessToken);
            let workspaceId: string;

            if (workspaceIdParam) {
                workspaceId = workspaceIdParam;
            } else {
                const workspaceClient = createWorkspaceClient(getAccessToken);
                workspaceId = await workspaceClient.ensureActiveWorkspace();
            }

            await planningClient.updateTask(workspaceId, taskId, { state: newState });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        } catch {
            loadTasks();
        }
    };

    const handleDelete = async (taskId: string) => {
        const token = getAccessToken();
        if (!token) return;

        const previous = tasks;
        setTasks(prev => prev.filter(t => t.id !== taskId));

        try {
            const planningClient = createPlanningClient(getAccessToken);
            let workspaceId: string;

            if (workspaceIdParam) {
                workspaceId = workspaceIdParam;
            } else {
                const workspaceClient = createWorkspaceClient(getAccessToken);
                workspaceId = await workspaceClient.ensureActiveWorkspace();
            }

            await planningClient.deleteTask(workspaceId, taskId);
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        } catch {
            setTasks(previous);
        }
    };

    if (authLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#aeb4ff" size="large" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Tareas</Text>
                <TouchableOpacity onPress={loadTasks} style={styles.refreshBtn} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#aeb4ff" size="small" />
                    ) : (
                        <Text style={styles.refreshBtnText}>↻</Text>
                    )}
                </TouchableOpacity>
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Text style={styles.errorClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Nueva tarea..."
                    placeholderTextColor="#666"
                    value={newTaskText}
                    onChangeText={setNewTaskText}
                    onSubmitEditing={handleCreate}
                    returnKeyType="done"
                    editable={!creating}
                />
                <TouchableOpacity
                    style={[styles.addBtn, (!newTaskText.trim() || creating) && styles.addBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!newTaskText.trim() || creating}
                >
                    {creating ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.addBtnText}>+</Text>
                    )}
                </TouchableOpacity>
            </View>

            {loading && tasks.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#aeb4ff" size="large" />
                </View>
            ) : tasks.length === 0 && !error ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>Sin tareas</Text>
                    <Text style={styles.emptySubtext}>Usa el campo acima para criar uma tarea</Text>
                </View>
            ) : (
                <FlatList
                    data={tasks}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TaskItem task={item} onToggle={handleToggle} onDelete={handleDelete} />
                    )}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backBtnText: { color: '#aeb4ff', fontSize: 24 },
    title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    refreshBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    refreshBtnText: { color: '#aeb4ff', fontSize: 22 },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#3b1010',
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
    errorClose: { color: '#ef4444', marginLeft: 8 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        color: '#fff',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#333',
    },
    addBtn: {
        backgroundColor: '#6872c6',
        borderRadius: 10,
        width: 46,
        height: 46,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addBtnDisabled: { opacity: 0.5 },
    addBtnText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    list: { paddingHorizontal: 16, paddingBottom: 32 },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#252525',
    },
    checkbox: {
        width: 26,
        height: 26,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#6872c6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkboxDone: { backgroundColor: '#6872c6' },
    checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    taskText: { flex: 1, color: '#ddd', fontSize: 15 },
    taskTextDone: { color: '#555', textDecorationLine: 'line-through' },
    deleteBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
    deleteBtnText: { color: '#555', fontSize: 16 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#555', fontSize: 18, fontWeight: '600' },
    emptySubtext: { color: '#444', fontSize: 13, marginTop: 6 },
});