import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { createWorkspaceClient } from '../src/services/workspaceClient';
import type { Workspace } from '@tuxnotas/shared/src/domain/Entities';
import { useTheme } from '../src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/ui/Card';

function formatDate(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-ES', {
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
    const theme = useTheme();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { loading: authLoading, getAccessToken } = useAuth();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [activeTab, setActiveTab] = useState<'hojas' | 'tareas' | 'miembros'>('hojas');
    const [searchQuery, setSearchQuery] = useState('');

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
            setError(err?.message ?? 'Error cargando grupo');
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
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator color={theme.primary} size="large" />
            </View>
        );
    }

    if (!id) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Error</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centered}>
                    <Text style={{ color: theme.danger, fontSize: 15 }}>ID de grupo no proporcionado</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                        {workspace?.name || 'Cargando...'}
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                        ID: {workspace?.id.slice(-6) || '---'}
                    </Text>
                </View>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={24} color={theme.text} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {['hojas', 'tareas', 'miembros'].map((tab) => {
                    const isActive = activeTab === tab;
                    const label = tab.charAt(0).toUpperCase() + tab.slice(1);
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabBtn, isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                            onPress={() => setActiveTab(tab as any)}
                        >
                            <Text style={[styles.tabText, { color: isActive ? theme.primary : theme.textSecondary }, isActive && { fontWeight: '600' }]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {error && (
                <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,69,58,0.1)', borderColor: theme.danger }]}>
                    <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Ionicons name="close" size={20} color={theme.danger} />
                    </TouchableOpacity>
                </View>
            )}

            {loading && !workspace ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={theme.primary} size="large" />
                </View>
            ) : workspace ? (
                <ScrollView contentContainerStyle={styles.content}>
                    
                    {activeTab === 'hojas' && (
                        <View>
                            <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Ionicons name="search" size={20} color={theme.textMuted} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text }]}
                                    placeholder="Buscar hoja"
                                    placeholderTextColor={theme.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            <Card style={styles.itemCard} padding={0}>
                                <TouchableOpacity
                                    style={styles.sheetItem}
                                    onPress={() => router.push(`/workspace-shared-text?id=${encodeURIComponent(workspace.id)}`)}
                                >
                                    <View style={[styles.sheetIconBox, { backgroundColor: 'rgba(126, 108, 250, 0.15)' }]}>
                                        <Ionicons name="document-text-outline" size={24} color={theme.primary} />
                                    </View>
                                    <View style={styles.sheetInfo}>
                                        <Text style={[styles.sheetTitle, { color: theme.text }]}>Texto Compartido</Text>
                                        <Text style={[styles.sheetSub, { color: theme.textMuted }]} numberOfLines={1}>
                                            Espacio de colaboración en texto plano
                                        </Text>
                                    </View>
                                    <View style={styles.sheetRight}>
                                        <Text style={[styles.sheetTime, { color: theme.textMuted }]}>
                                            {formatDate(workspace.updated_at).split(',')[0]}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={{ marginTop: 4 }} />
                                    </View>
                                </TouchableOpacity>
                            </Card>
                        </View>
                    )}

                    {activeTab === 'tareas' && (
                        <View style={styles.tabContentCentered}>
                            <Ionicons name="checkbox-outline" size={48} color={theme.textMuted} style={{ marginBottom: 16 }} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>Tareas del grupo</Text>
                            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Gestiona las tareas asignadas a este grupo.</Text>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                                onPress={() => router.push(`/tasks?workspaceId=${encodeURIComponent(workspace.id)}`)}
                            >
                                <Text style={styles.actionBtnText}>Ver tareas</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeTab === 'miembros' && (
                        <View style={styles.tabContentCentered}>
                            <Ionicons name="people-outline" size={48} color={theme.textMuted} style={{ marginBottom: 16 }} />
                            <Text style={[styles.emptyTitle, { color: theme.text }]}>Miembros</Text>
                            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Invita y gestiona a los miembros de tu grupo de estudio.</Text>
                            <Text style={[styles.infoCode, { color: theme.primary, backgroundColor: 'rgba(126, 108, 250, 0.15)' }]}>
                                Código: {workspace.id}
                            </Text>
                        </View>
                    )}

                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTextContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16 },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabText: { fontSize: 15 },
    
    errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1 },
    errorText: { fontSize: 14, flex: 1 },
    
    content: { padding: 20 },
    
    searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 10, marginBottom: 20 },
    searchInput: { flex: 1, fontSize: 16 },
    
    itemCard: { overflow: 'hidden' },
    sheetItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    sheetIconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    sheetInfo: { flex: 1 },
    sheetTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    sheetSub: { fontSize: 13 },
    sheetRight: { alignItems: 'flex-end' },
    sheetTime: { fontSize: 12 },
    
    tabContentCentered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
    emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20, marginBottom: 24, lineHeight: 20 },
    actionBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
    actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    infoCode: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, fontSize: 14, fontWeight: '600', overflow: 'hidden' }
});