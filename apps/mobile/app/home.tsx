import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useAuth } from '../src/services/AuthContext';

const BACKEND_BASE =
    (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://briefly.ddns.net');

interface HealthResult {
  name: string;
  url: string;
  status: 'idle' | 'loading' | 'ok' | 'error';
  latency?: number;
  error?: string;
}

const ENDPOINTS: Pick<HealthResult, 'name' | 'url'>[] = [
  { name: 'Frontend / Nginx', url: `${BACKEND_BASE}/health` },
  { name: 'Workspace Service', url: `${BACKEND_BASE}/api/workspace/health` },
  { name: 'Planning Service', url: `${BACKEND_BASE}/api/planning/health` },
  { name: 'Schedule Service', url: `${BACKEND_BASE}/api/schedule/health` },
];

async function checkOne(endpoint: Pick<HealthResult, 'name' | 'url'>): Promise<HealthResult> {
  const start = Date.now();
  try {
    const resp = await fetch(endpoint.url, { method: 'GET' });
    return {
      ...endpoint,
      status: resp.ok ? 'ok' : 'error',
      latency: Date.now() - start,
      error: resp.ok ? undefined : `HTTP ${resp.status}`,
    };
  } catch (err: any) {
    return {
      ...endpoint,
      status: 'error',
      latency: Date.now() - start,
      error: err?.message ?? 'network error',
    };
  }
}

function TodayButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.todayButton} onPress={onPress}>
      <Text style={styles.todayButtonText}>Hoy</Text>
    </TouchableOpacity>
  );
}

function TasksButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tasksButton} onPress={onPress}>
      <Text style={styles.tasksButtonText}>Tareas</Text>
    </TouchableOpacity>
  );
}

function WorkspacesButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.workspacesButton} onPress={onPress}>
      <Text style={styles.workspacesButtonText}>Espacios cloud</Text>
    </TouchableOpacity>
  );
}

function ScheduleButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.scheduleButton} onPress={onPress}>
      <Text style={styles.scheduleButtonText}>Horarios</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [results, setResults] = useState<HealthResult[]>([]);
  const [running, setRunning] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      runChecks();
    }, [])
  );

  const runChecks = useCallback(async () => {
    setRunning(true);
    setResults(ENDPOINTS.map(e => ({ ...e, status: 'loading' })));
    const fetched = await Promise.all(ENDPOINTS.map(e => checkOne(e)));
    setResults(fetched);
    setRunning(false);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    router.replace('/login');
  };

  const allOk = results.length > 0 && results.every(r => r.status === 'ok');
  const anyError = results.length > 0 && results.some(r => r.status === 'error');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Briefly</Text>
        <Text style={styles.subtitle}>Backend Health Check</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Usuario</Text>
          <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Backend</Text>
          <Text style={styles.infoValue}>{BACKEND_BASE}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, running && styles.buttonDisabled]}
          onPress={runChecks}
          disabled={running}
        >
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verificar servicios</Text>
          )}
        </TouchableOpacity>

        <TodayButton onPress={() => router.push('/today')} />
        <TasksButton onPress={() => router.push('/tasks')} />
        <WorkspacesButton onPress={() => router.push('/workspaces')} />
        <ScheduleButton onPress={() => router.push('/schedule')} />

        {results.length > 0 && (
          <View style={styles.results}>
            {results.map((r) => (
              <View key={r.name} style={[
                styles.resultRow,
                r.status === 'ok' ? styles.resultOk :
                r.status === 'error' ? styles.resultError :
                styles.resultLoading
              ]}>
                <View style={styles.resultLeft}>
                  <Text style={styles.resultName}>{r.name}</Text>
                  <Text style={styles.resultUrl}>{r.url}</Text>
                </View>
                <View style={styles.resultRight}>
                  {r.status === 'loading' && <ActivityIndicator color="#aeb4ff" size="small" />}
                  {r.status === 'ok' && (
                    <Text style={styles.resultOkText}>OK {r.latency != null ? `${r.latency}ms` : ''}</Text>
                  )}
                  {r.status === 'error' && (
                    <Text style={styles.resultErrorText}>{r.error ?? 'ERROR'}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {results.length > 0 && !running && (
          <View style={styles.summary}>
            {allOk ? (
              <Text style={styles.summaryOk}>Todos los servicios responden</Text>
            ) : anyError ? (
              <Text style={styles.summaryError}>Algunos servicios no responden</Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#aeb4ff', marginBottom: 32 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: '#666', fontSize: 14 },
  infoValue: { color: '#ccc', fontSize: 14 },
  button: { backgroundColor: '#6872c6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  todayButton: { backgroundColor: '#6872c6', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 32 },
  todayButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  tasksButton: { backgroundColor: '#252525', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#333' },
  tasksButtonText: { color: '#aeb4ff', fontWeight: 'bold', fontSize: 16 },
  workspacesButton: { backgroundColor: '#252525', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#333' },
  workspacesButtonText: { color: '#aeb4ff', fontWeight: 'bold', fontSize: 16 },
  scheduleButton: { backgroundColor: '#252525', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#333' },
  scheduleButtonText: { color: '#aeb4ff', fontWeight: 'bold', fontSize: 16 },
  results: { gap: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 10, backgroundColor: '#1a1a1a' },
  resultOk: { borderLeftWidth: 3, borderLeftColor: '#10b981' },
  resultError: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  resultLoading: { borderLeftWidth: 3, borderLeftColor: '#aeb4ff' },
  resultLeft: { flex: 1 },
  resultName: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  resultUrl: { color: '#555', fontSize: 11 },
  resultRight: { alignItems: 'flex-end', minWidth: 80 },
  resultOkText: { color: '#10b981', fontSize: 13, fontWeight: '600' },
  resultErrorText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  summary: { marginTop: 24, alignItems: 'center' },
  summaryOk: { color: '#10b981', fontSize: 15, fontWeight: '600' },
  summaryError: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  logoutButton: { marginTop: 32, borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
