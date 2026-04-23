export interface Identity {
    type: 'seed' | 'cloud';
    userId: string;
    // Para seed:
    seedPhrase?: string;
    encryptionKey?: string;
    syncPoolId?: string; // pool donde se listan sus cuadernos
    // Para cloud:
    email?: string;
    token?: string;
}
