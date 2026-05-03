/**
 * useSharedText — reads and edits workspace shared text from the cloud.
 *
 * Rules:
 * - GET on mount.
 * - No PUT on mount, onChangeText, or onBlur.
 * - save() only runs on explicit user action and only if canSave is true.
 * - Empty string is a valid content value (user intentionally erased everything).
 * - If PUT fails, content is kept in memory and saveError is set.
 */

import { useState, useCallback, useEffect } from 'react';
import { createWorkspaceClient } from '../services/workspaceClient';

export interface SharedTextState {
    isLoading: boolean;
    loadError: string | null;
    content: string;
    lastSavedContent: string;
    isSaving: boolean;
    saveError: string | null;
    version: number | null;
    updatedAt: string | null;
    canSave: boolean;
}

export interface SharedTextActions {
    setContent: (text: string) => void;
    reload: () => Promise<void>;
    save: () => Promise<void>;
}

export type UseSharedText = (opts: {
    workspaceId: string | null | undefined;
    getAccessToken: () => string | null;
}) => SharedTextState & SharedTextActions;

const MAX_CHARS = 50000;

export const useSharedText: UseSharedText = ({ workspaceId, getAccessToken }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [content, setContentState] = useState('');
    const [lastSavedContent, setLastSavedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [version, setVersion] = useState<number | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;

        const token = getAccessToken();
        if (!token) return;

        setIsLoading(true);
        setLoadError(null);

        try {
            const client = createWorkspaceClient(getAccessToken);
            const data = await client.getSharedText(workspaceId);

            if (data !== null) {
                setContentState(data.content);
                setLastSavedContent(data.content);
            } else {
                // 404 — no shared text yet
                setContentState('');
                setLastSavedContent('');
            }
            setSaveError(null);
        } catch (err: any) {
            setLoadError(err?.message ?? 'Error loading shared text');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, getAccessToken]);

    useEffect(() => {
        load();
    }, [load]);

    const setContent = useCallback((text: string) => {
        if (text.length <= MAX_CHARS) {
            setContentState(text);
        }
    }, []);

    const save = useCallback(async () => {
        if (!workspaceId) return;
        if (isLoading || loadError || isSaving) return;
        if (content === lastSavedContent) return;
        if (content.length > MAX_CHARS) return;

        const token = getAccessToken();
        if (!token) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            const client = createWorkspaceClient(getAccessToken);
            await client.updateSharedText(workspaceId, content);
            setLastSavedContent(content);
            setSaveError(null);
        } catch (err: any) {
            setSaveError(err?.message ?? 'Error saving shared text');
        } finally {
            setIsSaving(false);
        }
    }, [workspaceId, isLoading, loadError, isSaving, content, lastSavedContent, getAccessToken]);

    const isDirty = content !== lastSavedContent;
    const canSave = !isLoading && !loadError && !isSaving && isDirty && content.length <= MAX_CHARS;

    return {
        isLoading,
        loadError,
        content,
        lastSavedContent,
        isSaving,
        saveError,
        version,
        updatedAt,
        canSave,
        setContent,
        reload: load,
        save,
    };
};
