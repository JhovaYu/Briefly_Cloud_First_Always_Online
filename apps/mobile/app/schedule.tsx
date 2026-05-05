import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SectionList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { createScheduleClient } from '../src/services/scheduleClient';
import { queryClient } from '../src/lib/queryClient';
import { createUuid } from '@tuxnotas/shared/src/logic/uuid';
import type { ScheduleBlock } from '../src/services/scheduleClient';

// ── Day names ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function dayName(dayOfWeek: number): string {
    return DAY_NAMES[dayOfWeek] ?? `Día ${dayOfWeek}`;
}

// ── Section type for SectionList ────────────────────────────────────────────

interface Section {
    title: string;
    data: ScheduleBlock[];
}

// ── Form state ───────────────────────────────────────────────────────────────

interface FormState {
    title: string;
    day_of_week: string; // '0'–'6'
    start_time: string;
    duration_minutes: string;
    location: string;
    notes: string;
}

const EMPTY_FORM: FormState = {
    title: '',
    day_of_week: '0',
    start_time: '09:00',
    duration_minutes: '60',
    location: '',
    notes: '',
};

// ── Validation ────────────────────────────────────────────────────────────────

function validateForm(form: FormState): string | null {
    if (!form.title.trim()) return 'El título es requerido';
    if (!/^\d{2}:\d{2}$/.test(form.start_time)) return 'Hora inválida (formato HH:MM)';
    const dur = parseInt(form.duration_minutes, 10);
    if (isNaN(dur) || dur < 5 || dur > 480) return 'Duración entre 5 y 480 min';
    return null;
}

// ── Block row ─────────────────────────────────────────────────────────────────

function BlockRow({
    block,
    onEdit,
    onDelete,
}: {
    block: ScheduleBlock;
    onEdit: (block: ScheduleBlock) => void;
    onDelete: (block: ScheduleBlock) => void;
}) {
    const endMinutes = parseInt(block.start_time.split(':')[0], 10) * 60 +
        parseInt(block.start_time.split(':')[1], 10) + block.duration_minutes;
    const endHH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endMM = String(endMinutes % 60).padStart(2, '0');

    return (
        <View style={styles.blockItem}>
            <View style={[styles.colorDot, { backgroundColor: block.color ?? '#6872c6' }]} />
            <View style={styles.blockInfo}>
                <Text style={styles.blockTitle}>{block.title}</Text>
                <Text style={styles.blockTime}>
                    {block.start_time} – {endHH}:{endMM}
                    {'  ·  '}
                    {block.duration_minutes} min
                </Text>
                {block.location ? (
                    <Text style={styles.blockMeta}>{block.location}</Text>
                ) : null}
            </View>
            <View style={styles.blockActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(block)}>
                    <Text style={styles.editBtnText}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(block)}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
    const router = useRouter();
    const { workspaceId: workspaceIdParam } = useLocalSearchParams<{ workspaceId?: string }>();
    const { loading: authLoading, getAccessToken } = useAuth();
    const { activeWorkspaceId, activeWorkspaceName: workspaceName } = useActiveWorkspace();

    const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Modal form
    const [modalVisible, setModalVisible] = useState(false);
    const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);

    const buildSections = useCallback((blocks: ScheduleBlock[]): Section[] => {
        const byDay: Record<number, ScheduleBlock[]> = {};
        for (const b of blocks) {
            if (!byDay[b.day_of_week]) byDay[b.day_of_week] = [];
            byDay[b.day_of_week].push(b);
        }
        return DAY_NAMES.map((name, i) => ({
            title: name,
            data: byDay[i] ?? [],
        })).filter(s => s.data.length > 0);
    }, []);

    const loadBlocks = useCallback(async () => {
        const token = getAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const scheduleClient = createScheduleClient(getAccessToken);
            let workspaceId: string;

            if (workspaceIdParam) {
                workspaceId = workspaceIdParam;
            } else if (activeWorkspaceId) {
                workspaceId = activeWorkspaceId;
            } else {
                throw new Error('No active workspace');
            }

            const fetched = await scheduleClient.listScheduleBlocks(workspaceId);
            setBlocks(fetched);
            setSections(buildSections(fetched));
        } catch (err: any) {
            setError(err?.message ?? 'Error cargando horarios');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, workspaceIdParam, activeWorkspaceId, buildSections]);

    useEffect(() => {
        if (authLoading) return;
        const token = getAccessToken();
        if (!token) {
            router.replace('/login');
            return;
        }
        loadBlocks();
    }, [authLoading, loadBlocks, getAccessToken]);

    // ── Open modal ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditingBlock(null);
        setForm(EMPTY_FORM);
        setFormError(null);
        setModalVisible(true);
    };

    const openEdit = (block: ScheduleBlock) => {
        setEditingBlock(block);
        setForm({
            title: block.title,
            day_of_week: String(block.day_of_week),
            start_time: block.start_time,
            duration_minutes: String(block.duration_minutes),
            location: block.location ?? '',
            notes: block.notes ?? '',
        });
        setFormError(null);
        setModalVisible(true);
    };

    // ── Submit form ──────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        const validation = validateForm(form);
        if (validation) {
            setFormError(validation);
            return;
        }

        const token = getAccessToken();
        if (!token) return;

        const scheduleClient = createScheduleClient(getAccessToken);
        let workspaceId: string;

        if (workspaceIdParam) {
            workspaceId = workspaceIdParam;
        } else if (activeWorkspaceId) {
            workspaceId = activeWorkspaceId;
        } else {
            throw new Error('No active workspace');
        }

        setCreating(true);
        setFormError(null);

        try {
            if (editingBlock) {
                const updated = await scheduleClient.updateScheduleBlock(
                    workspaceId,
                    editingBlock.id,
                    {
                        title: form.title.trim(),
                        day_of_week: parseInt(form.day_of_week, 10),
                        start_time: form.start_time,
                        duration_minutes: parseInt(form.duration_minutes, 10),
                        location: form.location.trim() || null,
                        notes: form.notes.trim() || null,
                    },
                );
                setBlocks(prev => {
                    const next = prev.map(b => (b.id === updated.id ? updated : b));
                    setSections(buildSections(next));
                    return next;
                });
            } else {
                const created = await scheduleClient.createScheduleBlock(workspaceId, {
                    id: createUuid(),
                    title: form.title.trim(),
                    day_of_week: parseInt(form.day_of_week, 10),
                    start_time: form.start_time,
                    duration_minutes: parseInt(form.duration_minutes, 10),
                    location: form.location.trim() || null,
                    notes: form.notes.trim() || null,
                });
                setBlocks(prev => {
                    const next = [...prev, created];
                    setSections(buildSections(next));
                    return next;
                });
            }
            queryClient.invalidateQueries({ queryKey: ['schedule'] });
            setModalVisible(false);
        } catch (err: any) {
            setFormError(err?.message ?? 'Error guardando bloque');
        } finally {
            setCreating(false);
        }
    };

    // ── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = async (block: ScheduleBlock) => {
        const token = getAccessToken();
        if (!token) return;

        const scheduleClient = createScheduleClient(getAccessToken);
        let workspaceId: string;

        if (workspaceIdParam) {
            workspaceId = workspaceIdParam;
        } else if (activeWorkspaceId) {
            workspaceId = activeWorkspaceId;
        } else {
            throw new Error('No active workspace');
        }

        const previous = blocks;
        setBlocks(prev => {
            const next = prev.filter(b => b.id !== block.id);
            setSections(buildSections(next));
            return next;
        });

        try {
            await scheduleClient.deleteScheduleBlock(workspaceId, block.id);
            queryClient.invalidateQueries({ queryKey: ['schedule'] });
        } catch {
            setBlocks(previous);
        }
    };

    // ── Auth guard ──────────────────────────────────────────────────────────

    if (authLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#aeb4ff" size="large" />
            </View>
        );
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Horarios{workspaceName ? ` · ${workspaceName}` : ''}</Text>
                <TouchableOpacity onPress={loadBlocks} style={styles.refreshBtn} disabled={loading}>
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

            {loading && blocks.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#aeb4ff" size="large" />
                </View>
            ) : blocks.length === 0 && !error ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>Sin horarios</Text>
                    <Text style={styles.emptySubtext}>Toca + para agregar el primer bloque</Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <BlockRow block={item} onEdit={openEdit} onDelete={handleDelete} />
                    )}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                />
            )}

            {/* FAB add button */}
            <TouchableOpacity style={styles.fab} onPress={openCreate}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Form modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingBlock ? 'Editar bloque' : 'Nuevo bloque'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {formError && (
                            <View style={styles.formErrorBanner}>
                                <Text style={styles.formErrorText}>{formError}</Text>
                            </View>
                        )}

                        <TextInput
                            style={styles.input}
                            placeholder="Título *"
                            placeholderTextColor="#666"
                            value={form.title}
                            onChangeText={v => setForm(f => ({ ...f, title: v }))}
                            maxLength={255}
                        />

                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <Text style={styles.fieldLabel}>Día</Text>
                                <View style={styles.dayPicker}>
                                    {DAY_NAMES.map((name, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={[
                                                styles.dayChip,
                                                form.day_of_week === String(i) && styles.dayChipActive,
                                            ]}
                                            onPress={() => setForm(f => ({ ...f, day_of_week: String(i) }))}
                                        >
                                            <Text
                                                style={[
                                                    styles.dayChipText,
                                                    form.day_of_week === String(i) && styles.dayChipTextActive,
                                                ]}
                                            >
                                                {name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <Text style={styles.fieldLabel}>Hora (HH:MM)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="09:00"
                                    placeholderTextColor="#666"
                                    value={form.start_time}
                                    onChangeText={v => setForm(f => ({ ...f, start_time: v }))}
                                    maxLength={5}
                                    keyboardType="numbers-and-punctuation"
                                />
                            </View>
                            <View style={styles.halfField}>
                                <Text style={styles.fieldLabel}>Duración (min)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="60"
                                    placeholderTextColor="#666"
                                    value={form.duration_minutes}
                                    onChangeText={v => setForm(f => ({ ...f, duration_minutes: v }))}
                                    maxLength={3}
                                    keyboardType="number-pad"
                                />
                            </View>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Ubicación (opcional)"
                            placeholderTextColor="#666"
                            value={form.location}
                            onChangeText={v => setForm(f => ({ ...f, location: v }))}
                            maxLength={255}
                        />

                        <TextInput
                            style={[styles.input, styles.notesInput]}
                            placeholder="Notas (opcional)"
                            placeholderTextColor="#666"
                            value={form.notes}
                            onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                            multiline
                            maxLength={2000}
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={creating}
                        >
                            {creating ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>
                                    {editingBlock ? 'Guardar cambios' : 'Crear bloque'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    sectionHeader: {
        paddingVertical: 8,
        paddingTop: 16,
    },
    sectionTitle: { color: '#aeb4ff', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    blockItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#252525',
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    blockInfo: { flex: 1 },
    blockTitle: { color: '#ddd', fontSize: 15, fontWeight: '600', marginBottom: 3 },
    blockTime: { color: '#888', fontSize: 13 },
    blockMeta: { color: '#666', fontSize: 12, marginTop: 2 },
    blockActions: { flexDirection: 'row', gap: 8 },
    editBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
    editBtnText: { color: '#888', fontSize: 16 },
    deleteBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
    deleteBtnText: { color: '#ef4444', fontSize: 16 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#555', fontSize: 18, fontWeight: '600' },
    emptySubtext: { color: '#444', fontSize: 13, marginTop: 6 },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#6872c6',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    fabText: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    modalClose: { color: '#666', fontSize: 20 },
    formErrorBanner: {
        backgroundColor: '#3b1010',
        borderRadius: 8,
        padding: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    formErrorText: { color: '#ef4444', fontSize: 13 },
    input: {
        backgroundColor: '#111',
        color: '#fff',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 12,
    },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    fieldLabel: { color: '#666', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    dayChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
    },
    dayChipActive: { backgroundColor: '#6872c6', borderColor: '#6872c6' },
    dayChipText: { color: '#666', fontSize: 13 },
    dayChipTextActive: { color: '#fff', fontWeight: '600' },
    notesInput: { minHeight: 80, textAlignVertical: 'top' },
    submitBtn: {
        backgroundColor: '#6872c6',
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});