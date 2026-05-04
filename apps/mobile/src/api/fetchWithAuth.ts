import { supabase } from '../services/supabase';

/**
 * Fetch wrapper that injects a fresh Supabase access token per request.
 * Called by REST clients before each API call.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Unauthorized');
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  const hasBody = options.body !== undefined;
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Unauthorized');
  }

  return response;
}
