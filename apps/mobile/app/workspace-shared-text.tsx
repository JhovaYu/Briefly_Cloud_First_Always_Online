/**
 * Workspace Shared Text screen — PM-07B.3
 *
 * Reads and edits the workspace shared text.
 * All saves are explicit (no autosave, no onBlur save).
 */

import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';
import { useSharedText } from '../src/hooks/useSharedText';

const MAX_CHARS = 50000;

export default function WorkspaceSharedTextScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { loading: authLoading, getAccessToken } = useAuth();

    const {
        isLoading,
        loadError,
        content,
        lastSavedContent,
        isSaving,
        saveError,
        canSave,
        setContent,
        reload,
        save,
    } = useSharedText({ workspaceId: id, getAccessToken });

    if (authLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#aeb4ff" size="large" />
            </View>
        );
    }

    if (!id) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Texto Compartido</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>ID de workspace no proporcionado</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
                        <Text style={styles.retryBtnText}>Volver</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Texto Compartido</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.subtitleRow}>
                <Text style={styles.subtitle}>
                    Texto simple compartido con escritorio. El formato avanzado permanece en
                    escritorio.
                </Text>
            </View>

            {/* Load error */}
            {loadError && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{loadError}</Text>
                    <TouchableOpacity onPress={reload}>
                        <Text style={styles.errorRetry}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Save error */}
            {saveError && (
                <View style={styles.saveErrorBanner}>
                    <Text style={styles.saveErrorText}>{saveError}</Text>
                </View>
            )}

            {/* Editor area */}
            <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={styles.editorScrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.editorContainer}>
                    <TextInput
                        style={styles.editor}
                        multiline
                        placeholder={isLoading ? 'Cargando...' : 'Escribe aqui...'}
                        placeholderTextColor="#555"
                        value={content}
                        onChangeText={setContent}
                        maxLength={MAX_CHARS}
                        editable={!isLoading && !loadError}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            {/* Footer: counter + save */}
            <View style={styles.footer}>
                <Text style={styles.counter}>
                    {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </Text>

                <TouchableOpacity
                    style={[styles.saveBtn, (!canSave && !isSaving) && styles.saveBtnDisabled]}
                    onPress={save}
                    disabled={!canSave}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.saveBtnText}>
                            {content !== lastSavedContent ? 'Guardar' : 'Guardado'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backBtnText: { color: '#aeb4ff', fontSize: 24 },
    title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    placeholder: { width: 40 },
    subtitleRow: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    subtitle: {
        color: '#555',
        fontSize: 13,
        lineHeight: 18,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#3b1010',
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    errorBannerText: { color: '#ef4444', fontSize: 13, flex: 1 },
    errorRetry: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginLeft: 8 },
    errorText: { color: '#ef4444', fontSize: 15, marginBottom: 16 },
    retryBtn: {
        backgroundColor: '#252525',
        borderRadius: 10,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    retryBtnText: { color: '#aeb4ff', fontWeight: 'bold', fontSize: 15 },
    saveErrorBanner: {
        backgroundColor: '#3b1010',
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    saveErrorText: { color: '#ef4444', fontSize: 13 },
    editorScroll: { flex: 1 },
    editorScrollContent: { flexGrow: 1 },
    editorContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    editor: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        color: '#ddd',
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        lineHeight: 22,
        borderWidth: 1,
        borderColor: '#252525',
        minHeight: 300,
        maxHeight: 500,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
    },
    counter: { color: '#555', fontSize: 13 },
    saveBtn: {
        backgroundColor: '#6872c6',
        borderRadius: 10,
        paddingHorizontal: 24,
        paddingVertical: 12,
        minWidth: 100,
        alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
