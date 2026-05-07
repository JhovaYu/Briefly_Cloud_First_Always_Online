import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { getLocalDateString } from '../src/utils/dateUtils';
import { createPlanningClient } from '../src/services/planningClient';
import { queryClient } from '../src/lib/queryClient';
import { createUuid } from '@tuxnotas/shared/src/logic/uuid';
import type { PlanningTask, PlanningTaskState } from '@tuxnotas/shared/src/domain/Entities';
import { useTheme } from '../src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/ui/Card';
import { BottomNav } from '../src/components/ui/BottomNav';

function TaskItem({
    task,
    workspaceName,
    onToggle,
}: {
    task: PlanningTask;
    workspaceName: string;
    onToggle: (id: string, state: PlanningTaskState) => void;
}) {
    const theme = useTheme();
    const isDone = task.state === 'done';
    
    return (
        <View style={styles.taskItem}>
            <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => onToggle(task.id, isDone ? 'pending' : 'done')}
            >
                <Ionicons 
                    name={isDone ? "checkmark-circle" : "ellipse-outline"} 
                    size={28} 
                    color={isDone ? theme.primary : theme.textMuted} 
                />
            </TouchableOpacity>
            
            <View style={styles.taskContent}>
                <Text style={[styles.taskText, { color: theme.text }, isDone && { color: theme.textMuted, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                    {task.text}
                </Text>
                <Text style={[styles.taskSubtext, { color: theme.textMuted }]}>{workspaceName || 'Sin grupo'}</Text>
            </View>
            
            <TouchableOpacity style={styles.starBtn}>
                <Ionicons name="star-outline" size={20} color={theme.textMuted} />
            </TouchableOpacity>
        </View>
    );
}

export default function TasksScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { workspaceId: workspaceIdParam } = useLocalSearchParams<{ workspaceId?: string }>();
    const { loading: authLoading, getAccessToken } = useAuth();
    const { activeWorkspaceId, activeWorkspaceName: workspaceName } = useActiveWorkspace();
    
    const [tasks, setTasks] = useState<PlanningTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newTaskText, setNewTaskText] = useState('');
    const [creating, setCreating] = useState(false);
    
    const [filter, setFilter] = useState<'hoy' | 'pendientes' | 'completadas'>('hoy');

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
            } else if (activeWorkspaceId) {
                workspaceId = activeWorkspaceId;
            } else {
                setTasks([]);
                return; // No active workspace to load tasks for MVP
            }

            const fetched = await planningClient.listTasks(workspaceId);
            setTasks(fetched);
        } catch (err: any) {
            setError(err?.message ?? 'Error cargando tareas');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, workspaceIdParam, activeWorkspaceId]);

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

        let targetWorkspaceId = workspaceIdParam || activeWorkspaceId;
        if (!targetWorkspaceId) {
            setError('Selecciona un grupo para crear tareas');
            return;
        }

        const tempId = createUuid();
        const optimistic: PlanningTask = {
            id: tempId,
            workspace_id: targetWorkspaceId as string,
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
            const todayDate = getLocalDateString();
            const created = await planningClient.createTask(targetWorkspaceId as string, {
                id: tempId,
                text,
                state: 'pending',
                priority: 'medium',
                due_date: `${todayDate}T12:00:00`,
            });
            setTasks(prev => prev.map(t => (t.id === tempId ? { ...created, list_id: created.list_id ?? undefined } : t)));
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

        setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, state: newState } : t)));

        try {
            const planningClient = createPlanningClient(getAccessToken);
            let targetWorkspaceId = workspaceIdParam || activeWorkspaceId;
            if (!targetWorkspaceId) throw new Error('No active workspace');
            await planningClient.updateTask(targetWorkspaceId as string, taskId, { state: newState });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        } catch {
            loadTasks();
        }
    };

    const filteredTasks = useMemo(() => {
        switch (filter) {
            case 'hoy': return tasks.filter(t => t.state === 'pending'); // Simplified for MVP
            case 'pendientes': return tasks.filter(t => t.state === 'pending');
            case 'completadas': return tasks.filter(t => t.state === 'done');
            default: return tasks;
        }
    }, [tasks, filter]);

    if (authLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator color={theme.primary} size="large" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Tareas</Text>
                <TouchableOpacity>
                    <Ionicons name="filter-outline" size={24} color={theme.text} />
                </TouchableOpacity>
            </View>

            {/* Segmented Control */}
            <View style={[styles.segmentedControl, { backgroundColor: theme.surface }]}>
                {['hoy', 'pendientes', 'completadas'].map((f) => {
                    const isActive = filter === f;
                    const label = f.charAt(0).toUpperCase() + f.slice(1);
                    return (
                        <TouchableOpacity
                            key={f}
                            style={[styles.segmentBtn, isActive && { backgroundColor: theme.primary }]}
                            onPress={() => setFilter(f as any)}
                        >
                            <Text style={[styles.segmentText, { color: isActive ? '#fff' : theme.textSecondary }, isActive && { fontWeight: '600' }]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Group Selector */}
            <View style={styles.groupSelectorContainer}>
                <TouchableOpacity style={[styles.groupSelector, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="folder-outline" size={20} color={theme.textMuted} />
                    <Text style={[styles.groupSelectorText, { color: theme.text }]} numberOfLines={1}>
                        {workspaceName || 'Todos los grupos'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Error banner — only show for real errors, not for "no workspace" */}
            {error && !activeWorkspaceId && !workspaceIdParam && (
                <View style={[styles.helperBanner, { backgroundColor: 'rgba(126,108,250,0.1)', borderColor: theme.primary }]}>
                    <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                    <Text style={[styles.helperText, { color: theme.primary }]}>Selecciona un grupo para crear tareas</Text>
                </View>
            )}

            {error && (activeWorkspaceId || workspaceIdParam) && (
                <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,69,58,0.1)', borderColor: theme.danger }]}>
                    <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Ionicons name="close" size={20} color={theme.danger} />
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.listContent}>
                <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionDot, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {filter === 'hoy' ? 'Hoy' : filter === 'pendientes' ? 'Pendientes' : 'Completadas'} · {(filteredTasks || []).length}
                    </Text>
                </View>

                <Card style={styles.tasksCard} padding={8}>
                    {loading && (filteredTasks || []).length === 0 ? (
                        <ActivityIndicator color={theme.primary} style={{ margin: 20 }} />
                    ) : error && (filteredTasks || []).length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="alert-circle-outline" size={32} color={theme.textMuted} style={{ marginBottom: 12 }} />
                            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No se pudieron cargar las tareas</Text>
                            <TouchableOpacity onPress={loadTasks} style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: theme.surfaceHighlight, borderRadius: 8 }}>
                                <Text style={{ color: theme.primary, fontWeight: '600' }}>Reintentar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (filteredTasks || []).length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="checkmark-circle-outline" size={32} color={theme.textMuted} style={{ marginBottom: 12 }} />
                            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay tareas aquí</Text>
                        </View>
                    ) : (
                        (filteredTasks || []).map(task => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                workspaceName={workspaceName || ''}
                                onToggle={handleToggle}
                            />
                        ))
                    )}
                </Card>
            </ScrollView>

            <View style={[styles.inputRow, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
                <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                    placeholder={activeWorkspaceId || workspaceIdParam ? 'Añadir una tarea rápida...' : 'Selecciona un grupo primero'}
                    placeholderTextColor={theme.textMuted}
                    value={newTaskText}
                    onChangeText={setNewTaskText}
                    onSubmitEditing={handleCreate}
                    returnKeyType="done"
                    editable={!creating && (!!activeWorkspaceId || !!workspaceIdParam)}
                />
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: theme.primary }, (!newTaskText.trim() || creating || (!activeWorkspaceId && !workspaceIdParam)) && styles.addBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!newTaskText.trim() || creating || (!activeWorkspaceId && !workspaceIdParam)}
                >
                    {creating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
                </TouchableOpacity>
            </View>
            <BottomNav />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 32, fontWeight: '700' },
    
    segmentedControl: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 16 },
    segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    segmentText: { fontSize: 14 },
    
    groupSelectorContainer: { paddingHorizontal: 20, marginBottom: 20 },
    groupSelector: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
    groupSelectorText: { flex: 1, fontSize: 15, fontWeight: '500' },
    
    errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 16, padding: 12, borderRadius: 10, borderWidth: 1 },
    errorText: { fontSize: 14, flex: 1 },
    helperBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, padding: 12, borderRadius: 10, borderWidth: 1, gap: 8 },
    helperText: { fontSize: 14, flex: 1 },
    
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginLeft: 4 },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '600' },
    
    tasksCard: { marginBottom: 24 },
    taskItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    checkboxContainer: { marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    taskContent: { flex: 1, gap: 2 },
    taskText: { fontSize: 15 },
    taskSubtext: { fontSize: 12 },
    starBtn: { padding: 4 },
    emptyContainer: { padding: 32, alignItems: 'center', justifyContent: 'center' },
    emptyText: { textAlign: 'center', fontSize: 15 },
    
    inputRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, gap: 12 },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
    addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    addBtnDisabled: { opacity: 0.5 },
});