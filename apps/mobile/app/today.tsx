/**
 * Today Dashboard — PM-06G.1
 *
 * Shows a daily summary: next schedule block, pending task count,
 * top 3 pending tasks, and quick-action navigation buttons.
 * Uses existing clients only; no new endpoints, no backend changes.
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTodaySummary } from '../src/hooks/useTodaySummary';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { writeTodayCache } from '../src/services/TodayCacheService';
import { getLocalDateString } from '../src/utils/dateUtils';
import type { TodayData } from '../src/types/TodayData';

const BACKEND_BASE =
    (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://briefly.ddns.net');

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
}

// ── Section: Next Schedule Block ────────────────────────────────────────────

function NextBlockCard({ block }: { block: NonNullable<ReturnType<typeof useTodaySummary>['nextScheduleBlock']> }) {
    const endMin =
        parseInt(block.start_time.split(':')[0], 10) * 60 +
        parseInt(block.start_time.split(':')[1], 10) +
        block.duration_minutes;
    const endHh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
    const endMm = String(endMin % 60).padStart(2, '0');

    return (
        <View style={styles.card}>
            <Text style={styles.cardLabel}>Próximo</Text>
            <View style={styles.blockRow}>
                <View style={[styles.blockDot, { backgroundColor: block.color ?? '#6872c6' }]} />
                <View style={styles.blockInfo}>
                    <Text style={styles.blockTitle}>{block.title}</Text>
                    <Text style={styles.blockTime}>
                        {block.start_time} – {endHh}:{endMm}
                        {'  ·  '}
                        {block.duration_minutes} min
                    </Text>
                    {block.location ? (
                        <Text style={styles.blockMeta}>📍 {block.location}</Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function EmptyBlockCard() {
    return (
        <View style={styles.card}>
            <Text style={styles.cardLabel}>Próximo</Text>
            <View style={styles.emptyBlock}>
                <Text style={styles.emptyBlockTitle}>Sin horarios hoy</Text>
                <Text style={styles.emptyBlockSub}>Revisa el calendario para agregar bloques</Text>
            </View>
        </View>
    );
}

// ── Section: Pending Tasks ─────────────────────────────────────────────────

function TasksCard({
    count,
    tasks,
    onPress,
}: {
    count: number;
    tasks: ReturnType<typeof useTodaySummary>['topTasks'];
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>Tareas</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count}</Text>
                </View>
            </View>
            {tasks.length === 0 ? (
                <Text style={styles.emptyTasksText}>Sin tareas pendientes</Text>
            ) : (
                <View style={styles.taskList}>
                    {tasks.map(task => (
                        <View key={task.id} style={styles.taskRow}>
                            <View style={styles.taskBullet} />
                            <Text style={styles.taskText} numberOfLines={1}>
                                {task.text}
                            </Text>
                        </View>
                    ))}
                    {count > 3 && (
                        <Text style={styles.moreText}>+{count - 3} más</Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}

// ── Section: Quick Actions ───────────────────────────────────────────────────

function QuickActions({
    onTasks,
    onSchedule,
    onWorkspaces,
    onRefresh,
}: {
    onTasks: () => void;
    onSchedule: () => void;
    onWorkspaces: () => void;
    onRefresh: () => void;
}) {
    return (
        <View style={styles.actionsCard}>
            <Text style={styles.cardLabel}>Acciones rápidas</Text>
            <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionBtn} onPress={onTasks}>
                    <Text style={styles.actionIcon}>☑️</Text>
                    <Text style={styles.actionLabel}>Tareas</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={onSchedule}>
                    <Text style={styles.actionIcon}>📅</Text>
                    <Text style={styles.actionLabel}>Horario</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={onWorkspaces}>
                    <Text style={styles.actionIcon}>🗂️</Text>
                    <Text style={styles.actionLabel}>Workspaces</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={onRefresh}>
                    <Text style={styles.actionIcon}>↻</Text>
                    <Text style={styles.actionLabel}>Refrescar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function TodayScreen() {
    const router = useRouter();
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

    useEffect(() => {
        if (loading || error) return;

        const todayDate = getLocalDateString();
        const dateLabel = new Intl.DateTimeFormat('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        }).format(new Date());

        const topTasksSlice = (topTasks ?? []).slice(0, 3).map(t => ({
            id: t.id,
            text: t.text.length > 80 ? t.text.slice(0, 80) + '…' : t.text,
            priority: t.priority ?? null,
        }));

        const nextBlock = nextScheduleBlock
            ? {
                  id: nextScheduleBlock.id,
                  title: nextScheduleBlock.title,
                  start_time: nextScheduleBlock.start_time,
                  duration_minutes: nextScheduleBlock.duration_minutes ?? null,
                  location: nextScheduleBlock.location
                      ? nextScheduleBlock.location.length > 40
                          ? nextScheduleBlock.location.slice(0, 40) + '…'
                          : nextScheduleBlock.location
                      : null,
              }
            : null;

        const emptyStateMessage =
            workspaceId === null ? 'Sin workspace activo'
            : pendingTasksCount === 0 && nextBlock === null ? 'Todo en orden ✓'
            : null;

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

        // Build a serializable base for comparison (without updatedAt)
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
        if (base === lastPayloadRef.current && now - lastWriteMsRef.current < 30_000) {
            return;
        }

        lastPayloadRef.current = base;
        lastWriteMsRef.current = now;

        writeTodayCache(data);
    }, [loading, error, workspaceName, workspaceId, pendingTasksCount, topTasks, nextScheduleBlock]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#aeb4ff" size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={refresh}
                        tintColor="#aeb4ff"
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Text style={styles.title}>Hoy</Text>
                        <View style={styles.cloudBadge}>
                            <Text style={styles.cloudBadgeText}>☁️ CLOUD</Text>
                        </View>
                    </View>
                    <Text style={styles.greeting}>{getGreeting()}</Text>
                    {workspaceName ? (
                        <Text style={styles.workspaceName}>📁 {workspaceName}</Text>
                    ) : null}
                </View>

                {/* Error */}
                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={refresh}>
                            <Text style={styles.errorRetry}>↻ Reintentar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Next Block */}
                {nextScheduleBlock ? (
                    <NextBlockCard block={nextScheduleBlock} />
                ) : (
                    <EmptyBlockCard />
                )}

                {/* Tasks */}
                <TasksCard
                    count={pendingTasksCount}
                    tasks={topTasks}
                    onPress={() => router.push('/tasks')}
                />

                {/* Quick Actions */}
                <QuickActions
                    onTasks={() => router.push('/tasks')}
                    onSchedule={() => router.push('/schedule')}
                    onWorkspaces={() => router.push('/workspaces')}
                    onRefresh={refresh}
                />

                {/* Backend indicator */}
                <View style={styles.backendRow}>
                    <Text style={styles.backendLabel}>Backend</Text>
                    <Text style={styles.backendValue}>{BACKEND_BASE}</Text>
                </View>
            </ScrollView>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },

    // Header
    header: { marginBottom: 24 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    cloudBadge: {
        backgroundColor: '#1a3a1a',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#2d6a2d',
    },
    cloudBadgeText: { color: '#4ade80', fontSize: 11, fontWeight: '700' },
    greeting: { color: '#888', fontSize: 16, marginBottom: 4 },
    workspaceName: { color: '#666', fontSize: 13 },

    // Error
    errorBanner: {
        backgroundColor: '#3b1010',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ef4444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
    errorRetry: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginLeft: 8 },

    // Loading
    loadingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 10,
    },
    loadingText: { color: '#888', fontSize: 14 },

    // Card base
    card: {
        backgroundColor: '#1a1a1a',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#252525',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel: {
        color: '#aeb4ff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },

    // Block card
    blockRow: { flexDirection: 'row', alignItems: 'center' },
    blockDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
    blockInfo: { flex: 1 },
    blockTitle: { color: '#ddd', fontSize: 17, fontWeight: '600', marginBottom: 4 },
    blockTime: { color: '#888', fontSize: 13 },
    blockMeta: { color: '#666', fontSize: 12, marginTop: 2 },
    emptyBlock: { alignItems: 'center', paddingVertical: 12 },
    emptyBlockTitle: { color: '#555', fontSize: 16, fontWeight: '600' },
    emptyBlockSub: { color: '#444', fontSize: 12, marginTop: 4 },

    // Tasks card
    badge: {
        backgroundColor: '#6872c6',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
        marginBottom: 12,
    },
    badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    emptyTasksText: { color: '#555', fontSize: 14 },
    taskList: { gap: 8 },
    taskRow: { flexDirection: 'row', alignItems: 'center' },
    taskBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6872c6', marginRight: 10 },
    taskText: { color: '#ccc', fontSize: 14, flex: 1 },
    moreText: { color: '#666', fontSize: 12, marginTop: 6, fontStyle: 'italic' },

    // Quick actions
    actionsCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#252525',
    },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    actionBtn: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#111',
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    actionIcon: { fontSize: 22, marginBottom: 6 },
    actionLabel: { color: '#ccc', fontSize: 13, fontWeight: '600' },

    // Backend
    backendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    backendLabel: { color: '#444', fontSize: 11 },
    backendValue: { color: '#444', fontSize: 11 },
});