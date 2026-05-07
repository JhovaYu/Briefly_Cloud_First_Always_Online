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
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { queryClient } from '../src/lib/queryClient';
import { joinWorkspaceWithAuth, createWorkspaceWithAuth } from '../src/services/workspaceClient';
import type { Workspace } from '@tuxnotas/shared/src/domain/Entities';
import { useTheme } from '../src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/ui/Card';
import { CreateModal } from '../src/components/ui/CreateModal';
import { BottomNav } from '../src/components/ui/BottomNav';

function formatDate(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-ES', { month: 'long', day: 'numeric' });
    } catch {
        return isoString;
    }
}

// Helper to assign a stable color/icon to a workspace based on its ID
const getGroupVisuals = (id: string, theme: any) => {
    const colors = [theme.groupColors.purple, theme.groupColors.green, theme.groupColors.yellow, theme.groupColors.blue, theme.groupColors.pink];
    const icons = ['book', 'leaf', 'business', 'pencil', 'planet'] as const;
    
    // simple hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return { color: colors[index], icon: icons[index] };
};

export default function WorkspacesScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { loading: authLoading, getAccessToken } = useAuth();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const { activeWorkspaceId, setActiveWorkspace } = useActiveWorkspace();
    const [searchQuery, setSearchQuery] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    const loadWorkspaces = useCallback(async () => {
        const token = getAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            setLoading(false);
            setError('Error de conexión');
        }, 5000);

        try {
            const { fetchWorkspacesWithAuth } = await import('../src/services/workspaceClient');
            const fetched = await fetchWorkspacesWithAuth();
            clearTimeout(timeout);
            if (timedOut) return;
            setWorkspaces(fetched);
        } catch (err: any) {
            clearTimeout(timeout);
            if (timedOut) return;
            setError(err?.message ?? 'Error cargando grupos');
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
        setActiveWorkspace(workspace.id);
        router.push(`/workspace-detail?id=${encodeURIComponent(workspace.id)}`);
    };

    const filteredWorkspaces = workspaces.filter(ws => 
        ws.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleJoinWorkspace = async (code: string) => {
        const result = await joinWorkspaceWithAuth(code);
        await setActiveWorkspace(result.workspace.id);
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        await loadWorkspaces();
    };

    const handleCreateWorkspace = async (name: string) => {
        const ws = await createWorkspaceWithAuth(name);
        await setActiveWorkspace(ws.id);
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        await loadWorkspaces();
    };

    const renderItem = ({ item }: { item: Workspace }) => {
        const isActive = item.id === activeWorkspaceId;
        const visuals = getGroupVisuals(item.id, theme);
        
        return (
            <Card style={styles.workspaceItem} padding={16} variant="default">
                <TouchableOpacity
                    style={styles.workspaceTouchable}
                    onPress={() => handleWorkspacePress(item)}
                >
                    <View style={[styles.workspaceIcon, { backgroundColor: `${visuals.color}26` }]}>
                        <Ionicons name={visuals.icon as any} size={24} color={visuals.color} />
                    </View>
                    <View style={styles.workspaceInfo}>
                        <Text style={[styles.workspaceName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.workspaceDate, { color: theme.textMuted }]}>
                            {/* Assuming documents count would go here, mock to 0 for MVP if not available */}
                            0 hojas · Editada el {formatDate(item.created_at)}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                </TouchableOpacity>
            </Card>
        );
    };

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
                <Text style={[styles.title, { color: theme.text }]}>Grupos</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Ionicons name="add" size={28} color={theme.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="search" size={20} color={theme.textMuted} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Buscar grupo"
                        placeholderTextColor={theme.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {error && (
                <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,69,58,0.1)', borderColor: theme.danger }]}>
                    <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Ionicons name="close" size={20} color={theme.danger} />
                    </TouchableOpacity>
                </View>
            )}

            {error && workspaces.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="alert-circle-outline" size={48} color={theme.danger} style={{ marginBottom: 16 }} />
                    <Text style={[styles.emptyText, { color: theme.text }]}>Error de conexión</Text>
                    <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>No se pudieron cargar los grupos.</Text>
                    <TouchableOpacity onPress={handleRefresh} style={{ marginTop: 12, padding: 8, backgroundColor: 'rgba(255,69,58,0.1)', borderRadius: 8 }}>
                        <Text style={{ color: theme.danger, fontWeight: '600' }}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            ) : loading && workspaces.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={theme.primary} size="large" />
                </View>
            ) : workspaces.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="folder-open-outline" size={48} color={theme.textMuted} style={{ marginBottom: 16 }} />
                    <Text style={[styles.emptyText, { color: theme.text }]}>No tienes grupos</Text>
                    <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>Crea uno nuevo usando el botón +</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredWorkspaces}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
                />
            )}

            <TouchableOpacity 
                style={[styles.fab, { backgroundColor: theme.primary }]}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            <CreateModal 
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onCreateWorkspace={handleCreateWorkspace}
                onJoinWorkspace={handleJoinWorkspace}
            />
            <BottomNav />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 32, fontWeight: '700' },
    
    searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 10 },
    searchInput: { flex: 1, fontSize: 16 },
    
    errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 16, padding: 12, borderRadius: 10, borderWidth: 1 },
    errorText: { fontSize: 14, flex: 1 },
    
    list: { paddingHorizontal: 20, paddingBottom: 100 },
    workspaceItem: { marginBottom: 12 },
    workspaceTouchable: { flexDirection: 'row', alignItems: 'center' },
    workspaceIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    workspaceInfo: { flex: 1 },
    workspaceName: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
    workspaceDate: { fontSize: 13 },
    
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
    emptyText: { fontSize: 18, fontWeight: '600' },
    emptySubtext: { fontSize: 14, marginTop: 6, textAlign: 'center' },
    
    fab: { position: 'absolute', bottom: 80, right: 20, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
});