import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, SafeAreaView, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getUserProfile, saveUserProfile, getSavedPools, addPool, updatePoolLastOpened, removePool } from '../src/storage';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
// @ts-ignore
import type { UserProfile, PoolInfo } from '@tuxnotas/shared';

// Extend profile locally just in case
type LocalProfile = UserProfile & { avatarUri?: string };

export default function Index() {
    const router = useRouter();
    const { settings } = useApp();
    const sf = settings.fontSizeMultiplier; // scale factor

    const [profile, setProfile] = useState<LocalProfile | null>(null);
    const [name, setName] = useState('');
    const [pools, setPools] = useState<PoolInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [newPoolName, setNewPoolName] = useState('');
    const [joinId, setJoinId] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        (async () => {
            const p = await getUserProfile();
            setProfile(p as LocalProfile);
            setLoading(false);
        })();
    }, []);

    useFocusEffect(
        useCallback(() => {
            getSavedPools().then(setPools);
            getUserProfile().then(p => { if (p) setProfile(p as LocalProfile) });
        }, [])
    );

    const handleCreateProfile = async () => {
        if (!name.trim()) return;
        const newProfile: LocalProfile = {
            id: Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            createdAt: Date.now(),
        };
        await saveUserProfile(newProfile);
        setProfile(newProfile);
    };

    const handleCreatePool = async () => {
        const poolId = `pool-${Math.random().toString(36).substr(2, 9)}`;
        const pool: PoolInfo = {
            id: poolId,
            name: newPoolName.trim() || 'Mi espacio',
            icon: 'workspace',
            lastOpened: Date.now(),
            createdAt: Date.now(),
        };
        await addPool(pool);
        setCreating(false);
        setNewPoolName('');
        await loadPools();
        router.push({ pathname: `/${poolId}`, params: { name: pool.name } });
    };

    const loadPools = async () => {
        setPools(await getSavedPools());
    };

    const handleJoinPool = async () => {
        if (!joinId.trim()) return;

        let input = joinId.trim();
        let poolId = input;
        let signalingUrl: string | undefined = undefined;

        if (input.includes('@')) {
            const parts = input.split('@');
            poolId = parts[0];
            signalingUrl = `ws://${parts[1]}:4444`;
        }

        const existingPools = await getSavedPools();
        const match = existingPools.find(p => p.id === poolId);

        const pool: PoolInfo = {
            id: poolId,
            name: match ? match.name : poolId,
            icon: 'collab',
            lastOpened: Date.now(),
            createdAt: match ? match.createdAt : Date.now(),
            signalingUrl: signalingUrl || (match ? match.signalingUrl : undefined)
        };

        await addPool(pool);
        setJoinId('');
        await loadPools();

        router.push({ pathname: `/${poolId}`, params: { signalingUrl: pool.signalingUrl, name: pool.name } });
    };

    const openPool = async (pool: PoolInfo) => {
        await updatePoolLastOpened(pool.id);
        router.push({ pathname: `/${pool.id}`, params: { signalingUrl: pool.signalingUrl, name: pool.name } });
    };

    const handleOptionsPool = (pool: PoolInfo) => {
        Alert.alert('Opciones de Espacio', pool.name, [
            {
                text: 'Copiar ID para compartir', onPress: async () => {
                    await Clipboard.setStringAsync(pool.id);
                    Alert.alert('ID copiado al portapapeles');
                }
            },
            {
                text: 'Eliminar espacio', style: 'destructive', onPress: async () => {
                    await removePool(pool.id);
                    loadPools();
                }
            },
            { text: 'Cancelar', style: 'cancel' }
        ]);
    };

    if (loading) return <View style={styles.center}><Text style={{ color: '#fff', fontSize: 14 * sf }}>Cargando...</Text></View>;

    if (!profile) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <Text style={[styles.title, { fontSize: 28 * sf }]}>Bienvenido a Fluent</Text>
                    <Text style={[styles.subtitle, { fontSize: 16 * sf }]}>Configura tu perfil</Text>
                    <TextInput
                        style={[styles.input, { fontSize: 14 * sf }]}
                        placeholder="Tu nombre"
                        placeholderTextColor="#888"
                        value={name}
                        onChangeText={setName}
                    />
                    <TouchableOpacity style={styles.button} onPress={handleCreateProfile}>
                        <Text style={[styles.buttonText, { fontSize: 16 * sf }]}>Comenzar</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.headerTitle, { fontSize: 20 * sf }]}>Hola, {profile.name}</Text>
                    <Text style={{ color: '#888', fontSize: 12 * sf }}>Tus espacios</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.push('/profile')}>
                        <Ionicons name="settings-outline" size={26 * sf} color="#ccc" />
                    </TouchableOpacity>
                    {profile.avatarUri ? (
                        <Image source={{ uri: profile.avatarUri }} style={[styles.avatar, { width: 44 * sf, height: 44 * sf, borderRadius: 22 * sf }]} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: profile.color, width: 44 * sf, height: 44 * sf, borderRadius: 22 * sf }]} />
                    )}
                </View>
            </View>

            <FlatList
                data={pools}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                ListHeaderComponent={
                    <View style={{ gap: 12, marginBottom: 20 }}>
                        {creating ? (
                            <View style={styles.card}>
                                <TextInput style={[styles.input, { fontSize: 14 * sf }]} placeholderTextColor="#666" placeholder="Nombre del espacio..." autoFocus value={newPoolName} onChangeText={setNewPoolName} />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={handleCreatePool}><Text style={[styles.buttonText, { fontSize: 14 * sf }]}>Crear</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.buttonSecondary, { flex: 1 }]} onPress={() => setCreating(false)}><Text style={[styles.buttonTextSecondary, { fontSize: 14 * sf }]}>Cancelar</Text></TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.cardNew} onPress={() => setCreating(true)}>
                                <Text style={[styles.cardNewText, { fontSize: 14 * sf }]}>+ Crear nuevo espacio</Text>
                            </TouchableOpacity>
                        )}

                        <View style={[styles.card, { marginTop: 10 }]}>
                            <Text style={{ color: '#fff', fontSize: 13 * sf, marginBottom: 8, opacity: 0.7 }}>Unirse a espacio</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TextInput style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 14 * sf }]} placeholderTextColor="#666" placeholder="ID o ID@IP" value={joinId} onChangeText={setJoinId} />
                                <TouchableOpacity style={styles.buttonSecondary} onPress={handleJoinPool}><Text style={[styles.buttonTextSecondary, { fontSize: 14 * sf }]}>Unirse</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.cardPool} onPress={() => openPool(item)} onLongPress={() => handleOptionsPool(item)}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.poolName, { fontSize: 16 * sf }]}>{item.name}</Text>
                            <Text style={[styles.poolId, { fontSize: 12 * sf }]} numberOfLines={1}>{item.id}</Text>
                        </View>
                        <Text style={[styles.poolDate, { fontSize: 12 * sf, marginLeft: 10 }]}>{new Date(item.lastOpened).toLocaleDateString()}</Text>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    subtitle: { color: '#aaa', marginBottom: 32 },
    input: { backgroundColor: '#222', borderRadius: 8, padding: 12, color: '#fff', width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#333' },
    button: { backgroundColor: '#fff', borderRadius: 8, padding: 12, width: '100%', alignItems: 'center' },
    buttonText: { color: '#000', fontWeight: 'bold' },
    buttonSecondary: { backgroundColor: '#333', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center' },
    buttonTextSecondary: { color: '#fff' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTitle: { fontWeight: 'bold', color: '#fff' },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    card: { backgroundColor: '#1a1a1a', padding: 16, borderRadius: 12, marginBottom: 0 },
    cardNew: { backgroundColor: '#111', padding: 16, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#444' },
    cardNewText: { color: '#ccc', fontWeight: '500' },
    cardPool: { backgroundColor: '#1a1a1a', padding: 16, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    poolName: { color: '#fff', fontWeight: '600' },
    poolId: { color: '#666', marginTop: 4 },
    poolDate: { color: '#666' }
});
