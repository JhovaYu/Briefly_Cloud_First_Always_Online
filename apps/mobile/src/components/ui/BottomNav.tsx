import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();

    const tabs = [
        { name: 'Inicio', path: '/home', icon: 'home' },
        { name: 'Hoy', path: '/today', icon: 'calendar' },
        { name: 'Tareas', path: '/tasks', icon: 'checkmark-circle' },
        { name: 'Grupos', path: '/workspaces', icon: 'folder' },
    ] as const;

    return (
        <View style={[styles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            {tabs.map((tab) => {
                const isActive = pathname === tab.path || (pathname === '/' && tab.path === '/home');
                return (
                    <TouchableOpacity
                        key={tab.name}
                        style={styles.tab}
                        onPress={() => router.replace(tab.path)}
                    >
                        <Ionicons 
                            name={isActive ? tab.icon as any : `${tab.icon}-outline` as any} 
                            size={24} 
                            color={isActive ? theme.primary : theme.textMuted} 
                        />
                        <Text style={[styles.label, { color: isActive ? theme.primary : theme.textMuted }]}>
                            {tab.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        borderTopWidth: 1,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    label: {
        fontSize: 10,
        fontWeight: '500',
    }
});
