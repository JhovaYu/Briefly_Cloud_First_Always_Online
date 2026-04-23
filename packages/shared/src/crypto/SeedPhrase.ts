import { generateMnemonic, validateMnemonic } from 'bip39';
import { sha256 } from 'js-sha256';

/**
 * SeedPhrase: Generación de 12 palabras y derivación de identidades.
 */
export class SeedPhrase {
    
    /**
     * Genera una nueva frase semilla de 12 palabras.
     */
    static generate(): string {
        return generateMnemonic(128); // 128 bits de entropía = 12 palabras
    }

    /**
     * Valida si una cadena es una frase semilla BIP39 válida.
     */
    static isValid(phrase: string): boolean {
        return validateMnemonic(phrase.trim().toLowerCase());
    }

    /**
     * Deriva las credenciales del usuario a partir de su frase semilla.
     * @param phrase La frase de 12 palabras
     * @returns ID de usuario público, SyncPoolId (oculto) y Clave de encriptación
     */
    static deriveCredentials(phrase: string) {
        if (!this.isValid(phrase)) {
            throw new Error("Frase semilla inválida");
        }

        const normalized = phrase.trim().toLowerCase();
        
        // 1. User ID Público (para que otros lo vean)
        const userId = sha256(`briefly-user-id-${normalized}`).substring(0, 16);
        
        // 2. Sync Pool ID (el canal WebRTC oculto donde se sincronizarán sus metadatos)
        const syncPoolId = sha256(`briefly-sync-pool-${normalized}`);

        // 3. Encryption Key (para cifrar datos en el futuro)
        const encryptionKey = sha256(`briefly-encryption-${normalized}`);

        return {
            userId,
            syncPoolId,
            encryptionKey
        };
    }
}
