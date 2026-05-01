import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { createWorkspaceClient } from '../src/services/workspaceClient';
import type { Workspace } from '@tuxnotas/shared/src/domain/Entities';

function formatDate(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return isoString;
    }
}

export default function WorkspaceDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { loading: authLoading, getAccessToken } = useAuth();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadWorkspace = useCallback(async () => {
        if (!id) return;

        const token = getAccessToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const client = createWorkspaceClient(getAccessToken);
            const fetched = await client.getWorkspace(id);
            setWorkspace(fetched);
        } catch (err: any) {
            setError(err?.message ?? 'Error cargando workspace');
        } finally {
            setLoading(false);
        }
    }, [id, getAccessToken]);

    useFocusEffect(
        useCallback(() => {
            if (authLoading) return;
            const token = getAccessToken();
            if (!token) {
                router.replace('/login');
                return;
            }
            loadWorkspace();
        }, [authLoading, loadWorkspace, getAccessToken])
    );

    if (authLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#aeb4ff" size="large" />
            </View>
        );
    }

    if (!id) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Workspace</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.centered}>
                    <Text style={{ color: '#ef4444', fontSize: 15 }}>ID de workspace no proporcionado</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Workspace</Text>
                <View style={styles.placeholder} />
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Text style={styles.errorClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading && !workspace ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#aeb4ff" size="large" />
                </View>
            ) : workspace ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.card}>
                        <View style={styles.cardIcon}>
                            <Text style={styles.cardIconText}>W</Text>
                        </View>
                        <Text style={styles.workspaceName}>{workspace.name}</Text>
                    </View>

                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>Información</Text>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>ID</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>
                                ...{workspace.id.slice(-6)}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Creado</Text>
                            <Text style={styles.infoValue}>{formatDate(workspace.created_at)}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Actualizado</Text>
                            <Text style={styles.infoValue}>{formatDate(workspace.updated_at)}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.tasksButton}
                        onPress={() => router.push(`/tasks?workspaceId=${encodeURIComponent(workspace.id)}`)}
                    >
                        <Text style={styles.tasksButtonText}>Ver tareas</Text>
                    </TouchableOpacity>
                </ScrollView>
            ) : null}
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
    errorBannerText: { color: '#ef4444', fontSize: 13, flex: 1 },
    errorClose: { color: '#ef4444', marginLeft: 8 },
    content: { padding: 20, paddingBottom: 40 },
    card: {
        backgroundColor: '#1a1a1a',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#252525',
    },
    cardIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#252540',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardIconText: { color: '#aeb4ff', fontSize: 28, fontWeight: 'bold' },
    workspaceName: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    infoSection: {
        backgroundColor: '#1a1a1a',
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#252525',
    },
    sectionTitle: { color: '#aeb4ff', fontSize: 13, fontWeight: '600', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    infoLabel: { color: '#555', fontSize: 14 },
    infoValue: { color: '#ccc', fontSize: 14, maxWidth: '60%', textAlign: 'right' },
    tasksButton: {
        backgroundColor: '#6872c6',
        borderRadius: 10,
        padding: 18,
        alignItems: 'center',
    },
    tasksButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});