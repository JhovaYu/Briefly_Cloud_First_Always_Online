import { useQuery } from '@tanstack/react-query';
import { fetchWorkspacesWithAuth } from '../services/workspaceClient';

/**
 * useWorkspaces — fetches the list of workspaces for the current user.
 * Uses fetchWithAuth (supabase.auth.getSession) per request for a fresh token.
 */
export function useWorkspaces() {
    return useQuery({
        queryKey: ['workspaces'],
        queryFn: fetchWorkspacesWithAuth,
    });
}
