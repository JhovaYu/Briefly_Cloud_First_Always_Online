import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface CreateModalProps {
    visible: boolean;
    onClose: () => void;
    onCreateWorkspace: (name: string) => Promise<void>;
    onJoinWorkspace: (code: string) => Promise<void>;
}

export function CreateModal({ visible, onClose, onCreateWorkspace, onJoinWorkspace }: CreateModalProps) {
    const theme = useTheme();
    const [mode, setMode] = useState<'menu' | 'create_group' | 'join_group'>('menu');
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetAndClose = () => {
        setMode('menu');
        setInputValue('');
        setError(null);
        onClose();
    };

    const handleSubmit = async () => {
        const val = inputValue.trim();
        if (!val) return;
        
        setLoading(true);
        setError(null);
        try {
            if (mode === 'create_group') {
                await onCreateWorkspace(val);
            } else if (mode === 'join_group') {
                await onJoinWorkspace(val);
            }
            resetAndClose();
        } catch (err: any) {
            setError(err?.message || 'Ocurrió un error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={resetAndClose}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={styles.overlay}
            >
                <TouchableWithoutFeedback onPress={resetAndClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                
                <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                    <View style={styles.handle} />
                    
                    {mode === 'menu' ? (
                        <>
                            <Text style={[styles.title, { color: theme.text }]}>Crear</Text>
                            
                            <View style={styles.optionsGrid}>
                                <TouchableOpacity 
                                    style={[styles.optionCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                                    onPress={() => setMode('create_group')}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(126, 108, 250, 0.15)' }]}>
                                        <Ionicons name="folder-outline" size={32} color={theme.primary} />
                                    </View>
                                    <Text style={[styles.optionTitle, { color: theme.text }]}>Grupo</Text>
                                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>Crear un nuevo espacio</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.optionCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                                    onPress={() => setMode('join_group')}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                                        <Ionicons name="link-outline" size={32} color={theme.success} />
                                    </View>
                                    <Text style={[styles.optionTitle, { color: theme.text }]}>Unirse</Text>
                                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>Con código UUID</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.headerRow}>
                                <TouchableOpacity onPress={() => { setMode('menu'); setError(null); setInputValue(''); }}>
                                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                                </TouchableOpacity>
                                <Text style={[styles.title, { color: theme.text, marginBottom: 0, marginLeft: 12 }]}>
                                    {mode === 'create_group' ? 'Nuevo Grupo' : 'Unirse a Grupo'}
                                </Text>
                            </View>

                            <TextInput
                                style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                                placeholder={mode === 'create_group' ? 'Nombre del grupo...' : 'Código UUID...'}
                                placeholderTextColor={theme.textMuted}
                                value={inputValue}
                                onChangeText={setInputValue}
                                autoFocus
                                onSubmitEditing={handleSubmit}
                            />

                            {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

                            <TouchableOpacity 
                                style={[styles.submitBtn, { backgroundColor: theme.primary }, (!inputValue.trim() || loading) && { opacity: 0.5 }]}
                                onPress={handleSubmit}
                                disabled={!inputValue.trim() || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.submitBtnText}>{mode === 'create_group' ? 'Crear' : 'Unirse'}</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        minHeight: 300,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
    optionsGrid: { flexDirection: 'row', gap: 16 },
    optionCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    optionSub: { fontSize: 12, textAlign: 'center' },
    
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 16,
    },
    error: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
    submitBtn: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
