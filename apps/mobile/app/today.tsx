import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTodaySummary } from '../src/hooks/useTodaySummary';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { writeTodayCache } from '../src/services/TodayCacheService';
import { getLocalDateString } from '../src/utils/dateUtils';
import type { TodayData } from '../src/types/TodayData';
import { useTheme } from '../src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/ui/Card';
import { BottomNav } from '../src/components/ui/BottomNav';

export default function TodayScreen() {
    const router = useRouter();
    const theme = useTheme();
    const {
        loading,
        error,
        refresh,
        nextScheduleBlock,
        pendingTasksCount,
        topTasks,
        workspaceName,
    } = useTodaySummary();
    const { activeWorkspaceId: workspaceId } = useActiveWorkspace();

    const lastPayloadRef = useRef<string | null>(null);
    const lastWriteMsRef = useRef<number>(0);

    // Write cache for the Android widget
    useEffect(() => {
        if (loading || error) return;
        const todayDate = getLocalDateString();
        const dateLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
        
        const topTasksSlice = (topTasks ?? []).slice(0, 3).map(t => ({
            id: t.id,
            text: t.text.length > 80 ? t.text.slice(0, 80) + '…' : t.text,
            priority: t.priority ?? null,
        }));

        const nextBlock = nextScheduleBlock ? {
            id: nextScheduleBlock.id,
            title: nextScheduleBlock.title,
            start_time: nextScheduleBlock.start_time,
            duration_minutes: nextScheduleBlock.duration_minutes ?? null,
            location: nextScheduleBlock.location ? (nextScheduleBlock.location.length > 40 ? nextScheduleBlock.location.slice(0, 40) + '…' : nextScheduleBlock.location) : null,
        } : null;

        const emptyStateMessage = workspaceId === null ? 'Sin grupo activo' : pendingTasksCount === 0 && nextBlock === null ? 'Todo en orden' : null;

        const data: TodayData = {
            schemaVersion: 1,
            workspaceId,
            workspaceName: workspaceName ?? null,
            dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
            date: todayDate,
            pendingTasksCount: pendingTasksCount ?? 0,
            topTasks: topTasksSlice,
            nextScheduleBlock: nextBlock,
            stale: false,
            emptyStateMessage,
            updatedAt: new Date().toISOString(),
        };

        const base = JSON.stringify({
            schemaVersion: data.schemaVersion,
            workspaceId: data.workspaceId,
            workspaceName: data.workspaceName,
            date: data.date,
            pendingTasksCount: data.pendingTasksCount,
            topTasks: data.topTasks,
            nextScheduleBlock: data.nextScheduleBlock,
            stale: data.stale,
            emptyStateMessage: data.emptyStateMessage,
        });

        const now = Date.now();
        if (base === lastPayloadRef.current && now - lastWriteMsRef.current < 30_000) return;
        lastPayloadRef.current = base;
        lastWriteMsRef.current = now;
        writeTodayCache(data);
    }, [loading, error, workspaceName, workspaceId, pendingTasksCount, topTasks, nextScheduleBlock]);

    if (loading && !topTasks) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator color={theme.primary} size="large" />
            </View>
        );
    }

    const nextBlockEnd = nextScheduleBlock ? (() => {
        const startMin = parseInt(nextScheduleBlock.start_time.split(':')[0], 10) * 60 +
                         parseInt(nextScheduleBlock.start_time.split(':')[1], 10);
        const endMin = startMin + (nextScheduleBlock.duration_minutes || 0);
        const endHh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
        const endMm = String(endMin % 60).padStart(2, '0');
        return `${endHh}:${endMm}`;
    })() : '';

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.primary} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>Hoy</Text>
                    <TouchableOpacity>
                        <Ionicons name="calendar-outline" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {error && (
                    <View style={[styles.errorBanner, { backgroundColor: 'rgba(255, 69, 58, 0.1)', borderColor: theme.danger }]}>
                        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                        <TouchableOpacity onPress={refresh}>
                            <Text style={[styles.errorRetry, { color: theme.danger }]}>Reintentar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Siguiente evento */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Siguiente evento</Text>
                {nextScheduleBlock ? (
                    <Card style={styles.eventCard}>
                        <View style={styles.eventTop}>
                            <View style={[styles.eventIconBox, { backgroundColor: 'rgba(126, 108, 250, 0.15)' }]}>
                                <Ionicons name="book-outline" size={28} color={theme.primary} />
                            </View>
                            <View style={styles.eventInfo}>
                                <Text style={[styles.eventTitle, { color: theme.text }]}>{nextScheduleBlock.title}</Text>
                                <View style={[styles.eventTag, { backgroundColor: 'rgba(126, 108, 250, 0.15)' }]}>
                                    <Text style={[styles.eventTagText, { color: theme.primary }]}>Clase</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.eventDetails}>
                            {nextScheduleBlock.location && (
                                <View style={styles.eventDetailRow}>
                                    <Ionicons name="location-outline" size={16} color={theme.textMuted} />
                                    <Text style={[styles.eventDetailText, { color: theme.textMuted }]}>{nextScheduleBlock.location}</Text>
                                </View>
                            )}
                            <View style={styles.eventDetailRow}>
                                <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                                <Text style={[styles.eventDetailText, { color: theme.textMuted }]}>
                                    {nextScheduleBlock.start_time} - {nextBlockEnd}
                                </Text>
                            </View>
                        </View>
                    </Card>
                ) : (
                    <Card style={styles.emptyCard}>
                        <Ionicons name="calendar-outline" size={32} color={theme.textMuted} style={styles.emptyIcon} />
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay eventos próximos</Text>
                    </Card>
                )}

                {/* Tareas del día */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Tareas del día</Text>
                <Card style={styles.tasksCard} padding={8}>
                    {topTasks && topTasks.length > 0 ? (
                        topTasks.map((task) => (
                            <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => router.push('/tasks')}>
                                <Ionicons name="ellipse-outline" size={24} color={theme.textMuted} />
                                <Text style={[styles.taskText, { color: theme.text }]} numberOfLines={1}>{task.text}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={[styles.emptyTasks, { color: theme.textMuted }]}>No hay tareas pendientes para hoy</Text>
                    )}
                </Card>

                {/* Más tarde hoy */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Más tarde hoy</Text>
                <Card style={styles.emptyCard}>
                    <Ionicons name="calendar-outline" size={36} color={theme.textMuted} style={styles.emptyIcon} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay eventos programados</Text>
                    <Text style={[styles.emptySub, { color: theme.textMuted }]}>Disfruta tu tarde y sigue avanzando.</Text>
                </Card>

            </ScrollView>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 20, paddingTop: 10, paddingBottom: 20 },
    
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '700' },
    
    errorBanner: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    errorText: { fontSize: 14, flex: 1 },
    errorRetry: { fontSize: 14, fontWeight: '600', marginLeft: 12 },

    sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 10 },
    
    eventCard: { padding: 20, marginBottom: 12 },
    eventTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    eventIconBox: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    eventInfo: { flex: 1, justifyContent: 'center', height: 56 },
    eventTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    eventTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    eventTagText: { fontSize: 12, fontWeight: '600' },
    eventDetails: { gap: 6 },
    eventDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eventDetailText: { fontSize: 14 },

    tasksCard: { marginBottom: 12 },
    taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    taskText: { fontSize: 15, flex: 1 },
    emptyTasks: { padding: 16, textAlign: 'center', fontSize: 14 },

    emptyCard: { alignItems: 'center', justifyContent: 'center', padding: 32, marginBottom: 12 },
    emptyIcon: { marginBottom: 12, opacity: 0.5 },
    emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    emptySub: { fontSize: 14, textAlign: 'center' }
});