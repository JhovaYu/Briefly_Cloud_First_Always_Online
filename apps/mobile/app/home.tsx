import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/services/AuthContext';
import { useTodaySummary } from '../src/hooks/useTodaySummary';
import { useTheme } from '../src/hooks/useTheme';
import { getLocalDateString } from '../src/utils/dateUtils';
import { Card } from '../src/components/ui/Card';
import { useActiveWorkspace } from '../src/hooks/useActiveWorkspace';
import { BottomNav } from '../src/components/ui/BottomNav';

function getGreeting(name: string | undefined): string {
    const firstName = name ? name.split(' ')[0] : 'Usuario';
    return `Hola, ${firstName}`;
}

export default function HomeScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const theme = useTheme();
    const {
        loading,
        refresh,
        nextScheduleBlock,
        pendingTasksCount,
        topTasks,
    } = useTodaySummary();

    const dateLabel = new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(new Date());
    const formattedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

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
            <StatusBar style="light" />
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.primary} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Ionicons name="infinite-outline" size={32} color={theme.primary} />
                        <TouchableOpacity>
                            <Ionicons name="notifications-outline" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.greeting, { color: theme.text }]} numberOfLines={1}>
                        {getGreeting(user?.email?.split('@')[0])}
                    </Text>
                    <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{formattedDate}</Text>
                </View>

                {/* Tareas pendientes */}
                <Card style={styles.sectionCard} padding={0}>
                    <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push('/tasks')}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.textSecondary} />
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tareas pendientes</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                            <Text style={styles.badgeText}>{pendingTasksCount}</Text>
                        </View>
                    </TouchableOpacity>
                    
                    <View style={styles.taskList}>
                        {topTasks && topTasks.length > 0 ? (
                            topTasks.map((task, index) => (
                                <TouchableOpacity key={task.id} style={styles.taskItem}>
                                    <View style={styles.taskLeft}>
                                        <Ionicons name="ellipse-outline" size={22} color={theme.textMuted} />
                                        <Text style={[styles.taskText, { color: theme.text }]} numberOfLines={1}>{task.text}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>Sin tareas pendientes</Text>
                            </View>
                        )}
                    </View>
                </Card>

                {/* Próximo evento */}
                <Card style={styles.sectionCard} padding={0}>
                    <TouchableOpacity style={styles.sectionHeader} onPress={() => router.push('/schedule')}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Próximo evento</Text>
                        </View>
                    </TouchableOpacity>
                    
                    <View style={styles.eventContainer}>
                        {nextScheduleBlock ? (
                            <View style={styles.eventItem}>
                                <View style={styles.eventLeft}>
                                    <View style={[styles.eventDot, { backgroundColor: nextScheduleBlock.color || theme.primary }]} />
                                    <View>
                                        <Text style={[styles.eventTitle, { color: theme.text }]}>{nextScheduleBlock.title}</Text>
                                        <View style={styles.eventMetaRow}>
                                            <Text style={[styles.eventMeta, { color: theme.textMuted }]}>
                                                {nextScheduleBlock.location ? `${nextScheduleBlock.location}  ·  ` : ''}
                                                {nextScheduleBlock.start_time} - {nextBlockEnd}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={[styles.durationBadge, { backgroundColor: theme.surfaceHighlight }]}>
                                    <Text style={[styles.durationText, { color: theme.text }]}>{nextScheduleBlock.duration_minutes} min</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay eventos próximos hoy</Text>
                            </View>
                        )}
                    </View>
                </Card>

                {/* Grupos recientes */}
                <View style={styles.recentGroupsHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Grupos recientes</Text>
                    <TouchableOpacity onPress={() => router.push('/workspaces')}>
                        <Text style={[styles.seeAllText, { color: theme.primary }]}>Ver todos</Text>
                    </TouchableOpacity>
                </View>
                
                {/* For MVP we don't have recent groups fetched in useTodaySummary. We can either show a generic card or tell user to navigate to groups. Mockup shows 3 static or dynamic cards. Let's add a placeholder to match mockup visually. */}
                <Card style={styles.groupCard} padding={16}>
                    <TouchableOpacity style={styles.groupItem} onPress={() => router.push('/workspaces')}>
                        <View style={[styles.groupIconContainer, { backgroundColor: 'rgba(126, 108, 250, 0.15)' }]}>
                            <Ionicons name="book" size={24} color={theme.groupColors.purple} />
                        </View>
                        <View style={styles.groupInfo}>
                            <Text style={[styles.groupTitle, { color: theme.text }]}>Ir a mis Grupos</Text>
                            <Text style={[styles.groupMeta, { color: theme.textMuted }]}>Ver todos los grupos de estudio</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                </Card>

            </ScrollView>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 10, paddingBottom: 20 },
    header: { marginBottom: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    greeting: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
    dateLabel: { fontSize: 13 },
    
    sectionCard: { marginBottom: 20, overflow: 'hidden' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '600' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    
    taskList: { padding: 8 },
    taskItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10 },
    taskLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    taskText: { fontSize: 15, flex: 1 },
    emptyContainer: { padding: 16, alignItems: 'center', justifyContent: 'center' },
    emptyText: { textAlign: 'center', fontSize: 14 },

    eventContainer: { padding: 16 },
    eventItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    eventLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    eventDot: { width: 8, height: 8, borderRadius: 4 },
    eventTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    eventMetaRow: { flexDirection: 'row', alignItems: 'center' },
    eventMeta: { fontSize: 13 },
    durationBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    durationText: { fontSize: 12, fontWeight: '600' },

    recentGroupsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
    seeAllText: { fontSize: 14, fontWeight: '600' },
    groupCard: { marginBottom: 12 },
    groupItem: { flexDirection: 'row', alignItems: 'center' },
    groupIconContainer: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    groupInfo: { flex: 1 },
    groupTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    groupMeta: { fontSize: 13 },
});
