import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/AppContext';
import { AuthProvider } from '../src/services/AuthContext';
import * as QuickActions from 'expo-quick-actions';
import { router } from 'expo-router';
import { Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import type { Action } from 'expo-quick-actions';

// ── Quick Actions Definitions ───────────────────────────────────────────────

type RouterAction = Action & { params: { href: string } };

const QUICK_ACTIONS: RouterAction[] = Platform.select<RouterAction[]>({
    android: [
        { id: 'today',    title: 'Hoy',      icon: 'home',    params: { href: '/today' } },
        { id: 'tasks',    title: 'Tareas',    icon: 'task',    params: { href: '/tasks' } },
        { id: 'schedule', title: 'Horario',   icon: 'date',    params: { href: '/schedule' } },
    ],
    default: [],
});

// ── Setup ───────────────────────────────────────────────────────────────────

async function setupQuickActions() {
    try {
        const supported = await QuickActions.isSupported();
        if (!supported) return;
        await QuickActions.setItems(QUICK_ACTIONS);
    } catch {
        // Non-critical — skip silently
    }
}

// ── Root Layout ─────────────────────────────────────────────────────────────

export default function Layout() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Register quick actions and listen for invocations
        setupQuickActions().then(() => setReady(true));

        if (!QUICK_ACTIONS.length) return;

        // Handle cold-start quick action (app was closed, opened via shortcut)
        const initial = (QuickActions as any).initial as RouterAction | undefined;
        if (initial?.params?.href) {
            // Defer navigation until after auth is ready
            const timer = setTimeout(() => {
                router.navigate(initial.params.href);
            }, 500);
            return () => clearTimeout(timer);
        }

        // Listen for future quick actions (warm/hot start)
        const sub = QuickActions.addListener((action: RouterAction) => {
            if (action?.params?.href) {
                router.navigate(action.params.href);
            }
        });

        return () => sub.remove();
    }, []);

    return (
        <AppProvider>
            <AuthProvider>
                <SafeAreaProvider>
                    <SafeAreaView style={{ flex: 1 }}>
                        <StatusBar style="auto" />
                        {ready ? (
                            <Stack screenOptions={{ headerShown: false }} />
                        ) : (
                            <View style={styles.loading}>
                                <ActivityIndicator color="#aeb4ff" size="large" />
                            </View>
                        )}
                    </SafeAreaView>
                </SafeAreaProvider>
            </AuthProvider>
        </AppProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
    },
});