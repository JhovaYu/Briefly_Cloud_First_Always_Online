import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { queryClient } from '../src/lib/queryClient';
import { joinWorkspaceWithAuth, createWorkspaceWithAuth } from '../src/services/workspaceClient';
import type { Workspace } from '@tuxnotas/shared/src/domain/Entities';

function formatDate(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return isoString;
    }
}

export default function WorkspacesScreen() {
    const router = useRouter();
    const { loading: authLoading, getAccessToken } = useAuth();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const { activeWorkspaceId, setActiveWorkspace } = useActiveWorkspace();

    // ── Join/Create section state ───────────────────────────────────────────
    const [joinCode, setJoinCode] = useState('');
    const [createName, setCreateName] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const loadWorkspaces = useCallback(async () => {
        const token = getAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const { fetchWorkspacesWithAuth } = await import('../src/services/workspaceClient');
            const fetched = await fetchWorkspacesWithAuth();
            setWorkspaces(fetched);
        } catch (err: any) {
            setError(err?.message ?? 'Error cargando workspaces');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useFocusEffect(
        useCallback(() => {
            if (authLoading) return;
            const token = getAccessToken();
            if (!token) {
                router.replace('/login');
                return;
            }
            loadWorkspaces();
        }, [authLoading, loadWorkspaces, getAccessToken])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadWorkspaces();
        setRefreshing(false);
    };

    const handleWorkspacePress = (workspace: Workspace) => {
        router.push(`/workspace-detail?id=${encodeURIComponent(workspace.id)}`);
    };

    const handleUseAsActive = (workspace: Workspace) => {
        setActiveWorkspace(workspace.id);
    };

    // ── Join/Create handlers ───────────────────────────────────────────────

    const handleJoinWorkspace = async () => {
        const code = joinCode.trim();
        if (!code) return;

        setActionLoading(true);
        setActionError(null);
        try {
            const result = await joinWorkspaceWithAuth(code);
            await setActiveWorkspace(result.workspace.id);
            await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            setJoinCode('');
            await loadWorkspaces();
        } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('404')) {
                setActionError('Workspace no encontrado');
            } else if (msg.includes('401') || msg.includes('403')) {
                setActionError('Sesión no válida');
            } else {
                setActionError('Error al unirse al workspace');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateWorkspace = async () => {
        const name = createName.trim();
        if (!name) return;

        setActionLoading(true);
        setActionError(null);
        try {
            const ws = await createWorkspaceWithAuth(name);
            await setActiveWorkspace(ws.id);
            await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            setCreateName('');
            await loadWorkspaces();
        } catch (err: any) {
            setActionError(err?.message ?? 'Error al crear workspace');
        } finally {
            setActionLoading(false);
        }
    };

    const renderItem = ({ item }: { item: Workspace }) => {
        const isActive = item.id === activeWorkspaceId;
        return (
            <TouchableOpacity
                style={styles.workspaceItem}
                onPress={() => handleWorkspacePress(item)}
                onLongPress={() => !isActive && setActiveWorkspace(item.id)}
            >
                <View style={styles.workspaceIcon}>
                    <Text style={styles.workspaceIconText}>W</Text>
                </View>
                <View style={styles.workspaceInfo}>
                    <View style={styles.workspaceNameRow}>
                        <Text style={styles.workspaceName} numberOfLines={1}>{item.name}</Text>
                        {isActive && (
                            <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>Activo</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.workspaceDate}>{formatDate(item.created_at)}</Text>
                </View>
                {isActive ? (
                    <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Activo</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.useActiveBtn}
                        onPress={() => handleUseAsActive(item)}
                    >
                        <Text style={styles.useActiveBtnText}>Usar en Hoy</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.workspaceArrow}>→</Text>
            </TouchableOpacity>
        );
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
                <Text style={styles.title}>Workspaces</Text>
                <View style={styles.placeholder} />
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Text style={styles.errorClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Join/Create Section ─────────────────────────────────────── */}
            <View style={styles.joinSection}>
                <View style={styles.joinRow}>
                    <TextInput
                        style={styles.joinInput}
                        placeholder="Código UUID del workspace"
                        placeholderTextColor="#555"
                        value={joinCode}
                        onChangeText={setJoinCode}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!actionLoading}
                    />
                    <TouchableOpacity
                        style={[styles.joinBtn, (!joinCode.trim() || actionLoading) && styles.joinBtnDisabled]}
                        onPress={handleJoinWorkspace}
                        disabled={!joinCode.trim() || actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color="#aeb4ff" size="small" />
                        ) : (
                            <Text style={styles.joinBtnText}>Unirse</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>o</Text>
                    <View style={styles.dividerLine} />
                </View>

                <View style={styles.joinRow}>
                    <TextInput
                        style={styles.createInput}
                        placeholder="Nombre del nuevo workspace"
                        placeholderTextColor="#555"
                        value={createName}
                        onChangeText={setCreateName}
                        editable={!actionLoading}
                    />
                    <TouchableOpacity
                        style={[styles.createBtn, (!createName.trim() || actionLoading) && styles.createBtnDisabled]}
                        onPress={handleCreateWorkspace}
                        disabled={!createName.trim() || actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.createBtnText}>Crear</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {actionError && (
                    <Text style={styles.actionError}>{actionError}</Text>
                )}
            </View>

            {loading && workspaces.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#aeb4ff" size="large" />
                </View>
            ) : workspaces.length === 0 && !error ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>Sin workspaces</Text>
                    <Text style={styles.emptySubtext}>Crea uno o únete a un workspace</Text>
                </View>
            ) : (
                <FlatList
                    data={workspaces}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor="#aeb4ff"
                        />
                    }
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
    placeholder: { width: 40 },
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
    // Join/Create section
    joinSection: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#252525',
    },
    joinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    joinInput: {
        flex: 1,
        backgroundColor: '#111',
        color: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    joinBtn: {
        backgroundColor: '#252540',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#3a3a6a',
    },
    joinBtnDisabled: { opacity: 0.5 },
    joinBtnText: { color: '#aeb4ff', fontSize: 14, fontWeight: '600' },
    createInput: {
        flex: 1,
        backgroundColor: '#111',
        color: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    createBtn: {
        backgroundColor: '#6872c6',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
    dividerText: { color: '#555', fontSize: 12 },
    actionError: { color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' },
    list: { paddingHorizontal: 16, paddingBottom: 32 },
    workspaceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#252525',
    },
    workspaceIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#252540',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    workspaceIconText: { color: '#aeb4ff', fontSize: 18, fontWeight: 'bold' },
    workspaceInfo: { flex: 1 },
    workspaceName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    workspaceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    activeBadge: {
        backgroundColor: '#1a3a1a',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: '#2d6a2d',
    },
    activeBadgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
    useActiveBtn: {
        backgroundColor: '#252540',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#3a3a6a',
    },
    useActiveBtnText: { color: '#aeb4ff', fontSize: 11, fontWeight: '600' },
    workspaceDate: { color: '#555', fontSize: 12 },
    workspaceArrow: { color: '#555', fontSize: 18 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#555', fontSize: 18, fontWeight: '600' },
    emptySubtext: { color: '#444', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
});