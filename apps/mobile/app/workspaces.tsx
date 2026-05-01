import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { createWorkspaceClient } from '../src/services/workspaceClient';
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

    const loadWorkspaces = useCallback(async () => {
        const token = getAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const client = createWorkspaceClient(getAccessToken);
            const fetched = await client.listWorkspaces();
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

    const renderItem = ({ item }: { item: Workspace }) => (
        <TouchableOpacity style={styles.workspaceItem} onPress={() => handleWorkspacePress(item)}>
            <View style={styles.workspaceIcon}>
                <Text style={styles.workspaceIconText}>W</Text>
            </View>
            <View style={styles.workspaceInfo}>
                <Text style={styles.workspaceName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.workspaceDate}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.workspaceArrow}>→</Text>
        </TouchableOpacity>
    );

    if (authLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#aeb4ff" size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
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

            {loading && workspaces.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#aeb4ff" size="large" />
                </View>
            ) : workspaces.length === 0 && !error ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>Sin workspaces</Text>
                    <Text style={styles.emptySubtext}>Crea uno desde la app web para verlo aquí</Text>
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
        </View>
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
    workspaceDate: { color: '#555', fontSize: 12 },
    workspaceArrow: { color: '#555', fontSize: 18 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#555', fontSize: 18, fontWeight: '600' },
    emptySubtext: { color: '#444', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
});