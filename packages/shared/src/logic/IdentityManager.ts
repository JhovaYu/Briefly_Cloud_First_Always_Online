import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class IdentityManager {
    private static _supabaseClient: SupabaseClient | null = null;

    /**
     * Inicializa la conexión a Supabase Cloud usando las credenciales del frontend.
     */
    static initializeCloud(url: string, key: string): SupabaseClient {
        if (!this._supabaseClient) {
            this._supabaseClient = createClient(url, key);
        }
        return this._supabaseClient;
    }

    /**
     * Retorna el cliente de Supabase si ya ha sido inicializado.
     */
    static get cloudClient(): SupabaseClient | null {
        return this._supabaseClient;
    }
}
