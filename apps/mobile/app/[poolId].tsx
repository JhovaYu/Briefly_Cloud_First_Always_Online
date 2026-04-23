import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Task, TaskList, TaskService } from '@tuxnotas/shared';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Awareness } from 'y-protocols/awareness';
import { StatusBar } from 'expo-status-bar';

export default function PoolDetail() {
    const { poolId, name, signalingUrl } = useLocalSearchParams();
    const router = useRouter();
    const [doc] = useState(() => new Y.Doc());
    const [taskService] = useState(() => new TaskService(doc));
    const [provider, setProvider] = useState<WebrtcProvider | null>(null);

    const [activeListId, setActiveListId] = useState<string | null>(null);
    const [tick, setTick] = useState(0); // <-- Triggers re-render when Yjs updates

    // ... state ...
    const [newTaskText, setNewTaskText] = useState('');
    const [newListName, setNewListName] = useState('');
    const [creatingList, setCreatingList] = useState(false);

    useEffect(() => {
        if (!poolId) return;

        // Connect to signaling server
        const url = signalingUrl as string || 'ws://localhost:4444'; // Fallback
        console.log('Connecting to', url);

        const prov = new WebrtcProvider(poolId as string, doc, {
            signaling: [url],
            password: undefined,
            awareness: new Awareness(doc),
            maxConns: 20 + Math.floor(Math.random() * 15),
            filterBcConns: false,
            peerOpts: {}
        });
        setProvider(prov);

        const updateHandler = () => {
            // Simply trigger a re-render on any Yjs update
            setTick(t => t + 1);
        };

        doc.on('update', updateHandler);

        return () => {
            prov.destroy();
            doc.off('update', updateHandler);
        };
    }, [poolId, signalingUrl, doc]);

    // Synchronously derive reactive data on every render (no stale closures!)
    const taskLists = taskService.getTaskLists(poolId as string);
    const tasks = activeListId ? taskService.getTasks(activeListId) : [];

    // Automatically select first list if none is selected
    useEffect(() => {
        if (!activeListId && taskLists.length > 0) {
            setActiveListId(taskLists[0].id);
        }
    }, [activeListId, taskLists]);

    const handleAddTask = () => {
        if (!newTaskText.trim() || !activeListId) return;
        taskService.addTask(activeListId, newTaskText.trim());
        setNewTaskText('');
    };

    const handleToggleTask = (task: Task) => {
        const newState = task.state === 'done' ? 'pending' : 'done';
        taskService.updateTask(task.id, { state: newState });
    };

    const handleCreateList = () => {
        if (!newListName.trim()) return;
        const list = taskService.createTaskList(newListName.trim(), poolId as string);
        setNewListName('');
        setCreatingList(false);
        setActiveListId(list.id);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: name as string || 'Espacio', headerStyle: { backgroundColor: '#111' }, headerTintColor: '#fff', headerTitleStyle: { fontSize: 18 * sf } }} />
            <StatusBar style="light" />

            {/* Horizontal List Selector */}
            <View style={{ height: 50 * sf, borderBottomWidth: 1, borderBottomColor: '#222' }}>
                <ScrollView horizontal contentContainerStyle={{ padding: 8, gap: 8 }}>
                    {taskLists.map(list => (
                        <TouchableOpacity
                            key={list.id}
                            style={[styles.tab, activeListId === list.id && styles.activeTab]}
                            onPress={() => setActiveListId(list.id)}>
                            <Text style={[styles.tabText, { fontSize: 12 * sf }, activeListId === list.id && styles.activeTabText]}>{list.name}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.tab} onPress={() => setCreatingList(true)}>
                        <Text style={[styles.tabText, { fontSize: 12 * sf }]}>+ Nueva lista</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {creatingList && (
                <View style={[styles.creationBar, { padding: 10 * sf }]}>
                    <TextInput style={[styles.input, { fontSize: 14 * sf }]} placeholder="Nombre de lista..." placeholderTextColor="#666" value={newListName} onChangeText={setNewListName} autoFocus />
                    <TouchableOpacity onPress={handleCreateList}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 * sf }}>OK</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setCreatingList(false)}><Text style={{ color: '#aaa', marginLeft: 16 * sf, fontSize: 14 * sf }}>X</Text></TouchableOpacity>
                </View>
            )}

            {/* Tasks */}
            <View style={{ flex: 1, padding: 16 }}>
                {!activeListId ? (
                    <View style={styles.center}>
                        <Text style={{ color: '#666', fontSize: 14 * sf }}>Selecciona o crea una lista de tareas</Text>
                    </View>
                ) : (
                    <ScrollView>
                        {tasks.length === 0 && <Text style={{ color: '#444', textAlign: 'center', marginTop: 20 * sf, fontSize: 14 * sf }}>No hay tareas</Text>}
                        {tasks.map(task => (
                            <TouchableOpacity key={task.id} style={styles.taskItem} onPress={() => handleToggleTask(task)}>
                                <View style={[styles.checkbox, { width: 20 * sf, height: 20 * sf, borderRadius: 10 * sf }, task.state === 'done' && styles.checkboxChecked]}>
                                    {task.state === 'done' && <Text style={{ color: '#000', fontSize: 10 * sf }}>✓</Text>}
                                </View>
                                <Text style={[styles.taskText, { fontSize: 16 * sf }, task.state === 'done' && styles.taskTextDone]}>{task.text}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Add Task Bar */}
            {activeListId && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
                    <View style={[styles.footer, { padding: 12 * sf }]}>
                        <TextInput
                            style={[styles.taskInput, { fontSize: 14 * sf, borderRadius: 20 * sf, paddingHorizontal: 16 * sf, paddingVertical: 8 * sf }]}
                            placeholder="Escribe una tarea..."
                            placeholderTextColor="#666"
                            value={newTaskText}
                            onChangeText={setNewTaskText}
                            onSubmitEditing={handleAddTask}
                        />
                        <TouchableOpacity style={[styles.sendButton, { width: 32 * sf, height: 32 * sf, borderRadius: 16 * sf }]} onPress={handleAddTask}>
                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 * sf }}>+</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#222' },
    activeTab: { backgroundColor: '#fff' },
    tabText: { color: '#ccc' },
    activeTabText: { color: '#000', fontWeight: 'bold' },

    creationBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222' },
    input: { flex: 1, color: '#fff', padding: 0 },

    taskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
    checkbox: { borderWidth: 2, borderColor: '#444', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: '#fff', borderColor: '#fff' },
    taskText: { color: '#eee' },
    taskTextDone: { color: '#666', textDecorationLine: 'line-through' },

    footer: { backgroundColor: '#1a1a1a', flexDirection: 'row', alignItems: 'center', gap: 10 },
    taskInput: { flex: 1, backgroundColor: '#222', color: '#fff' },
    sendButton: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }
});
